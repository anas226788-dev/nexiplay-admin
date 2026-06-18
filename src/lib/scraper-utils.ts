import { ProxyAgent, fetch as undiciFetch } from 'undici';
import * as cheerio from 'cheerio';

export interface ScrapedEpisode {
    number: number;
    title: string;
    link: string;
    streamingUrl?: string;
    season?: number;  // Source season number (for multi-season scrapers)
}

export interface ScrapedResult {
    pageTitle: string;
    resolution: string;
    seasonZipLink: string | null;
    episodes: ScrapedEpisode[];
    pendingSubEpisodes?: ScrapedEpisode[];
    warnings?: string[];
    totalFound?: number;
    resolvedCount?: number;
    fallbackCount?: number;
}

interface ResolvedZipperLink {
    link: string;
    resolvedToMega?: boolean;
    warning?: string;
    embedUrl?: string;
}

const HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
};

/**
 * Detect resolution from text.
 */
function detectResolution(text: string): string {
    const match = text.match(/\b(360p|480p|720p|1080p|2160p|4K)\b/i);
    if (match) {
        const res = match[1].toLowerCase();
        if (res === '4k') return '2160p';
        return res;
    }
    return '720p';
}

/**
 * Extract episode number from text.
 */
function extractEpisodeNumber(text: string): number | null {
    const match = text.match(/(?:Episode|Ep\.?|E)\s*[-.]?\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);

    const numMatch = text.match(/^\s*(\d+)\s*$/);
    if (numMatch) return parseInt(numMatch[1], 10);

    return null;
}

/**
 * Generic HTML scraper (FXLinks/standard).
 */
function parseFxlinksEpisodes(html: string): ScrapedResult {
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        pageTitle = titleMatch[1].replace(/&#8211;/g, '-').replace(/&amp;/g, '&').trim();
    }

    const schemaMatch = html.match(/"headline"\s*:\s*"([^"]+)"/);
    if (schemaMatch) {
        pageTitle = schemaMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/').trim();
    }

    const resolution = detectResolution(html);
    let seasonZipLink: string | null = null;
    const episodes: ScrapedEpisode[] = [];

    const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
        const href = match[1].trim();
        const rawText = match[2].replace(/<[^>]*>/g, '').trim();

        if (!rawText || !href) continue;
        if (href.startsWith('#') || href.startsWith('javascript:')) continue;

        if (/season\s*zip|full\s*season|complete\s*season|batch\s*download/i.test(rawText)) {
            seasonZipLink = href;
            continue;
        }

        const epNum = extractEpisodeNumber(rawText);
        if (epNum !== null) {
            if (!episodes.find(e => e.number === epNum)) {
                episodes.push({
                    number: epNum,
                    title: rawText,
                    link: href,
                });
            }
        }
    }

    episodes.sort((a, b) => a.number - b.number);

    return {
        pageTitle,
        resolution,
        seasonZipLink,
        episodes,
    };
}

/**
 * Extract episodes from RareAnimes HTML with language awareness (Hindi DUB / Hindi Sub).
 * Returns separate arrays for DUB and SUB episodes.
 */
function extractRareAnimesEpisodes(html: string): {
    dub: { title: string; zipperUrl: string; streamingUrl?: string }[];
    sub: { title: string; zipperUrl: string; streamingUrl?: string }[];
} {
    const dub: { title: string; zipperUrl: string; streamingUrl?: string }[] = [];
    const sub: { title: string; zipperUrl: string; streamingUrl?: string }[] = [];
    const seenDub = new Set<string>();
    const seenSub = new Set<string>();

    // Find all episode positions
    const epPattern = /Episode\s*(\d+)([^<]*)/gi;
    let epMatch;
    const epPositions: { num: string; title: string; index: number }[] = [];

    while ((epMatch = epPattern.exec(html)) !== null) {
        epPositions.push({
            num: epMatch[1],
            title: epMatch[2].replace(/<[^>]*>/g, '').trim(),
            index: epMatch.index,
        });
    }

    for (let i = 0; i < epPositions.length; i++) {
        const ep = epPositions[i];
        if (seenDub.has(ep.num) && seenSub.has(ep.num)) continue;

        // Get slice from this episode to the next (or 5000 chars max)
        const endIndex = i + 1 < epPositions.length
            ? epPositions[i + 1].index
            : Math.min(ep.index + 5000, html.length);
        const searchSlice = html.substring(ep.index, endIndex);

        const epTitle = ep.title
            ? `Episode ${ep.num} ${ep.title}`
            : `Episode ${ep.num}`;
        const cleanTitle = epTitle.replace(/\s+/g, ' ').trim();

        const megaLinkRegex = /<a[^>]+href="([^"]+)"[^>]*>(?:<[^>]+>)*Mega(?:<\/[^>]+>)*<\/a>/i;
        const watchMultiRegex = /<a[^>]+href="([^"]+)"[^>]*>(?:<[^>]+>)*WatchMultQuality(?:<\/[^>]+>)*<\/a>/i;
        const streamBetaRegex = /<a[^>]+href="([^"]+)"[^>]*>(?:<[^>]+>)*StreamBeta(?:<\/[^>]+>)*<\/a>/i;

        // Find Hindi DUB section and its links
        const dubIndex = searchSlice.search(/Hindi\s*DUB/i);
        if (dubIndex !== -1 && !seenDub.has(ep.num)) {
            const dubSlice = searchSlice.substring(dubIndex, dubIndex + 1500);
            // Stop at next language section to avoid grabbing wrong links
            const nextLangCut = dubSlice.search(/Hindi\s*Sub|Tamil|Telugu|Malayalam/i);
            const dubSearchArea = nextLangCut > 0 ? dubSlice.substring(0, nextLangCut) : dubSlice;
            
            const megaMatch = megaLinkRegex.exec(dubSearchArea);
            if (megaMatch) {
                const watchMultiMatch = watchMultiRegex.exec(dubSearchArea);
                const streamBetaMatch = streamBetaRegex.exec(dubSearchArea);
                const streamingUrl = watchMultiMatch ? watchMultiMatch[1] : (streamBetaMatch ? streamBetaMatch[1] : undefined);
                
                dub.push({ 
                    title: cleanTitle, 
                    zipperUrl: megaMatch[1],
                    streamingUrl
                });
                seenDub.add(ep.num);
            }
        }

        // Find Hindi Sub section and its Mega link (Disabled - DUB only as per user request)
        /*
        const subIndex = searchSlice.search(/Hindi\s*Sub/i);
        if (subIndex !== -1 && !seenSub.has(ep.num)) {
            const subSlice = searchSlice.substring(subIndex, subIndex + 1500);
            const nextLangCut = subSlice.search(/Tamil|Telugu|Malayalam/i);
            const subSearchArea = nextLangCut > 0 ? subSlice.substring(0, nextLangCut) : subSlice;
            const megaMatch = megaLinkRegex.exec(subSearchArea);
            if (megaMatch) {
                sub.push({ title: cleanTitle, zipperUrl: megaMatch[1] });
                seenSub.add(ep.num);
            }
        }
        */

        // Fallback: if no DUB markers found (and no SUB section present), treat first Mega as DUB (backward compat)
        if (!seenDub.has(ep.num) && dubIndex === -1) {
            const megaMatch = megaLinkRegex.exec(searchSlice);
            if (megaMatch) {
                const watchMultiMatch = watchMultiRegex.exec(searchSlice);
                const streamBetaMatch = streamBetaRegex.exec(searchSlice);
                const streamingUrl = watchMultiMatch ? watchMultiMatch[1] : (streamBetaMatch ? streamBetaMatch[1] : undefined);
                
                dub.push({ 
                    title: cleanTitle, 
                    zipperUrl: megaMatch[1],
                    streamingUrl
                });
                seenDub.add(ep.num);
            }
        }
    }

    const sortFn = (a: { title: string }, b: { title: string }) => {
        const numA = parseInt(a.title.match(/\d+/)?.[0] || '0', 10);
        const numB = parseInt(b.title.match(/\d+/)?.[0] || '0', 10);
        return numA - numB;
    };
    dub.sort(sortFn);
    sub.sort(sortFn);

    return { dub, sub };
}

let cachedProxies: string[] = [];
let lastProxyFetchTime = 0;
const PROXY_CACHE_TTL = 15 * 60 * 1000; // Cache proxy list for 15 minutes

async function getProxyList(): Promise<string[]> {
    const now = Date.now();
    if (cachedProxies.length > 0 && (now - lastProxyFetchTime) < PROXY_CACHE_TTL) {
        return cachedProxies;
    }

    try {
        const proxyListUrl = 'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=8000&country=all&ssl=all&anonymity=all';
        const res = await globalThis.fetch(proxyListUrl);
        if (res.ok) {
            const text = await res.text();
            cachedProxies = text.split('\r\n').filter(p => p.trim() !== '');
            lastProxyFetchTime = now;
            console.log(`[Proxy Rotator] Fetched and cached ${cachedProxies.length} proxies.`);
        }
    } catch (e: any) {
        console.warn(`[Proxy Rotator] Failed to fetch proxy list: ${e.message}`);
    }

    return cachedProxies;
}

function isCloudflareBlock(status: number, html: string): boolean {
    if (status === 403 || status === 503 || status === 429 || status === 520 || status === 522) {
        return true;
    }
    const lowerHtml = html.toLowerCase();
    
    // Check page title for wait screen or access denied
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().toLowerCase() : '';
    if (title.includes('just a moment') || title.includes('attention required') || title.includes('access denied')) {
        return true;
    }
    
    // Specific Cloudflare challenge markers
    return (
        lowerHtml.includes('cf-challenge') ||
        lowerHtml.includes('cf_challenge') ||
        lowerHtml.includes('window._cf_chl_opt') ||
        (lowerHtml.includes('turnstile') && lowerHtml.includes('challenge') && !lowerHtml.includes('episode'))
    );
}

/**
 * Fetch HTML page with rotated proxies to bypass Cloudflare protection.
 * Falls back to direct fetch if all proxies fail.
 */
