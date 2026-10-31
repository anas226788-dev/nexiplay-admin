import { NextRequest, NextResponse } from 'next/server';
import { handleCheckEpisodes } from '@/lib/episode-checker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader?.trim();
    const cronKeyHeader = request.headers.get('x-cron-key')?.trim();
    const { searchParams } = new URL(request.url);
    const keyParam = (searchParams.get('key') || searchParams.get('token') || searchParams.get('secret'))?.trim();
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (isVercelCron) return true;

    const validKeys = [
        'nexi_cron_5f9a8b7c6d1e4023a1',
        'nexiplay_novel_sync_2026',
        'nexiplay_cron_2026'
    ];
    if (cronSecret) validKeys.push(cronSecret);

    if (keyParam && validKeys.includes(keyParam)) return true;
    if (bearerToken && validKeys.includes(bearerToken)) return true;
    if (cronKeyHeader && validKeys.includes(cronKeyHeader)) return true;

    // Allow internal requests originating from the admin UI
    const origin = request.headers.get('origin') || '';
    const referer = request.headers.get('referer') || '';
    const host = request.headers.get('host') || '';
    if ((origin && host && origin.includes(host)) || (referer && host && referer.includes(host))) {
        return true;
    }

    // If no secret configured, allow default operation
    if (!cronSecret) return true;

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
