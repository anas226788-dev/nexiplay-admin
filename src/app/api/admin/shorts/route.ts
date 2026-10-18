import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function extractYouTubeId(urlOrId: string): string | null {
    if (!urlOrId) return null;
    const clean = urlOrId.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;

    const match = clean.match(/(?:shorts\/|v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

export async function GET() {
    try {
        // 1. Fetch from custom table if exists
        let customShorts: any[] = [];
        try {
            const { data } = await supabase.from('shorts').select('*').order('created_at', { ascending: false });
            if (data) customShorts = data;
        } catch { /* table might not exist yet */ }

        // 2. Fetch live upstream trending feed
        let upstreamCount = 0;
        try {
            const res = await fetch('https://www.moviebari.space/api/shorts', {
                next: { revalidate: 3600 },
                signal: AbortSignal.timeout(3000),
            });
            if (res.ok) {
                const data = await res.json();
                upstreamCount = Array.isArray(data.items) ? data.items.length : 0;
            }
        } catch { /* optional */ }

        return NextResponse.json({
            customShorts,
            upstreamCount,
            totalActive: customShorts.length + 12 + upstreamCount,
        });
    } catch (error) {
        console.error('[Admin Shorts API] Error:', error);
        return NextResponse.json({ customShorts: [], upstreamCount: 20, totalActive: 32 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const youtubeId = extractYouTubeId(body.url || body.youtube_id || '');
        const title = (body.title || '').trim();
        const channelName = (body.channel_name || 'Nexiplay Creator').trim();
        const kind = body.kind === 'trailer' ? 'trailer' : 'short';
        const movieSlug = (body.movie_slug || '').trim() || null;
        const movieTitle = (body.movie_title || '').trim() || null;

        if (!youtubeId) {
            return NextResponse.json({ error: 'Valid YouTube Shorts URL or 11-character Video ID is required.' }, { status: 400 });
        }
        if (!title) {
            return NextResponse.json({ error: 'Video title is required.' }, { status: 400 });
        }

        const newRow = {
            youtube_id: youtubeId,
            title,
            channel: 'custom',
            channel_name: channelName,
            kind,
            thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
            movie_slug: movieSlug,
            movie_title: movieTitle,
            is_active: true,
            priority: 10,
            created_at: new Date().toISOString(),
        };

        // Insert into shorts table
        const { data, error } = await supabase.from('shorts').insert([newRow]).select().single();
        if (error) {
            // If table doesn't exist, instruct admin
            return NextResponse.json({
                error: `Database table "shorts" is missing. Please run the SQL migration "create_shorts_table.sql" in Supabase SQL editor. Error: ${error.message}`,
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, item: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to add short' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const { error } = await supabase.from('shorts').delete().eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
    }
}
