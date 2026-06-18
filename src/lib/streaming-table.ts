import type { SupabaseClient } from '@supabase/supabase-js';
import type { Movie } from './types';

export interface StreamingRow {
    movie_id: string;
    tmdb_id?: string | null;
    imdb_id?: string | null;
    mal_id?: string | null;
    streaming_url?: string | null;
    is_disabled?: boolean | null;
    streaming_url_animerulz?: string | null;
    streaming_url_toonplay?: string | null;
    animerulz_url?: string | null;
    animerulz_season?: number | null;
    animerulz_resolution?: '360p' | '480p' | '720p' | '1080p' | null;
    toonplay_url?: string | null;
    toonplay_season?: number | null;
    toonplay_resolution?: '360p' | '480p' | '720p' | '1080p' | null;
    multi_scraper_config?: string | null;
    updated_at?: string | null;
}

const STREAMING_TABLE_MISSING_CODES = new Set(['42P01', 'PGRST106', 'PGRST205']);

export function isStreamingTableMissing(error: any): boolean {
    const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
    return STREAMING_TABLE_MISSING_CODES.has(error?.code) ||
        (message.includes('streaming') && (message.includes('not exist') || message.includes('schema cache')));
}

const cleanValue = (value: any) => value === '' ? null : value;

export function mergeStreamingRow<T extends Partial<Movie>>(movie: T, row?: StreamingRow | null): T {
    if (!row) return movie;

    const next: any = { ...movie };
    const assign = (key: keyof Movie, value: any) => {
        if (value !== undefined && value !== null) next[key] = value;
    };

    assign('tmdb_id', row.tmdb_id);
    assign('imdb_id', row.imdb_id);
    assign('mal_id', row.mal_id);
    assign('streaming_url_animerulz', row.streaming_url_animerulz);
    assign('streaming_url_toonplay', row.streaming_url_toonplay);
    assign('animerulz_url', row.animerulz_url);
    assign('animerulz_season', row.animerulz_season);
    assign('animerulz_resolution', row.animerulz_resolution);
    assign('toonplay_url', row.toonplay_url);
    assign('toonplay_season', row.toonplay_season);
    assign('toonplay_resolution', row.toonplay_resolution);

    if (row.is_disabled) {
        next.streaming_url = 'disabled';
    } else if (row.streaming_url !== undefined && row.streaming_url !== null) {
        next.streaming_url = row.streaming_url;
    }

    if (row.multi_scraper_config) {
        next.scraper_url = row.multi_scraper_config;
        next.scraper_source = 'multi';
    }

    return next;
}

export async function fetchStreamingRows(
    supabase: SupabaseClient,
    movieIds: string[]
): Promise<Map<string, StreamingRow>> {
    const ids = Array.from(new Set(movieIds.filter(Boolean)));
    if (ids.length === 0) return new Map();

    const { data, error } = await supabase
        .from('streaming')
        .select('*')
        .in('movie_id', ids);

    if (error) {
        if (!isStreamingTableMissing(error)) {
            console.warn('[Streaming Table] Failed to fetch streaming rows:', error.message);
        }
        return new Map();
    }

    return new Map((data || []).map(row => [row.movie_id, row as StreamingRow]));
}

export async function mergeMoviesWithStreaming<T extends Partial<Movie> & { id: string }>(
    supabase: SupabaseClient,
    movies: T[]
): Promise<T[]> {
    const streamingRows = await fetchStreamingRows(supabase, movies.map(movie => movie.id));
    if (streamingRows.size === 0) return movies;
    return movies.map(movie => mergeStreamingRow(movie, streamingRows.get(movie.id)));
}

export function buildStreamingPayload(movieId: string, updates: Record<string, any>): Partial<StreamingRow> | null {
    const payload: Partial<StreamingRow> = {
        movie_id: movieId,
        updated_at: new Date().toISOString(),
    };

    let hasStreamingField = false;
    const set = (key: keyof StreamingRow, value: any) => {
        if (value === undefined) return;
        (payload as any)[key] = cleanValue(value);
        hasStreamingField = true;
    };

    set('tmdb_id', updates.tmdb_id);
    set('imdb_id', updates.imdb_id);
    set('mal_id', updates.mal_id);
    set('streaming_url_animerulz', updates.streaming_url_animerulz);
    set('streaming_url_toonplay', updates.streaming_url_toonplay);
    set('animerulz_url', updates.animerulz_url);
    set('animerulz_season', updates.animerulz_season);
    set('animerulz_resolution', updates.animerulz_resolution);
    set('toonplay_url', updates.toonplay_url);
    set('toonplay_season', updates.toonplay_season);
    set('toonplay_resolution', updates.toonplay_resolution);

    if (updates.streaming_url !== undefined) {
        hasStreamingField = true;
        payload.is_disabled = updates.streaming_url === 'disabled';
        payload.streaming_url = updates.streaming_url === 'disabled' ? null : cleanValue(updates.streaming_url);
    }

    if (updates.scraper_source === 'multi' || updates.scraper_url !== undefined) {
        hasStreamingField = true;
        payload.multi_scraper_config = updates.scraper_source === 'multi'
            ? cleanValue(updates.scraper_url)
            : null;
    }

    return hasStreamingField ? payload : null;
}

export async function upsertStreamingRow(
    supabase: SupabaseClient,
    movieId: string,
    updates: Record<string, any>
): Promise<boolean> {
    const payload = buildStreamingPayload(movieId, updates);
    if (!payload) return false;

    const { error } = await supabase
        .from('streaming')
        .upsert(payload, { onConflict: 'movie_id' });

    if (error) {
        if (!isStreamingTableMissing(error)) {
            console.warn('[Streaming Table] Failed to upsert streaming row:', error.message);
        }
        return false;
    }

    return true;
}
