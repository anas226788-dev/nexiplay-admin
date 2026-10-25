import { NextRequest, NextResponse } from 'next/server';
import { supabaseNovels } from '@/lib/supabase-novels';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const R2_BUCKET = process.env.R2_BUCKET || 'nexiplay-novels';
const HAS_R2 = !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

const s3 = HAS_R2
    ? new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT || '',
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
        }
    })
    : null;

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get('key');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (isVercelCron) return true;

    // Supported secret keys (includes env secret and default keys)
    const validKeys = [
        'nexi_cron_5f9a8b7c6d1e4023a1',
        'nexiplay_novel_sync_2026'
    ];
    if (cronSecret) validKeys.push(cronSecret);

    if (keyParam && validKeys.includes(keyParam)) return true;
    if (bearerToken && validKeys.includes(bearerToken)) return true;

    // Allow requests originating from the admin UI
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const host = request.headers.get('host') || '';
    const isSameOrigin = (origin && host && origin.includes(host)) || (referer && host && referer.includes(host));
    const isAdminHeader = request.headers.get('x-admin-sync') === 'true';

    if (isSameOrigin || isAdminHeader) return true;

    // If no secret configured at all in Vercel, allow operation
    if (!cronSecret) return true;

    return false;
}

async function getGolponirSession() {
    const initRes = await fetch('https://golponir.com/books', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        cache: 'no-store'
    });
    
    // Extract Set-Cookie headers
    const cookiesHeader = initRes.headers.getSetCookie 
        ? initRes.headers.getSetCookie() 
        : [initRes.headers.get('set-cookie') || ''];
        
    const cookieString = cookiesHeader.filter(Boolean).map(c => c.split(';')[0]).join('; ');
    const xsrfMatch = cookieString.match(/XSRF-TOKEN=([^;]+)/);
    const xsrfToken = xsrfMatch ? decodeURIComponent(xsrfMatch[1]) : '';

    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://golponir.com/books',
        'Origin': 'https://golponir.com',
        'Cookie': cookieString,
        'X-XSRF-TOKEN': xsrfToken
    };
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    // 1. Validate Secret Authorization
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized. Invalid or missing cron key.' },
            { status: 401 }
        );
    }

    try {
        console.log('[Cron Sync Novels] Starting automatic synchronization with Golponir...');

        const MAX_TIME_MS = 25000; // 25-second safety deadline to avoid cron-job.org / Vercel timeout

        // 2. Obtain session cookies from Golponir
        const headers = await getGolponirSession();

        // 3. Fetch all existing novels in Supabase
        const { data: supaNovels, error: supaErr } = await supabaseNovels
            .from('novels')
            .select('id, title, slug, status, cover_url, author, genre')
            .limit(2000);

        if (supaErr || !supaNovels) {
            throw new Error(`Failed to load Supabase novels: ${supaErr?.message}`);
        }

        const supaBySlug = new Map<string, any>();
        const supaByTitle = new Map<string, any>();
        for (const n of supaNovels) {
            if (n.slug) supaBySlug.set(n.slug.toLowerCase().trim(), n);
            if (n.title) supaByTitle.set(n.title.toLowerCase().trim(), n);
        }

        // 4. Collect running/ongoing novels from our database (PRIORITY 1)
        const ongoingSupaNovels = supaNovels.filter(n => n.status === 'ongoing' || !n.status);
        console.log(`[Cron Sync Novels] Found ${ongoingSupaNovels.length} ongoing novel(s) in Supabase.`);

        // 5. Fetch recently updated books from Golponir feed (PRIORITY 2: for new discoveries)
        let updatedBooks: any[] = [];
        try {
            const updatedRes = await fetch('https://golponir.com/api/books', {
                method: 'POST',
                headers,
                body: JSON.stringify({ page: 1, per_page: 30, completion_status: 'all' }),
                cache: 'no-store'
            });

            if (updatedRes.ok) {
                const updatedJson = await updatedRes.json();
                updatedBooks = updatedJson.data || [];
            }
        } catch (fetchErr: any) {
            console.warn('[Cron Sync Novels] Could not fetch global books feed:', fetchErr.message);
        }

        // 6. Merge lists: Put database's ongoing novels FIRST, then newly discovered books from Golponir
        const booksToProcess: Array<{
            slug: string;
            name: string;
            author?: string;
            image?: string;
            genres?: string;
            completion_status?: string;
            episode_count?: number;
            existingNovel?: any;
        }> = [];

        const seenSlugs = new Set<string>();

        // Add DB ongoing novels first
        for (const on of ongoingSupaNovels) {
            if (!on.slug) continue;
            const sKey = on.slug.toLowerCase().trim();
            seenSlugs.add(sKey);
            booksToProcess.push({
                slug: on.slug,
                name: on.title,
                author: on.author,
                image: on.cover_url,
                genres: on.genre,
                existingNovel: on
            });
        }

        // Add updated books from Golponir
        for (const b of updatedBooks) {
            if (!b.slug) continue;
            const sKey = b.slug.toLowerCase().trim();
            if (!seenSlugs.has(sKey)) {
                seenSlugs.add(sKey);
                booksToProcess.push({
                    slug: b.slug,
                    name: b.name,
                    author: b.author,
                    image: b.image,
                    genres: b.genres,
                    completion_status: b.completion_status,
                    episode_count: b.episode_count,
                    existingNovel: supaBySlug.get(sKey) || supaByTitle.get((b.name || '').toLowerCase().trim())
                });
            }
        }

        console.log(`[Cron Sync Novels] Total books queued for update check: ${booksToProcess.length}`);

        // 7. Batch-fetch existing chapter numbers for all known novels
        const knownNovelIds = booksToProcess
            .map(b => b.existingNovel?.id)
            .filter(Boolean) as string[];

        const existingChaptersMap = new Map<string, Set<number>>();
        if (knownNovelIds.length > 0) {
            const { data: allChapterRows } = await supabaseNovels
                .from('novel_chapters')
                .select('novel_id, chapter_number')
                .in('novel_id', knownNovelIds);

            for (const row of allChapterRows || []) {
                if (!existingChaptersMap.has(row.novel_id)) {
                    existingChaptersMap.set(row.novel_id, new Set<number>());
                }
                existingChaptersMap.get(row.novel_id)!.add(row.chapter_number);
            }
        }

        let totalNewChaptersAdded = 0;
        const syncDetails: Array<{ novel: string; chaptersAdded: number; chapterNumbers: number[] }> = [];

        // 8. Process each book
        for (const book of booksToProcess) {
            if (Date.now() - startTime > MAX_TIME_MS) {
                console.warn(`[Cron Sync Novels] Time threshold reached (${Date.now() - startTime}ms), completing response gracefully.`);
                break;
            }

            const slugKey = book.slug.toLowerCase().trim();
            const titleKey = (book.name || '').toLowerCase().trim();
            let novel = book.existingNovel || supaBySlug.get(slugKey) || supaByTitle.get(titleKey);
            let novelId = novel?.id;

            // If completely new novel discovered on Golponir, insert into Supabase
            if (!novel) {
                novelId = crypto.randomUUID();
                const newNovelData = {
                    id: novelId,
                    title: book.name,
                    slug: book.slug,
                    author: book.author || 'Golponir',
                    genre: book.genres || 'Romantic',
                    cover_url: book.image || null,
                    description: `${book.name} - ${book.author || 'Golponir'} এর উপন্যাস।`,
                    status: book.completion_status === 'completed' ? 'completed' : 'ongoing',
                    created_at: new Date().toISOString()
                };

                const { error: createErr } = await supabaseNovels.from('novels').insert(newNovelData);
                if (createErr) {
                    console.error(`[Cron Sync Novels] Failed to create novel "${book.name}":`, createErr.message);
                    continue;
                }
                novel = newNovelData;
                supaBySlug.set(slugKey, novel);
                supaByTitle.set(titleKey, novel);
                existingChaptersMap.set(novelId, new Set<number>());
                console.log(`[Cron Sync Novels] Created new novel "${book.name}" (ID: ${novelId})`);
            } else if (book.image && (!novel.cover_url || novel.cover_url.trim() === '')) {
                await supabaseNovels.from('novels').update({ cover_url: book.image }).eq('id', novelId);
            }

            const existingNums = existingChaptersMap.get(novelId) || new Set<number>();

            // Fast skip if book has known episode_count and our DB already has that many chapters
            if (book.episode_count && book.episode_count > 0 && existingNums.size >= book.episode_count) {
                continue;
            }

            // Fetch episodes list for this book from Golponir
            let episodes: any[] = [];
            try {
                const epRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(book.slug)}/episodes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ page: 1, per_page: 100 }),
                    cache: 'no-store'
                });
                if (!epRes.ok) continue;
                const epJson = await epRes.json();
                episodes = epJson.data || [];
            } catch (epErr: any) {
                console.warn(`[Cron Sync Novels] Could not fetch episodes for "${book.name}":`, epErr.message);
                continue;
            }

            // Identify missing episodes
            const missingEpisodes = episodes.filter((ep: any) => {
                const num = ep.episode_number || (episodes.indexOf(ep) + 1);
                return !existingNums.has(num);
            });

            if (missingEpisodes.length === 0) {
                continue;
            }

            console.log(`[Cron Sync Novels] Ingesting ${missingEpisodes.length} new chapter(s) for "${book.name}"...`);

            const addedNumbers: number[] = [];
            const supaRowsToInsert: any[] = [];

            // Ingest missing episodes in parallel chunks
            const CHUNK_SIZE = 4;
            for (let i = 0; i < missingEpisodes.length; i += CHUNK_SIZE) {
                if (Date.now() - startTime > MAX_TIME_MS) break;

                const chunk = missingEpisodes.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(async (ep: any) => {
                    const epNum = ep.episode_number || (episodes.indexOf(ep) + 1);
                    const chapterId = crypto.randomUUID();
                    const chapterSlug = `chapter-${epNum}`;

                    try {
                        const detailRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(book.slug)}/episode/${ep.id}`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({}),
                            cache: 'no-store'
                        });
                        if (!detailRes.ok) return;
                        const detailJson = await detailRes.json();
                        const content = detailJson.data?.content || '';
                        const title = detailJson.data?.title || ep.name || `Chapter ${epNum}`;

                        let uploadedToR2 = false;

                        // Upload to Cloudflare R2 if configured
                        if (s3 && HAS_R2) {
                            try {
                                const r2Key = `chapters/${novelId}/${epNum}.json`;
                                const r2Payload = {
                                    id: chapterId,
                                    novel_id: novelId,
                                    chapter_number: epNum,
                                    title,
                                    slug: chapterSlug,
                                    content
                                };

                                const cmd = new PutObjectCommand({
                                    Bucket: R2_BUCKET,
                                    Key: r2Key,
                                    Body: JSON.stringify(r2Payload),
                                    ContentType: 'application/json'
                                });
                                await s3.send(cmd);
                                uploadedToR2 = true;
                            } catch (r2Err: any) {
                                console.warn(`[Cron Sync Novels] R2 upload failed for ${book.name} ep ${epNum}:`, r2Err.message);
                            }
                        }

                        // Store in Supabase: keep content in DB if R2 is not used, so chapters are never lost
                        supaRowsToInsert.push({
                            id: chapterId,
                            novel_id: novelId,
                            chapter_number: epNum,
                            title,
                            slug: chapterSlug,
                            content: uploadedToR2 ? '' : content,
                            created_at: new Date().toISOString()
                        });

                        addedNumbers.push(epNum);
                    } catch (chErr: any) {
                        console.error(`[Cron Sync Novels] Error on chapter ${epNum} of "${book.name}":`, chErr.message);
                    }
                }));
            }

            // Insert chapters into Supabase
            if (supaRowsToInsert.length > 0) {
                const { error: batchErr } = await supabaseNovels
                    .from('novel_chapters')
                    .insert(supaRowsToInsert);

                if (batchErr) {
                    console.error(`[Cron Sync Novels] Supabase insert error for "${book.name}":`, batchErr.message);
                } else {
                    totalNewChaptersAdded += addedNumbers.length;
                    syncDetails.push({
                        novel: book.name,
                        chaptersAdded: addedNumbers.length,
                        chapterNumbers: addedNumbers
                    });
                }
            }
        }

        const durationMs = Date.now() - startTime;
        console.log(`[Cron Sync Novels] Sync complete in ${durationMs}ms. Total new chapters added: ${totalNewChaptersAdded}`);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration_ms: durationMs,
            booksChecked: booksToProcess.length,
            newChaptersAdded: totalNewChaptersAdded,
            details: syncDetails,
            message: totalNewChaptersAdded > 0 
                ? `Successfully synced ${totalNewChaptersAdded} new chapter(s).`
                : 'All running novels are up to date with Golponir.'
        }, {
            headers: { 'Cache-Control': 'no-store' }
        });

    } catch (error: any) {
        console.error('[Cron Sync Novels] Unexpected fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error occurred during sync',
            duration_ms: Date.now() - startTime
        }, { status: 500 });
    }
}

export const POST = GET;
