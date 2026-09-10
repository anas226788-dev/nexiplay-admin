import { NextRequest, NextResponse } from 'next/server';
import { supabaseNovels } from '@/lib/supabase-novels';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || 'nexiplay_novel_sync_2026';
const R2_BUCKET = process.env.R2_BUCKET || 'nexiplay-novels';

const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || 'https://567e986afd30a195bbcc250e393fabb2.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'd4436908e2b179428b39075f49c3a859',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '89cea1266e4de08a6028580dbe184d3a1858179f66f35936eb6f3982109f8e0a'
    }
});

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
    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get('key');
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const adminHeader = request.headers.get('x-admin-sync');

    if (keyParam !== CRON_SECRET && bearerToken !== CRON_SECRET && adminHeader !== 'true') {
        return NextResponse.json(
            { success: false, error: 'Unauthorized. Invalid or missing cron key.' },
            { status: 401 }
        );
    }

    try {
        console.log('[Cron Sync Novels] Starting automatic synchronization with Golponir...');

        const MAX_TIME_MS = 22000; // 22-second safety deadline to avoid cron-job.org 30s timeout

        // 2. Obtain session cookies from Golponir
        const headers = await getGolponirSession();

        // 3. Fetch latest updated books from Golponir (/api/books)
        const updatedRes = await fetch('https://golponir.com/api/books', {
            method: 'POST',
            headers,
            body: JSON.stringify({ page: 1, per_page: 25, completion_status: 'all' }),
            cache: 'no-store'
        });

        if (!updatedRes.ok) {
            const errText = await updatedRes.text();
            throw new Error(`Golponir books API returned HTTP ${updatedRes.status}: ${errText.substring(0, 150)}`);
        }

        const updatedJson = await updatedRes.json();
        const updatedBooks: any[] = updatedJson.data || [];

        console.log(`[Cron Sync Novels] Found ${updatedBooks.length} books checked on Golponir.`);

        // 4. Fetch all existing novels in Supabase for quick matching
        const { data: supaNovels, error: supaErr } = await supabaseNovels
            .from('novels')
            .select('id, title, slug, cover_url')
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

        // 5. Batch-fetch existing chapters for all matched novels in ONE single query
        const matchedNovelIds = Array.from(new Set(
            updatedBooks.map(b => {
                const sKey = (b.slug || '').toLowerCase().trim();
                const tKey = (b.name || '').toLowerCase().trim();
                return (supaBySlug.get(sKey) || supaByTitle.get(tKey))?.id;
            }).filter(Boolean)
        ));

        const existingChaptersMap = new Map<string, Set<number>>();
        if (matchedNovelIds.length > 0) {
            const { data: allChapterRows } = await supabaseNovels
                .from('novel_chapters')
                .select('novel_id, chapter_number')
                .in('novel_id', matchedNovelIds);

            for (const row of allChapterRows || []) {
                if (!existingChaptersMap.has(row.novel_id)) {
                    existingChaptersMap.set(row.novel_id, new Set<number>());
                }
                existingChaptersMap.get(row.novel_id)!.add(row.chapter_number);
            }
        }

        let totalNewChaptersAdded = 0;
        const syncDetails: Array<{ novel: string; chaptersAdded: number; chapterNumbers: number[] }> = [];

        // 6. Process each book with fast skipping and time-budget protection
        for (const book of updatedBooks) {
            if (Date.now() - startTime > MAX_TIME_MS) {
                console.warn(`[Cron Sync Novels] Time threshold reached (${Date.now() - startTime}ms), completing response gracefully.`);
                break;
            }

            const slugKey = (book.slug || '').toLowerCase().trim();
            const titleKey = (book.name || '').toLowerCase().trim();
            let novel = supaBySlug.get(slugKey) || supaByTitle.get(titleKey);
            let novelId = novel?.id;

            // If completely new novel, insert into Supabase
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
                // Update cover if blank
                await supabaseNovels.from('novels').update({ cover_url: book.image }).eq('id', novelId);
            }

            // Check existing chapters against Golponir's episode_count
            const existingNums = existingChaptersMap.get(novelId) || new Set<number>();
            const targetCount = book.episode_count || 0;

            // FAST SKIP: If database already has full chapters, skip network calls entirely!
            if (existingNums.size >= targetCount && targetCount > 0) {
                continue;
            }

            // 7. Fetch episodes from Golponir only when chapters are actually missing
            const epRes = await fetch(`https://golponir.com/api/books/${encodeURIComponent(book.slug)}/episodes`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ page: 1, per_page: 100 }),
                cache: 'no-store'
            });
            if (!epRes.ok) continue;
            const epJson = await epRes.json();
            const episodes: any[] = epJson.data || [];

            // Filter missing episodes
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

            // 8. Fetch content for missing episodes concurrently in chunks of 5
            const CHUNK_SIZE = 5;
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

                        // Upload to Cloudflare R2
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

                        // Lightweight record for Supabase
                        supaRowsToInsert.push({
                            id: chapterId,
                            novel_id: novelId,
                            chapter_number: epNum,
                            title,
                            slug: chapterSlug,
                            content: '', // Zero heavy content in Supabase!
                            created_at: new Date().toISOString()
                        });

                        addedNumbers.push(epNum);
                    } catch (chErr: any) {
                        console.error(`[Cron Sync Novels] Error on chapter ${epNum} of "${book.name}":`, chErr.message);
                    }
                }));
            }

            // Batch insert lightweight chapter records into Supabase
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
            booksChecked: updatedBooks.length,
            newChaptersAdded: totalNewChaptersAdded,
            details: syncDetails,
            message: totalNewChaptersAdded > 0 
                ? `Successfully synced ${totalNewChaptersAdded} new chapter(s) to Cloudflare R2 & Supabase.`
                : 'All novels are up to date with Golponir.'
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
