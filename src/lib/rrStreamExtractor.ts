import vm from 'vm';

let cachedPlayerJs: string | null = null;
let lastPlayerJsFetch = 0;

async function getPlayerJs(): Promise<string> {
    const now = Date.now();
    // Cache for 1 hour
    if (cachedPlayerJs && now - lastPlayerJsFetch < 3600000) {
        return cachedPlayerJs;
    }
    try {
        const res = await fetch('https://argon.razorshell.space/assets/players/jwplayer/player.js', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://argon.razorshell.space/'
            }
        });
        if (res.ok) {
            cachedPlayerJs = await res.text();
            lastPlayerJsFetch = now;
            return cachedPlayerJs;
        }
    } catch (e: any) {
        console.warn('[RR Extractor] Failed to fetch player.js:', e.message);
    }
    return cachedPlayerJs || '';
}

export interface ExtractedRRStream {
    success: boolean;
    m3u8Url?: string;
    cookies?: string;
    title?: string;
}

/**
 * Extracts the direct .m3u8 stream and session cookies from:
 * 1. A rareanimes article post page (e.g. https://www.rareanimes.mov/hindi/.../)
 * 2. A codedew zipper link (e.g. https://codedew.com/zipper/?url=...)
 * 3. An argon razorshell embed URL (e.g. https://argon.razorshell.space/embed/...)
 * 4. A direct .m3u8 playlist URL
 */
export async function extractRRStream(rawUrl: string, epNum: number = 1): Promise<ExtractedRRStream> {
    if (!rawUrl) {
        return { success: false };
    }

    const cleanUrl = rawUrl.trim();

    // 0. If it's already an m3u8 or mp4
    if (cleanUrl.includes('.m3u8') || cleanUrl.includes('.mp4')) {
        return { success: true, m3u8Url: cleanUrl };
    }

    try {
        let currentTarget = cleanUrl;

        // 1. If it's a rareanimes blog post, find the episode zipper link
        if (currentTarget.includes('rareanimes.') || (!currentTarget.includes('codedew.com/zipper') && !currentTarget.includes('razorshell.space'))) {
            try {
                const postRes = await fetch(currentTarget, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://rareanimes.net/'
                    }
                });

                if (postRes.ok) {
                    const postHtml = await postRes.text();
                    const epNumStr = String(epNum);
                    const padded = epNumStr.padStart(2, '0');
                    const epRegex = new RegExp(`(?:Episode|Ep\\.?)\\s*(?:0*${epNumStr}|${padded})\\b`, 'i');
                    const epMatch = epRegex.exec(postHtml);

                    if (epMatch) {
                        const subHtml = postHtml.substring(epMatch.index, epMatch.index + 3500);
                        const zipMatch = subHtml.match(/href=["'](https?:\/\/[^"']*codedew\.com\/zipper\/[^"']*)["']/i)
                                      || subHtml.match(/href=["'](https?:\/\/[^"']*zipper\/[^"']*)["']/i);
                        if (zipMatch) {
                            currentTarget = zipMatch[1].replace(/&amp;/g, '&');
                        }
                    } else {
                        // Fallback: look for first zipper link on page if ep 1
                        if (epNum === 1) {
                            const firstZip = postHtml.match(/href=["'](https?:\/\/[^"']*codedew\.com\/zipper\/[^"']*)["']/i);
                            if (firstZip) {
                                currentTarget = firstZip[1].replace(/&amp;/g, '&');
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.warn('[RR Extractor Post Resolve Warning]:', err.message);
            }
        }

        // 2. Unwrap codedew zipper if present
        let playerEmbedUrl = currentTarget;
        if (currentTarget.includes('codedew.com/zipper') || currentTarget.includes('/zipper/')) {
            const zipperRes = await fetch(currentTarget, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://rareanimes.net/'
                }
            });

            if (zipperRes.ok) {
                const zipperHtml = await zipperRes.text();
                const iframeMatch = zipperHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
                if (iframeMatch && iframeMatch[1]) {
                    playerEmbedUrl = iframeMatch[1];
                }
            }
        }

        // Must be an embed URL to extract juicycodes from
        if (!playerEmbedUrl.includes('razorshell.space') && !playerEmbedUrl.includes('embed')) {
            return { success: false };
        }

        // 3. Fetch the player embed HTML
        const embedRes = await fetch(playerEmbedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://codedew.com/'
            }
        });

        if (!embedRes.ok) {
            return { success: false };
        }

        const rawCookies = embedRes.headers.get('set-cookie') || '';
        const cookies = rawCookies
            .split(/,(?=\s*[a-zA-Z0-9_-]+=)/)
            .map(c => c.split(';')[0].trim())
            .join('; ');

        const html = await embedRes.text();
        const jcMatch = html.match(/_juicycodes\([\s\S]*?\)/);

        if (!jcMatch) {
            return { success: false };
        }

        // 4. Deobfuscate using VM to obtain direct m3u8 source URL
        const playerJs = await getPlayerJs();
        if (!playerJs) {
            return { success: false };
        }

        let m3u8Url = '';
        let streamTitle = '';

        const context: any = {
            window: {},
            document: {
                getElementById: () => ({ appendChild: () => {}, innerHTML: '' }),
                querySelector: () => null,
                addEventListener: () => {}
            },
            location: { href: playerEmbedUrl },
            navigator: { userAgent: 'Mozilla/5.0' },
            eval: (code: string) => {
                const match = code.match(/https:\\\/\\\/[^"]+\.m3u8/);
                if (match) {
                    m3u8Url = match[0].replace(/\\\//g, '/');
                }
                const titleMatch = code.match(/"title":"([^"]+)"/);
                if (titleMatch) {
                    streamTitle = titleMatch[1];
                }
                return {};
            }
        };
        context.window = context;

        vm.createContext(context);
        try {
            vm.runInContext(playerJs, context, { timeout: 3000 });
            vm.runInContext(jcMatch[0], context, { timeout: 3000 });
        } catch {
            // Ignore runtime UI errors inside VM
        }

        if (m3u8Url) {
            return {
                success: true,
                m3u8Url,
                cookies,
                title: streamTitle
            };
        }

        return { success: false };
    } catch (err: any) {
        console.error('[RR Stream Extractor Error]:', err.message);
        return { success: false };
    }
}
