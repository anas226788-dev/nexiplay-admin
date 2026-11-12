import { getAdminSupabase } from '@/lib/supabase-admin';

export type LatestUpdateType = 'movie' | 'season' | 'episode';

export interface SyncLatestUpdateParams {
    movieId: string;
    updateType?: LatestUpdateType;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    preserveExistingEpisodeOnSeason?: boolean;
}

const DEFAULT_WEB_SITE_URL = 'https://nexiplay.vercel.app';

export function normalizeContentSlugPath(type: string | null | undefined, slug: string | null | undefined, fallbackId: string): string {
    const cleanType = String(type || 'anime').trim().toLowerCase().replace(/^\/+|\/+$/g, '') || 'anime';
    const cleanSlug = String(slug || '').trim().replace(/^\/+/, '').split('/').pop() || fallbackId;
    return `/${cleanType}/${cleanSlug}`;
}

export async function revalidatePublicWeb(paths: string[] = ['/', '/anime', '/series', '/movies']): Promise<boolean> {
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) return false;

    const rawBase =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_WEB_URL ||
        DEFAULT_WEB_SITE_URL;
    const baseUrl = rawBase.replace(/\/+$/, '');

    try {
        const res = await fetch(`${baseUrl}/api/revalidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret, paths }),
            signal: AbortSignal.timeout(3500),
        });
        return res.ok;
    } catch (err) {
        console.warn('[LatestUpdates] Public web revalidation failed (non-fatal):', err);
        return false;
    }
}

export async function syncLatestUpdate({
    movieId,
    updateType = 'episode',
    seasonNumber = null,
    episodeNumber = null,
    preserveExistingEpisodeOnSeason = true,
}: SyncLatestUpdateParams) {
    const db = getAdminSupabase();
    const cleanMovieId = String(movieId || '').trim();
    if (!cleanMovieId) {
        throw new Error('movieId is required.');
    }

    const { data: movie, error: movieError } = await db
        .from('movies')
        .select('id, title, poster_url, slug, type, last_episode')
        .eq('id', cleanMovieId)
        .single();

    if (movieError || !movie) {
        throw new Error(movieError?.message || 'Movie not found.');
    }

    let resolvedUpdateType: LatestUpdateType = updateType;
    let resolvedEpisodeNumber: number | null =
        episodeNumber !== null && episodeNumber !== undefined && Number.isFinite(Number(episodeNumber))
            ? Number(episodeNumber)
            : null;
    const resolvedSeasonNumber: number | null =
        seasonNumber !== null && seasonNumber !== undefined && Number.isFinite(Number(seasonNumber))
            ? Number(seasonNumber)
            : null;

    if (resolvedUpdateType === 'season' && preserveExistingEpisodeOnSeason && resolvedEpisodeNumber === null) {
        const { data: existing } = await db
            .from('updates')
            .select('episode_number')
            .eq('content_id', movie.id)
            .maybeSingle();
        if (existing?.episode_number) {
            resolvedUpdateType = 'episode';
            resolvedEpisodeNumber = existing.episode_number;
        }
    }

    const nowIso = new Date().toISOString();
    const targetSlug = normalizeContentSlugPath(movie.type, movie.slug, movie.id);
    const cleanContentType = (String(movie.type || 'anime').trim().toLowerCase() || 'anime') as 'anime' | 'series' | 'movie';

    const updateRow = {
        content_id: movie.id,
        title: String(movie.title || '').trim(),
        poster_url: movie.poster_url || null,
        slug: targetSlug,
        content_type: cleanContentType,
        update_type: resolvedUpdateType,
        season_number: resolvedSeasonNumber,
        episode_number: resolvedEpisodeNumber,
        is_active: true,
        updated_at: nowIso,
    };

    const { data: upserted, error: upsertError } = await db
        .from('updates')
        .upsert(updateRow, { onConflict: 'content_id' })
        .select()
        .single();

    if (upsertError) {
        throw new Error(`Updates upsert failed: ${upsertError.message}`);
    }

    const moviePatch: Record<string, unknown> = { updated_at: nowIso };
    if (
        resolvedEpisodeNumber !== null &&
        resolvedEpisodeNumber > (typeof movie.last_episode === 'number' ? movie.last_episode : 0)
    ) {
        moviePatch.last_episode = resolvedEpisodeNumber;
    }

    const { error: movieUpdateError } = await db
        .from('movies')
        .update(moviePatch)
        .eq('id', movie.id);

    if (movieUpdateError) {
        console.warn('[LatestUpdates] Failed to bump movie updated_at/last_episode:', movieUpdateError.message);
    }

    const revalidated = await revalidatePublicWeb(['/', '/anime', '/series', '/movies', targetSlug]);

    return {
        update: upserted || updateRow,
        revalidated,
    };
}
