import { NextRequest, NextResponse } from 'next/server';

interface ScrapedEpisode {
    number: number;
    title: string;
    link: string;
}

interface ScrapeResult {
    pageTitle: string;
    resolution: string;
    seasonZipLink: string | null;
    episodes: ScrapedEpisode[];
}

/**
 * Detect resolution from the page title or heading.
 * e.g. "Naruto: Shippuden (Season 1) [Hindi-English] 720p" → "720p"
 */
function detectResolution(text: string): string {
    const match = text.match(/\b(360p|480p|720p|1080p|2160p|4K)\b/i);
    if (match) {
        const res = match[1].toLowerCase();
        if (res === '4k') return '2160p';
        return res;
    }
    return '720p'; // default fallback
}

/**
 * Extract episode number from text like "Episode 01", "Ep 5", "Episode-12", etc.
 */
function extractEpisodeNumber(text: string): number | null {
    // Match patterns: "Episode 01", "Episode-5", "Ep 12", "Ep.3", "E01"
    const match = text.match(/(?:Episode|Ep\.?|E)\s*[-.]?\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);

    // Fallback: just a standalone number like "01" or "1"
    const numMatch = text.match(/^\s*(\d+)\s*$/);
    if (numMatch) return parseInt(numMatch[1], 10);

    return null;
}

/**
 * Generic HTML scraper that parses episode links from any site.
 * Looks for <a> tags inside headings (h1-h6) or standalone <a> tags
 * that contain episode-related text.
 */
function parseEpisodes(html: string): ScrapeResult {
    // Extract page title
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        pageTitle = titleMatch[1].replace(/&#8211;/g, '-').replace(/&amp;/g, '&').trim();
    }

    // Try to get a more descriptive title from structured data
    const schemaMatch = html.match(/"headline"\s*:\s*"([^"]+)"/);
    if (schemaMatch) {
        pageTitle = schemaMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/').trim();
    }

    const resolution = detectResolution(html);

    let seasonZipLink: string | null = null;
    const episodes: ScrapedEpisode[] = [];

    // Generic pattern: find all <a> tags with href, inside <h1>-<h6> or standalone
    // Pattern 1: <h3><a href="...">Episode XX</a></h3>
    // Pattern 2: <a href="..." class="...">Episode XX</a>
    const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
        const href = match[1].trim();
        // Strip HTML tags from the anchor text
        const rawText = match[2].replace(/<[^>]*>/g, '').trim();

        if (!rawText || !href) continue;

        // Skip internal/navigation links
        if (href.startsWith('#') || href.startsWith('javascript:')) continue;

        // Check for "Season Zip" / "Full Season" / "Complete Season"
        if (/season\s*zip|full\s*season|complete\s*season|batch\s*download/i.test(rawText)) {
            seasonZipLink = href;
            continue;
        }

        // Check for episode patterns
        const epNum = extractEpisodeNumber(rawText);
        if (epNum !== null) {
            // Avoid duplicates
            if (!episodes.find(e => e.number === epNum)) {
                episodes.push({
                    number: epNum,
                    title: rawText,
                    link: href,
                });
            }
        }
    }

    // Sort by episode number
    episodes.sort((a, b) => a.number - b.number);

    return {
        pageTitle,
        resolution,
        seasonZipLink,
        episodes,
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        // Fetch the page server-side (no CORS issues)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            },
            signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch URL: HTTP ${response.status}` },
                { status: 502 }
            );
        }

        const html = await response.text();
        const result = parseEpisodes(html);

        if (result.episodes.length === 0) {
            return NextResponse.json(
                {
                    error: 'No episodes found on this page. Make sure the page contains links with "Episode" text.',
                    pageTitle: result.pageTitle,
                },
                { status: 404 }
            );
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Scrape error:', error);

        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Request timed out. The source site may be slow or unreachable.' },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { error: `Scraping failed: ${error.message}` },
            { status: 500 }
        );
    }
}
