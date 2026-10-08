import { NextRequest, NextResponse } from 'next/server';
import { decryptStream } from '@/lib/streamCrypto';
import { extractRRStream } from '@/lib/rrStreamExtractor';
import { getStreamApiSettings } from '@/lib/streamApiKeyService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getLiveOrigin(request: NextRequest): string {
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    if (forwardedHost) {
        return `${forwardedProto}://${forwardedHost}`;
    }
    const host = request.headers.get('host');
    if (host) {
        const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
        return `${proto}://${host}`;
    }
    return request.nextUrl.origin;
}

function makeAbsoluteUrl(relativeUrl: string, baseUrl: string): string {
    try {
        return new URL(relativeUrl, baseUrl).href;
    } catch {
        return relativeUrl;
    }
}

function rewriteM3U8(playlist: string, baseUrl: string, origin: string, token: string): string {
    const lines = playlist.split('\n');
    const rewritten = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
            if (trimmed.includes('URI=')) {
                return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
                    const absUri = makeAbsoluteUrl(uri, baseUrl);
                    const proxyUrl = `${origin}/api/v1/anime/playback?token=${encodeURIComponent(token)}&seg=${encodeURIComponent(absUri)}`;
                    return `URI="${proxyUrl}"`;
                });
            }
            return line;
        }

        const absUrl = makeAbsoluteUrl(trimmed, baseUrl);
        return `${origin}/api/v1/anime/playback?token=${encodeURIComponent(token)}&seg=${encodeURIComponent(absUrl)}`;
    });

    return rewritten.join('\n');
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const segUrl = searchParams.get('seg');
    const origin = getLiveOrigin(request);

    const settings = await getStreamApiSettings();
    if (!settings.isEnabled) {
        return new NextResponse('Stream API is currently disabled by administrator.', { status: 503 });
    }

    if (!token) {
        return new NextResponse('Access denied: Missing security token.', { status: 400 });
    }

    const payload = decryptStream(token);
    if (!payload || !payload.url) {
        return new NextResponse('Access denied: Invalid or expired token.', { status: 403 });
    }

    // 1. Serving a specific HLS chunk / segment (.ts, .m4s, variant .m3u8)
    if (segUrl) {
        try {
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://argon.razorshell.space/',
                'Origin': 'https://argon.razorshell.space'
            };

            if (payload.cookies) {
                headers['Cookie'] = payload.cookies;
            }

            const clientRange = request.headers.get('range');
            if (clientRange) {
                headers['Range'] = clientRange;
            }

            const segRes = await fetch(segUrl, { headers });

            if (!segRes.ok) {
                return new NextResponse(`Segment fetch failed with status ${segRes.status}`, { status: segRes.status });
            }

            const contentType = segRes.headers.get('content-type') || '';
            const isSubPlaylist = contentType.includes('mpegurl') || segUrl.includes('.m3u8');

            if (isSubPlaylist) {
                const subPlaylistText = await segRes.text();
                const rewritten = rewriteM3U8(subPlaylistText, segUrl, origin, token);
                return new NextResponse(rewritten, {
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                        'Cache-Control': 'private, no-cache, no-store, must-revalidate'
                    }
                });
            }

            // Binary media segment
            const responseHeaders: Record<string, string> = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
                'Content-Type': contentType || 'video/mp2t',
                'Cache-Control': 'public, max-age=86400, immutable'
            };

            const cl = segRes.headers.get('content-length');
            if (cl) responseHeaders['Content-Length'] = cl;
            const cr = segRes.headers.get('content-range');
            if (cr) responseHeaders['Content-Range'] = cr;
            const ar = segRes.headers.get('accept-ranges');
            if (ar) responseHeaders['Accept-Ranges'] = ar;

            return new NextResponse(segRes.body, {
                status: segRes.status,
                headers: responseHeaders
            });
        } catch (err: any) {
            console.error('[Playback Segment Error]:', err.message);
            return new NextResponse(`Segment proxy error: ${err.message}`, { status: 500 });
        }
    }

    // 2. Main stream request (playlist or embed)
    let targetUrl = payload.url;
    let cookies = payload.cookies || '';

    // If targetUrl is an embed page, try on-demand HLS extraction
    if (!targetUrl.includes('.m3u8') && (targetUrl.includes('codedew.com') || targetUrl.includes('razorshell.space'))) {
        try {
            const extracted = await extractRRStream(targetUrl);
            if (extracted.success && extracted.m3u8Url) {
                targetUrl = extracted.m3u8Url;
                if (extracted.cookies) {
                    cookies = extracted.cookies;
                }
            }
        } catch (e: any) {
            console.warn('[Playback Extractor On-demand Warning]:', e.message);
        }
    }

    // 3. If targetUrl is an M3U8 HLS stream, fetch and rewrite it
    if (targetUrl.includes('.m3u8') || targetUrl.includes('/stream/')) {
        try {
            const headers: Record<string, string> = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://argon.razorshell.space/',
                'Origin': 'https://argon.razorshell.space'
            };
            if (cookies) {
                headers['Cookie'] = cookies;
            }

            const m3u8Res = await fetch(targetUrl, { headers });

            if (m3u8Res.ok) {
                const playlistText = await m3u8Res.text();
                if (playlistText.includes('#EXTM3U')) {
                    const rewritten = rewriteM3U8(playlistText, targetUrl, origin, token);
                    return new NextResponse(rewritten, {
                        headers: {
                            'Content-Type': 'application/vnd.apple.mpegurl',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                            'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
                            'Cache-Control': 'private, no-cache, no-store, must-revalidate'
                        }
                    });
                }
            }
        } catch (err: any) {
            console.error('[Playback M3U8 Proxy Error]:', err.message);
        }
    }

    // 4. Target could not be served as an M3U8 stream (Never proxy or display external websites!)
    return new NextResponse('Playback error: Direct HLS video stream not available for this target.', {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization, Origin, Referer'
        }
    });
}
