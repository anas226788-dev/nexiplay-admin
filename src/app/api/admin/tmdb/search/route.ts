import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type TmdbSearchItem = {
    id: number;
    media_type?: string;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    original_language?: string;
    vote_average?: number;
    adult?: boolean;
};

function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

export async function GET(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (process.env.TMDB_COMMERCIAL_LICENSE_CONFIRMED !== 'true' && process.env.TMDB_NONCOMMERCIAL_USE_CONFIRMED !== 'true') {
        return NextResponse.json({ error: 'TMDB API use is disabled until the permitted usage mode is configured.' }, { status: 503 });
    }

    const apiKey = process.env.TMDB_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({ error: 'TMDB is not configured on this server. Add TMDB_API_KEY to the admin environment.' }, { status: 503 });
    }

    const params = new URL(req.url).searchParams;
    const query = params.get('query')?.trim() ?? '';
    const rawMedia = params.get('media')?.toLowerCase();
    const media = rawMedia === 'tv' ? 'tv' : rawMedia === 'movie' ? 'movie' : 'multi';
    const page = Math.min(500, Math.max(1, Number(params.get('page')) || 1));
    if (query.length < 2 || query.length > 100) {
        return NextResponse.json({ error: 'Enter a title between 2 and 100 characters.' }, { status: 400 });
    }

    try {
        const isImdbId = /^tt\d+$/i.test(query);
        let url: URL;
        if (isImdbId) {
            url = new URL(`https://api.themoviedb.org/3/find/${query}`);
            url.searchParams.set('external_source', 'imdb_id');
        } else {
            url = new URL(`https://api.themoviedb.org/3/search/${media}`);
            url.searchParams.set('query', query);
            url.searchParams.set('language', 'en-US');
            url.searchParams.set('include_adult', 'false');
            url.searchParams.set('page', String(page));
        }
        url.searchParams.set('api_key', apiKey);
        const response = await fetch(url, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(12_000),
            cache: 'no-store',
        });
        if (!response.ok) {
            console.warn('[TMDB catalog] Search rejected:', response.status);
            return NextResponse.json({ error: response.status === 401
                ? 'TMDB rejected the API credential. Check TMDB_API_KEY.'
                : 'TMDB search is temporarily unavailable. Try again shortly.' }, { status: response.status === 401 ? 503 : 502 });
        }

        const payload = await response.json() as { 
            results?: TmdbSearchItem[]; 
            movie_results?: TmdbSearchItem[];
            tv_results?: TmdbSearchItem[];
            total_pages?: number; 
            total_results?: number 
        };
        const rawList = isImdbId
            ? [...(payload.movie_results ?? []).map(r => ({ ...r, media_type: 'movie' })), ...(payload.tv_results ?? []).map(r => ({ ...r, media_type: 'tv' }))]
            : (payload.results ?? []);

        const results = rawList
            .filter(item => item.media_type !== 'person')
            .map(item => {
                const itemMedia = item.media_type === 'tv' ? 'tv' : item.media_type === 'movie' ? 'movie' : media === 'tv' ? 'tv' : 'movie';
                const title = item.title || item.name || 'Untitled';
                const date = item.release_date || item.first_air_date || '';
                return {
                    id: item.id,
                    media: itemMedia,
                    title,
                    originalTitle: item.original_title || item.original_name || title,
                    overview: item.overview || '',
                    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                    backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
                    releaseYear: date.slice(0, 4) || null,
                    language: item.original_language || null,
                    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
                    adult: Boolean(item.adult),
                };
            });

        // Cross-reference with Supabase to detect if title already exists in DB
        let existingByTmdbId = new Map<string, { id: string; title: string; slug: string; type: string }>();
        const tmdbIds = results.map(r => String(r.id));
        if (tmdbIds.length > 0) {
            try {
                const supabase = getAdminSupabase();
                const { data: dbMatches } = await supabase
                    .from('movies')
                    .select('id, tmdb_id, title, slug, type')
                    .in('tmdb_id', tmdbIds);

                for (const match of (dbMatches || [])) {
                    if (match.tmdb_id) {
                        existingByTmdbId.set(String(match.tmdb_id), match);
                    }
                }
            } catch (dbErr) {
                console.warn('[TMDB catalog] Error matching existing titles:', dbErr);
            }
        }

        const enrichedResults = results.map(item => {
            const existing = existingByTmdbId.get(String(item.id));
            return {
                ...item,
                inDatabase: Boolean(existing),
                existingId: existing?.id || null,
                existingSlug: existing?.slug || null,
                existingType: existing?.type || null,
            };
        });

        return NextResponse.json({
            results: enrichedResults,
            page,
            totalPages: Math.min(payload.total_pages ?? 1, 500),
            totalResults: payload.total_results ?? results.length,
        }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        console.error('[TMDB catalog] Search failed:', error);
        return NextResponse.json({ error: 'Could not reach TMDB. Check the connection and try again.' }, { status: 502 });
    }
}
