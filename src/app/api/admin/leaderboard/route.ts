import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function fetchAllWatchCounts(db: ReturnType<typeof getAdminSupabase>): Promise<Map<string, number>> {
    const watchMap = new Map<string, number>();
    let offset = 0;
    const pageSize = 1000;

    while (offset < 10000) {
        const { data, error } = await db
            .from('user_events')
            .select('user_id, event_type')
            .eq('event_type', 'watch')
            .range(offset, offset + pageSize - 1);

        if (error || !data || data.length === 0) break;
        for (const ev of data) {
            if (ev.user_id) {
                watchMap.set(ev.user_id, (watchMap.get(ev.user_id) || 0) + 1);
            }
        }
        if (data.length < pageSize) break;
        offset += pageSize;
    }

    return watchMap;
}

async function generateRealUsersLeaderboard(db: ReturnType<typeof getAdminSupabase>) {
    const [{ data: profiles, error: profErr }, { data: balances, error: balErr }, watchMap] = await Promise.all([
        db.from('profiles').select('id, email, display_name, avatar_url, vip_badge, vip_badge_expires, created_at').limit(2000),
        db.from('coin_balances').select('user_id, balance, total_earned, total_spent').limit(2000),
        fetchAllWatchCounts(db),
    ]);

    if (profErr) throw profErr;
    if (balErr) throw balErr;

    const coinMap = new Map<string, number>();
    for (const b of balances || []) {
        if (b.user_id) {
            coinMap.set(b.user_id, Number(b.balance) || 0);
        }
    }

    const nowMs = Date.now();
    const seenUserIds = new Set<string>();
    const scoredUsers: Array<{
        user_id: string;
        name: string;
        avatar_url: string | null;
        badge_type: string;
        coins: number;
        watched_count: number;
        score: number;
        is_fake: boolean;
    }> = [];

    for (const p of profiles || []) {
        if (!p.id || seenUserIds.has(p.id)) continue;
        seenUserIds.add(p.id);

        const rawBadge = String(p.vip_badge || '').trim();
        const badgeLower = rawBadge.toLowerCase();
        const expMs = p.vip_badge_expires ? Date.parse(p.vip_badge_expires) : NaN;
        const isExpired = !Number.isNaN(expMs) && expMs < nowMs;

        const activeBadge = !rawBadge || isExpired ? 'none' : rawBadge;
        const activeLower = activeBadge.toLowerCase();
        const isElite = activeLower.includes('elite') || activeLower === 'gold_vip';
        const isVip = !isElite && activeLower.includes('vip');

        // Rules: Active Elite > Active VIP > Free Member, then Exact DB Coins DESC, then Watched Count DESC
        const badgeWeight = isElite ? 100_000_000 : isVip ? 50_000_000 : 0;
        const coins = coinMap.get(p.id) ?? 0;
        const watched = watchMap.get(p.id) ?? 0;
        const name = (p.display_name && String(p.display_name).trim()) ||
            (p.email ? String(p.email).split('@')[0] : 'User');

        const score = badgeWeight + (coins * 1000) + Math.min(999, watched);

        scoredUsers.push({
            user_id: p.id,
            name,
            avatar_url: p.avatar_url || null,
            badge_type: activeBadge,
            coins,
            watched_count: watched,
            score,
            is_fake: false,
        });
    }

    scoredUsers.sort((a, b) =>
        b.score - a.score ||
        b.coins - a.coins ||
        b.watched_count - a.watched_count
    );

    const topRealUsers = scoredUsers.slice(0, 15).map((u, idx) => ({
        rank: idx + 1,
        user_id: u.user_id,
        name: u.name,
        avatar_url: u.avatar_url,
        badge_type: u.badge_type,
        coins: u.coins,
        watched_count: u.watched_count,
        is_fake: false,
        updated_at: new Date().toISOString(),
    }));

    // Delete all existing rows (including any synthetic or duplicate entries) using service_role
    await db.from('leaderboard_entries').delete().gte('rank', 0);

    let inserted: any[] = [];
    if (topRealUsers.length > 0) {
        const { data, error: insErr } = await db
            .from('leaderboard_entries')
            .insert(topRealUsers)
            .select('*')
            .order('rank', { ascending: true });
        if (insErr) throw insErr;
        inserted = data || topRealUsers;
    }

    await db
        .from('app_settings')
        .upsert({ id: 1, leaderboard_mode: 'algorithm' }, { onConflict: 'id' });

    return inserted;
}