async function fetchHtmlWithProxy(
    url: string,
    referer?: string,
    cookies?: string[]
): Promise<{ html: string; status: number; ok: boolean; setCookieHeader: string | null }> {
    const proxies = await getProxyList();
    
    if (proxies.length > 0) {
        // Shuffle to get a random assortment of proxies
        const shuffled = [...proxies].sort(() => Math.random() - 0.5);
        const maxRetries = Math.min(15, shuffled.length);
        
        for (let i = 0; i < maxRetries; i++) {
            const proxy = shuffled[i];
            const proxyUri = `http://${proxy}`;
            
            try {
                const dispatcher = new ProxyAgent({ uri: proxyUri });
                
                const headers: Record<string, string> = { ...HEADERS };
                if (referer) headers['Referer'] = referer;
                if (cookies && cookies.length > 0) headers['Cookie'] = cookies.join('; ');
                
                const res = await undiciFetch(url, {
                    headers,
                    dispatcher,
                    signal: AbortSignal.timeout(6000), // 6 seconds timeout per proxy
                });
                
                const html = await res.text();
                
                if (res.ok && !isCloudflareBlock(res.status, html)) {
                    console.log(`[Proxy Rotator] Successfully fetched ${url} via proxy ${proxyUri}`);
                    return {
                        html,
                        status: res.status,
                        ok: true,
                        setCookieHeader: res.headers.get('set-cookie'),
                    };
                } else {
                    console.warn(`[Proxy Rotator] Proxy ${proxyUri} blocked or returned status ${res.status} for ${url}`);
                }
            } catch (err: any) {
                console.warn(`[Proxy Rotator] Proxy ${proxyUri} failed for ${url}: ${err.message}`);
            }
        }
    }
    
    console.warn(`[Proxy Rotator] All proxies failed. Falling back to direct fetch for ${url}`);
    
    // Fallback to direct fetch
    const headers: Record<string, string> = { ...HEADERS };
    if (referer) headers['Referer'] = referer;
    if (cookies && cookies.length > 0) headers['Cookie'] = cookies.join('; ');
    
    const res = await undiciFetch(url, {
        headers,
        signal: AbortSignal.timeout(12000),
    });
    
    const html = await res.text();
    return {
        html,
        status: res.status,
        ok: res.ok,
        setCookieHeader: res.headers.get('set-cookie')
    };
}

/**
 * Resolve RareAnimes streaming page URL (WatchMultiQuality/StreamBeta) to the actual embedded video player URL.
 */
async function resolveStreamingEmbed(streamingUrl: string): Promise<string> {
    try {
        const res = await fetchHtmlWithProxy(streamingUrl);
        if (res.ok) {
            const iframeMatch = res.html.match(/<iframe[^>]+src="([^"]+)"/i);
            if (iframeMatch) return iframeMatch[1];
        }
    } catch (e: any) {
        console.warn(`Failed to resolve streaming embed for ${streamingUrl}: ${e.message}`);
    }
    return streamingUrl;
}

/**
 * Resolve RareAnimes zipper URL to final Mega URL.
 * Uses CodeTabs proxy to bypass Cloudflare bot protection on codedew.com.
 * Falls back to the zipper URL itself if resolution fails completely.
 */
async function resolveZipperToMega(zipperUrl: string): Promise<ResolvedZipperLink> {
    try {
        const step1 = await fetchHtmlWithProxy(zipperUrl);
        if (!step1.ok) {
            const warning = `Zipper step1 HTTP ${step1.status}; using zipper fallback`;
            console.warn(warning);
            return { link: zipperUrl, resolvedToMega: false, warning };
        }

        const cookies: string[] = [];
        if (step1.setCookieHeader) {
            const parts = step1.setCookieHeader.split(/,\s*(?=\w+=)/);
            for (const part of parts) {
                const name = part.split(';')[0]?.trim();
                if (name) cookies.push(name);
            }
        }

        const step2Match = step1.html.match(/href="([^"]*ad_step=2[^"]*)"/i);
        if (!step2Match) {
            const directMega = step1.html.match(/href="(https:\/\/mega\.nz\/[^"]+)"/i);
            if (directMega) return { link: directMega[1], resolvedToMega: true };
            // No ad_step and no mega link — fall back to zipper URL
            return {
                link: zipperUrl,
                resolvedToMega: false,
                warning: 'No Mega link or ad_step found; using zipper fallback',
            };
        }

        const step2Path = step2Match[1].replace(/&amp;/g, '&');
        const zipperOrigin = new URL(zipperUrl).origin;
        const step2Url = step2Path.startsWith('http') ? step2Path : `${zipperOrigin}${step2Path}`;

        const step2 = await fetchHtmlWithProxy(step2Url, zipperUrl, cookies);
        if (!step2.ok) {
            const warning = `Zipper step2 HTTP ${step2.status}; using zipper fallback`;
            console.warn(warning);
            return { link: zipperUrl, resolvedToMega: false, warning };
        }

        const megaMatch = step2.html.match(/href="(https:\/\/mega\.nz\/[^"]+)"/i);
        if (!megaMatch) {
            const anyExternal = step2.html.match(/href="(https?:\/\/(?!codedew\.com)[^"]+)"/i);
            if (anyExternal) return { link: anyExternal[1], resolvedToMega: false };
            // No external link found — fall back to zipper URL
            return {
                link: zipperUrl,
                resolvedToMega: false,
                warning: 'No external link found after ad step; using zipper fallback',
            };
        }

        return { link: megaMatch[1], resolvedToMega: true };
    } catch (e: any) {
        const warning = `Failed to resolve zipper URL (${e.message}); using zipper fallback`;
        console.warn(warning);
        return { link: zipperUrl, resolvedToMega: false, warning };
    }
}

/**
 * Resolve a Codedew zipper URL without first loading its ad-step 1 page.
 * The ad-step 2 URL contains the final Mega anchor and is much faster.
 */
