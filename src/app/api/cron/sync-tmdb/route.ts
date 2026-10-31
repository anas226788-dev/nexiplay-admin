import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { upsertStreamingRow } from '@/lib/streaming-table';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EXECUTION_MS = 18000; // 18-second safety guard for cron-job.org (30s limit)

function slugify(value: string) {
    return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'untitled';
}

function verifyCronAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const queryKey = searchParams.get('key');

    const validKeys = [
        process.env.CRON_SECRET,
        'nexiplay_cron_2026',
        'nexiplay_novel_sync_2026'
    ].filter(Boolean) as string[];

    if (queryKey && validKeys.includes(queryKey)) return true;

    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (validKeys.includes(token)) return true;
    }

    return false;
}

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    if (!verifyCronAuth(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.TMDB_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({
            success: false,
            error: 'TMDB_API_KEY is not configured in environment variables.'
        }, { status: 503 });
    }

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit')) || 4, 10);

    const db = getAdminSupabase();
    const importedItems: any[] = [];
    const errors: string[] = [];
    let scannedCount = 0;
    let skippedCount = 0;

    try {
        // 1. Fetch Daily Trending from TMDB (Movies & TV)
        const trendingRes = await fetch(
            `https://api.themoviedb.org/3/trending/all/day?language=en-US&api_key=${apiKey}`,
            { signal: AbortSignal.timeout(8000), cache: 'no-store' }
        );

        if (!trendingRes.ok) {
            throw new Error(`Failed to fetch TMDB trending: HTTP ${trendingRes.status}`);
        }

        const trendingData = await trendingRes.json();
        const candidateItems = (trendingData.results || []).filter((item: any) => {
            const hasMedia = item.media_type === 'movie' || item.media_type === 'tv';
            const hasTitle = Boolean(item.title || item.name);
            const hasPoster = Boolean(item.poster_path);
            return hasMedia && hasTitle && hasPoster;
        });

        scannedCount = candidateItems.length;

        // 2. Fetch existing TMDB IDs from movies table
        const candidateIds = candidateItems.map((c: any) => String(c.id));
        const { data: existingMovies } = await db
            .from('movies')
            .select('id, tmdb_id')
            .in('tmdb_id', candidateIds);

        const existingTmdbSet = new Set((existingMovies || []).map((m: any) => String(m.tmdb_id)));

        // 3. Process new titles (within time-budget)
        for (const candidate of candidateItems) {
            // Check time budget
            if (Date.now() - startTime >= MAX_EXECUTION_MS) {
                console.log('[TMDB Cron] Time budget reached (18s), wrapping up run gracefully.');
                break;
            }

            if (importedItems.length >= limit) {
                break;
            }

            const tmdbIdStr = String(candidate.id);
            if (existingTmdbSet.has(tmdbIdStr)) {
                skippedCount++;
                continue;
            }

            try {
                const media = candidate.media_type === 'tv' ? 'tv' : 'movie';
                const contentType = media === 'tv' ? 'series' : 'movie';

                // Fetch full details
                const detailRes = await fetch(
                    `https://api.themoviedb.org/3/${media}/${candidate.id}?api_key=${apiKey}&append_to_response=credits,external_ids,videos&language=en-US`,
                    { signal: AbortSignal.timeout(6000), cache: 'no-store' }
                );

                if (!detailRes.ok) {
                    errors.push(`TMDB detail failed for ${candidate.id}: ${detailRes.status}`);
                    continue;
                }

                const detail = await detailRes.json();
                const title = (detail.title || detail.name || '').trim();
                if (!title) continue;

                const date = detail.release_date || detail.first_air_date || '';
                const year = Number(date.slice(0, 4)) || null;

                const trailer = (detail.videos?.results ?? []).find((v: any) =>
                    v.site === 'YouTube' && v.key && v.type === 'Trailer' && v.official
                ) ?? (detail.videos?.results ?? []).find((v: any) =>
                    v.site === 'YouTube' && v.key && v.type === 'Trailer'
                );

                const imdbId = detail.external_ids?.imdb_id || detail.imdb_id || null;

                const moviePayload: Record<string, any> = {
                    title,
                    description: detail.overview || null,
                    poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
                    banner_url_desktop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null,
                    type: contentType,
                    release_year: year,
                    language: detail.original_language || null,
                    cast_members: (detail.credits?.cast ?? []).slice(0, 8).map((p: any) => p.name).filter(Boolean).join(', '),
                    trailer_url: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
                    tmdb_id: tmdbIdStr,
                    imdb_id: imdbId,
                    is_adult: Boolean(detail.adult),
                    admin_note: 'auto_sync'
                };

                const yearSuffix = year ? `-${year}` : '';
                let slug = `${slugify(title)}${yearSuffix}`;

                // Insert into movies
                let savedMovie: any = null;
                const { data: inserted, error: insertError } = await db
                    .from('movies')
                    .insert({ ...moviePayload, slug })
                    .select('*')
                    .single();

                if (insertError?.code === '23505') {
                    // Slug duplicate fallback
                    slug = `${slug}-${candidate.id}`;
                    const retry = await db
                        .from('movies')
                        .insert({ ...moviePayload, slug })
                        .select('*')
                        .single();

                    if (retry.error) {
                        errors.push(`Insert failed for ${title}: ${retry.error.message}`);
                        continue;
                    }
                    savedMovie = retry.data;
                } else if (insertError) {
                    errors.push(`Insert failed for ${title}: ${insertError.message}`);
                    continue;
                } else {
                    savedMovie = inserted;
                }

                const movieId = savedMovie.id;

                // Create Streaming row so player embeds work immediately!
                await upsertStreamingRow(db, movieId, {
                    tmdb_id: tmdbIdStr,
                    imdb_id: imdbId
                });

                // Upsert Categories & Movie Categories
                if (detail.genres && detail.genres.length > 0) {
                    const categoryRows = await Promise.all(detail.genres.map(async (genre: any) => {
                        const gSlug = slugify(genre.name);
                        const { data: catData } = await db
                            .from('categories')
                            .upsert({ name: genre.name, slug: gSlug }, { onConflict: 'slug' })
                            .select('id')
                            .single();
                        return catData ? { movie_id: movieId, category_id: catData.id } : null;
                    }));

                    const validCatRows = categoryRows.filter(Boolean);
                    if (validCatRows.length > 0) {
                        await db.from('movie_categories').upsert(validCatRows, {
                            onConflict: 'movie_id,category_id',
                            ignoreDuplicates: true
                        });
                    }
                }

                // Add to Latest Updates table for instant home-page visibility
                try {
                    await db.from('latest_updates').insert({
                        content_id: movieId,
                        update_text: 'Fresh Release Added',
                        type: contentType
                    });
                } catch {
                    // Non-critical, ignore if latest_updates schema differs
                }

                existingTmdbSet.add(tmdbIdStr);
                importedItems.push({
                    id: movieId,
                    title,
                    type: contentType,
                    year,
                    tmdb_id: tmdbIdStr,
                    imdb_id: imdbId,
                    slug
                });

            } catch (itemErr: any) {
                errors.push(`Error syncing TMDB ID ${candidate.id}: ${itemErr.message}`);
            }
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            scanned: scannedCount,
            skipped_existing: skippedCount,
            imported_count: importedItems.length,
            imported: importedItems,
            errors: errors.length > 0 ? errors : undefined
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });

    } catch (err: any) {
        console.error('[TMDB Cron] Fatal error:', err);
        return NextResponse.json({
            success: false,
            error: err.message,
            duration_ms: Date.now() - startTime
        }, {
            status: 500,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    }
}

export const POST = GET;
