import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id, message } = body;

        if (!user_id || !message) {
            return NextResponse.json({ error: 'Parameters "user_id" and "message" are required' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: 'Database credentials not configured' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('user_notifications')
            .insert({
                user_id,
                message,
                is_read: false
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Message sent successfully', data });
    } catch (err: any) {
        console.error('Send message error:', err);
        return NextResponse.json({ error: err.message || 'Failed to send message' }, { status: 500 });
    }
}