async function resolveZipperToMegaStrict(zipperUrl: string): Promise<ResolvedZipperLink> {
    const extractMega = (html: string): string | null => {
        const megaMatch = html.match(/href=["'](https:\/\/mega\.nz\/[^"']+)["']/i);
        return megaMatch ? megaMatch[1] : null;
    };

    const fetchDirectHtml = async (targetUrl: string, referer?: string) => {
        const headers: Record<string, string> = {
            ...HEADERS,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
            'Sec-Fetch-User': '?1',
        };
        if (referer) headers['Referer'] = referer;

        const res = await fetch(targetUrl, {
            headers,
            signal: AbortSignal.timeout(12000),
        });
        const html = await res.text();
        return { html, ok: res.ok, status: res.status };
    };

    const buildStep2Url = (targetUrl: string) => {
        const url = new URL(targetUrl);
        url.searchParams.set('ad_step', '2');
        return url.href;
    };

    const step2Url = buildStep2Url(zipperUrl);
    const errors: string[] = [];

    try {
        const directStep2 = await fetchDirectHtml(step2Url, zipperUrl);
        if (directStep2.ok) {
            const mega = extractMega(directStep2.html);
            if (mega) return { link: mega };
            errors.push('direct step2: no Mega link found');
        } else {
            errors.push(`direct step2 HTTP ${directStep2.status}`);
        }
    } catch (e: any) {
        errors.push(`direct step2: ${e.message}`);
    }

    try {
        const step1 = await fetchDirectHtml(zipperUrl);
        if (!step1.ok) {
            errors.push(`direct step1 HTTP ${step1.status}`);
        } else {
            const directMega = extractMega(step1.html);
            if (directMega) return { link: directMega };

            const step2Match = step1.html.match(/href=["']([^"']*ad_step=2[^"']*)["']/i);
            if (step2Match) {
                const step2Path = step2Match[1].replace(/&amp;/g, '&');
                const resolvedStep2Url = new URL(step2Path, zipperUrl).href;
                const resolvedStep2 = await fetchDirectHtml(resolvedStep2Url, zipperUrl);
                if (resolvedStep2.ok) {
                    const mega = extractMega(resolvedStep2.html);
                    if (mega) return { link: mega };
                    errors.push('direct step1-derived step2: no Mega link found');
                } else {
                    errors.push(`direct step1-derived step2 HTTP ${resolvedStep2.status}`);
                }
            } else {
                errors.push('direct step1: no ad_step link found');
            }
        }
    } catch (e: any) {
        errors.push(`direct step1 flow: ${e.message}`);
    }

    try {
        const proxiedStep2 = await fetchHtmlWithProxy(step2Url, zipperUrl);
        if (proxiedStep2.ok) {
            const mega = extractMega(proxiedStep2.html);
            if (mega) return { link: mega };
            errors.push('proxied step2: no Mega link found');
        } else {
            errors.push(`proxied step2 HTTP ${proxiedStep2.status}`);
        }
    } catch (e: any) {
        errors.push(`proxied step2: ${e.message}`);
    }

    throw new Error(errors.join('; '));
}

/**
 * Resolve MovieLinkBD chain.
 */
async function resolveMovieLinkChain(
    origin: string,
    getLinkPath: string,
    initialCookies: string[]
): Promise<string | null> {
    const getLinkUrl = getLinkPath.startsWith('http') ? getLinkPath : `${origin}${getLinkPath}`;
    const cookies = [...initialCookies];
    let cookieHeader = cookies.join('; ');

    const res1 = await fetch(getLinkUrl, {
        headers: {
            ...HEADERS,
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res1.ok) return null;
    const html1 = await res1.text();

    const setCookie1 = res1.headers.get('set-cookie');
    if (setCookie1) {
        const parts = setCookie1.split(/,\s*(?=\w+=)/);
        for (const part of parts) {
            const name = part.split(';')[0]?.trim();
            if (name && !cookies.includes(name)) cookies.push(name);
        }
        cookieHeader = cookies.join('; ');
    }

    const fileMatch = html1.match(/href="([^"]*\/file\/[^"]*)"/i);
    if (!fileMatch) return null;
    const fileUrl = fileMatch[1].startsWith('http') ? fileMatch[1] : `${origin}${fileMatch[1]}`;

    const res2 = await fetch(fileUrl, {
        headers: {
            ...HEADERS,
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res2.ok) return null;
    const html2 = await res2.text();

    const setCookie2 = res2.headers.get('set-cookie');
    if (setCookie2) {
        const parts = setCookie2.split(/,\s*(?=\w+=)/);
        for (const part of parts) {
            const name = part.split(';')[0]?.trim();
            if (name && !cookies.includes(name)) cookies.push(name);
        }
        cookieHeader = cookies.join('; ');
    }

    const tokenMatch = html2.match(/href="([^"]*\/file\/[^"]*\?token=[^"]*)"/i);
    if (!tokenMatch) return null;
    const tokenUrl = tokenMatch[1].startsWith('http') ? tokenMatch[1] : `${origin}${tokenMatch[1]}`;

    const res3 = await fetch(tokenUrl, {
        headers: {
            ...HEADERS,
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
        signal: AbortSignal.timeout(10000),
    });
    if (!res3.ok) return null;
    const html3 = await res3.text();

    const originHostname = new URL(origin).hostname;
    const finalLinks: { text: string; href: string }[] = [];
    const finalLinkPattern = /href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let finalMatch;
    while ((finalMatch = finalLinkPattern.exec(html3)) !== null) {
        const href = finalMatch[1];
        const text = finalMatch[2].replace(/<[^>]*>/g, '').trim();
        if (href.startsWith('http') && !href.includes(originHostname) && !href.includes('otieu.com')) {
            finalLinks.push({ text, href });
        }
    }

    if (finalLinks.length === 0) return null;

    const r2Link = finalLinks.find(l => l.href.includes('r2.dev') || l.text.toLowerCase().includes('fast cloud'));
    const alwaysWorkLink = finalLinks.find(l => l.href.includes('movielinkbd.mom') || l.text.toLowerCase().includes('always work'));
    const instantLink = finalLinks.find(l => l.href.includes('instantcloud.org') || l.text.toLowerCase().includes('instant'));

    return r2Link?.href || alwaysWorkLink?.href || instantLink?.href || finalLinks[0]?.href;
}

/**
 * Helper to check if a scraped episode should be skipped based on skipEpisodes list.
 * Supports raw episode numbers (backward compatibility) and "season_episode" strings.
 */
export function shouldSkipEpisode(
    skipEpisodes: (string | number)[],
    epNum: number,
    seasonNum?: number
): boolean {
    if (skipEpisodes.includes(epNum)) return true;
    if (seasonNum !== undefined && skipEpisodes.includes(`${seasonNum}_${epNum}`)) return true;
    return false;
}

/**
 * Main scrape entrypoint.
 */
export async function scrapeSource(
    url: string,
    source: 'fxlinks' | 'rareanimes' | 'movielink' | 'bollyflix' | 'animerulz' | 'toonplay' | 'animeworld' | 'animixstream' | 'toonstream' | 'muse_india' | 'anione_india',
    skipEpisodes: (string | number)[] = [],
    options: { disableSequels?: boolean; targetSeason?: number; movieTitle?: string } = {}
): Promise<ScrapedResult> {
    if (source === 'animeworld') {
        return scrapeAnimeWorld(url, skipEpisodes, options.targetSeason);
    }
    if (source === 'animixstream') {
        return scrapeAnimixStream(url, skipEpisodes, options.targetSeason);
    }
    if (source === 'toonstream') {
        return scrapeToonStream(url, skipEpisodes, options.targetSeason, options.movieTitle);
    }
    if (source === 'muse_india') {
        return scrapeYouTubeSource(url, 'Muse India', skipEpisodes, options.targetSeason);
    }
    if (source === 'anione_india') {
        return scrapeYouTubeSource(url, 'Ani-One India', skipEpisodes, options.targetSeason);
    }
    let html = '';
    let status = 200;
    let ok = true;
    let setCookieHeader: string | null = null;

    if (source === 'rareanimes') {
        console.log(`[Scraper] Using proxy rotator for initial fetch of ${url}`);
        const fetchRes = await fetchHtmlWithProxy(url);
        html = fetchRes.html;
        status = fetchRes.status;
        ok = fetchRes.ok;
        setCookieHeader = fetchRes.setCookieHeader;
    } else {
        const response = await fetch(url, {
            headers: HEADERS,
            signal: AbortSignal.timeout(25000), // 25 seconds for slow redirects
        });
        status = response.status;
        ok = response.ok;
        setCookieHeader = response.headers.get('set-cookie');
        if (ok) {
            html = await response.text();
        }
    }

    if (!ok || isCloudflareBlock(status, html)) {
        if (source !== 'rareanimes') {
            console.warn(`[Scraper] Direct fetch failed or Cloudflare block detected (HTTP ${status}). Retrying with proxy rotator...`);
            const fetchRes = await fetchHtmlWithProxy(url);
            html = fetchRes.html;
            status = fetchRes.status;
            ok = fetchRes.ok;
            setCookieHeader = fetchRes.setCookieHeader;
        }
        
        if (!ok || isCloudflareBlock(status, html)) {
            throw new Error(`Failed to fetch source page: HTTP ${status} (Cloudflare block or connection error)`);
        }
    }

    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        pageTitle = titleMatch[1]
            .replace(/&#8211;/g, '-')
            .replace(/&amp;/g, '&')
            .replace(/&#038;/g, '&')
            .trim();
    }
    const schemaMatch = html.match(/"headline"\s*:\s*"([^"]+)"/);
    if (schemaMatch) {
        pageTitle = schemaMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/').trim();
    }

    const resolution = detectResolution(html);

    if (source === 'fxlinks') {
        const result = parseFxlinksEpisodes(html);
        result.pageTitle = pageTitle || result.pageTitle;
        return result;
    } else if (source === 'rareanimes') {
        const { dub: rawDubEpisodes, sub: rawSubEpisodes } = extractRareAnimesEpisodes(html);

        if (rawDubEpisodes.length === 0 && rawSubEpisodes.length === 0) {
            throw new Error('No episodes with Mega links found on this page.');
        }

        const episodes: ScrapedEpisode[] = [];
        const pendingSubEpisodes: ScrapedEpisode[] = [];
        const warnings: string[] = [];
        let resolvedCount = 0;

        // Resolve DUB episodes (auto-import)
        for (const ep of rawDubEpisodes) {
            try {
                const resolved = await resolveZipperToMega(ep.zipperUrl);
                const epNum = parseInt(ep.title.match(/\d+/)?.[0] || '0', 10);
                let resolvedStreamingUrl = ep.streamingUrl;
                if (ep.streamingUrl) {
                    resolvedStreamingUrl = await resolveStreamingEmbed(ep.streamingUrl);
                }
                episodes.push({
                    number: epNum,
                    title: ep.title,
                    link: resolved.link,
                    streamingUrl: resolvedStreamingUrl,
                });
                if (resolved.resolvedToMega) {
                    resolvedCount++;
                } else if (resolved.warning) {
                    warnings.push(`DUB ${ep.title}: ${resolved.warning}`);
                }
            } catch (err: any) {
                warnings.push(`DUB ${ep.title}: ${err.message}`);
                const epNum = parseInt(ep.title.match(/\d+/)?.[0] || '0', 10);
                episodes.push({
                    number: epNum,
                    title: ep.title,
                    link: ep.zipperUrl,
                    streamingUrl: ep.streamingUrl,
                });
            }
            await new Promise(r => setTimeout(r, 400));
        }

        // Resolve SUB episodes (Disabled - DUB only as per user request)
        /*
        for (const ep of rawSubEpisodes) {
            try {
                const megaLink = await resolveZipperToMega(ep.zipperUrl);
                const epNum = parseInt(ep.title.match(/\d+/)?.[0] || '0', 10);
                pendingSubEpisodes.push({
                    number: epNum,
                    title: ep.title,
                    link: megaLink,
                });
            } catch (err: any) {
                warnings.push(`SUB ${ep.title}: ${err.message}`);
            }
            await new Promise(r => setTimeout(r, 400));
        }
        */

        if (episodes.length === 0) {
            throw new Error(`No importable episode links found. Errors: ${warnings.join('; ')}`);
        }

        return {
            pageTitle,
            resolution,
            seasonZipLink: null,
            episodes,
            pendingSubEpisodes: undefined,
            warnings,
            totalFound: rawDubEpisodes.length,
            resolvedCount,
            fallbackCount: episodes.length - resolvedCount,
        };
    } else if (source === 'movielink') {
        const cookies: string[] = [];
        const rawSetCookie = setCookieHeader;
        if (rawSetCookie) {
            const parts = rawSetCookie.split(/,\s*(?=\w+=)/);
            for (const part of parts) {
                const name = part.split(';')[0]?.trim();
                if (name) cookies.push(name);
            }
        }

        const btnPattern = /href="([^"]*getLink[^"]*)"[^>]*>[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/gi;
        const buttons: { path: string; label: string }[] = [];
        let match;
        while ((match = btnPattern.exec(html)) !== null) {
            buttons.push({
                path: match[1],
                label: match[2].replace(/<[^>]*>/g, '').trim(),
            });
        }

        if (buttons.length === 0) {
            throw new Error('No download buttons found on this page.');
        }

        const origin = new URL(url).origin;
        const episodes: ScrapedEpisode[] = [];
        const warnings: string[] = [];
        let idx = 1;

        for (const btn of buttons) {
            try {
                const resolvedUrl = await resolveMovieLinkChain(origin, btn.path, cookies);
                if (resolvedUrl) {
                    const epNum = extractEpisodeNumber(btn.label) || idx++;
                    episodes.push({
                        number: epNum,
                        title: btn.label,
                        link: resolvedUrl,
                    });
                } else {
                    warnings.push(`Failed to resolve download links for "${btn.label}"`);
                }
                await new Promise(r => setTimeout(r, 400));
            } catch (err: any) {
                warnings.push(`${btn.label}: ${err.message}`);
            }
        }

        if (episodes.length === 0) {
            throw new Error(`Failed to resolve any direct download links. Errors: ${warnings.join('; ')}`);
        }

        let detectedRes = resolution;
        const combinedText = (pageTitle + ' ' + (episodes[0]?.title || '')).toLowerCase();
        const resMatch = combinedText.match(/\b(360p|480p|720p|1080p|2160p|4K)\b/i);
        if (resMatch) {
            const res = resMatch[1].toLowerCase();
            detectedRes = res === '4k' ? '2160p' : res;
        }

        episodes.sort((a, b) => a.number - b.number);

        return {
            pageTitle,
            resolution: detectedRes,
            seasonZipLink: null,
            episodes,
            warnings,
            totalFound: buttons.length,
            resolvedCount: episodes.length,
        };
    } else if (source === 'bollyflix') {
        return scrapeBollyflix(url);
    } else if (source === 'animerulz') {
        return scrapeAnimerulz(url, skipEpisodes, options.disableSequels, options.targetSeason);
    } else if (source === 'toonplay') {
        return scrapeToonplay(url, skipEpisodes, options.targetSeason);
    } else {
        throw new Error(`Unsupported scraper source: ${source}`);
    }
}

/**
 * Animerulz API configuration.
 * Uses streamindia.co.in backend APIs to fetch episode lists and streaming sources.
 */
const ANIMERULZ_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Referer': 'https://animerulzapp.buzz/',
    'Origin': 'https://animerulzapp.buzz',
};

const ANIMERULZ_PRIMARY_API = 'https://hianime.streamindia.co.in/api/v2/hianime/anilist';
const ANIMERULZ_FALLBACK_API = 'https://fallback.streamindia.co.in';

/**
 * Fetch JSON from Animerulz API endpoints with proper headers.
 */
async function fetchAnimerulzJson(url: string): Promise<any> {
    const res = await undiciFetch(url, {
        headers: ANIMERULZ_HEADERS,
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/**
 * Extract the AniList numeric ID from an Animerulz URL.
 * Supports formats like:
 *   - https://animerulzapp.buzz/watch/1735 (direct ID)
 *   - https://animerulzapp.buzz/anime/naruto-shippuden-1735 (slug with ID)
 *   - Plain numeric string "1735"
 */
function extractAnimerulzId(url: string): string | null {
    // If it's just a number, return it
    if (/^\d+$/.test(url.trim())) return url.trim();

    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;

        // Match /watch/1735 or /anime/slug-1735 or /1735
        const idMatch = path.match(/\/(\d+)(?:\/.*)?$/) || path.match(/[-/](\d+)(?:\/.*)?$/);
        if (idMatch) return idMatch[1];

        // Check query params (e.g., ?id=1735)
        const idParam = urlObj.searchParams.get('id');
        if (idParam && /^\d+$/.test(idParam)) return idParam;
    } catch {
        // Not a valid URL, try extracting number from string
        const numMatch = url.match(/(\d+)/);
        if (numMatch) return numMatch[1];
    }

    return null;
}

/**
 * Fetch sequel AniList IDs by following SEQUEL relations recursively.
 * Returns an array of { id, seasonNum } starting from season 2.
 * Best-effort: if the AniList API fails, returns an empty array.
 */
async function fetchAnilistSequels(anilistId: string): Promise<{ id: number; seasonNum: number }[]> {
    const sequels: { id: number; seasonNum: number }[] = [];
    let currentId = parseInt(anilistId);
    let seasonNum = 1;
    const visited = new Set<number>();

    const query = `
        query ($id: Int) {
            Media(id: $id, type: ANIME) {
                relations {
                    edges {
                        relationType
                        node {
                            id
                            title { romaji english }
                            format
                        }
                    }
                }
            }
        }
    `;

    try {
        while (true) {
            if (visited.has(currentId)) break;
            visited.add(currentId);

            const res = await undiciFetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ query, variables: { id: currentId } }),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                console.warn(`[Animerulz] AniList API returned ${res.status} for ID ${currentId}, stopping sequel search.`);
                break;
            }

            const json = await res.json() as any;
            const edges = json?.data?.Media?.relations?.edges || [];

            // Find the SEQUEL relation (TV format preferred)
            const sequelEdge = edges.find((e: any) =>
                e.relationType === 'SEQUEL' &&
                (e.node?.format === 'TV' || e.node?.format === 'TV_SHORT' || !e.node?.format)
            ) || edges.find((e: any) => e.relationType === 'SEQUEL');

            if (!sequelEdge) break;

            seasonNum++;
            const sequelId = sequelEdge.node.id;
            const sequelTitle = sequelEdge.node.title?.english || sequelEdge.node.title?.romaji || `Sequel #${sequelId}`;
            console.log(`[Animerulz] Found sequel: "${sequelTitle}" (AniList ID: ${sequelId}) as Season ${seasonNum}`);
            sequels.push({ id: sequelId, seasonNum });
            currentId = sequelId;

            // Rate limit AniList API calls
            await new Promise(r => setTimeout(r, 500));
        }
    } catch (err: any) {
        console.warn(`[Animerulz] Failed to fetch AniList sequels: ${err.message}. Continuing with primary season only.`);
    }

    return sequels;
}

/**
 * Scrape episodes for a single AniList ID and return them with the given season number.
 * This is a helper extracted from the main scrapeAnimerulz function.
 */
async function scrapeAnimerulzSeason(
    anilistId: string,
    seasonNum: number,
    skipEpisodes: (string | number)[]
): Promise<{ episodes: ScrapedEpisode[]; warnings: string[]; resolvedCount: number; totalFound: number; animeName: string }> {
    let epData: any;
    try {
        epData = await fetchAnimerulzJson(`${ANIMERULZ_PRIMARY_API}/episodes/${anilistId}`);
        if (epData.status !== 200 || !epData.data || epData.data.length === 0) {
            throw new Error('Primary returned no data');
        }
        console.log(`[Animerulz] Season ${seasonNum} (ID ${anilistId}): Primary API found ${epData.data.length} episodes`);
    } catch (primaryErr: any) {
        console.warn(`[Animerulz] Season ${seasonNum} Primary API failed (${primaryErr.message}), trying fallback...`);
        try {
            epData = await fetchAnimerulzJson(`${ANIMERULZ_FALLBACK_API}/episodes/${anilistId}`);
        } catch (fallbackErr: any) {
            console.warn(`[Animerulz] Season ${seasonNum} (ID ${anilistId}): Both APIs failed: ${fallbackErr.message}`);
            return { episodes: [], warnings: [`Season ${seasonNum}: Failed to fetch episodes`], resolvedCount: 0, totalFound: 0, animeName: `Anime #${anilistId}` };
        }
    }

    if (!epData.data || epData.data.length === 0) {
        return { episodes: [], warnings: [`Season ${seasonNum}: No episodes found`], resolvedCount: 0, totalFound: 0, animeName: `Anime #${anilistId}` };
    }

    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    let resolvedCount = 0;

    const firstEp = epData.data[0];
    const animeName = firstEp?.titles?.en || firstEp?.titles?.x_jat || `Anime #${anilistId}`;

    for (const ep of epData.data) {
        const epNum = ep.number;
        const epTitle = ep.titles?.en || ep.titles?.x_jat || ep.title || `Episode ${epNum}`;

        if (shouldSkipEpisode(skipEpisodes, epNum, seasonNum)) {
            episodes.push({
                number: epNum,
                title: epTitle,
                link: `https://animerulzapp.buzz/watch/${anilistId}?ep=${epNum}`,
                season: seasonNum,
            });
            continue;
        }

        try {
            const serverRes = await fetchAnimerulzJson(
                `${ANIMERULZ_FALLBACK_API}/servers?id=${anilistId}&ep=${epNum}`
            );

            const cats = serverRes.data?.categories || {};
            const dubServers: string[] = cats.dub || [];
            const subServers: string[] = cats.sub || [];
            const ids: Record<string, string> = cats.ids || {};

            const preferredLang = dubServers.length > 0 ? 'dub' : 'sub';
            const servers = preferredLang === 'dub' ? dubServers : subServers;

            const serverName = servers.find(s => ids[s]);
            if (!serverName) {
                warnings.push(`S${seasonNum} Ep ${epNum}: No valid server found`);
                episodes.push({
                    number: epNum,
                    title: epTitle,
                    link: `https://animerulzapp.buzz/watch/${anilistId}?ep=${epNum}`,
                    season: seasonNum,
                });
                continue;
            }

            const providerId = ids[serverName];

            const sourceUrl = `${ANIMERULZ_FALLBACK_API}/sources?anilistid=${anilistId}&providerid=${encodeURIComponent(providerId)}&ep=${epNum}&provider=${serverName}&category=${preferredLang}`;
            const sourceRes = await fetchAnimerulzJson(sourceUrl);

            const m3u8Url = sourceRes.data?.sources?.[0]?.url;
            if (m3u8Url) {
                episodes.push({
                    number: epNum,
                    title: epTitle,
                    link: m3u8Url,
                    streamingUrl: m3u8Url,
                    season: seasonNum,
                });
                resolvedCount++;
            } else {
                warnings.push(`S${seasonNum} Ep ${epNum}: No streaming URL in source response`);
                episodes.push({
                    number: epNum,
                    title: epTitle,
                    link: `https://animerulzapp.buzz/watch/${anilistId}?ep=${epNum}`,
                    season: seasonNum,
                });
            }
        } catch (err: any) {
            warnings.push(`S${seasonNum} Ep ${epNum}: ${err.message}`);
            episodes.push({
                number: epNum,
                title: epTitle,
                link: `https://animerulzapp.buzz/watch/${anilistId}?ep=${epNum}`,
                season: seasonNum,
            });
        }

        // Rate limit: 300ms between episodes to avoid hammering the API
        await new Promise(r => setTimeout(r, 300));
    }

    return { episodes, warnings, resolvedCount, totalFound: epData.data.length, animeName };
}

/**
 * Scrape Animerulz streaming data via the streamindia.co.in API.
 *
 * Flow:
 * 1. Extract AniList ID from URL
 * 2. Fetch episode list from primary API (fallback if fails)
 * 3. For each episode, resolve server list and get streaming m3u8 URL
 * 4. Follow AniList SEQUEL relations to scrape multi-season content
 *
 * Returns episodes with streaming URLs (m3u8 links) and season numbers.
 */
export async function scrapeAnimerulz(
    url: string,
    skipEpisodes: (string | number)[] = [],
    disableSequels: boolean = false,
    targetSeasonNum?: number
): Promise<ScrapedResult> {
    const anilistId = extractAnimerulzId(url);
    if (!anilistId) {
        throw new Error('Could not extract AniList ID from URL. Provide a URL like https://animerulzapp.buzz/watch/1735 or a numeric ID.');
    }

    console.log(`[Animerulz] Starting scrape for AniList ID: ${anilistId}${targetSeasonNum ? `, target season: ${targetSeasonNum}` : ''}`);

    // Step 1: Scrape primary season (either targetSeasonNum, or 1 by default)
    const primarySeason = targetSeasonNum || 1;
    const primaryResult = await scrapeAnimerulzSeason(anilistId, primarySeason, skipEpisodes);

    if (primaryResult.episodes.length === 0) {
        throw new Error(`No episodes found for this anime (ID: ${anilistId}).`);
    }

    const episodes: ScrapedEpisode[] = [...primaryResult.episodes];
    const warnings: string[] = [...primaryResult.warnings];
    let resolvedCount = primaryResult.resolvedCount;
    let totalEpisodes = primaryResult.totalFound;
    const animeName = primaryResult.animeName;

    let seasonCount = 1;

    // Step 2: Discover and scrape sequel seasons via AniList API (only if sequels are NOT disabled)
    if (!disableSequels) {
        const sequels = await fetchAnilistSequels(anilistId);
        seasonCount = sequels.length + 1;
        for (const sequel of sequels) {
            console.log(`[Animerulz] Scraping Season ${sequel.seasonNum} (AniList ID: ${sequel.id})...`);
            const seasonResult = await scrapeAnimerulzSeason(String(sequel.id), sequel.seasonNum, skipEpisodes);
            episodes.push(...seasonResult.episodes);
            warnings.push(...seasonResult.warnings);
            resolvedCount += seasonResult.resolvedCount;
            totalEpisodes += seasonResult.totalFound;
        }
    }

    episodes.sort((a, b) => {
        // Sort by season first, then by episode number
        const seasonDiff = (a.season || 1) - (b.season || 1);
        if (seasonDiff !== 0) return seasonDiff;
        return a.number - b.number;
    });

    if (episodes.length === 0) {
        throw new Error('Failed to resolve any episode streaming links.');
    }

    // Build a descriptive page title
    const pageTitle = `${animeName} (Animerulz${seasonCount > 1 ? `, ${seasonCount} seasons` : ''})`;

    return {
        pageTitle,
        resolution: '720p', // Streaming is adaptive, default to 720p
        seasonZipLink: null,
        episodes,
        warnings: warnings.length > 0 ? warnings : undefined,
        totalFound: totalEpisodes,
        resolvedCount,
        fallbackCount: episodes.length - resolvedCount,
    };
}

/**
 * Search a WordPress-based site using standard query params.
 */
export async function searchWordPressSite(
    baseUrl: string,
    query: string
): Promise<{ title: string; url: string }[]> {
    const searchUrl = `${baseUrl.replace(/\/+$/, '')}/?s=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
        throw new Error(`Failed to search WordPress site: HTTP ${res.status}`);
    }
    const html = await res.text();

    const results: { title: string; url: string }[] = [];
    const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
    let articleMatch;
    
    while ((articleMatch = articleRegex.exec(html)) !== null) {
        const articleHtml = articleMatch[1];
        
        const linkMatch = /<h[123][^>]*class="[^"]*(?:entry-title|post-title|title)[^"]*"[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(articleHtml)
            || /<h[123][^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(articleHtml)
            || /<a[^>]+class="[^"]*(?:post-link|entry-title-link)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(articleHtml)
            || /<a[^>]+href="([^"]+)"[^>]*rel="bookmark"[^>]*>([\s\S]*?)<\/a>/i.exec(articleHtml);
            
        if (linkMatch) {
            const url = linkMatch[1];
            const title = linkMatch[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').trim();
            if (url && title && !results.some(r => r.url === url)) {
                results.push({ title, url });
            }
        }
    }

    if (results.length === 0) {
        const backupRegex = /<h[23][^>]*class="[^"]*(?:entry-title|post-title|title)[^"]*"[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = backupRegex.exec(html)) !== null) {
            const url = match[1];
            const title = match[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').trim();
            if (url && title && !results.some(r => r.url === url)) {
                results.push({ title, url });
            }
        }
    }
    
    if (results.length === 0) {
        const fallbackRegex = /<a[^>]+href="([^"]+)"[^>]*bookmark[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = fallbackRegex.exec(html)) !== null) {
            const url = match[1];
            const title = match[2].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#8211;/g, '-').trim();
            if (url && title && !results.some(r => r.url === url)) {
                results.push({ title, url });
            }
        }
    }

    return results.slice(0, 15);
}

/**
 * Scrape BollyFlix movie/series page.
 * Strategy: Find quality headings (e.g. "480p [550MB]"), then extract only the
 * Google Drive link immediately following each heading. All redirect/ad links
 * (fastdlserver.site, linksmd.top, etc.) are filtered based on anchor text,
 * capturing only those that are Google Drive buttons (or direct drive.google.com / gdflix / etc links).
 */
export async function scrapeBollyflix(url: string): Promise<ScrapedResult> {
    const response = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch BollyFlix page: HTTP ${response.status}`);
    }
    const html = await response.text();

    // Extract page title
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        pageTitle = titleMatch[1]
            .replace(/&#8211;/g, '-')
            .replace(/&amp;/g, '&')
            .replace(/&#038;/g, '&')
            .trim();
    }
    const schemaMatch = html.match(/"headline"\s*:\s*"([^"]+)"/);
    if (schemaMatch) {
        pageTitle = schemaMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/').trim();
    }

    // Narrow to post content area only
    let contentHtml = html;
    const contentMatch =
        html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|single-content)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<!--/i) ||
        html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|single-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (contentMatch) {
        contentHtml = contentMatch[1];
    }

    const resolution = detectResolution(html);
    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    let idx = 1;

    interface QualitySection {
        resolution: string;
        size: string;
        headingEnd: number;
    }

    const sections: QualitySection[] = [];

    // Match headings, paragraphs, strong tags that contain resolution info
    const headingPattern = /<(?:p|h[2-6]|strong|span)[^>]*>([\s\S]*?)<\/(?:p|h[2-6]|strong|span)>/gi;
    let hMatch: RegExpExecArray | null;

    while ((hMatch = headingPattern.exec(contentHtml)) !== null) {
        const rawText = hMatch[1].replace(/<[^>]*>/g, '').trim();
        // Must contain a resolution keyword
        const resMatch = rawText.match(/\b(480p|720p|1080p|2160p|4[Kk])\b/i);
        if (!resMatch) continue;

        // Skip headers that are just intro descriptions of the page, e.g. "available in 1080p, 720p & 480p Qualities"
        if (rawText.toLowerCase().includes('qualities') || rawText.toLowerCase().includes('super quality') || rawText.toLowerCase().includes('available in')) {
            continue;
        }

        const res = resMatch[1].toLowerCase() === '4k' ? '2160p' : resMatch[1].toLowerCase();
        const sizeMatch = rawText.match(/\[?\s*(\d+(?:\.\d+)?\s*(?:MB|GB))\s*\]?/i);
        const size = sizeMatch ? sizeMatch[1].trim() : '';

        sections.push({
            resolution: res,
            size,
            headingEnd: hMatch.index + hMatch[0].length,
        });
    }

    // Anchor pattern: href and link text/html
    const anchorPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const endIndex =
            i + 1 < sections.length
                ? sections[i + 1].headingEnd
                : Math.min(section.headingEnd + 3000, contentHtml.length);

        const slice = contentHtml.substring(section.headingEnd, endIndex);
        
        anchorPattern.lastIndex = 0; // reset
        let aMatch: RegExpExecArray | null;
        const foundForSection: { href: string; text: string }[] = [];

        while ((aMatch = anchorPattern.exec(slice)) !== null) {
            const href = aMatch[1];
            const text = aMatch[2].replace(/<[^>]*>/g, '').trim();
            const textLower = text.toLowerCase();
            const hrefLower = href.toLowerCase();

            // Criteria to determine if it is a Google Drive link:
            // 1. Text contains "google drive", "g-drive", "gdrive", or "drive"
            // 2. OR href contains google drive / proxy domains
            const isGoogleDriveLink = 
                textLower.includes('google drive') || 
                textLower.includes('g-drive') || 
                textLower.includes('gdrive') ||
                textLower.includes('drive') ||
                hrefLower.includes('drive.google.com') ||
                hrefLower.includes('gdflix') ||
                hrefLower.includes('gdtot') ||
                hrefLower.includes('gdbot') ||
                hrefLower.includes('driveseed') ||
                hrefLower.includes('drivebot');

            const isExcluded = 
                textLower.includes('download links') || 
                textLower.includes('direct links') ||
                textLower.includes('how to download') ||
                textLower.includes('join us') ||
                textLower.includes('telegram');

            if (isGoogleDriveLink && !isExcluded) {
                foundForSection.push({ href, text });
            }
        }

        if (foundForSection.length > 0) {
            foundForSection.forEach((item, fIdx) => {
                const label = section.size
                    ? `${section.resolution} [${section.size}]` + (foundForSection.length > 1 ? ` - Link ${fIdx + 1}` : '')
                    : section.resolution + (foundForSection.length > 1 ? ` - Link ${fIdx + 1}` : '');
                
                episodes.push({
                    number: idx++,
                    title: label,
                    link: item.href,
                });
            });
        } else {
            warnings.push(`No Google Drive link found for ${section.resolution}${section.size ? ' [' + section.size + ']' : ''}`);
        }
    }

    // Fallback directly from content HTML if no sections matched
    if (episodes.length === 0) {
        anchorPattern.lastIndex = 0;
        let aMatch: RegExpExecArray | null;
        while ((aMatch = anchorPattern.exec(contentHtml)) !== null) {
            const href = aMatch[1];
            const text = aMatch[2].replace(/<[^>]*>/g, '').trim();
            const textLower = text.toLowerCase();
            const hrefLower = href.toLowerCase();

            const isGoogleDriveLink = 
                textLower.includes('google drive') || 
                textLower.includes('g-drive') || 
                textLower.includes('gdrive') ||
                textLower.includes('drive') ||
                hrefLower.includes('drive.google.com') ||
                hrefLower.includes('gdflix') ||
                hrefLower.includes('gdtot') ||
                hrefLower.includes('gdbot') ||
                hrefLower.includes('driveseed') ||
                hrefLower.includes('drivebot');

            const isExcluded = 
                textLower.includes('download links') || 
                textLower.includes('direct links') ||
                textLower.includes('how to download') ||
                textLower.includes('join us') ||
                textLower.includes('telegram');

            if (isGoogleDriveLink && !isExcluded) {
                episodes.push({
                    number: idx++,
                    title: `Google Drive Link ${idx - 1} (${resolution})`,
                    link: href,
                });
            }
        }

        if (episodes.length === 0) {
            throw new Error('No Google Drive download links found on this BollyFlix page.');
        }
    }

    return {
        pageTitle,
        resolution,
        seasonZipLink: null,
        episodes,
        warnings,
        totalFound: episodes.length,
        resolvedCount: episodes.length,
    };
}

