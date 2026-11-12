import { NextRequest, NextResponse } from 'next/server';
import { syncLatestUpdate, type LatestUpdateType } from '@/lib/latest-updates';

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
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const movieId = typeof body?.movieId === 'string' ? body.movieId.trim() : '';
        if (!movieId) {
            return NextResponse.json({ success: false, error: 'movieId is required.' }, { status: 400 });
        }

        const rawType = typeof body?.updateType === 'string' ? body.updateType.trim().toLowerCase() : 'episode';
        const updateType: LatestUpdateType =
            rawType === 'movie' || rawType === 'season' || rawType === 'episode' ? rawType : 'episode';

        const seasonNumber =
            body?.seasonNumber !== null && body?.seasonNumber !== undefined && body?.seasonNumber !== ''
                ? Number(body.seasonNumber)
                : null;
        const episodeNumber =
            body?.episodeNumber !== null && body?.episodeNumber !== undefined && body?.episodeNumber !== ''
                ? Number(body.episodeNumber)
                : null;

        const result = await syncLatestUpdate({
            movieId,
            updateType,
            seasonNumber: Number.isFinite(seasonNumber) ? seasonNumber : null,
            episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : null,
            preserveExistingEpisodeOnSeason: body?.preserveExistingEpisodeOnSeason !== false,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error: any) {
        console.error('[Updates API] Failed to sync latest update:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to sync latest update' },
            { status: 500 }
        );
    }
}
