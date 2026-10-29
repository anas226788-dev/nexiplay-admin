import { NextRequest, NextResponse } from 'next/server';
import { supabaseNovels } from '@/lib/supabase-novels';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader?.trim();
    const cronKeyHeader = request.headers.get('x-cron-key')?.trim();
    const { searchParams } = new URL(request.url);
    const keyParam = (searchParams.get('key') || searchParams.get('token') || searchParams.get('secret'))?.trim();
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (isVercelCron) return true;

    // Supported secret keys (for cron-job.org, manual webhook, or Vercel cron)
    const validKeys = [
        'nexi_cron_5f9a8b7c6d1e4023a1',
        'nexiplay_novel_sync_2026',
        'nexiplay_cron_2026'
    ];
    if (cronSecret) validKeys.push(cronSecret);

    if (keyParam && validKeys.includes(keyParam)) return true;
    if (bearerToken && validKeys.includes(bearerToken)) return true;
    if (cronKeyHeader && validKeys.includes(cronKeyHeader)) return true;

    // Allow requests originating from the admin UI
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const host = request.headers.get('host') || '';
    const isSameOrigin = (origin && host && origin.includes(host)) || (referer && host && referer.includes(host));
    const isAdminHeader = request.headers.get('x-admin-sync') === 'true';

    if (isSameOrigin || isAdminHeader) return true;

    // If no secret configured in environment, allow operation
    if (!cronSecret) return true;

    return false;
}

async function getGolponirSession(): Promise<Record<string, string>> {
    try {
        const initRes = await fetch('https://golponir.com/books', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000)
        });

        // Extract Set-Cookie headers
        const cookiesHeader = initRes.headers.getSetCookie 
            ? initRes.headers.getSetCookie() 
            : [initRes.headers.get('set-cookie') || ''];
            
        const cookieString = cookiesHeader.filter(Boolean).map(c => c.split(';')[0].trim()).join('; ');
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
    } catch {
        // Fallback default headers if session fetch times out
        return {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
    }
}