/**
 * Scrape ToonPlay streaming data.
 */
export async function scrapeToonplay(
    url: string,
    skipEpisodes: (string | number)[] = [],
    targetSeasonNum?: number
): Promise<ScrapedResult> {
    let toonplayId = '';
    let searchQuery = url.trim();
    const trimmed = url.trim();
    
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            const urlObj = new URL(trimmed);
            if (urlObj.hostname.includes('toonplay.in')) {
                toonplayId = urlObj.searchParams.get('id') || '';
                if (!toonplayId) {
                    const parts = urlObj.pathname.split('/').filter(Boolean);
                    const lastPart = parts[parts.length - 1] || '';
                    if (lastPart.startsWith('series-') || lastPart.startsWith('anime-')) {
                        toonplayId = lastPart;
                        console.log(`[ToonPlay] Extracted series ID from URL path: ${toonplayId}`);
                    } else {
                        // Extract query for search fallback (e.g. series-daemons-of-the-shadow-realm -> daemons of the shadow realm)
                        searchQuery = lastPart.replace(/^series-/, '').replace(/^watch-/, '').replace(/-/g, ' ');
                        console.log(`[ToonPlay] Extracted search query from URL path: "${searchQuery}"`);
                    }
                }
            } else if (urlObj.hostname.includes('animesalt.ac') && urlObj.pathname.includes('/episode/')) {
                const episodeUrl = trimmed;
                console.log(`[ToonPlay] Directly scraping single AnimeSalt episode: ${episodeUrl}`);
                const extractRes = await undiciFetch(
                    `https://anime.streamindia.co.in/api/extract?url=${encodeURIComponent(episodeUrl)}`,
                    {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Referer': 'https://toonplay.in/',
                            'Origin': 'https://toonplay.in'
                        },
                        signal: AbortSignal.timeout(15000),
                    }
                );
                if (!extractRes.ok) throw new Error(`Extract API returned status ${extractRes.status}`);
                const extractData = await extractRes.json() as any;
                const playerUrl = extractData.data?.videoPlayerUrl;
                if (!playerUrl) throw new Error("Could not extract playerUrl from AnimeSalt episode link");

                const streamRes = await undiciFetch(
                    `https://extract.streamindia.co.in/api?url=${encodeURIComponent(playerUrl)}`,
                    {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Referer': 'https://toonplay.in/',
                            'Origin': 'https://toonplay.in'
                        },
                        signal: AbortSignal.timeout(15000),
                    }
                );
                if (!streamRes.ok) throw new Error(`Stream extraction returned status ${streamRes.status}`);
                const streamData = await streamRes.json() as any;
                
                const files = streamData.files || {};
                const m3u8Url = files.hin || files.eng || Object.values(files)[0];
                if (!m3u8Url) throw new Error("No m3u8 stream found in extraction results");

                const epMatch = episodeUrl.match(/(\d+)x(\d+)/) || episodeUrl.match(/episode-\d+/);
                const epNum = epMatch ? parseInt(epMatch[2] || epMatch[0].replace('episode-', '')) : 1;

                return {
                    pageTitle: `Episode ${epNum} (ToonPlay Direct)`,
                    resolution: '720p',
                    seasonZipLink: null,
                    episodes: [{
                        number: epNum,
                        title: `Episode ${epNum}`,
                        link: m3u8Url,
                        streamingUrl: m3u8Url
                    }],
                    totalFound: 1,
                    resolvedCount: 1,
                };
            }
        } catch (err: any) {
            console.warn(`[ToonPlay] Failed to parse URL: ${err.message}`);
        }
    } else {
        toonplayId = trimmed;
    }

    if (!toonplayId) {
        console.log(`[ToonPlay] Searching for query: ${searchQuery}`);
        const searchRes = await undiciFetch(
            `https://animesalt.streamindia.co.in/api/search?q=${encodeURIComponent(searchQuery)}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                    'Referer': 'https://toonplay.in/',
                    'Origin': 'https://toonplay.in'
                },
                signal: AbortSignal.timeout(15000),
            }
        );
        if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            const firstItem = searchData.data?.[0] || searchData.results?.[0];
            if (firstItem && firstItem.id) {
                toonplayId = firstItem.id;
                console.log(`[ToonPlay] Search matched ID: ${toonplayId}`);
            }
        }
    }

    if (!toonplayId) {
        throw new Error(`Could not resolve ToonPlay ID for: ${url}`);
    }

    console.log(`[ToonPlay] Fetching series info for ID: ${toonplayId}`);
    const infoRes = await undiciFetch(
        `https://animesalt.streamindia.co.in/api/info?id=${encodeURIComponent(toonplayId)}`,
        {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Referer': 'https://toonplay.in/',
                'Origin': 'https://toonplay.in'
            },
            signal: AbortSignal.timeout(15000),
        }
    );
    if (!infoRes.ok) {
        throw new Error(`ToonPlay Info API returned status ${infoRes.status}`);
    }
    const infoData = await infoRes.json() as any;
    const anime = infoData.anime;
    if (!anime) {
        throw new Error("No anime data found in Info API response");
    }

    const title = anime.title || `Anime #${toonplayId}`;
    const seasonsList = anime.seasonsList || [];
    
    // Parse season from URL if present
    let targetSeason: number | null = null;
    try {
        const urlObj = new URL(url);
        const seasonParam = urlObj.searchParams.get('season');
        if (seasonParam) targetSeason = parseInt(seasonParam);
    } catch {
        // Not a URL or no season param
    }

    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    let totalEpisodes = 0;
    let resolvedCount = 0;

    for (const seasonObj of seasonsList) {
        const seasonNum = parseInt(seasonObj.season || '1');
        // If targetSeasonNum is specified, only scrape that season!
        if (targetSeasonNum !== undefined && seasonNum !== targetSeasonNum) {
            continue;
        }

        const seasonEps = seasonObj.episodes || [];
        totalEpisodes += seasonEps.length;

        for (const ep of seasonEps) {
            const epNum = ep.number;
            const epTitle = ep.title || `Episode ${epNum}`;
            const epId = ep.id;
            const episodeUrl = epId.startsWith('http') ? epId : `https://animesalt.ac/${epId}`;
            
            if (shouldSkipEpisode(skipEpisodes, epNum, seasonNum)) {
                episodes.push({
                    number: epNum,
                    title: epTitle,
                    link: episodeUrl,
                    season: seasonNum,
                });
                continue;
            }
            
            try {
                const extractRes = await undiciFetch(
                    `https://anime.streamindia.co.in/api/extract?url=${encodeURIComponent(episodeUrl)}`,
                    {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Referer': 'https://toonplay.in/',
                            'Origin': 'https://toonplay.in'
                        },
                        signal: AbortSignal.timeout(15000),
                    }
                );
                
                if (extractRes.ok) {
                    const extractData = await extractRes.json() as any;
                    const playerUrl = extractData.data?.videoPlayerUrl;
                    if (playerUrl) {
                        const streamRes = await undiciFetch(
                            `https://extract.streamindia.co.in/api?url=${encodeURIComponent(playerUrl)}`,
                            {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                                    'Referer': 'https://toonplay.in/',
                                    'Origin': 'https://toonplay.in'
                                },
                                signal: AbortSignal.timeout(15000),
                            }
                        );
                        
                        if (streamRes.ok) {
                            const streamData = await streamRes.json() as any;
                            const files = streamData.files || {};
                            const m3u8Url = files.hin || files.eng || files.jpn || Object.values(files)[0];
                            
                            if (m3u8Url) {
                                episodes.push({
                                    number: epNum,
                                    title: epTitle,
                                    link: m3u8Url,
                                    streamingUrl: m3u8Url,
                                    season: seasonNum,
                                });
                                resolvedCount++;
                            } else {
                                warnings.push(`S${seasonNum} Ep ${epNum}: No streaming URL in files`);
                                episodes.push({
                                    number: epNum,
                                    title: epTitle,
                                    link: episodeUrl,
                                    season: seasonNum,
                                });
                            }
                        } else {
                            warnings.push(`S${seasonNum} Ep ${epNum}: Failed to extract files (Status ${streamRes.status})`);
                            episodes.push({
                                number: epNum,
                                title: epTitle,
                                link: episodeUrl,
                                season: seasonNum,
                            });
                        }
                    } else {
                        warnings.push(`S${seasonNum} Ep ${epNum}: No videoPlayerUrl extracted`);
                        episodes.push({
                            number: epNum,
                            title: epTitle,
                            link: episodeUrl,
                            season: seasonNum,
                        });
                    }
                } else {
                    warnings.push(`S${seasonNum} Ep ${epNum}: Extract API failed (Status ${extractRes.status})`);
                    episodes.push({
                        number: epNum,
                        title: epTitle,
                        link: episodeUrl,
                        season: seasonNum,
                    });
                }
            } catch (err: any) {
                warnings.push(`S${seasonNum} Ep ${epNum}: ${err.message}`);
                episodes.push({
                    number: epNum,
                    title: epTitle,
                    link: episodeUrl,
                    season: seasonNum,
                });
            }

            await new Promise(r => setTimeout(r, 200));
        }
    }

    episodes.sort((a, b) => {
        // Sort by season first, then by episode number
        const seasonDiff = (a.season || 1) - (b.season || 1);
        if (seasonDiff !== 0) return seasonDiff;
        return a.number - b.number;
    });

    return {
        pageTitle: `${title} (ToonPlay)`,
        resolution: '720p',
        seasonZipLink: null,
        episodes,
        warnings: warnings.length > 0 ? warnings : undefined,
        totalFound: totalEpisodes,
        resolvedCount,
        fallbackCount: episodes.length - resolvedCount,
    };
}

