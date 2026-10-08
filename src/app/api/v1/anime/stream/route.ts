import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { encryptStream } from '@/lib/streamCrypto';
import { extractRRStream } from '@/lib/rrStreamExtractor';
import { validateApiKeyAccess, recordApiKeyUsage } from '@/lib/streamApiKeyService';

export const dynamic = 'force-dynamic';

function parseJsonStreams(urlStr: string | null | undefined): Record<string, string> {
    if (!urlStr) return {};
    const trimmed = urlStr.trim();
    if (trimmed.startsWith('{')) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return {};
        }
    }
    return {};
}

function parseMultiConfig(raw: string | null | undefined): Record<string, any> {
    if (!raw) return {};
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) return {};
    try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    // Extract API Key from query params or headers
    const authHeader = request.headers.get('authorization') || '';
    const bearerKey = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.substring(7).trim() : null;
    const apiKey = searchParams.get('apiKey')?.trim() ||
                   searchParams.get('key')?.trim() ||
                   searchParams.get('api_key')?.trim() ||
                   request.headers.get('x-api-key')?.trim() ||
                   request.headers.get('apikey')?.trim() ||
                   bearerKey;

    const originHeader = request.headers.get('origin');
    const refererHeader = request.headers.get('referer');
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp = forwardedFor || request.headers.get('x-real-ip') || undefined;

    // 1. Validate Access & Key Permission
    const accessCheck = await validateApiKeyAccess(apiKey, originHeader, refererHeader);
    if (!accessCheck.allowed) {
        return NextResponse.json(
            {
                success: false,
                error: accessCheck.reason || 'Access denied.',
                code: accessCheck.statusCode === 503 ? 'STREAM_API_DISABLED' : 'UNAUTHORIZED_KEY'
            },
            {
                status: accessCheck.statusCode || 403,
                headers: { 'Access-Control-Allow-Origin': '*' }
            }
        );
    }

    if (apiKey) {
        recordApiKeyUsage(apiKey, clientIp).catch(() => {});
    }

    const slug = searchParams.get('slug')?.trim();
    const id = searchParams.get('id')?.trim();
    const seasonNum = parseInt(searchParams.get('season') || '1', 10) || 1;
    const epNum = parseInt(searchParams.get('episode') || searchParams.get('ep') || '1', 10) || 1;

    if (!slug && !id) {
        return NextResponse.json(
            { success: false, error: 'Either "slug" or "id" parameter is required.' },
            { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    try {
        // 1. Fetch movie/anime metadata
        let query = supabase.from('movies').select('*');
        if (id) {
            query = query.eq('id', id);
        } else if (slug) {
            query = query.eq('slug', slug);
        }

        const { data: movie, error: movieError } = await query.maybeSingle();

        if (movieError || !movie) {
            return NextResponse.json(
                { success: false, error: 'Anime not found.' },
                { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const isSeriesOrAnime = movie.type === 'anime' || movie.type === 'series';
        let rrStreamUrl = '';

        // 2. If Series/Anime, fetch corresponding episode
        if (isSeriesOrAnime) {
            // Try fetching with season
            const { data: season } = await supabase
                .from('seasons')
                .select('id')
                .eq('movie_id', movie.id)
                .eq('season_number', seasonNum)
                .maybeSingle();

            let episodeQuery = supabase.from('episodes').select('*');
            if (season?.id) {
                episodeQuery = episodeQuery.eq('season_id', season.id).eq('episode_number', epNum);
            } else {
                episodeQuery = episodeQuery.eq('movie_id', movie.id).eq('episode_number', epNum);
            }

            const { data: episode } = await episodeQuery.maybeSingle();

            if (episode?.streaming_url) {
                const epStreams = parseJsonStreams(episode.streaming_url);
                if (epStreams.rareanimes) {
                    rrStreamUrl = epStreams.rareanimes;
                } else if (typeof episode.streaming_url === 'string' && !episode.streaming_url.startsWith('{')) {
                    // Fallback to episode direct streaming url
                    rrStreamUrl = episode.streaming_url;
                }
            }

            // Also check multi-scraper config on movie level
            if (!rrStreamUrl && movie.scraper_source === 'multi' && movie.scraper_url) {
                const config = parseMultiConfig(movie.scraper_url);
                const rrConfig = config.rareanimes;
                if (rrConfig) {
                    const epKey = `${seasonNum}_${epNum}`;
                    const seasonKey = String(seasonNum);
                    rrStreamUrl = rrConfig.mode === 'episode'
                        ? rrConfig.episodeUrls?.[epKey]
                        : rrConfig.mode === 'separate'
                            ? rrConfig.urls?.[seasonKey]
                            : rrConfig.url;
                }
            }
        } else {
            // Single content (Movie)
            const streams = parseJsonStreams(movie.streaming_url);
            if (streams.rareanimes) {
                rrStreamUrl = streams.rareanimes;
            } else if (movie.streaming_url && !movie.streaming_url.startsWith('{')) {
                rrStreamUrl = movie.streaming_url;
            }
        }

        if (!rrStreamUrl) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'RR Nexiplay Server stream not available for this episode.',
                    title: movie.title,
                    season: seasonNum,
                    episode: epNum
                },
                { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // 3. Resolve direct HLS stream (extract from rareanimes post, zipper, or embed)
        const extracted = await extractRRStream(rrStreamUrl, epNum);

        if (!extracted.success || !extracted.m3u8Url) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'RR Nexiplay Server direct video stream could not be extracted for this episode.',
                    title: movie.title,
                    season: seasonNum,
                    episode: epNum
                },
                { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const resolvedTargetUrl = extracted.m3u8Url;
        const streamCookies = extracted.cookies || '';

        // 4. Encrypt the direct stream URL with expiration (2 hours)
        const now = Date.now();
        const expiresAt = now + 2 * 60 * 60 * 1000;

        const token = encryptStream({
            url: resolvedTargetUrl,
            server: 'rareanimes',
            cookies: streamCookies,
            format: 'hls_stream',
            contentId: movie.id,
            slug: movie.slug,
            season: seasonNum,
            episode: epNum,
            createdAt: now,
            expiresAt
        });

        const origin = request.nextUrl.origin;
        const playbackUrl = `${origin}/api/v1/anime/playback?token=${encodeURIComponent(token)}`;
        const embedUrl = `${origin}/embed/rr?slug=${encodeURIComponent(movie.slug)}&season=${seasonNum}&episode=${epNum}`;

        return NextResponse.json(
            {
                success: true,
                title: movie.title,
                type: movie.type,
                slug: movie.slug,
                season: seasonNum,
                episode: epNum,
                server: 'RR Nexiplay Server',
                format: 'hls_stream',
                keyType: accessCheck.keyRecord?.type || (apiKey ? 'custom' : 'demo'),
                expiresInSeconds: 7200,
                token,
                playbackUrl,
                embedUrl,
                iframeCode: `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>`
            },
            {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, apikey',
                    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
                }
            }
        );
    } catch (err: any) {
        console.error('[Stream API Error]:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Internal server error.' },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, apikey'
        }
    });
}
