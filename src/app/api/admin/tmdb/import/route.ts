import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type TmdbDetail = {
    id: number;
    title?: string;
    name?: string;
    overview?: string;
    poster_path?: string | null;
    backdrop_path?: string | null;
    release_date?: string;
    first_air_date?: string;
    original_language?: string;
    adult?: boolean;
    genres?: Array<{ id: number; name: string }>;
    credits?: { cast?: Array<{ name?: string; character?: string }> };
    videos?: { results?: Array<{ key?: string; site?: string; type?: string; official?: boolean }> };
};

function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

function slugify(value: string) {
    return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'untitled';
}

export async function POST(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (process.env.TMDB_COMMERCIAL_LICENSE_CONFIRMED !== 'true' && process.env.TMDB_NONCOMMERCIAL_USE_CONFIRMED !== 'true') {
        return NextResponse.json({ error: 'TMDB API use is disabled until the permitted usage mode is configured.' }, { status: 503 });
    }
    const apiKey = process.env.TMDB_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: 'TMDB is not configured on this server. Add TMDB_API_KEY to the admin environment.' }, { status: 503 });

    try {
        const body = await req.json() as { tmdbId?: unknown; media?: unknown; contentType?: unknown };
        const tmdbId = Number(body.tmdbId);
        const media = body.media === 'tv' ? 'tv' : body.media === 'movie' ? 'movie' : null;
        const contentType = ['movie', 'series', 'anime'].includes(String(body.contentType)) ? String(body.contentType) : null;
        if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0 || !media || !contentType) {
            return NextResponse.json({ error: 'Choose a valid TMDB title and content type.' }, { status: 400 });
        }
        if ((media === 'movie' && contentType !== 'movie') || (media === 'tv' && contentType === 'movie')) {
            return NextResponse.json({ error: 'The selected content type does not match this TMDB title.' }, { status: 400 });
        }

        const detailUrl = new URL(`https://api.themoviedb.org/3/${media}/${tmdbId}`);
        detailUrl.searchParams.set('language', 'en-US');
        detailUrl.searchParams.set('append_to_response', 'credits,videos');
        detailUrl.searchParams.set('api_key', apiKey);
        const tmdbResponse = await fetch(detailUrl, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(12_000),
            cache: 'no-store',
        });
        if (tmdbResponse.status === 404) return NextResponse.json({ error: 'This TMDB title is no longer available.' }, { status: 404 });
        if (!tmdbResponse.ok) return NextResponse.json({ error: 'TMDB could not provide title details. Try again shortly.' }, { status: 502 });

        const detail = await tmdbResponse.json() as TmdbDetail;
        const title = (detail.title || detail.name || '').trim();
        if (!title) return NextResponse.json({ error: 'TMDB returned a title without a name.' }, { status: 422 });
        const date = detail.release_date || detail.first_air_date || '';
        const year = Number(date.slice(0, 4)) || null;
        const trailer = (detail.videos?.results ?? []).find(video =>
            video.site === 'YouTube' && video.key && video.type === 'Trailer' && video.official
        ) ?? (detail.videos?.results ?? []).find(video => video.site === 'YouTube' && video.key && video.type === 'Trailer');

        const payload = {
            title,
            description: detail.overview || null,
            poster_url: detail.poster_path ? `https://image.tmdb.org/t/p/w500${detail.poster_path}` : null,
            banner_url_desktop: detail.backdrop_path ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}` : null,
            type: contentType,
            release_year: year,
            language: detail.original_language || null,
            cast_members: (detail.credits?.cast ?? []).slice(0, 8).map(person => person.name).filter(Boolean).join(', '),
            trailer_url: trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
            tmdb_id: String(tmdbId),
            is_adult: Boolean(detail.adult),
        };

        const db = getAdminSupabase();
        const { data: matches, error: matchError } = await db.from('movies')
            .select('id, slug').eq('tmdb_id', String(tmdbId)).limit(2);
        if (matchError) throw matchError;
        const existing = matches?.[0];
        let movieId: string;
        let action: 'created' | 'updated';
        if (existing) {
            const { data, error } = await db.from('movies').update(payload).eq('id', existing.id).select('id').single();
            if (error) throw error;
            movieId = data.id;
            action = 'updated';
        } else {
            const yearSuffix = year ? `-${year}` : '';
            let slug = `${slugify(title)}${yearSuffix}`;
            const { data, error } = await db.from('movies').insert({ ...payload, slug }).select('id').single();
            if (error?.code === '23505') {
                slug = `${slug}-${tmdbId}`;
                const retry = await db.from('movies').insert({ ...payload, slug }).select('id').single();
                if (retry.error) throw retry.error;
                movieId = retry.data.id;
            } else {
                if (error) throw error;
                movieId = data.id;
            }
            action = 'created';
        }

        const categoryRows = await Promise.all((detail.genres ?? []).map(async genre => {
            const slug = slugify(genre.name);
            const { data, error } = await db.from('categories').upsert({ name: genre.name, slug }, { onConflict: 'slug' }).select('id').single();
            if (error) throw error;
            return { movie_id: movieId, category_id: data.id };
        }));
        if (categoryRows.length) {
            const { error } = await db.from('movie_categories').upsert(categoryRows, {
                onConflict: 'movie_id,category_id', ignoreDuplicates: true,
            });
            if (error) throw error;
        }

        return NextResponse.json({ ok: true, action, movieId, title }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[TMDB catalog] Import failed:', error);
        return NextResponse.json({ error: 'Could not save this title. Check the database configuration and try again.' }, { status: 500 });
    }
}