/**
 * Scrape AnimeWorld India (watchanimeworld.net)
 */
export async function scrapeAnimeWorld(
    url: string,
    skipEpisodes: (string | number)[] = [],
    targetSeasonNum?: number
): Promise<ScrapedResult> {
    console.log(`[AnimeWorld] Scraping URL: ${url}`);
    
    let slug = '';
    let isMovie = false;
    try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.includes('movies')) {
            isMovie = true;
            slug = parts[parts.indexOf('movies') + 1] || parts[parts.length - 1];
        } else if (parts.includes('series')) {
            slug = parts[parts.indexOf('series') + 1] || parts[parts.length - 1];
        } else {
            slug = parts[parts.length - 1] || '';
        }
    } catch {
        slug = url.split('/').filter(Boolean).pop() || '';
    }

    if (!slug) {
        throw new Error(`Invalid URL: ${url}`);
    }

    const domain = 'https://watchanimeworld.net';
    const detailUrl = isMovie ? `${domain}/movies/${slug}/` : `${domain}/series/${slug}/`;
    
    let html = '';
    try {
        const fetchRes = await fetchHtmlWithProxy(detailUrl);
        html = fetchRes.html;
    } catch (err: any) {
        console.warn(`[AnimeWorld] Direct fetch/proxy failed: ${err.message}. Trying direct fetch...`);
        const resp = await fetch(detailUrl, { headers: HEADERS });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        html = await resp.text();
    }

    const $ = cheerio.load(html);
    const title = $('.entry-title, h1.entry-title').text().trim() || slug;
    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    let resolvedCount = 0;

    if (isMovie) {
        const iframeSources: string[] = [];
        $('iframe').each((i, elem) => {
            const src = $(elem).attr('src') || $(elem).attr('data-src');
            if (src && !src.includes('facebook') && !src.includes('google') && !src.includes('twitter')) {
                iframeSources.push(src.startsWith('//') ? 'https:' + src : src);
            }
        });

        const movieStream = iframeSources[0];
        if (movieStream) {
            episodes.push({
                number: 1,
                title: 'Movie',
                link: movieStream,
                streamingUrl: movieStream,
                season: 1
            });
            resolvedCount = 1;
        } else {
            throw new Error(`No video iframe found on movie page: ${detailUrl}`);
        }
    } else {
        let postId = '';
        const seasonLinks = $('.choose-season .sel-temp a, ul.aa-cnt.sub-menu li a');
        if (seasonLinks.length > 0) {
            postId = seasonLinks.first().attr('data-post') || '';
        }

        if (!postId) {
            const bodyClass = $('body').attr('class') || '';
            const postMatch = bodyClass.match(/postid-(\d+)/);
            if (postMatch) postId = postMatch[1];
        }

        const targetSeason = targetSeasonNum || 1;
        console.log(`[AnimeWorld] Found postId: ${postId}, targetSeason: ${targetSeason}`);

        let rawEpisodes: { number: number; title: string; link: string }[] = [];
        const currentSeasonElem = $('.n_s');
        const currentSeason = currentSeasonElem.length > 0 ? parseInt(currentSeasonElem.text().trim(), 10) : 1;

        if (currentSeason === targetSeason) {
            $('#episode_by_temp li, ul.allEpData li, .allEpData li').each((i, elem) => {
                const link = $(elem).find('a.lnk-blk').attr('href');
                const numEpiText = $(elem).find('span.num-epi').text().trim();
                const epTitle = $(elem).find('h2.entry-title').text().trim();
                
                if (link && numEpiText) {
                    const match = numEpiText.match(/(\d+)x(\d+)/);
                    if (match) {
                        const epNum = parseInt(match[2], 10);
                        rawEpisodes.push({
                            number: epNum,
                            title: epTitle || `Episode ${epNum}`,
                            link: link
                        });
                    }
                }
            });
        }

        if (rawEpisodes.length === 0 && postId) {
            try {
                const ajaxUrl = `${domain}/wp-admin/admin-ajax.php`;
                const bodyParams = new URLSearchParams();
                bodyParams.append('action', 'action_select_season');
                bodyParams.append('season', String(targetSeason));
                bodyParams.append('post', postId);

                const response = await fetch(ajaxUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'User-Agent': HEADERS['User-Agent'],
                        'Referer': detailUrl
                    },
                    body: bodyParams
                });

                if (response.ok) {
                    const ajaxHtml = await response.text();
                    const ajax$ = cheerio.load('<ul class="allEpData">' + ajaxHtml + '</ul>');
                    ajax$('li').each((i, elem) => {
                        const link = ajax$(elem).find('a.lnk-blk').attr('href');
                        const numEpiText = ajax$(elem).find('span.num-epi').text().trim();
                        const epTitle = ajax$(elem).find('h2.entry-title').text().trim();

                        if (link && numEpiText) {
                            const match = numEpiText.match(/(\d+)x(\d+)/);
                            if (match) {
                                const epNum = parseInt(match[2], 10);
                                rawEpisodes.push({
                                    number: epNum,
                                    title: epTitle || `Episode ${epNum}`,
                                    link: link
                                });
                            }
                        }
                    });
                }
            } catch (err: any) {
                console.error(`[AnimeWorld] AJAX season fetch failed: ${err.message}`);
                warnings.push(`AJAX season fetch failed: ${err.message}`);
            }
        }

        if (rawEpisodes.length === 0) {
            throw new Error(`No episodes found for Season ${targetSeason} on AnimeWorld`);
        }

        for (const ep of rawEpisodes) {
            if (shouldSkipEpisode(skipEpisodes, ep.number, targetSeason)) {
                episodes.push({
                    number: ep.number,
                    title: ep.title,
                    link: ep.link,
                    season: targetSeason
                });
                continue;
            }

            try {
                let epHtml = '';
                try {
                    const epFetch = await fetchHtmlWithProxy(ep.link);
                    epHtml = epFetch.html;
                } catch {
                    const epResp = await fetch(ep.link, { headers: HEADERS });
                    epHtml = await epResp.text();
                }

                const ep$ = cheerio.load(epHtml);
                const iframeSources: string[] = [];
                ep$('iframe').each((i, elem) => {
                    const src = ep$(elem).attr('src') || ep$(elem).attr('data-src');
                    if (src && !src.includes('facebook') && !src.includes('google') && !src.includes('twitter')) {
                        iframeSources.push(src.startsWith('//') ? 'https:' + src : src);
                    }
                });

                const streamUrl = iframeSources[0];
                if (streamUrl) {
                    episodes.push({
                        number: ep.number,
                        title: ep.title,
                        link: ep.link,
                        streamingUrl: streamUrl,
                        season: targetSeason
                    });
                    resolvedCount++;
                } else {
                    warnings.push(`S${targetSeason} Ep ${ep.number}: No video iframe found`);
                    episodes.push({
                        number: ep.number,
                        title: ep.title,
                        link: ep.link,
                        season: targetSeason
                    });
                }
            } catch (err: any) {
                warnings.push(`S${targetSeason} Ep ${ep.number}: ${err.message}`);
                episodes.push({
                    number: ep.number,
                    title: ep.title,
                    link: ep.link,
                    season: targetSeason
                });
            }

            await new Promise(r => setTimeout(r, 300));
        }
    }

    return {
        pageTitle: `${title} (AnimeWorld)`,
        resolution: '720p',
        seasonZipLink: null,
        episodes,
        warnings: warnings.length > 0 ? warnings : undefined,
        totalFound: episodes.length,
        resolvedCount
    };
}

