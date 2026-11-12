import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePublicWeb } from '@/lib/latest-updates';

export const dynamic = 'force-dynamic';

function getAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase credentials not configured');
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            action,
            taskId,
            newLastEpisode,
            newNextEpisode,
            newNextEpisodeDate,
            adminNote,
            notifyAdmin,
            scraperUrl,
            scraperSource,
            scraperResolution,
            scraperSeason
        } = body;

        if (!taskId) {
            return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 });
        }

        const db = getAdminClient();
        const nowIso = new Date().toISOString();

        // 1. Fetch current movie
        const { data: movie, error: fetchErr } = await db
            .from('movies')
            .select('id, title, slug, type, poster_url, last_episode, next_episode, scraper_season')
            .eq('id', taskId)
            .single();

        if (fetchErr || !movie) {
            return NextResponse.json({ success: false, error: fetchErr?.message || 'Movie not found' }, { status: 404 });
        }

        const movieUpdatePayload: any = {
            last_episode: newLastEpisode,
            next_episode: newNextEpisode,
            next_episode_date: newNextEpisodeDate,
            updated_at: nowIso,
            notify_admin: notifyAdmin !== undefined ? notifyAdmin : false,
        };

        if (action === 'edit') {
            if (adminNote !== undefined) movieUpdatePayload.admin_note = adminNote;
            movieUpdatePayload.scraper_url = scraperSource ? scraperUrl : null;
            movieUpdatePayload.scraper_source = scraperSource || null;
            movieUpdatePayload.scraper_resolution = scraperSource ? scraperResolution : null;
            movieUpdatePayload.scraper_season = scraperSource ? scraperSeason : 1;
        }

        // 2. Update movies table
        const { error: updateErr } = await db
            .from('movies')
            .update(movieUpdatePayload)
            .eq('id', taskId);

        if (updateErr) {
            throw updateErr;
        }

        // 3. Sync to `updates` table with service_role privileges
        let updateSyncSuccess = false;
        if (newLastEpisode && newLastEpisode > 0) {
            try {
                let seasonNum = scraperSeason || movie.scraper_season || 1;
                if (!seasonNum || seasonNum <= 1) {
                    const match = movie.title.match(/season\s*(\d+)/i) || movie.title.match(/season\s*\d+-(\d+)/i);
                    if (match) seasonNum = parseInt(match[1]);
                }

                const targetSlug = movie.slug ? `/${movie.type}/${movie.slug}` : `/${movie.type}/${movie.id}`;

                const { error: upsertErr } = await db
                    .from('updates')
                    .upsert({
                        content_id: movie.id,
                        title: movie.title.trim(),
                        poster_url: movie.poster_url,
                        slug: targetSlug,
                        content_type: movie.type || 'anime',
                        update_type: 'episode',
                        season_number: seasonNum,
                        episode_number: newLastEpisode,
                        is_active: true,
                        updated_at: nowIso,
                    }, { onConflict: 'content_id' });

                if (upsertErr) {
                    console.error('[Running API] updates upsert error:', upsertErr);
                } else {
                    updateSyncSuccess = true;
                    await revalidatePublicWeb(['/', '/anime', '/series', '/movies', targetSlug]);
                }
            } catch (uErr: any) {
                console.error('[Running API] Failed to sync latest updates table:', uErr.message);
            }
        }

        return NextResponse.json({
            success: true,
            updatedMovie: { ...movie, ...movieUpdatePayload },
            updateSynced: updateSyncSuccess
        });
    } catch (err: any) {
        console.error('[Running API] Error:', err);
        return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
    }
}
