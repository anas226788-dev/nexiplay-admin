import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeSource } from '@/lib/scraper-utils';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestId, url, source, type: selectedType } = body;

        if (!requestId) {
            return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
        }

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        if (!source || !['rareanimes', 'bollyflix', 'movielink'].includes(source)) {
            return NextResponse.json({ error: 'Invalid scraper source' }, { status: 400 });
        }

        // 1. Scrape the content page
        const scrapedResult = await scrapeSource(url, source);

        // 2. Extract metadata
        const pageTitle = scrapedResult.pageTitle || 'Unknown Title';
        
        // Extract release year (looks for four-digit number between 1980 and 2030)
        let releaseYear = new Date().getFullYear();
        const yearMatch = pageTitle.match(/\b(19[89]\d|20[0-2]\d|2030)\b/);
        if (yearMatch) {
            releaseYear = parseInt(yearMatch[1], 10);
        }

        // Use selected type if provided, otherwise infer content type
        let type: 'movie' | 'series' | 'anime' = 'movie';
        if (selectedType && ['movie', 'series', 'anime'].includes(selectedType)) {
            type = selectedType;
        } else if (source === 'rareanimes') {
            type = 'anime';
        } else if (/movie/i.test(pageTitle) || /movie/i.test(url)) {
            type = 'movie';
        } else if (
            /season|series|episodes|ep\b|s\d+/i.test(pageTitle) ||
            scrapedResult.episodes.length > 1
        ) {
            type = 'series';
        }

        // Standardize clean title
        let cleanTitle = pageTitle
            .replace(/\b(19[89]\d|20[0-2]\d|2030)\b/g, '') // Remove year
            .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '') // Remove parentheses/brackets
            .replace(/download|watch|online|dual|audio|hindi|english|multi|subs?/gi, '') // Remove common keywords
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleanTitle) cleanTitle = pageTitle;

        // Poster URL (usually wordpress has open graph image, or we can use a placeholder)
        let posterUrl = '';
        
        // Try to fetch page and extract og:image if scrapeSource didn't return it
        try {
            const pageRes = await fetch(url);
            if (pageRes.ok) {
                const pageHtml = await pageRes.text();
                const ogImageMatch = pageHtml.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
                    || pageHtml.match(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
                if (ogImageMatch) {
                    posterUrl = ogImageMatch[1];
                }
            }
        } catch (e) {
            console.warn('Failed to extract poster image URL:', e);
        }

        // Formulate scraped_data payload
        const scrapedData: any = {
            title: cleanTitle,
            original_title: pageTitle,
            type,
            release_year: releaseYear,
            poster_url: posterUrl || null,
            description: '',
            source_url: url,
            scraper_source: source,
            scraper_resolution: scrapedResult.resolution || '720p',
            downloads: [],
            seasons: []
        };

        // Populate download options based on content type
        if (type === 'movie') {
            scrapedData.downloads = scrapedResult.episodes.map(ep => {
                let quality = scrapedResult.resolution || '720p';
                if (/\b480p\b/i.test(ep.title)) quality = '480p';
                else if (/\b720p\b/i.test(ep.title)) quality = '720p';
                else if (/\b1080p\b/i.test(ep.title)) quality = '1080p';
                else if (/\b2160p\b/i.test(ep.title)) quality = '2160p';

                return {
                    quality,
                    fileSize: ep.title.match(/\b\d+(?:\.\d+)?\s*(?:MB|GB)\b/i)?.[0] || '1GB',
                    fileUrl: ep.link
                };
            });
        } else {
            // For series/anime, group as Season 1
            scrapedData.seasons = [
                {
                    season_number: 1,
                    episodes: scrapedResult.episodes.map(ep => {
                        let resolution = scrapedResult.resolution || '720p';
                        if (/360p/i.test(ep.title)) resolution = '360p';
                        else if (/480p/i.test(ep.title)) resolution = '480p';
                        else if (/720p/i.test(ep.title)) resolution = '720p';
                        else if (/1080p/i.test(ep.title)) resolution = '1080p';

                        const megaLink = ep.link.includes('mega.nz') ? ep.link : undefined;
                        const gdriveLink = ep.link.includes('drive.google.com') || ep.link.includes('gdrive') ? ep.link : undefined;

                        return {
                            episode_number: ep.number,
                            episode_title: ep.title.replace(/Episode\s*\d+/i, '').trim() || `Episode ${ep.number}`,
                            download_links: [
                                {
                                    resolution,
                                    file_size: ep.title.match(/\b\d+(?:\.\d+)?\s*(?:MB|GB)\b/i)?.[0] || '',
                                    mega_link: megaLink || (!gdriveLink ? ep.link : undefined),
                                    gdrive_link: gdriveLink || undefined
                                }
                            ]
                        };
                    })
                }
            ];
        }

        // 3. Update the request in supabase
        const { error: updateError } = await supabase
            .from('content_requests')
            .update({
                status: 'review',
                scraper_source: source,
                source_url: url,
                scraped_data: scrapedData
            })
            .eq('id', requestId);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true, data: scrapedData });

    } catch (error: any) {
        console.error('Agent import error:', error);
        return NextResponse.json(
            { error: `Import failed: ${error.message}` },
            { status: 500 }
        );
    }
}