/**
 * Scrape AnimixStream (animixstream.com)
 */
export async function scrapeAnimixStream(
    url: string,
    skipEpisodes: (string | number)[] = [],
    targetSeasonNum?: number
): Promise<ScrapedResult> {
    console.log(`[AnimixStream] Scraping URL: ${url}`);

    let slug = '';
    try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        slug = parts[parts.indexOf('anime') + 1] || parts[parts.length - 1];
    } catch {
        slug = url.split('/').filter(Boolean).pop() || '';
    }

    if (!slug) {
        throw new Error(`Invalid AnimixStream URL: ${url}`);
    }

    const domain = 'https://animixstream.com';
    const detailUrl = `${domain}/anime/${slug}/`;

    let html = '';
    try {
        const fetchRes = await fetchHtmlWithProxy(detailUrl);
        html = fetchRes.html;
    } catch (err: any) {
        console.warn(`[AnimixStream] Fetch failed: ${err.message}. Trying direct...`);
        const resp = await fetch(detailUrl, { headers: HEADERS });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        html = await resp.text();
    }

    const $ = cheerio.load(html);
    const title = $('.entry-title, h1.entry-title').text().trim() || slug;
    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    let resolvedCount = 0;

    const rawEpisodes: { number: number; title: string; link: string }[] = [];
    
    $('div.episodelist a, ul.episodes a, div.episodes a, a[href*="/episode/"]').each((i, elem) => {
        const link = $(elem).attr('href');
        const text = $(elem).text().trim();
        if (link) {
            const epNum = extractEpisodeNumber(text) || extractEpisodeNumber(link);
            if (epNum !== null && !rawEpisodes.find(e => e.number === epNum)) {
                rawEpisodes.push({
                    number: epNum,
                    title: text || `Episode ${epNum}`,
                    link: link.startsWith('http') ? link : domain + link
                });
            }
        }
    });

    if (rawEpisodes.length === 0) {
        console.log(`[AnimixStream] No episode links found. Attempting fallback generation...`);
        for (let epNum = 1; epNum <= 50; epNum++) {
            const epLink = `${domain}/episode/${slug}-episode-${epNum}/`;
            rawEpisodes.push({
                number: epNum,
                title: `Episode ${epNum}`,
                link: epLink
            });
        }
    }

    const targetSeason = targetSeasonNum || 1;

    for (const ep of rawEpisodes) {
        if (shouldSkipEpisode(skipEpisodes, ep.number, targetSeason)) {
            episodes.push({
                number: ep.number,
                title: ep.title,
                link: ep.link,
                season: targetSeason
            });
            continue;
        }

        try {
            let epHtml = '';
            let ok = true;
            try {
                const epFetch = await fetchHtmlWithProxy(ep.link);
                epHtml = epFetch.html;
                ok = epFetch.ok;
            } catch {
                const epResp = await fetch(ep.link, { headers: HEADERS });
                ok = epResp.ok;
                if (ok) epHtml = await epResp.text();
            }

            if (!ok && rawEpisodes.length > 50) {
                break;
            }

            if (epHtml) {
                const ep$ = cheerio.load(epHtml);
                const iframeSources: string[] = [];
                ep$('iframe').each((i, elem) => {
                    const src = ep$(elem).attr('src') || ep$(elem).attr('data-src');
                    if (src && !src.includes('facebook') && !src.includes('google') && !src.includes('twitter')) {
                        iframeSources.push(src.startsWith('//') ? 'https:' + src : src);
                    }
                });

                ep$('video source').each((i, elem) => {
                    const src = ep$(elem).attr('src');
                    if (src) iframeSources.push(src);
                });

                const streamUrl = iframeSources[0];
                if (streamUrl) {
                    episodes.push({
                        number: ep.number,
                        title: ep.title,
                        link: ep.link,
                        streamingUrl: streamUrl,
                        season: targetSeason
                    });
                    resolvedCount++;
                } else {
                    if (rawEpisodes.length > 50 && episodes.length > 0 && resolvedCount === 0) {
                        break;
                    }
                    warnings.push(`S${targetSeason} Ep ${ep.number}: No video player source found`);
                    episodes.push({
                        number: ep.number,
                        title: ep.title,
                        link: ep.link,
                        season: targetSeason
                    });
                }
            }
        } catch (err: any) {
            warnings.push(`S${targetSeason} Ep ${ep.number}: ${err.message}`);
            episodes.push({
                number: ep.number,
                title: ep.title,
                link: ep.link,
                season: targetSeason
            });
        }

        await new Promise(r => setTimeout(r, 300));
    }

    return {
        pageTitle: `${title} (AnimixStream)`,
        resolution: '720p',
        seasonZipLink: null,
        episodes,
        warnings: warnings.length > 0 ? warnings : undefined,
        totalFound: episodes.length,
        resolvedCount
    };
}

