import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function adminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase credentials not configured');
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, is_pinned } = body;

        if (!id) {
            return NextResponse.json({ error: 'Movie ID is required' }, { status: 400 });
        }

        const db = adminClient();
        const pinState = Boolean(is_pinned);
        const adminNoteVal = pinState ? 'pinned' : null;

        const { data: noteData, error: noteError } = await db
            .from('movies')
            .update({ admin_note: adminNoteVal })
            .eq('id', id)
            .select('id, title, admin_note')
            .single();

        if (noteError) {
            throw noteError;
        }

        return NextResponse.json({ success: true, movie: { ...noteData, is_pinned: pinState }, is_pinned: pinState });
    } catch (err: any) {
        console.error('Pin API error:', err);
        return NextResponse.json({ error: err.message || 'Failed to toggle pin' }, { status: 500 });
    }
}
