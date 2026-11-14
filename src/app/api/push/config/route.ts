import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import {
    DEFAULT_NEXIPLAY_ONESIGNAL_APP_ID,
    getMaskedPushSettings,
    inspectOneSignalAndroidConfig,
} from '@/lib/onesignal';

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
    if (!sameOrigin(req)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }
    try {
        const config = await getMaskedPushSettings();
        const androidDiagnostics = await inspectOneSignalAndroidConfig(config.onesignalAppId);
        return NextResponse.json(
            { ok: true, config, androidDiagnostics },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || 'Failed to load push settings' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    if (!sameOrigin(req)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await req.json();
        const db = getAdminSupabase();

        const payload: Record<string, any> = {
            id: 1,
            provider: 'onesignal',
            onesignal_app_id: String(body.onesignalAppId || DEFAULT_NEXIPLAY_ONESIGNAL_APP_ID).trim(),
            auto_push_episodes: body.autoPushEpisodes !== false,
            auto_push_movies: body.autoPushMovies !== false,
            auto_push_notices: body.autoPushNotices !== false,
            updated_at: new Date().toISOString(),
        };

        if (typeof body.onesignalRestApiKey === 'string' && body.onesignalRestApiKey.trim().length > 0) {
            payload.onesignal_rest_api_key = body.onesignalRestApiKey.trim();
        } else if (body.clearRestApiKey === true) {
            payload.onesignal_rest_api_key = '';
        }

        const { error } = await db
            .from('push_notification_settings')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            return NextResponse.json(
                {
                    ok: false,
                    error: `Database save failed (${error.message}). Run add_push_notification_settings.sql or set ONESIGNAL_REST_API_KEY in env.`,
                },
                { status: 500 }
            );
        }

        const config = await getMaskedPushSettings();
        const androidDiagnostics = await inspectOneSignalAndroidConfig(config.onesignalAppId);
        return NextResponse.json({ ok: true, config, androidDiagnostics });
    } catch (err: any) {
        return NextResponse.json(
            { ok: false, error: err?.message || 'Failed to save push settings' },
            { status: 500 }
        );
    }
}
