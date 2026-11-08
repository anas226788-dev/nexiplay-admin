import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface CachedStream {
    url: string;
    expiresAt: number;
}
const streamCache = new Map<string, CachedStream>();

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://toonplay.in/',
    'Origin': 'https://toonplay.in'
};

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
    const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store'
    });
    if (!res.ok) {
        throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    let toonplayId = searchParams.get('toonplay_id')?.trim() || searchParams.get('id')?.trim() || '';
    const season = parseInt(searchParams.get('season') || '1', 10) || 1;
    const episode = parseInt(searchParams.get('episode') || searchParams.get('ep') || '1', 10) || 1;
    const cachedUrl = searchParams.get('cached_url')?.trim() || '';
    const title = searchParams.get('title')?.trim() || '';
    const slug = searchParams.get('slug')?.trim() || '';

    const cacheKey = `${toonplayId || slug || title}_s${season}_e${episode}`;
    const cached = streamCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json({
            success: true,
            url: cached.url,
            cached: true
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }

    try {
        if (!toonplayId) {
            let movie: any = null;
            if (slug) {
                const { data } = await supabase.from('movies').select('id, title, slug, toonplay_url, scraper_url').eq('slug', slug).maybeSingle();
                movie = data;
            }
            if (!movie && title) {
                const { data } = await supabase.from('movies').select('id, title, slug, toonplay_url, scraper_url').ilike('title', `%${title}%`).limit(1);
                movie = data?.[0];
            }

            if (movie?.toonplay_url) {
                const tpMatch = movie.toonplay_url.match(/(?:id=|series-|anime-)([a-zA-Z0-9-]+)/);
                if (tpMatch) {
                    toonplayId = tpMatch[0].startsWith('id=') ? tpMatch[0].replace('id=', '') : tpMatch[0];
                }
            }

            if (!toonplayId && (title || movie?.title)) {
                const searchQ = (title || movie?.title || '').replace(/\(.*?\)/g, '').trim();
                const searchRes = await fetchJson(`https://animesalt.streamindia.co.in/api/search?q=${encodeURIComponent(searchQ)}&page=1`);
                const items: any[] = searchRes.data || [];
                if (items.length > 0) {
                    toonplayId = items[0].id;
                }
            }
        }

        if (!toonplayId) {
            if (cachedUrl) return NextResponse.json({ success: true, url: cachedUrl });
            return NextResponse.json({ success: false, error: 'Could not resolve ToonPlay ID for this title.' }, { status: 404 });
        }

        const infoData = await fetchJson(`https://animesalt.streamindia.co.in/api/info?id=${encodeURIComponent(toonplayId)}`);
        const anime = infoData.anime || {};
        const seasonsList: any[] = anime.seasonsList || [];

        const targetSeason = seasonsList.find((s: any) => parseInt(s.season, 10) === season) || seasonsList[0];
        if (!targetSeason) {
            if (cachedUrl) return NextResponse.json({ success: true, url: cachedUrl });
            return NextResponse.json({ success: false, error: `Season ${season} not found in ToonPlay.` }, { status: 404 });
        }

        const episodes: any[] = targetSeason.episodes || [];
        const targetEpisode = episodes.find((e: any) => e.number === episode) || episodes[episode - 1];
        if (!targetEpisode) {
            if (cachedUrl) return NextResponse.json({ success: true, url: cachedUrl });
            return NextResponse.json({ success: false, error: `Episode ${episode} not found in ToonPlay.` }, { status: 404 });
        }

        const epLink = targetEpisode.link || (targetEpisode.id ? `https://animesalt.cx/${targetEpisode.id.startsWith('/') ? targetEpisode.id.slice(1) : targetEpisode.id}` : '');
        if (!epLink) {
            if (cachedUrl) return NextResponse.json({ success: true, url: cachedUrl });
            return NextResponse.json({ success: false, error: 'No episode URL available for extraction.' }, { status: 404 });
        }

        const extractRes = await fetchJson(`https://anime.streamindia.co.in/api/extract?url=${encodeURIComponent(epLink)}`);
        const extractData = extractRes.data || {};
        const watchServers: any[] = extractData.watchServers || [];

        let finalUrl = '';

        const abyssServer = watchServers.find((ws: any) => (ws.url || '').includes('animesalt.cx') && (ws.url || '').includes('player.php'));
        if (abyssServer?.url) {
            finalUrl = `https://animesalt.streamindia.co.in/abyss?url=${encodeURIComponent(abyssServer.url)}`;
        } else if (watchServers.length > 0) {
            finalUrl = watchServers[0].url;
        } else if (extractData.videoPlayerUrl) {
            finalUrl = extractData.videoPlayerUrl;
        }

        if (!finalUrl && cachedUrl) {
            finalUrl = cachedUrl;
        }

        if (!finalUrl) {
            return NextResponse.json({ success: false, error: 'No active stream servers found for this episode.' }, { status: 404 });
        }

        streamCache.set(cacheKey, {
            url: finalUrl,
            expiresAt: Date.now() + 60 * 60 * 1000
        });

        return NextResponse.json({
            success: true,
            url: finalUrl,
            title: anime.title || title,
            season,
            episode
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });

    } catch (err: any) {
        console.error('[Resolve Toonplay] Error:', err);
        if (cachedUrl) return NextResponse.json({ success: true, url: cachedUrl });
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export const POST = GET;