// Fallback search to find true Golponir slug if original slug 404s
async function searchGolponirSlug(title: string, headers: Record<string, string>): Promise<string | null> {
    try {
        const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
        const res = await fetch('https://golponir.com/api/books', {
            method: 'POST',
            headers,
            body: JSON.stringify({ page: 1, per_page: 5, search: cleanTitle }),
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) return null;
        const json = await res.json();
        const found = json.data?.[0];
        return found?.slug || null;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    // 1. Validate Secret Authorization
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { 
                success: false, 
                error: 'Unauthorized. Invalid or missing cron key. Pass ?key=nexiplay_cron_2026 or ?key=nexi_cron_5f9a8b7c6d1e4023a1' 
            },
            { status: 401 }
        );
    }

    try {
        console.log('[Cron Sync Novels] Starting automatic synchronization with Golponir...');

        // 22-second safety deadline: cron-job.org times out at 30s!
        // Finishing within 22s guarantees a reliable 200 OK every time.
        const MAX_TIME_MS = 22000;

        // 2. Obtain session cookies from Golponir
        const headers = await getGolponirSession();

        // 3. Fetch existing novels from Supabase (paginated to bypass 1000 limit)
        const supaNovels: any[] = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        while (true) {
            const { data, error: supaErr } = await supabaseNovels
                .from('novels')
                .select('id, title, slug, status, cover_url, author, genre')
                .range(from, from + PAGE_SIZE - 1);

            if (supaErr) {
                throw new Error(`Failed to load Supabase novels: ${supaErr.message}`);
            }
            if (!data || data.length === 0) break;
            supaNovels.push(...data);
            if (data.length < PAGE_SIZE) break;
            from += PAGE_SIZE;
        }

        const supaBySlug = new Map<string, any>();
        const supaByTitle = new Map<string, any>();
        for (const n of supaNovels) {
            if (n.slug) supaBySlug.set(n.slug.toLowerCase().trim(), n);
            if (n.title) supaByTitle.set(n.title.toLowerCase().trim(), n);
        }

        // 4. Fetch Page 1 and Page 2 of Golponir books (the 100 most recently updated books)
        const updatedBooks: any[] = [];
        try {
            const [p1Res, p2Res] = await Promise.all([
                fetch('https://golponir.com/api/books', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ page: 1, per_page: 50, completion_status: 'running' }),
                    cache: 'no-store',
                    signal: AbortSignal.timeout(7000)
                }).then(r => r.ok ? r.json() : null).catch(() => null),

                fetch('https://golponir.com/api/books', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ page: 2, per_page: 50, completion_status: 'running' }),
                    cache: 'no-store',
                    signal: AbortSignal.timeout(7000)
                }).then(r => r.ok ? r.json() : null).catch(() => null)
            ]);

            const feedSlugs = new Set<string>();
            for (const res of [p1Res, p2Res]) {
                for (const b of res?.data || []) {
                    if (b?.slug && !feedSlugs.has(b.slug)) {
                        feedSlugs.add(b.slug);
                        updatedBooks.push(b);
                    }
                }
            }
        } catch (fetchErr: any) {
            console.warn('[Cron Sync Novels] Could not fetch global books feed:', fetchErr.message);
        }

        // 5. Build prioritized books queue:
        // Priority 1: Newly updated books from Golponir feed (top 100)
        // Priority 2: Ongoing novels from our DB with rotating offset
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

        // 1. Add active feed from Golponir FIRST
        for (const b of updatedBooks) {
            if (!b.slug) continue;
            const sKey = b.slug.toLowerCase().trim();
            const tKey = (b.name || '').toLowerCase().trim();
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
                    existingNovel: supaBySlug.get(sKey) || supaByTitle.get(tKey)
                });
            }
        }

        // 2. Add ongoing DB novels next with time-based rotation
        const ongoingSupaNovels = supaNovels.filter(n => n.status === 'ongoing' || !n.status);
        const offset = (Math.floor(Date.now() / (1000 * 60 * 10))) % Math.max(1, ongoingSupaNovels.length);
        const rotatedOngoing = [...ongoingSupaNovels.slice(offset), ...ongoingSupaNovels.slice(0, offset)];

        for (const on of rotatedOngoing) {
            if (!on.slug) continue;
            const sKey = on.slug.toLowerCase().trim();
            if (!seenSlugs.has(sKey)) {
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
        }

        console.log(`[Cron Sync Novels] Total books queued for update check: ${booksToProcess.length}`);

        let totalNewChaptersAdded = 0;
        const syncDetails: Array<{ novel: string; chaptersAdded: number; chapterNumbers: number[] }> = [];

        // 6. Process each book
        for (const book of booksToProcess) {
            if (Date.now() - startTime > MAX_TIME_MS) {
                console.log(`[Cron Sync Novels] 22-second limit reached (${Date.now() - startTime}ms), finishing gracefully.`);
                break;
            }

            const slugKey = book.slug.toLowerCase().trim();
            const titleKey = (book.name || '').toLowerCase().trim();
            let novel = book.existingNovel || supaBySlug.get(slugKey) || supaByTitle.get(titleKey);
            let novelId = novel?.id;

            // If completely new novel discovered on Golponir, insert into Supabase
            if (!novel) {
                novelId = crypto.randomUUID();
                const nowIso = new Date().toISOString();
                const newNovelData = {
                    id: novelId,
                    title: book.name,
                    slug: book.slug,
                    author: book.author || 'Golponir',
                    genre: book.genres || 'Romantic',
                    cover_url: book.image || null,
                    description: `${book.name} - ${book.author || 'Golponir'} এর উপন্যাস।`,
                    status: book.completion_status === 'completed' ? 'completed' : 'ongoing',
                    created_at: nowIso,
                    updated_at: nowIso
                };

                const { error: createErr } = await supabaseNovels.from('novels').insert(newNovelData);
                if (createErr) {
                    console.error(`[Cron Sync Novels] Failed to create novel "${book.name}":`, createErr.message);
                    continue;
                }
                novel = newNovelData;
                supaBySlug.set(slugKey, novel);
                supaByTitle.set(titleKey, novel);
                console.log(`[Cron Sync Novels] Created new novel "${book.name}" (ID: ${novelId})`);
            } else if (book.image && (!novel.cover_url || novel.cover_url.trim() === '')) {
                await supabaseNovels.from('novels').update({ cover_url: book.image }).eq('id', novelId);
            }

            // Sync completion status: ensure ongoing novels are marked ongoing
            if ((book.completion_status === 'ongoing' || book.completion_status === 'running') && novel.status !== 'ongoing') {
                await supabaseNovels.from('novels').update({ status: 'ongoing' }).eq('id', novelId);
                novel.status = 'ongoing';
            } else if (book.completion_status === 'completed' && novel.status !== 'completed') {
                await supabaseNovels.from('novels').update({ status: 'completed' }).eq('id', novelId);
                novel.status = 'completed';
            }

            // Fetch existing chapter numbers directly from Supabase
            let existingNums = new Set<number>();
            if (novelId) {
                const { data: chapRows } = await supabaseNovels
                    .from('novel_chapters')
                    .select('chapter_number')
                    .eq('novel_id', novelId)
                    .limit(5000);

                if (chapRows) {
                    existingNums = new Set<number>(chapRows.map((r: any) => r.chapter_number));
                }
            }

            // Fast skip if book has known episode_count and our DB already has that many chapters
            if (book.episode_count && book.episode_count > 0 && existingNums.size >= book.episode_count) {
                continue;
            }

            // Determine target page on Golponir (50 episodes per page)
            const targetEpPage = Math.max(1, Math.floor(existingNums.size / 50) + 1);
            let activeSlug = book.slug;

            // Fetch episodes list for this book from Golponir
            let episodes: any[] = [];
            try {
                let epRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(activeSlug)}/episodes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ page: targetEpPage, per_page: 50 }),
                    cache: 'no-store',
                    signal: AbortSignal.timeout(6000)
                });

                // Fallback: if 404, search Golponir for the true slug
                if (epRes.status === 404) {
                    const fallbackSlug = await searchGolponirSlug(book.name, headers);
                    if (fallbackSlug && fallbackSlug !== activeSlug) {
                        activeSlug = fallbackSlug;
                        epRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(activeSlug)}/episodes`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ page: targetEpPage, per_page: 50 }),
                            cache: 'no-store',
                            signal: AbortSignal.timeout(6000)
                        });
                    }
                }

                if (epRes.ok) {
                    const epJson = await epRes.json();
                    episodes = epJson.data || [];
                }
            } catch (epErr: any) {
                console.warn(`[Cron Sync Novels] Could not fetch episodes for "${book.name}":`, epErr.message);
                continue;
            }

            // Identify missing episodes
            let missingEpisodes = episodes.filter((ep: any) => {
                const num = ep.episode_number || (episodes.indexOf(ep) + 1);
                return !existingNums.has(num);
            });

            // If target page had 0 missing, but we know Golponir has more episodes, try next page
            if (missingEpisodes.length === 0 && book.episode_count && existingNums.size < book.episode_count) {
                try {
                    const nextRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(activeSlug)}/episodes`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ page: targetEpPage + 1, per_page: 50 }),
                        cache: 'no-store',
                        signal: AbortSignal.timeout(6000)
                    });
                    if (nextRes.ok) {
                        const nextJson = await nextRes.json();
                        const nextEpisodes = nextJson.data || [];
                        const nextMissing = nextEpisodes.filter((ep: any) => {
                            const num = ep.episode_number || (nextEpisodes.indexOf(ep) + 1);
                            return !existingNums.has(num);
                        });
                        if (nextMissing.length > 0) {
                            episodes = nextEpisodes;
                            missingEpisodes = nextMissing;
                        }
                    }
                } catch {}
            }

            if (missingEpisodes.length === 0) {
                continue;
            }

            console.log(`[Cron Sync Novels] Ingesting ${missingEpisodes.length} new chapter(s) for "${book.name}"...`);

            const addedNumbers: number[] = [];
            const supaRowsToInsert: any[] = [];

            // Ingest missing episodes in small batches
            const CHUNK_SIZE = 4;
            for (let i = 0; i < missingEpisodes.length; i += CHUNK_SIZE) {
                if (Date.now() - startTime > MAX_TIME_MS) break;

                const chunk = missingEpisodes.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(async (ep: any) => {
                    const epNum = ep.episode_number || (episodes.indexOf(ep) + 1);
                    const chapterId = crypto.randomUUID();
                    const chapterSlug = `chapter-${epNum}`;

                    try {
                        const detailRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(activeSlug)}/episode/${ep.id}`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({}),
                            cache: 'no-store',
                            signal: AbortSignal.timeout(7000)
                        });
                        if (!detailRes.ok) return;
                        const detailJson = await detailRes.json();
                        const content = detailJson.data?.content || '';
                        const title = detailJson.data?.name || detailJson.data?.title || ep.name || `Chapter ${epNum}`;

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
                            } catch (r2Err: any) {
                                console.warn(`[Cron Sync Novels] R2 upload failed for ${book.name} ep ${epNum}:`, r2Err.message);
                            }
                        }

                        // Store in Supabase: keep content in DB for instant reliable access & fallback
                        supaRowsToInsert.push({
                            id: chapterId,
                            novel_id: novelId,
                            chapter_number: epNum,
                            title,
                            slug: chapterSlug,
                            content,
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

                    // CRUCIAL: Touch updated_at so newly updated running novels immediately jump to the top!
                    await supabaseNovels.from('novels').update({
                        updated_at: new Date().toISOString(),
                        status: 'ongoing'
                    }).eq('id', novelId);
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
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });

    } catch (error: any) {
        console.error('[Cron Sync Novels] Unexpected fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Unknown error occurred during sync',
            duration_ms: Date.now() - startTime
        }, { 
            status: 500,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    }
}

export const POST = GET;
