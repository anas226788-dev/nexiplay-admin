import { NextRequest, NextResponse } from 'next/server';
import { syncToonplayDownloads } from '@/lib/toonplay-download-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const force = searchParams.get('force') === 'true';

        const result = await syncToonplayDownloads({ forceSyncAll: force });
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    return GET(request);
}
