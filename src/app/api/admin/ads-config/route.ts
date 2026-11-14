import { NextResponse } from 'next/server';
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

export async function GET(req: Request) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const db = getAdminSupabase();
        const { data, error } = await db
            .from('app_settings')
            .select('*')
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return NextResponse.json(
            { ok: true, settings: data || null },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (error: unknown) {
        console.error('Admin ads-config GET error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load app ads configuration';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    try {
        const body = await req.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
        }

        const db = getAdminSupabase();
        const { data: existingRow, error: fetchError } = await db
            .from('app_settings')
            .select('id')
            .order('id', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (fetchError) throw fetchError;
        const targetId = existingRow?.id ?? 1;

        const payload: Record<string, unknown> = {
            app_ad_network: ['startio', 'unity', 'both'].includes(body.app_ad_network)
                ? body.app_ad_network
                : 'startio',
            startio_app_id: String(body.startio_app_id || '').trim(),
            unity_app_key: String(body.unity_app_key || '').trim(),
            unity_banner_id: String(body.unity_banner_id || '').trim(),
            unity_interstitial_id: String(body.unity_interstitial_id || '').trim(),
            unity_rewarded_id: String(body.unity_rewarded_id || '').trim(),
            is_banner_enabled: Boolean(body.is_banner_enabled),
            is_interstitial_enabled: Boolean(body.is_interstitial_enabled),
            is_rewarded_enabled: Boolean(body.is_rewarded_enabled),
            is_native_enabled: Boolean(body.is_native_enabled),
            is_app_open_enabled: Boolean(body.is_app_open_enabled),
            is_premium_server_ad_enabled: Boolean(body.is_premium_server_ad_enabled),
            is_test_ads_enabled: Boolean(body.is_test_ads_enabled),
            is_ads_enabled: Boolean(body.is_ads_enabled),
            direct_link_url: String(body.direct_link_url || '').trim(),
            is_download_verification_enabled: Boolean(body.is_download_verification_enabled),
            download_ad_url_1: String(body.download_ad_url_1 || '').trim(),
            ...(body.download_ad_url_2 !== undefined && { download_ad_url_2: String(body.download_ad_url_2 || '').trim() }),
            ...(body.is_verification_enabled !== undefined && { is_verification_enabled: Boolean(body.is_verification_enabled) }),
            ...(body.verification_ad_url_1 !== undefined && { verification_ad_url_1: String(body.verification_ad_url_1 || '').trim() }),
            ...(body.verification_ad_url_2 !== undefined && { verification_ad_url_2: String(body.verification_ad_url_2 || '').trim() }),
            ...(body.is_novel_verification_enabled !== undefined && { is_novel_verification_enabled: Boolean(body.is_novel_verification_enabled) }),
            ...(body.novel_ad_url_1 !== undefined && { novel_ad_url_1: String(body.novel_ad_url_1 || '').trim() }),
            ...(body.novel_ad_url_2 !== undefined && { novel_ad_url_2: String(body.novel_ad_url_2 || '').trim() }),
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await db
            .from('app_settings')
            .update(payload)
            .eq('id', targetId)
            .select('*')
            .single();

        if (error) throw error;
        if (!data) {
            throw new Error(`No app_settings row found (id=${targetId}) to update`);
        }

        return NextResponse.json(
            { ok: true, settings: data },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (error: unknown) {
        console.error('Admin ads-config PUT error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save app ads configuration';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    return PUT(req);
}
