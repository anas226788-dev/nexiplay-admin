import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'event' | 'session' | 'user_all'
        const id = searchParams.get('id'); // The specific ID

        if (!type || !id) {
            return NextResponse.json({ error: 'Parameters "type" and "id" are required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Database credentials not configured' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        if (type === 'event') {
            const { error } = await supabase.from('user_events').delete().eq('id', id);
            if (error) throw error;
            return NextResponse.json({ success: true, message: 'Event deleted successfully' });
        }

        if (type === 'session') {
            const { error } = await supabase.from('user_sessions').delete().eq('session_id', id);
            if (error) throw error;
            return NextResponse.json({ success: true, message: 'Session deleted successfully' });
        }

        if (type === 'user_all') {
            // Delete all events, sessions and messages for this user ID
            const [eventsRes, sessionsRes, messagesRes] = await Promise.all([
                supabase.from('user_events').delete().eq('user_id', id),
                supabase.from('user_sessions').delete().eq('user_id', id),
                supabase.from('notifications').delete().eq('user_id', id)
            ]);

            if (eventsRes.error) throw eventsRes.error;
            if (sessionsRes.error) throw sessionsRes.error;
            if (messagesRes.error) throw messagesRes.error;

            return NextResponse.json({ success: true, message: 'All user activity logs deleted successfully' });
        }

        if (type === 'notification') {
            const { error } = await supabase.from('notifications').delete().eq('id', id);
            if (error) throw error;
            return NextResponse.json({ success: true, message: 'Notification deleted successfully' });
        }

        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
    } catch (err: any) {
        console.error('Delete logs error:', err);
        return NextResponse.json({ error: err.message || 'Failed to delete logs' }, { status: 500 });
    }
}
