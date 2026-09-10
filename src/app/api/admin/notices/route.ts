import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

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

// GET: Fetch all notices or single notice by ?id=
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const db = getAdminSupabase();

        if (id) {
            const { data, error } = await db
                .from('notices')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                return NextResponse.json({ ok: false, error: 'Notice not found' }, { status: 404 });
            }
            return NextResponse.json({ ok: true, notice: data });
        }

        const { data, error } = await db
            .from('notices')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return NextResponse.json({ ok: true, notices: data || [] });
    } catch (error: any) {
        console.error('[API notices GET] Error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Failed to fetch notices' }, { status: 500 });
    }
}

// POST: Create a new notice
export async function POST(request: NextRequest) {
    if (!sameOrigin(request)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const {
            content,
            type = 'top_bar',
            pages = 'all',
            bg_color,
            text_color,
            is_active = true,
            image_url = null,
            video_url = null,
            platform = 'both',
            movie_id = null
        } = body;

        if (!content || !content.trim()) {
            return NextResponse.json({ ok: false, error: 'Message content is required.' }, { status: 400 });
        }

        if (pages === 'specific' && !movie_id) {
            return NextResponse.json({ ok: false, error: 'Please select a targeted content title.' }, { status: 400 });
        }

        const db = getAdminSupabase();
        const payload = {
            content: content.trim(),
            type,
            pages,
            bg_color: bg_color || '',
            text_color: text_color || '',
            is_active: Boolean(is_active),
            image_url: image_url || null,
            video_url: video_url || null,
            platform: platform || 'both',
            movie_id: pages === 'specific' && movie_id ? movie_id : null
        };

        const { data, error } = await db
            .from('notices')
            .insert([payload])
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return NextResponse.json({ ok: false, error: 'Insert returned 0 rows.' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, notice: data[0] });
    } catch (error: any) {
        console.error('[API notices POST] Error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Failed to create notice' }, { status: 500 });
    }
}

// PUT: Update an existing notice by id
export async function PUT(request: NextRequest) {
    if (!sameOrigin(request)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ ok: false, error: 'Notice ID is required for update.' }, { status: 400 });
        }

        if (updates.content !== undefined && !updates.content.trim()) {
            return NextResponse.json({ ok: false, error: 'Message content cannot be empty.' }, { status: 400 });
        }

        if (updates.pages === 'specific' && !updates.movie_id) {
            return NextResponse.json({ ok: false, error: 'Please select a targeted content title.' }, { status: 400 });
        }

        const payload: Record<string, any> = {};
        if (updates.content !== undefined) payload.content = updates.content.trim();
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.pages !== undefined) payload.pages = updates.pages;
        if (updates.bg_color !== undefined) payload.bg_color = updates.bg_color;
        if (updates.text_color !== undefined) payload.text_color = updates.text_color;
        if (updates.is_active !== undefined) payload.is_active = Boolean(updates.is_active);
        if (updates.image_url !== undefined) payload.image_url = updates.image_url || null;
        if (updates.video_url !== undefined) payload.video_url = updates.video_url || null;
        if (updates.platform !== undefined) payload.platform = updates.platform;
        if (updates.pages !== undefined || updates.movie_id !== undefined) {
            payload.movie_id = (updates.pages === 'specific' && updates.movie_id) ? updates.movie_id : null;
        }

        const db = getAdminSupabase();
        const { data, error } = await db
            .from('notices')
            .update(payload)
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return NextResponse.json({ ok: false, error: 'Notice not found or update failed (0 rows affected).' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, notice: data[0] });
    } catch (error: any) {
        console.error('[API notices PUT] Error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Failed to update notice' }, { status: 500 });
    }
}

// PATCH: Partial update (e.g. toggle is_active)
export async function PATCH(request: NextRequest) {
    if (!sameOrigin(request)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, is_active } = body;

        if (!id) {
            return NextResponse.json({ ok: false, error: 'Notice ID is required.' }, { status: 400 });
        }

        const db = getAdminSupabase();
        const { data, error } = await db
            .from('notices')
            .update({ is_active: Boolean(is_active) })
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return NextResponse.json({ ok: false, error: 'Notice not found.' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, notice: data[0] });
    } catch (error: any) {
        console.error('[API notices PATCH] Error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Failed to toggle notice' }, { status: 500 });
    }
}

// DELETE: Remove a notice by id
export async function DELETE(request: NextRequest) {
    if (!sameOrigin(request)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        let id = searchParams.get('id');

        if (!id) {
            try {
                const body = await request.json();
                id = body.id;
            } catch {}
        }

        if (!id) {
            return NextResponse.json({ ok: false, error: 'Notice ID is required for deletion.' }, { status: 400 });
        }

        const db = getAdminSupabase();
        const { data, error } = await db
            .from('notices')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) {
            return NextResponse.json({ ok: false, error: 'Notice not found or already deleted.' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, deletedId: id });
    } catch (error: any) {
        console.error('[API notices DELETE] Error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Failed to delete notice' }, { status: 500 });
    }
}
