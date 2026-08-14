import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type DownloadInput = {
    quality?: unknown;
    fileSize?: unknown;
    fileUrl?: unknown;
};

function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try {
        return new URL(origin).host === new URL(req.url).host;
    } catch {
        return false;
    }
}

function nonEmptyString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeDownload(value: DownloadInput) {
    const quality = nonEmptyString(value.quality);
    const fileSize = nonEmptyString(value.fileSize);
    const fileUrl = nonEmptyString(value.fileUrl);

    if (!quality) {
        throw new Error('Each download must include a quality.');
    }
    if (fileUrl) {
        let parsed: URL;
        try {
            parsed = new URL(fileUrl);
        } catch {
            throw new Error(`Invalid download URL for ${quality}.`);
        }
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`Download URL for ${quality} must use http or https.`);
        }
    }

    return {
        quality,
        file_size: fileSize || null,
        file_url: fileUrl || null,
    };
}

export async function POST(req: Request) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json() as {
            movieId?: unknown;
            downloads?: unknown;
        };
        const movieId = nonEmptyString(body.movieId);
        if (!movieId) {
            return NextResponse.json({ error: 'movieId is required.' }, { status: 400 });
        }
        if (body.downloads !== undefined && !Array.isArray(body.downloads)) {
            return NextResponse.json({ error: 'downloads must be an array.' }, { status: 400 });
        }

        const normalizedDownloads = ((body.downloads ?? []) as DownloadInput[]).map(normalizeDownload);
        const db = getAdminSupabase();
        const { data: movie, error: movieError } = await db
            .from('movies')
            .select('id')
            .eq('id', movieId)
            .maybeSingle();
        if (movieError) throw movieError;
        if (!movie) {
            return NextResponse.json({ error: 'Movie not found.' }, { status: 404 });
        }

        const { error: deleteError } = await db
            .from('downloads')
            .delete()
            .eq('movie_id', movieId);
        if (deleteError) throw deleteError;

        if (normalizedDownloads.length > 0) {
            const rows = normalizedDownloads.map(download => ({
                movie_id: movieId,
                ...download,
            }));
            const { error: insertError } = await db.from('downloads').insert(rows);
            if (insertError) throw insertError;
        }

        return NextResponse.json({
            ok: true,
            movieId,
            count: normalizedDownloads.length,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        console.error('Admin downloads API error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save downloads.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
