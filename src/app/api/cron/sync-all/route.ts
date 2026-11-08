import { NextRequest, NextResponse } from 'next/server';
import { GET as getBollyflix } from '../sync-bollyflix/route';
import { GET as getNovels } from '../sync-novels/route';
import { GET as getTmdb } from '../sync-tmdb/route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const url = new URL(request.url);
    const key = url.searchParams.get('key') || 'nexiplay_cron_2026';

    const results: Record<string, any> = {};

    try {
        // 1. Run TMDB Daily Releases & Trending Sync
        try {
            const tmdbReq = new NextRequest(new URL(`/api/cron/sync-tmdb?key=${encodeURIComponent(key)}&limit=3`, request.url), {
                headers: request.headers
            });
            const tmdbRes = await getTmdb(tmdbReq);
            results.tmdb = await tmdbRes.json();
        } catch (tErr: any) {
            results.tmdb = { success: false, error: tErr.message };
        }

        // 2. Run Bollyflix Sync
        try {
            const bollyReq = new NextRequest(new URL(`/api/cron/sync-bollyflix?key=${encodeURIComponent(key)}`, request.url), {
                headers: request.headers
            });
            const bollyRes = await getBollyflix(bollyReq);
            results.bollyflix = await bollyRes.json();
        } catch (bErr: any) {
            results.bollyflix = { success: false, error: bErr.message };
        }

        // 3. Run Novel Sync
        try {
            const novelReq = new NextRequest(new URL(`/api/cron/sync-novels?key=${encodeURIComponent(key)}`, request.url), {
                headers: request.headers
            });
            const novelRes = await getNovels(novelReq);
            results.novels = await novelRes.json();
        } catch (nErr: any) {
            results.novels = { success: false, error: nErr.message };
        }

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            results
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message,
            duration_ms: Date.now() - startTime
        }, { 
            status: 500,
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
        });
    }
}

export const POST = GET;
