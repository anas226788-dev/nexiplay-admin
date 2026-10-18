import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
type Profile = { id: string; label: string; description: string; genres: string[]; types: string[] };
const DEFAULT_PROFILES: Profile[] = [
    { id: 'feel-good', label: 'Feel-good', description: 'Light, funny stories for a brighter mood.', genres: ['comedy', 'family', 'romance'], types: ['movie', 'series', 'anime'] },
    { id: 'adventure', label: 'Adventure', description: 'Fast, exciting stories with a sense of discovery.', genres: ['action', 'adventure', 'fantasy'], types: ['movie', 'series', 'anime'] },
    { id: 'thoughtful', label: 'Thoughtful', description: 'Character-led drama, mystery and science fiction.', genres: ['drama', 'mystery', 'science-fiction'], types: ['movie', 'series', 'anime'] },
    { id: 'cozy', label: 'Cozy', description: 'Warm animation and easygoing stories.', genres: ['animation', 'family', 'comedy'], types: ['movie', 'series', 'anime'] },
];
const validTypes = new Set(['movie', 'series', 'anime']);
function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}
function validProfiles(value: unknown): value is Profile[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 8) return false;
    const ids = new Set<string>();
    return value.every(item => {
        if (!item || typeof item !== 'object') return false;
        const profile = item as Profile;
        if (!/^[a-z0-9-]{2,40}$/.test(profile.id) || ids.has(profile.id)) return false;
        ids.add(profile.id);
        return typeof profile.label === 'string' && profile.label.trim().length > 0 && profile.label.length <= 40
            && typeof profile.description === 'string' && profile.description.length <= 180
            && Array.isArray(profile.genres) && profile.genres.length <= 12
            && profile.genres.every(slug => typeof slug === 'string' && /^[a-z0-9-]{1,50}$/.test(slug))
            && Array.isArray(profile.types) && profile.types.length > 0 && profile.types.every(type => validTypes.has(type));
    });
}
export async function GET(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const { data, error } = await getAdminSupabase().from('app_settings').select('mood_profiles').eq('id', 1).single();
        if (error) throw error;
        return NextResponse.json({ profiles: data.mood_profiles ?? DEFAULT_PROFILES, writable: true }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[Mood Picks] Load failed:', error);
        const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
        const detail = error instanceof Error ? error.message : '';
        const setupMessage = code === '42703' || /column .* does not exist/i.test(detail)
            ? 'Database setup is incomplete. Apply supabase/migrations/add_mood_profiles.sql to enable saving.'
            : /Server Supabase credentials are not configured/i.test(detail)
                ? 'Admin server credentials are missing. Configure SUPABASE_SERVICE_ROLE_KEY on the admin server and apply supabase/migrations/add_mood_profiles.sql in Supabase before saving.'
                : 'Settings could not be loaded. Check the admin server connection.';
        return NextResponse.json({ profiles: DEFAULT_PROFILES, writable: false, setupMessage }, { headers: { 'Cache-Control': 'no-store' } });
    }
}
export async function PUT(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    try {
        const body = await req.json();
        if (!validProfiles(body?.profiles)) return NextResponse.json({ error: 'Check profile names, unique IDs, genre slugs and content types.' }, { status: 400 });
        const profiles = (body.profiles as Profile[]).map((profile: Profile) => ({
            id: profile.id,
            label: profile.label.trim(),
            description: profile.description.trim(),
            genres: [...new Set(profile.genres)],
            types: [...new Set(profile.types)],
        }));
        const { error } = await getAdminSupabase().from('app_settings').update({ mood_profiles: profiles, updated_at: new Date().toISOString() }).eq('id', 1);
        if (error) throw error;
        return NextResponse.json({ ok: true, profiles }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('[Mood Picks] Save failed:', error);
        return NextResponse.json({ error: 'Could not save mood profiles. Check database setup and retry.' }, { status: 503 });
    }
}