/**
 * Scrape ToonStream (toonstream.vip) using toon-scraper-package
 */
export async function scrapeToonStream(
    url: string,
    skipEpisodes: (string | number)[] = [],
    targetSeasonNum?: number,
    movieTitle?: string
): Promise<ScrapedResult> {
    console.log(`[ToonStream] Scraping URL: ${url}`);
    
    let origin = 'https://toonstream.vip';
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname.includes('toonstream')) {
            origin = parsedUrl.origin;
        }
    } catch {}

    const config = require('toon-scraper-package/config');
    config.BASE_URL = origin;

    const Anime = require('toon-scraper-package/src/anime');
    const Search = require('toon-scraper-package/src/search');

    const normalizeToonStreamUrl = (sourceUrl: string) => {
        if (!sourceUrl) return '';
        if (sourceUrl.startsWith('//')) return `https:${sourceUrl}`;
        if (sourceUrl.startsWith('/')) return `${origin}${sourceUrl}`;
        return sourceUrl;
    };

    const resolveToonStreamEmbed = async (sourceUrl: string) => {
        const normalizedUrl = normalizeToonStreamUrl(sourceUrl);
        if (!normalizedUrl) return '';

        let parsedSource: URL;
        try {
            parsedSource = new URL(normalizedUrl);
        } catch {
            return normalizedUrl;
        }

        const isEpisodePage = parsedSource.hostname.includes('toonstream') && parsedSource.pathname.includes('/episode/');
        if (!isEpisodePage) {
            return normalizedUrl;
        }

        const response = await fetch(normalizedUrl, { headers: HEADERS });
        const html = await response.text();
        const $ = cheerio.load(html);
        const iframeSources: string[] = [];

        $('iframe').each((_, elem) => {
            const src = $(elem).attr('data-src') || $(elem).attr('src');
            if (src) iframeSources.push(normalizeToonStreamUrl(src));
        });

        return iframeSources.find(src => src.includes('trembed=')) || iframeSources[0] || normalizedUrl;
    };

    let slug = '';
    let type: 'series' | 'movies' = 'series';
    try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.pathname.split('/').filter(Boolean);
        if (parts.includes('movies')) {
            type = 'movies';
            slug = parts[parts.indexOf('movies') + 1] || parts[parts.length - 1];
        } else if (parts.includes('series')) {
            type = 'series';
            slug = parts[parts.indexOf('series') + 1] || parts[parts.length - 1];
        } else {
            slug = parts[parts.length - 1] || '';
        }
    } catch {
        slug = url.split('/').filter(Boolean).pop() || '';
    }

    if (!slug && movieTitle) {
        console.log(`[ToonStream] No slug in URL. Fallback search for title: ${movieTitle}`);
        try {
            const searchRes = await Search.live_search(movieTitle);
            const item = searchRes?.result?.series?.[0] || searchRes?.result?.movies?.[0];
            if (item && item.slug) {
                slug = item.slug;
                type = searchRes?.result?.series?.[0] ? 'series' : 'movies';
            }
        } catch (searchErr: any) {
            console.error(`[ToonStream] Live search failed: ${searchErr.message}`);
        }
    }

    if (!slug) {
        throw new Error(`Could not determine ToonStream slug/ID for URL: ${url}`);
    }

    console.log(`[ToonStream] Fetching info for slug: ${slug}, type: ${type}`);
    const info = await Anime.movie_or_series_info(slug, type);
    if (!info) {
        throw new Error(`Failed to fetch ToonStream info for: ${slug}`);
    }

    const title = info.title || slug;
    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    let resolvedCount = 0;

    const targetSeason = targetSeasonNum || 1;

    if (type === 'movies') {
        const sources = info.sources || [];
        const streamUrl = sources[0] ? await resolveToonStreamEmbed(sources[0]) : '';
        if (streamUrl) {
            episodes.push({
                number: 1,
                title: 'Movie',
                link: streamUrl,
                streamingUrl: streamUrl,
                season: 1
            });
            resolvedCount = 1;
        } else {
            throw new Error(`No streaming source found for movie: ${slug}`);
        }
    } else {
        const seasonsMap = info.seasons || {};
        const seasonEpisodes = seasonsMap[targetSeason] || [];

        for (const ep of seasonEpisodes) {
            const epNum = ep.episode;
            const epTitle = ep.episode_slug || `Episode ${epNum}`;

            if (shouldSkipEpisode(skipEpisodes, epNum, targetSeason)) {
                episodes.push({
                    number: epNum,
                    title: `Episode ${epNum}`,
                    link: `${origin}/episode/${ep.episode_slug}/`,
                    season: targetSeason
                });
                continue;
            }

            try {
                const sources = await Anime.fetch_source(ep.episode_slug, 'series');
                const streamUrl = sources?.[0]
                    ? await resolveToonStreamEmbed(sources[0])
                    : await resolveToonStreamEmbed(`${origin}/episode/${ep.episode_slug}/`);
                if (streamUrl) {
                    episodes.push({
                        number: epNum,
                        title: `Episode ${epNum}`,
                        link: `${origin}/episode/${ep.episode_slug}/`,
                        streamingUrl: streamUrl,
                        season: targetSeason
                    });
                    resolvedCount++;
                } else {
                    warnings.push(`S${targetSeason} Ep ${epNum}: No streaming source found`);
                    episodes.push({
                        number: epNum,
                        title: `Episode ${epNum}`,
                        link: `${origin}/episode/${ep.episode_slug}/`,
                        season: targetSeason
                    });
                }
            } catch (err: any) {
                warnings.push(`S${targetSeason} Ep ${epNum}: ${err.message}`);
                episodes.push({
                    number: epNum,
                    title: `Episode ${epNum}`,
                    link: `${origin}/episode/${ep.episode_slug}/`,
                    season: targetSeason
                });
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }

    return {
        pageTitle: `${title} (ToonStream)`,
        resolution: '720p',
        seasonZipLink: null,
        episodes,
        warnings: warnings.length > 0 ? warnings : undefined,
        totalFound: episodes.length,
        resolvedCount
    };
}

/**
 * Scrape YouTube Source (Muse India / Ani-One India)
 */
export async function scrapeYouTubeSource(
    url: string,
    sourceName: string,
    skipEpisodes: (string | number)[] = [],
    targetSeasonNum?: number
): Promise<ScrapedResult> {
    console.log(`[YouTube Scraper - ${sourceName}] Scraping URL: ${url}`);

    let channelId = '';
    let playlistId = '';

    try {
        const urlObj = new URL(url);
        playlistId = urlObj.searchParams.get('list') || '';
        
        if (!playlistId) {
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.includes('channel')) {
                channelId = parts[parts.indexOf('channel') + 1] || '';
            } else if (parts.includes('playlist')) {
                playlistId = parts[parts.indexOf('playlist') + 1] || '';
            } else if (urlObj.pathname.includes('@')) {
                const handle = parts.find(p => p.startsWith('@')) || '';
                if (handle) {
                    console.log(`[YouTube Scraper] Resolving handle ${handle} to channel ID...`);
                    const channelPageRes = await fetch(`https://www.youtube.com/${handle}/videos`, { headers: HEADERS });
                    if (channelPageRes.ok) {
                        const channelHtml = await channelPageRes.text();
                        const match = channelHtml.match(/"externalChannelId"\s*:\s*"(UC[^"]+)"/) || 
                                      channelHtml.match(/"channelId"\s*:\s*"(UC[^"]+)"/);
                        if (match) {
                            channelId = match[1];
                            console.log(`[YouTube Scraper] Resolved ${handle} to channel ID: ${channelId}`);
                        }
                    }
                }
            }
        }
    } catch (err: any) {
        console.warn(`[YouTube Scraper] Error parsing URL: ${err.message}`);
    }

    if (!channelId && !playlistId) {
        if (url.startsWith('UC')) {
            channelId = url;
        } else if (url.startsWith('PL')) {
            playlistId = url;
        } else {
            throw new Error(`Could not extract YouTube Channel or Playlist ID from: ${url}`);
        }
    }

    const feedUrl = playlistId 
        ? `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`
        : `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

    console.log(`[YouTube Scraper] Fetching XML feed: ${feedUrl}`);
    const resp = await fetch(feedUrl, { headers: HEADERS });
    if (!resp.ok) {
        throw new Error(`Failed to fetch YouTube RSS feed: HTTP ${resp.status}`);
    }
    const xmlText = await resp.text();

    const $ = cheerio.load(xmlText, { xmlMode: true });
    const episodes: ScrapedEpisode[] = [];
    const warnings: string[] = [];
    const targetSeason = targetSeasonNum || 1;
    let resolvedCount = 0;

    $('entry').each((i, elem) => {
        const videoId = $(elem).find('yt\\:videoId, videoId').text().trim();
        const title = $(elem).find('title').text().trim();
        
        if (videoId && title) {
            const epNum = extractEpisodeNumber(title);
            if (epNum !== null) {
                const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                
                if (shouldSkipEpisode(skipEpisodes, epNum, targetSeason)) {
                    episodes.push({
                        number: epNum,
                        title: title,
                        link: `https://www.youtube.com/watch?v=${videoId}`,
                        season: targetSeason
                    });
                } else {
                    episodes.push({
                        number: epNum,
                        title: title,
                        link: `https://www.youtube.com/watch?v=${videoId}`,
                        streamingUrl: embedUrl,
                        season: targetSeason
                    });
                    resolvedCount++;
                }
            }
        }
    });

    if (playlistId && episodes.length < 15) {
        try {
            console.log(`[YouTube Scraper] Scraping playlist page for full list...`);
            const playPageRes = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, { headers: HEADERS });
            if (playPageRes.ok) {
                const playHtml = await playPageRes.text();
                const videoRegex = /"videoId"\s*:\s*"([^"]+)"[\s\S]*?"title"\s*:\s*{\s*"runs"\s*:\s*\[\s*{\s*"text"\s*:\s*"([^"]+)"/g;
                let match;
                while ((match = videoRegex.exec(playHtml)) !== null) {
                    const videoId = match[1];
                    const title = match[2];
                    const epNum = extractEpisodeNumber(title);
                    if (epNum !== null && !episodes.find(e => e.number === epNum)) {
                        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                        if (shouldSkipEpisode(skipEpisodes, epNum, targetSeason)) {
                            episodes.push({
                                number: epNum,
                                title: title,
                                link: `https://www.youtube.com/watch?v=${videoId}`,
                                season: targetSeason
                            });
                        } else {
                            episodes.push({
                                number: epNum,
                                title: title,
                                link: `https://www.youtube.com/watch?v=${videoId}`,
                                streamingUrl: embedUrl,
                                season: targetSeason
                            });
                            resolvedCount++;
                        }
                    }
                }
            }
        } catch (e: any) {
            console.warn(`[YouTube Scraper] Playlist page HTML scrape failed: ${e.message}`);
        }
    }

    episodes.sort((a, b) => a.number - b.number);

    return {
        pageTitle: `${sourceName} Channel/Playlist`,
        resolution: '1080p',
        seasonZipLink: null,
        episodes,
        warnings: warnings.length > 0 ? warnings : undefined,
        totalFound: episodes.length,
        resolvedCount
    };
}
