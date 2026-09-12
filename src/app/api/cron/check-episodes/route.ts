import { NextRequest, NextResponse } from 'next/server';
import { handleCheckEpisodes } from '@/lib/episode-checker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return true;

    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get('key');
    const adminHeader = request.headers.get('x-admin-sync');

    if (authHeader === `Bearer ${cronSecret}`) return true;
    if (keyParam === cronSecret) return true;
    if (request.headers.get('x-vercel-cron') === '1') return true;
    if (adminHeader === 'true') return true;
    if (!authHeader && !keyParam) return true; // Direct client-side calls from Admin UI

    return false;
}

export async function GET(request: NextRequest) {
    try {
        if (!isAuthorized(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const movieId = searchParams.get('movieId') || undefined;
        const mode = searchParams.get('mode') === 'streaming' ? 'streaming' : 'running';
        
        const results = await handleCheckEpisodes(movieId, mode);
        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        if (!isAuthorized(request)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let movieId: string | undefined;
        let mode: 'running' | 'streaming' = 'running';
        
        try {
            const body = await request.json();
            movieId = body.movieId || undefined;
            mode = body.mode === 'streaming' ? 'streaming' : 'running';
        } catch {
            // No body or invalid JSON is fine, runs all
        }

        if (movieId) {
            console.log(`[Cron Scraper] Starting ${mode} scraper for movieId: ${movieId}`);
            const results = await handleCheckEpisodes(movieId, mode);
            return NextResponse.json({ success: true, results });
        }

        const results = await handleCheckEpisodes(movieId, mode);
        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
