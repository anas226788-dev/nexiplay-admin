import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try {
        return new URL(origin).host === new URL(req.url).host;
    } catch {
        return false;
    }
}

function normalizeUrl(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${field} is required`);
    }
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`${field} must use http or https`);
    }
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return parsed.toString();
}

export async function GET(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const { data, error } = await getAdminSupabase()
            .from('app_settings')
            .select('id, rareanimes_url, bollyflix_url, movielink_url, updated_at')
            .eq('id', 1)
            .single();
        if (error) throw error;
        return NextResponse.json({ settings: data }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: unknown) {
        console.error('Admin settings GET error:', error);
        return NextResponse.json({ error: 'Failed to load scraper domains' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const body = await req.json().catch(() => null);
        const payload = {
            rareanimes_url: normalizeUrl(body?.rareanimes_url, 'RareAnimes URL'),
            bollyflix_url: normalizeUrl(body?.bollyflix_url, 'BollyFlix URL'),
            movielink_url: normalizeUrl(body?.movielink_url, 'MovieLink URL'),
            updated_at: new Date().toISOString(),
        };
        const { data, error } = await getAdminSupabase()
            .from('app_settings')
            .update(payload)
            .eq('id', 1)
            .select('id, rareanimes_url, bollyflix_url, movielink_url, updated_at')
            .single();
        if (error) throw error;
        return NextResponse.json({ settings: data }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error: unknown) {
        console.error('Admin settings PUT error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save scraper domains';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}