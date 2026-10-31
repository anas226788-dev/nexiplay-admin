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

export async function GET(req: NextRequest) {
    try {
        const db = getAdminSupabase();
        const idParam = req.nextUrl.searchParams.get('id');

        if (idParam) {
            const { data, error } = await db
                .from('app_config')
                .select('*')
                .eq('id', idParam)
                .maybeSingle();

            if (error) throw error;
            return NextResponse.json({ ok: true, config: data || null });
        }

        // Fetch all configs to provide both app_update and web_launch_modal
        const { data: configs, error } = await db
            .from('app_config')
            .select('*');

        if (error) throw error;

        const appUpdate = configs?.find((c) => c.id === 'app_update') || null;
        const webLaunchModal = configs?.find((c) => c.id === 'web_launch_modal') || null;

        return NextResponse.json({
            ok: true,
            config: appUpdate, // For backward compatibility with existing admin code
            appUpdate,
            webLaunchModal,
            configs: configs || [],
        });
    } catch (err: any) {
        console.error('[API app-config GET] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const db = getAdminSupabase();
        const configId = String(body.id || 'app_update').trim();

        let releaseNotes = body.release_notes;
        if (typeof releaseNotes === 'object' && releaseNotes !== null) {
            releaseNotes = JSON.stringify(releaseNotes);
        } else {
            releaseNotes = String(releaseNotes || '').trim();
        }

        const payload = {
            id: configId,
            latest_version_code: Number(body.latest_version_code) || 1,
            latest_version_name: String(body.latest_version_name || '1.0.0').trim(),
            apk_url: String(body.apk_url || '').trim(),
            release_notes: releaseNotes,
            force_update: Boolean(body.force_update),
            min_version_code: Number(body.min_version_code) || 1,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await db
            .from('app_config')
            .upsert(payload, { onConflict: 'id' })
            .select();

        if (error) throw error;
        return NextResponse.json({ ok: true, config: data?.[0] || payload });
    } catch (err: any) {
        console.error('[API app-config POST] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
