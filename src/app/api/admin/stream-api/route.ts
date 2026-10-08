import { NextRequest, NextResponse } from 'next/server';
import {
    getStreamApiSettings,
    updateStreamApiSettings,
    getStreamApiKeys,
    createStreamApiKey,
    toggleStreamApiKey,
    deleteStreamApiKey
} from '@/lib/streamApiKeyService';

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

// GET: Fetch stream API settings and all keys
export async function GET() {
    try {
        const [settings, keys] = await Promise.all([
            getStreamApiSettings(),
            getStreamApiKeys()
        ]);

        const stats = {
            totalKeys: keys.length,
            activeKeys: keys.filter(k => k.isActive).length,
            disabledKeys: keys.filter(k => !k.isActive).length,
            productionKeys: keys.filter(k => k.type === 'production').length,
            testKeys: keys.filter(k => k.type === 'test').length,
            totalRequests: keys.reduce((acc, k) => acc + (k.totalRequests || 0), 0)
        };

        return NextResponse.json({
            ok: true,
            settings,
            keys,
            stats
        });
    } catch (err: any) {
        console.error('[Admin Stream API GET error]:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}

// POST: Manage keys and settings
export async function POST(request: NextRequest) {
    if (!sameOrigin(request)) {
        return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { action } = body;

        // 1. Create a new key
        if (action === 'create_key') {
            const { name, type, allowedOrigins, rateLimitPerDay, expiresAt } = body;
            if (!name || !name.trim()) {
                return NextResponse.json({ ok: false, error: 'Client or Key Name is required.' }, { status: 400 });
            }

            const newKey = await createStreamApiKey({
                name: name.trim(),
                type: type === 'test' ? 'test' : 'production',
                allowedOrigins: Array.isArray(allowedOrigins) ? allowedOrigins : ['*'],
                rateLimitPerDay: Number(rateLimitPerDay || 0),
                expiresAt: expiresAt || null
            });

            return NextResponse.json({ ok: true, key: newKey });
        }

        // 2. Toggle Active / Disabled
        if (action === 'toggle_key') {
            const { id, isActive } = body;
            if (!id) {
                return NextResponse.json({ ok: false, error: 'Key ID is required.' }, { status: 400 });
            }

            const updated = await toggleStreamApiKey(id, Boolean(isActive));
            return NextResponse.json({ ok: true, key: updated });
        }

        // 3. Delete / Revoke Key
        if (action === 'delete_key') {
            const { id } = body;
            if (!id) {
                return NextResponse.json({ ok: false, error: 'Key ID is required.' }, { status: 400 });
            }

            const success = await deleteStreamApiKey(id);
            return NextResponse.json({ ok: true, success });
        }

        // 4. Update Settings (Master switch, Mode, TTL)
        if (action === 'update_settings') {
            const { settings } = body;
            if (!settings) {
                return NextResponse.json({ ok: false, error: 'Settings payload is required.' }, { status: 400 });
            }

            const updatedSettings = await updateStreamApiSettings({
                isEnabled: typeof settings.isEnabled === 'boolean' ? settings.isEnabled : undefined,
                accessMode: settings.accessMode,
                defaultTtlSeconds: Number(settings.defaultTtlSeconds || 7200),
                requireOriginMatch: Boolean(settings.requireOriginMatch)
            });

            return NextResponse.json({ ok: true, settings: updatedSettings });
        }

        return NextResponse.json({ ok: false, error: 'Unknown action.' }, { status: 400 });
    } catch (err: any) {
        console.error('[Admin Stream API POST error]:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
