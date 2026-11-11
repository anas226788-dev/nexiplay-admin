import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import {
    ANDROID_CHANNELS,
    cleanContentSlug,
    pushNewContentNotification,
    pushNewEpisodeNotification,
    pushNewSeasonNotification,
    sendOneSignalPush,
} from '@/lib/onesignal';

export const dynamic = 'force-dynamic';

function sameOrigin(req: Request): boolean {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try {
        return new URL(origin).host === new URL(req.url).host;
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const mode = String(body.mode || 'manual').trim().toLowerCase();

        // 1. Auto hooks called cleanly from Admin client forms (SeasonEditor / EpisodeImporter / MovieForm)
        if (mode === 'episode' && body.movieId) {
            const db = getAdminSupabase();
            const { data: movie } = await db
                .from('movies')
                .select('id, title, slug, poster_url, type')
                .eq('id', body.movieId)
                .maybeSingle();

            if (!movie) {
                return NextResponse.json({ ok: false, error: 'Movie not found' }, { status: 404 });
            }

            const result = await pushNewEpisodeNotification({
                movieId: movie.id,
                title: movie.title,
                slug: movie.slug,
                contentType: movie.type,
                posterUrl: movie.poster_url,
                seasonNumber: Number(body.seasonNumber || 1),
                episodeNumber: Number(body.episodeNumber || 1),
                extraCount: body.extraCount ? Number(body.extraCount) : undefined,
            });
            return NextResponse.json(result);
        }

        if (mode === 'season' && body.movieId) {
            const db = getAdminSupabase();
            const { data: movie } = await db
                .from('movies')
                .select('id, title, slug, poster_url, type')
                .eq('id', body.movieId)
                .maybeSingle();

            if (!movie) {
                return NextResponse.json({ ok: false, error: 'Movie not found' }, { status: 404 });
            }

            const result = await pushNewSeasonNotification({
                movieId: movie.id,
                title: movie.title,
                slug: movie.slug,
                contentType: movie.type,
                posterUrl: movie.poster_url,
                seasonNumber: Number(body.seasonNumber || 1),
            });
            return NextResponse.json(result);
        }

        if (mode === 'content' && body.movieId) {
            const db = getAdminSupabase();
            const { data: movie } = await db
                .from('movies')
                .select('id, title, slug, poster_url, type, release_year, language')
                .eq('id', body.movieId)
                .maybeSingle();

            if (!movie) {
                return NextResponse.json({ ok: false, error: 'Movie not found' }, { status: 404 });
            }

            const result = await pushNewContentNotification({
                movieId: movie.id,
                title: movie.title,
                slug: movie.slug,
                contentType: movie.type,
                posterUrl: movie.poster_url,
                releaseYear: movie.release_year,
                language: movie.language,
            });
            return NextResponse.json(result);
        }

        // 2. Manual Push Broadcast from Admin Push Console
        const title = String(body.title || '').trim();
        const message = String(body.message || '').trim();
        if (!title || !message) {
            return NextResponse.json(
                { ok: false, error: 'Title and message are required.' },
                { status: 400 }
            );
        }

        const cleanType = body.contentType ? String(body.contentType).trim().toLowerCase() : null;
        const cleanSlug = cleanContentSlug(body.slug);
        const seasonNumber = body.seasonNumber ? Number(body.seasonNumber) : null;
        const episodeNumber = body.episodeNumber ? Number(body.episodeNumber) : null;

        const channelId =
            body.channel === 'episodes'
                ? ANDROID_CHANNELS.EPISODES
                : body.channel === 'releases'
                ? ANDROID_CHANNELS.RELEASES
                : ANDROID_CHANNELS.ALERTS;

        const pushResult = await sendOneSignalPush({
            title,
            message,
            channelId,
            posterUrl: body.imageUrl || null,
            deepLink: body.deepLink || null,
            screen: cleanSlug ? 'content' : 'notifications',
            contentType: cleanType,
            slug: cleanSlug || null,
            seasonNumber,
            episodeNumber,
            movieId: body.movieId || null,
            updateType: episodeNumber ? 'episode' : cleanSlug ? 'movie' : 'notice',
            overrideAppId: body.overrideAppId,
            overrideRestApiKey: body.overrideRestApiKey,
        });

        // Optionally also store broadcast inside in-app `notifications` feed
        if (body.saveToInAppFeed === true) {
            try {
                const db = getAdminSupabase();
                await db.from('notifications').insert({
                    user_id: null,
                    title,
                    message,
                    type: episodeNumber ? 'episode' : cleanSlug ? 'release' : 'general',
                    is_read: false,
                    deep_link: cleanSlug
                        ? `nexiplay://content/${cleanType || 'anime'}/${cleanSlug}${
                              seasonNumber || episodeNumber
                                  ? `?${[seasonNumber ? `season=${seasonNumber}` : null, episodeNumber ? `episode=${episodeNumber}` : null].filter(Boolean).join('&')}`
                                  : ''
                          }`
                        : 'nexiplay://notifications',
                    content_type: cleanType || null,
                    slug: cleanSlug || null,
                    poster_url: body.imageUrl || null,
                    badge_text: body.badgeText || (episodeNumber ? 'NEW EPISODE' : 'ANNOUNCEMENT'),
                });
            } catch (feedErr) {
                console.warn('[Push Send] Failed to mirror into notifications table:', feedErr);
            }
        }

        if (!pushResult.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    skipped: pushResult.skipped,
                    error: pushResult.error || pushResult.reason || 'Push send failed',
                },
                { status: pushResult.skipped ? 400 : 500 }
            );
        }

        return NextResponse.json({
            ok: true,
            notificationId: pushResult.notificationId,
            recipients: pushResult.recipients ?? 0,
        });
    } catch (err: any) {
        console.error('[API push/send] Error:', err);
        return NextResponse.json(
            { ok: false, error: err?.message || 'Push send failed' },
            { status: 500 }
        );
    }
}
