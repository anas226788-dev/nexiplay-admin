import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    return handlePurge(request);
}

export async function POST(request: Request) {
    return handlePurge(request);
}

async function handlePurge(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '7', 10);
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Supabase credentials not configured' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Purge user_events older than cutoff date
        const { data: eventsData, error: eventsError } = await supabase
            .from('user_events')
            .delete()
            .lt('created_at', cutoffDate)
            .select('id');

        if (eventsError) {
            console.warn('Events purge warning:', eventsError);
        }

        // 2. Purge user_sessions older than cutoff date
        const { data: sessionsData, error: sessionsError } = await supabase
            .from('user_sessions')
            .delete()
            .lt('last_seen_at', cutoffDate)
            .select('session_id');

        if (sessionsError) {
            console.warn('Sessions purge warning:', sessionsError);
        }

        return NextResponse.json({
            success: true,
            cutoffDate,
            purgedEventsCount: eventsData?.length ?? 0,
            purgedSessionsCount: sessionsData?.length ?? 0,
            message: `Successfully purged logs older than ${days} days.`
        });
    } catch (err: any) {
        console.error('Purge logs error:', err);
        return NextResponse.json({ error: err.message || 'Failed to purge logs' }, { status: 500 });
    }
}
