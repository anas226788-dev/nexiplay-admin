import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface CachedDownload {
    data: any;
    expiresAt: number;
}

const downloadCache = new Map<string, CachedDownload>();
let manifestCache: { series: any[]; expiresAt: number } | null = null;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://toonplay.in/',
    'Origin': 'https://toonplay.in'
};

function cleanTitle(t: string): string {
    let clean = t.replace(/\(.*?\)/g, '');
    clean = clean.replace(/Season\s*\d+/gi, '');
    clean = clean.replace(/[^a-zA-Z0-9\s]/g, '');
    return clean.trim().toLowerCase();
}

function extractSeasonNumber(title: string, defaultSeason: number = 1): number {
    const sMatch = title.match(/Season\s*0?(\d+)/i) || title.match(/S0?(\d+)/i);
    return sMatch ? parseInt(sMatch[1], 10) : defaultSeason;
}

async function getManifest(): Promise<any[]> {
    const now = Date.now();
    if (manifestCache && now < manifestCache.expiresAt) {
        return manifestCache.series;
    }
    const res = await fetch('https://toonplay.in/downloads/index.json', {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000),
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch ToonPlay manifest (${res.status})`);
    }
    const json = await res.json();
    const series = Array.isArray(json.series) ? json.series : [];
    manifestCache = { series, expiresAt: now + 5 * 60 * 1000 };
    return series;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title')?.trim() || '';
    const slug = searchParams.get('slug')?.trim() || '';
    const season = parseInt(searchParams.get('season') || '1', 10) || 1;
    const episode = parseInt(searchParams.get('episode') || searchParams.get('ep') || '1', 10) || 1;

    if (!title && !slug) {
        return NextResponse.json({ success: false, error: 'Either "title" or "slug" is required' }, { status: 400 });
    }

    const cacheKey = `${slug || title}_s${season}_e${episode}`.toLowerCase();
    const cached = downloadCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json({
            success: true,
            cached: true,
            ...cached.data
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=1800'
            }
        });
    }

    try {
        const seriesList = await getManifest();
        const cleanedInput = cleanTitle(title || slug);

        let matchedSeries = seriesList.find((s: any) => {
            const rawTitle = s.meta?.title || s.slug || '';
            const sNum = extractSeasonNumber(rawTitle, 1);
            const cleanedManifest = cleanTitle(rawTitle);
            return (cleanedInput.includes(cleanedManifest) || cleanedManifest.includes(cleanedInput)) && sNum === season;
        });

        if (!matchedSeries) {
            matchedSeries = seriesList.find((s: any) => {
                const rawTitle = s.meta?.title || s.slug || '';
                const cleanedManifest = cleanTitle(rawTitle);
                return cleanedInput.includes(cleanedManifest) || cleanedManifest.includes(cleanedInput);
            });
        }

        if (matchedSeries) {
            const targetSlug = matchedSeries.slug;
            const seriesUrl = `https://toonplay.in/downloads/${encodeURIComponent(targetSlug)}.json`;
            const seriesRes = await fetch(seriesUrl, {
                headers: HEADERS,
                signal: AbortSignal.timeout(10000),
                cache: 'no-store'
            });

            if (seriesRes.ok) {
                const seriesData = await seriesRes.json();
                const epList: any[] = seriesData.page?.episodes || [];
                const targetEp = epList.find((e: any) => e.episode === episode) || epList[episode - 1];

                if (targetEp) {
                    const qualities = (targetEp.qualities || []).map((q: any) => {
                        const qRaw = (q.quality || '').toLowerCase();
                        let res = '720p';
                        if (qRaw.includes('480')) res = '480p';
                        else if (qRaw.includes('1080')) res = '1080p';

                        const links = q.links || {};
                        return {
                            quality: res,
                            qualityLabel: q.quality,
                            size: q.size,
                            links: {
                                hcloud: links.Hcloud || null,
                                mega: links.MEGA || null,
                                gdf: links.GDF || null,
                                fprs: links.Fprs || null,
                                multi: links.Multi || null
                            }
                        };
                    });

                    const payload = {
                        title: matchedSeries.meta?.title || title,
                        season,
                        episode,
                        source: 'toonplay_download_center',
                        qualities
                    };

                    downloadCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 30 * 60 * 1000 });

                    return NextResponse.json({
                        success: true,
                        cached: false,
                        ...payload
                    }, {
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                            'Cache-Control': 'public, max-age=1800'
                        }
                    });
                }
            }
        }

        const searchQ = (title || slug).replace(/\(.*?\)/g, '').trim();
        const searchRes = await fetch(`https://animesalt.streamindia.co.in/api/search?q=${encodeURIComponent(searchQ)}&page=1`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(10000)
        });

        if (searchRes.ok) {
            const searchData = await searchRes.json();
            const items: any[] = searchData.data || [];
            if (items.length > 0) {
                const animeId = items[0].id;
                const infoRes = await fetch(`https://animesalt.streamindia.co.in/api/info?id=${encodeURIComponent(animeId)}`, {
                    headers: HEADERS,
                    signal: AbortSignal.timeout(10000)
                });

                if (infoRes.ok) {
                    const infoData = await infoRes.json();
                    const seasonsList: any[] = infoData.anime?.seasonsList || [];
                    const targetSeason = seasonsList.find((s: any) => parseInt(s.season, 10) === season) || seasonsList[0];
                    const episodes: any[] = targetSeason?.episodes || [];
                    const targetEp = episodes.find((e: any) => e.number === episode) || episodes[episode - 1];

                    if (targetEp?.id) {
                        const dlRes = await fetch(`https://animesalt.streamindia.co.in/api/toonplay/download?id=${encodeURIComponent(targetEp.id)}`, {
                            headers: HEADERS,
                            signal: AbortSignal.timeout(10000)
                        });

                        if (dlRes.ok) {
                            const dlData = await dlRes.json();
                            const downloads: any[] = dlData.downloads || [];
                            if (downloads.length > 0) {
                                const qualities = downloads.map((d: any) => ({
                                    quality: d.quality?.toLowerCase() || '720p',
                                    qualityLabel: d.quality || 'HD',
                                    size: d.size || null,
                                    links: {
                                        mega: d.link,
                                        server: d.server,
                                        lang: d.lang
                                    }
                                }));

                                const payload = {
                                    title: infoData.anime?.title || title,
                                    season,
                                    episode,
                                    source: 'toonplay_api',
                                    qualities
                                };

                                downloadCache.set(cacheKey, { data: payload, expiresAt: Date.now() + 30 * 60 * 1000 });

                                return NextResponse.json({
                                    success: true,
                                    cached: false,
                                    ...payload
                                }, {
                                    headers: {
                                        'Access-Control-Allow-Origin': '*',
                                        'Cache-Control': 'public, max-age=1800'
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: false,
            error: `No live download links found for "${title}" S${season}E${episode}`
        }, { status: 404 });

    } catch (err: any) {
        console.error('[Live ToonPlay Download] Error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export const POST = GET;