export async function GET() {
    try {
        const db = getAdminSupabase();

        const [{ data: settings }, { data: existingEntries, error: lbErr }] = await Promise.all([
            db.from('app_settings').select('is_leaderboard_enabled, leaderboard_mode').eq('id', 1).maybeSingle(),
            db.from('leaderboard_entries').select('*').order('rank', { ascending: true }),
        ]);

        if (lbErr) throw lbErr;

        let entries = existingEntries || [];

        // Check if there are any synthetic entries (is_fake = true), null user_id entries, or duplicate ranks
        const rankSet = new Set<number>();
        const userSet = new Set<string>();
        let needsCleanRegen = entries.length === 0;

        for (const e of entries) {
            if (e.is_fake || !e.user_id) {
                needsCleanRegen = true;
                break;
            }
            if (rankSet.has(e.rank) || userSet.has(e.user_id)) {
                needsCleanRegen = true;
                break;
            }
            rankSet.add(e.rank);
            userSet.add(e.user_id);
        }

        if (needsCleanRegen) {
            entries = await generateRealUsersLeaderboard(db);
        }

        return NextResponse.json({
            ok: true,
            is_leaderboard_enabled: settings?.is_leaderboard_enabled ?? true,
            leaderboard_mode: needsCleanRegen ? 'algorithm' : (settings?.leaderboard_mode || 'algorithm'),
            entries,
        });
    } catch (error: any) {
        console.error('[API admin/leaderboard GET] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Failed to load leaderboard' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;
        const db = getAdminSupabase();

        if (action === 'generate') {
            const entries = await generateRealUsersLeaderboard(db);
            return NextResponse.json({
                ok: true,
                entries,
                leaderboard_mode: 'algorithm',
                message: `Leaderboard updated with ${entries.length} real users (0 synthetic users).`,
            });
        }

        if (action === 'toggle') {
            const enabled = Boolean(body.is_leaderboard_enabled);
            const { error } = await db
                .from('app_settings')
                .upsert({ id: 1, is_leaderboard_enabled: enabled }, { onConflict: 'id' });
            if (error) throw error;

            return NextResponse.json({
                ok: true,
                is_leaderboard_enabled: enabled,
                message: `Leaderboard is now ${enabled ? 'ENABLED (Visible in App)' : 'DISABLED (Hidden in App)'}.`,
            });
        }

        if (action === 'swap') {
            const { firstId, firstRank, secondId, secondRank } = body;
            if (!firstId || !secondId) {
                return NextResponse.json({ ok: false, error: 'Missing entry IDs for rank swap' }, { status: 400 });
            }

            await Promise.all([
                db.from('leaderboard_entries').update({ rank: secondRank, updated_at: new Date().toISOString() }).eq('id', firstId),
                db.from('leaderboard_entries').update({ rank: firstRank, updated_at: new Date().toISOString() }).eq('id', secondId),
                db.from('app_settings').upsert({ id: 1, leaderboard_mode: 'custom' }, { onConflict: 'id' }),
            ]);

            const { data: entries } = await db
                .from('leaderboard_entries')
                .select('*')
                .order('rank', { ascending: true });

            return NextResponse.json({
                ok: true,
                entries: entries || [],
                leaderboard_mode: 'custom',
                message: `Swapped Rank #${firstRank} & #${secondRank}! (Custom Mode Active)`,
            });
        }

        if (action === 'edit') {
            const { id, name, badge_type, coins, watched_count } = body;
            if (!id) {
                return NextResponse.json({ ok: false, error: 'Entry ID is required' }, { status: 400 });
            }

            const { error } = await db
                .from('leaderboard_entries')
                .update({
                    name: String(name || '').trim() || 'User',
                    badge_type: badge_type || 'none',
                    coins: Number(coins) || 0,
                    watched_count: Number(watched_count) || 0,
                    is_fake: false,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) throw error;

            await db.from('app_settings').upsert({ id: 1, leaderboard_mode: 'custom' }, { onConflict: 'id' });

            const { data: entries } = await db
                .from('leaderboard_entries')
                .select('*')
                .order('rank', { ascending: true });

            return NextResponse.json({
                ok: true,
                entries: entries || [],
                leaderboard_mode: 'custom',
                message: 'Leaderboard entry updated successfully!',
            });
        }

        return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('[API admin/leaderboard POST] Error:', error);
        return NextResponse.json(
            { ok: false, error: error.message || 'Leaderboard operation failed' },
            { status: 500 }
        );
    }
}
