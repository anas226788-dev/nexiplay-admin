import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': 'https://bollyflix.co.za/'
};

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader?.trim();
    const cronKeyHeader = request.headers.get('x-cron-key')?.trim();
    const { searchParams } = new URL(request.url);
    const keyParam = (searchParams.get('key') || searchParams.get('token') || searchParams.get('secret'))?.trim();
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (isVercelCron) return true;

    const validKeys = [
        'nexi_cron_5f9a8b7c6d1e4023a1',
        'nexiplay_novel_sync_2026',
        'nexiplay_cron_2026'
    ];
    if (cronSecret) validKeys.push(cronSecret);

    if (keyParam && validKeys.includes(keyParam)) return true;
    if (bearerToken && validKeys.includes(bearerToken)) return true;
    if (cronKeyHeader && validKeys.includes(cronKeyHeader)) return true;

    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const host = request.headers.get('host') || '';
    const isSameOrigin = (origin && host && origin.includes(host)) || (referer && host && referer.includes(host));
    const isAdminHeader = request.headers.get('x-admin-sync') === 'true';

    if (isSameOrigin || isAdminHeader) return true;
    if (!cronSecret) return true;

    return false;
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    // 1. Authorization Check for cron-job.org / Vercel
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { 
                success: false, 
                error: 'Unauthorized. Invalid or missing cron key. Pass ?key=nexiplay_cron_2026' 
            }, 
            { status: 401 }
        );
    }

    try {
        const supabase = getAdminSupabase();
        const MAX_TIME_MS = 22000; // Finish within 22s for cron-job.org

        // 1. Get current Bollyflix domain from app_settings
        const { data: settings } = await supabase
            .from('app_settings')
            .select('bollyflix_url')
            .eq('id', 1)
            .single();

        const bollyBase = (settings?.bollyflix_url || 'https://bollyflix.co.za/').replace(/\/+$/, '');

        // 2. Fetch Bollyflix homepage
        const homeRes = await fetch(`${bollyBase}/`, {
            headers: HEADERS,
            signal: AbortSignal.timeout(10000),
            cache: 'no-store'
        });

        if (!homeRes.ok) {
            return NextResponse.json({ success: false, error: `Bollyflix HTTP ${homeRes.status}` }, { status: 502 });
        }

        const html = await homeRes.text();
        const $ = cheerio.load(html);

        const foundArticles: { link: string; title: string; poster: string }[] = [];
        $('article').each((_, article) => {
            const link = $(article).find('a').first().attr('href');
            const title = $(article).find('a').first().text().trim() || $(article).find('.entry-title').text().trim();
            const poster = $(article).find('img').first().attr('src') || '';
            if (link && link.includes(new URL(bollyBase).host) && !link.includes('/movies-by-')) {
                foundArticles.push({ link, title, poster });
            }
        });

        const synced: string[] = [];
        const skipped: string[] = [];

        // 3. Process top 10 articles
        for (let i = 0; i < Math.min(10, foundArticles.length); i++) {
            if (Date.now() - startTime > MAX_TIME_MS) {
                console.log('[Cron Bollyflix] Time limit reached, finishing response.');
                break;
            }

            const item = foundArticles[i];
            try {
                const pageRes = await fetch(item.link, { headers: HEADERS, signal: AbortSignal.timeout(8000), cache: 'no-store' });
                if (!pageRes.ok) continue;
                const pageHtml = await pageRes.text();
                const $p = cheerio.load(pageHtml);

                const rawTitle = $p('h1.entry-title, h1.title').first().text().trim() || $p('title').text().trim();
                const poster = $p('.entry-content img, .post-content img, article img').first().attr('src') || item.poster || '';

                const yearMatch = rawTitle.match(/\b(202\d|201\d|19\d\d)\b/);
                const release_year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

                const title = rawTitle
                    .replace(/^Download\s+/i, '')
                    .replace(/\s*480p\s*\|\s*720p\s*\|\s*1080p.*/i, '')
                    .replace(/\s*Dual Audio.*/i, '')
                    .replace(/\s*\[.*?\]/g, '')
                    .replace(/\(.*?\)/g, '')
                    .replace(/\s*Movie$/i, '')
                    .trim() || rawTitle;

                const isSeries = /series|season|drama|kdrama/i.test(rawTitle) || /series|season/i.test(item.link);
                const type = isSeries ? 'series' : 'movie';

                let language = 'Hindi';
                if (/dual\s*audio/i.test(rawTitle)) language = 'Dual Audio';
                else if (/english/i.test(rawTitle)) language = 'English';
                else if (/korean/i.test(rawTitle)) language = 'Korean';
                else if (/tamil/i.test(rawTitle)) language = 'Tamil';
                else if (/telugu/i.test(rawTitle)) language = 'Telugu';

                const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
                const slug = `${slugBase}-${release_year}`;

                // Check duplicate
                const { data: existing } = await supabase
                    .from('movies')
                    .select('id')
                    .or(`slug.eq.${slug},title.ilike.%${title}%`)
                    .limit(1);

                if (existing && existing.length > 0) {
                    skipped.push(title);
                    continue;
                }

                const descEl = $p('.entry-content p').filter((_, p) => $p(p).text().includes('Download') || $p(p).text().includes('movie')).first();
                const description = descEl.length ? descEl.text().trim() : `Download ${title} (${release_year}) available in Nexiplay`;

                // Collect and deduplicate download links by resolution
                const resMap = new Map<string, { resolution: string; file_size: string; gdrive_link: string }>();
                $p('h1, h2, h3, h4, h5, p').each((_, el) => {
                    const text = $p(el).text().trim();
                    if (/480p|720p|1080p|2160p|4k/i.test(text) && !text.includes('qualities') && !text.includes('movies-by')) {
                        const resMatch = text.match(/\b(480p|720p|1080p|2160p|4k)\b/i);
                        const res = resMatch ? resMatch[1].toLowerCase() : '720p';
                        const sizeMatch = text.match(/\[?\s*(\d+(?:\.\d+)?\s*(?:MB|GB)(?:\/E)?)\s*\]?/i);
                        const size = sizeMatch ? sizeMatch[1].trim() : '';

                        $p(el).nextUntil('h1, h2, h3, h4, h5, p:has(strong)').find('a').each((__, a) => {
                            const href = $p(a).attr('href');
                            const linkText = $p(a).text().trim();
                            if (href && !href.startsWith('#') && (linkText.includes('Google Drive') || linkText.includes('Download') || href.includes('fastdl') || href.includes('linksmod') || href.includes('gdflix'))) {
                                if (!resMap.has(res)) {
                                    resMap.set(res, { resolution: res, file_size: size, gdrive_link: href });
                                }
                            }
                        });
                    }
                });

                // Insert movie
                const { data: inserted, error: insertError } = await supabase
                    .from('movies')
                    .insert({
                        title,
                        slug,
                        type,
                        release_year,
                        poster_url: poster,
                        description,
                        language,
                        source: 'WEB-DL',
                        format: 'MKV',
                        subtitle: 'English',
                        is_trending: false,
                        trending_badge: 'false',
                        scraper_url: item.link,
                        scraper_source: 'bollyflix',
                        app_streaming_enabled: true
                    })
                    .select('id, title')
                    .single();

                if (insertError) {
                    console.error('Movie insert error:', insertError);
                    continue;
                }

                // Insert links
                if (resMap.size > 0) {
                    const linkInserts = Array.from(resMap.values()).map(r => ({
                        movie_id: inserted.id,
                        resolution: r.resolution,
                        file_size: r.file_size || null,
                        gdrive_link: r.gdrive_link,
                        link_status: { gdrive_link: 'ACTIVE' }
                    }));
                    await supabase.from('download_links').insert(linkInserts);
                }

                // Insert update notification
                await supabase.from('updates').insert({
                    content_id: inserted.id,
                    title: inserted.title,
                    poster_url: poster,
                    content_type: type,
                    update_type: 'movie',
                    is_active: true
                });

                synced.push(title);
            } catch (err: any) {
                console.error('Error syncing Bollyflix item:', err.message);
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            synced_count: synced.length,
            synced_titles: synced,
            skipped_count: skipped.length,
            skipped_titles: skipped
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    } catch (error: any) {
        console.error('Sync Bollyflix error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            duration_ms: Date.now() - startTime 
        }, { 
            status: 500,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    }
}

export const POST = GET;
