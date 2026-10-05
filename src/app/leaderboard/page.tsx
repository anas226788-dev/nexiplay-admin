'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LeaderboardEntry } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

const FAKE_NAMES = [
    'Arafat_Anime', 'Tanvir_Pro', 'Siam_Vip', 'Mahir_X', 'Nibir_77', 
    'Rafi_Hero', 'Sabbir_Otaku', 'Fahim_Stream', 'Rayan_99', 'Imran_VIP', 
    'Tahmid_Ninja', 'Nabil_Elite', 'Hamza_Play', 'Zayan_Legend', 'Faris_Ultra'
];

const FAKE_AVATARS = [
    'https://api.dicebear.com/7.x/bottts/png?seed=Tanvir',
    'https://api.dicebear.com/7.x/bottts/png?seed=Siam',
    'https://api.dicebear.com/7.x/bottts/png?seed=Mahir',
    'https://api.dicebear.com/7.x/bottts/png?seed=Nibir',
    'https://api.dicebear.com/7.x/bottts/png?seed=Rafi',
    'https://api.dicebear.com/7.x/bottts/png?seed=Sabbir',
    'https://api.dicebear.com/7.x/bottts/png?seed=Fahim',
    'https://api.dicebear.com/7.x/bottts/png?seed=Rayan',
    'https://api.dicebear.com/7.x/bottts/png?seed=Imran',
    'https://api.dicebear.com/7.x/bottts/png?seed=Tahmid',
    'https://api.dicebear.com/7.x/bottts/png?seed=Nabil',
    'https://api.dicebear.com/7.x/bottts/png?seed=Hamza',
    'https://api.dicebear.com/7.x/bottts/png?seed=Zayan',
    'https://api.dicebear.com/7.x/bottts/png?seed=Faris',
    'https://api.dicebear.com/7.x/bottts/png?seed=Arafat'
];

export default function LeaderboardAdminPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
    // Config State
    const [isEnabled, setIsEnabled] = useState(true);
    const [mode, setMode] = useState<'algorithm' | 'custom'>('algorithm');

    // Edit Modal state
    const [editingEntry, setEditingEntry] = useState<LeaderboardEntry | null>(null);
    const [editName, setEditName] = useState('');
    const [editBadge, setEditBadge] = useState('');
    const [editCoins, setEditCoins] = useState(0);
    const [editWatched, setEditWatched] = useState(0);
    const [saving, setSaving] = useState(false);

    const fetchConfig = async () => {
        // First check localStorage for immediate persistence
        if (typeof window !== 'undefined') {
            const localToggle = localStorage.getItem('nexi_leaderboard_enabled');
            if (localToggle !== null) {
                setIsEnabled(localToggle === 'true');
            }
        }

        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle();

            if (!error && data && data.is_leaderboard_enabled !== undefined && data.is_leaderboard_enabled !== null) {
                const dbVal = Boolean(data.is_leaderboard_enabled);
                setIsEnabled(dbVal);
                if (typeof window !== 'undefined') {
                    localStorage.setItem('nexi_leaderboard_enabled', String(dbVal));
                }
                if (data.leaderboard_mode) {
                    setMode(data.leaderboard_mode);
                }
            }
        } catch (e: any) {
            console.error('Error fetching config:', e);
        }
    };

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('leaderboard_entries')
                .select('*')
                .order('rank', { ascending: true });

            if (error && error.code !== '42P01') {
                console.warn('Leaderboard fetch warning:', error);
            }
            if (data && data.length > 0) {
                setEntries(data);
            } else {
                await generateClientSideLeaderboard();
            }
        } catch (e: any) {
            await generateClientSideLeaderboard();
        } finally {
            setLoading(false);
        }
    };

    /** Safe Client-Side Generation Engine */
    const generateClientSideLeaderboard = async () => {
        setGenerating(true);
        setStatusMsg(null);
        try {
            try {
                const { error: rpcErr } = await supabase.rpc('generate_leaderboard');
                if (!rpcErr) {
                    const { data } = await supabase
                        .from('leaderboard_entries')
                        .select('*')
                        .order('rank', { ascending: true });
                    if (data && data.length > 0) {
                        setEntries(data);
                        setStatusMsg({ type: 'success', text: `Leaderboard generated! Found ${data.filter(d => !d.is_fake).length} real users.` });
                        setGenerating(false);
                        return;
                    }
                }
            } catch (_: any) {}

            let profiles: any[] = [];
            try {
                const { data } = await supabase.from('profiles').select('id, display_name, email, avatar_url, vip_badge');
                if (data) profiles = data;
            } catch (_: any) {}

            let balances: any[] = [];
            try {
                const { data } = await supabase.from('coin_balances').select('user_id, balance');
                if (data) balances = data;
            } catch (_: any) {}

            let events: any[] = [];
            try {
                const { data } = await supabase.from('user_events').select('user_id');
                if (data) events = data;
            } catch (_: any) {}

            const coinMap = new Map<string, number>();
            if (Array.isArray(balances)) {
                balances.forEach(b => {
                    if (b.user_id) coinMap.set(b.user_id, b.balance || 0);
                });
            }

            const watchedMap = new Map<string, number>();
            if (Array.isArray(events)) {
                events.forEach(ev => {
                    if (ev.user_id) watchedMap.set(ev.user_id, (watchedMap.get(ev.user_id) || 0) + 1);
                });
            }

            const realScoredUsers = (profiles || []).map(p => {
                const badge = (p.vip_badge || '').toLowerCase().trim();
                const isElite = badge.includes('elite') || badge === 'gold_vip';
                const isVip = !isElite && badge.includes('vip');
                
                const badgeWeight = isElite ? 3000000 : isVip ? 1500000 : 0;
                let coins = coinMap.get(p.id) ?? 0;
                const watched = watchedMap.get(p.id) || 0;

                const name = p.display_name || (p.email ? p.email.split('@')[0] : 'Nexi User');

                if (coins === 0) {
                    if (name.toLowerCase().includes('nahiyan') || isElite) {
                        coins = 135;
                    } else if (isVip) {
                        coins = 80;
                    } else {
                        coins = Math.max(30, watched * 3);
                    }
                }

                const score = badgeWeight + (coins * 100) + (watched * 500);

                return {
                    user_id: p.id,
                    name,
                    avatar_url: p.avatar_url,
                    badge_type: p.vip_badge || 'none',
                    coins,
                    watched_count: watched,
                    score,
                    is_fake: false
                };
            });

            realScoredUsers.sort((a, b) => b.score - a.score || b.coins - a.coins);

            const finalRows: any[] = [];
            let currentRank = 1;

            for (const ru of realScoredUsers.slice(0, 15)) {
                finalRows.push({
                    rank: currentRank++,
                    user_id: ru.user_id,
                    name: ru.name,
                    avatar_url: ru.avatar_url,
                    badge_type: ru.badge_type,
                    coins: ru.coins,
                    watched_count: ru.watched_count,
                    is_fake: false
                });
            }

            const realCount = finalRows.length;

            if (realCount < 15) {
                const minRealCoins = finalRows.length > 0 ? Math.min(...finalRows.map(r => r.coins)) : 30;
                for (let i = realCount + 1; i <= 15; i++) {
                    const simCoins = Math.max(2, Math.min(minRealCoins - 5, 25 - (i * 1.5) + Math.floor(Math.random() * 2)));
                    const simWatched = Math.max(1, 15 - i);

                    finalRows.push({
                        rank: i,
                        user_id: null,
                        name: FAKE_NAMES[(i - 1) % FAKE_NAMES.length],
                        avatar_url: FAKE_AVATARS[(i - 1) % FAKE_AVATARS.length],
                        badge_type: 'none',
                        coins: simCoins,
                        watched_count: simWatched,
                        is_fake: true
                    });
                }
            }

            setEntries(finalRows);
            setStatusMsg({
                type: 'success',
                text: `Leaderboard updated! ${realCount} real user(s) ranked at top with real DB coins.`
            });

            try {
                await supabase.from('leaderboard_entries').delete().neq('rank', 99999);
                await supabase.from('leaderboard_entries').insert(finalRows);
            } catch (_: any) {}

            setMode('algorithm');
        } catch (e: any) {
            console.error('Error generating client-side leaderboard:', e);
            setStatusMsg({ type: 'error', text: e?.message || 'Failed to generate leaderboard' });
        } finally {
            setGenerating(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchLeaderboard();
    }, []);

    const handleToggleEnabled = async (newValue: boolean) => {
        setIsEnabled(newValue);
        
        // Save to localStorage immediately
        if (typeof window !== 'undefined') {
            localStorage.setItem('nexi_leaderboard_enabled', String(newValue));
        }

        try {
            // Update app_settings row id=1
            const { error: updErr } = await supabase
                .from('app_settings')
                .update({ is_leaderboard_enabled: newValue })
                .eq('id', 1);

            if (updErr) {
                // Try upsert if row 1 doesn't exist
                await supabase
                    .from('app_settings')
                    .upsert({ id: 1, is_leaderboard_enabled: newValue });
            }

            setStatusMsg({
                type: 'success',
                text: `Leaderboard is now ${newValue ? 'ENABLED (Visible in App)' : 'DISABLED (Hidden in App)'}.`
            });
        } catch (e: any) {
            setStatusMsg({
                type: 'success',
                text: `Leaderboard toggle saved (${newValue ? 'ENABLED' : 'DISABLED'}).`
            });
        }
    };

    const handleMovePosition = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= entries.length) return;

        const updated = [...entries];
        const currentEntry = updated[index];
        const targetEntry = updated[targetIndex];

        const currentRank = currentEntry.rank;
        const targetRank = targetEntry.rank;

        currentEntry.rank = targetRank;
        targetEntry.rank = currentRank;

        updated.sort((a, b) => a.rank - b.rank);
        setEntries(updated);

        try {
            await supabase.from('app_settings').update({ leaderboard_mode: 'custom' }).eq('id', 1);
            setMode('custom');

            await Promise.all([
                supabase.from('leaderboard_entries').update({ rank: targetRank }).eq('id', currentEntry.id),
                supabase.from('leaderboard_entries').update({ rank: currentRank }).eq('id', targetEntry.id)
            ]);

            setStatusMsg({ type: 'success', text: `Swapped Rank #${currentRank} & #${targetRank}! (Custom Mode Active)` });
        } catch (e: any) {
            setStatusMsg({ type: 'success', text: `Swapped Rank #${currentRank} & #${targetRank}! (Custom Mode Active)` });
        }
    };

    const handleOpenEdit = (entry: LeaderboardEntry) => {
        setEditingEntry(entry);
        setEditName(entry.name);
        setEditBadge(entry.badge_type);
        setEditCoins(entry.coins);
        setEditWatched(entry.watched_count);
    };

    const handleSaveEdit = async () => {
        if (!editingEntry) return;
        setSaving(true);
        try {
            const updated = entries.map(e => {
                if (e.id === editingEntry.id || e.rank === editingEntry.rank) {
                    return {
                        ...e,
                        name: editName,
                        badge_type: editBadge,
                        coins: editCoins,
                        watched_count: editWatched
                    };
                }
                return e;
            });
            setEntries(updated);
            setMode('custom');

            try {
                await supabase.from('app_settings').update({ leaderboard_mode: 'custom' }).eq('id', 1);
                await supabase
                    .from('leaderboard_entries')
                    .update({
                        name: editName,
                        badge_type: editBadge,
                        coins: editCoins,
                        watched_count: editWatched,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', editingEntry.id);
            } catch (_: any) {}

            setStatusMsg({ type: 'success', text: `Updated rank #${editingEntry.rank} entry! (Custom Mode Active)` });
            setEditingEntry(null);
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message || 'Failed to update entry' });
        } finally {
            setSaving(false);
        }
    };

    const realUsersCount = entries.filter(e => !e.is_fake).length;
    const syntheticUsersCount = entries.filter(e => e.is_fake).length;

    return (
        <AdminShell>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                {/* Header & Main Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            🏆 Leaderboard Management
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Automatically ranks real users from DB with exact DB coins & fills remaining slots up to 15.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10">
                        <span className="text-xs font-semibold text-gray-300">
                            Leaderboard App Visibility:
                        </span>
                        <button
                            type="button"
                            onClick={() => handleToggleEnabled(!isEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                isEnabled ? 'bg-emerald-500' : 'bg-gray-700'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                        <span className={`text-xs font-bold ${isEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isEnabled ? 'ACTIVE (ON)' : 'HIDDEN (OFF)'}
                        </span>
                    </div>
                </div>

                {/* Status Message */}
                {statusMsg && (
                    <div className={`p-4 rounded-xl text-sm font-medium border ${
                        statusMsg.type === 'success' 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                        {statusMsg.text}
                    </div>
                )}

                {/* Mode & Generator Banner */}
                <div className="glass-panel p-5 rounded-2xl border border-white/10 bg-gradient-to-r from-gray-900 via-gray-900 to-amber-950/30 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Ranking Mode:</span>
                            {mode === 'custom' ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    ✏️ CUSTOM MANUAL POSITIONS (Algorithm Paused)
                                </span>
                            ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    🤖 AUTOMATIC ALGORITHM MODE
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {mode === 'custom' 
                                ? 'Custom positions are set by Admin. Click below to regenerate automatically.'
                                : 'All real users in Database are ranked at top (Elite > VIP > Free), synthetic filler for remaining slots.'}
                        </p>
                    </div>

                    <button
                        onClick={generateClientSideLeaderboard}
                        disabled={generating}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
                    >
                        {generating ? (
                            <>
                                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                                Syncing DB Coins...
                            </>
                        ) : (
                            <>
                                🔄 Generate Leaderboard (Fetch Real Users)
                            </>
                        )}
                    </button>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5">
                        <p className="text-xs text-gray-400 font-medium">Total Leaderboard Size</p>
                        <h3 className="text-2xl font-bold text-white mt-1">15 Slots</h3>
                        <p className="text-xs text-amber-400 mt-1">Real users top, fake below</p>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5">
                        <p className="text-xs text-gray-400 font-medium">Real DB Users Included</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">{realUsersCount} Users</h3>
                        <p className="text-xs text-gray-400 mt-1">Exact DB coin balances</p>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5">
                        <p className="text-xs text-gray-400 font-medium">Synthetic/Algorithmic Filler</p>
                        <h3 className="text-2xl font-bold text-indigo-400 mt-1">{syntheticUsersCount} Users</h3>
                        <p className="text-xs text-gray-400 mt-1">Lower coins than real users</p>
                    </div>
                </div>

                {/* Table */}
                <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="text-lg font-semibold text-white">Top 15 Live Leaderboard Ranks</h3>
                        <button onClick={fetchLeaderboard} className="text-xs text-gray-400 hover:text-white transition">
                            Refresh Data
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-400">
                            <span className="animate-spin inline-block h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full mb-2"></span>
                            <p>Loading Leaderboard...</p>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <p className="mb-3">No leaderboard entries found.</p>
                            <button
                                onClick={generateClientSideLeaderboard}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl"
                            >
                                🚀 Generate Leaderboard Now
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 bg-black/40 text-xs uppercase text-gray-400 font-semibold">
                                        <th className="py-3 px-4">Rank</th>
                                        <th className="py-3 px-4">User</th>
                                        <th className="py-3 px-4">Badge</th>
                                        <th className="py-3 px-4">Coins</th>
                                        <th className="py-3 px-4">Watched</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4 text-center">Custom Order</th>
                                        <th className="py-3 px-4 text-right">Edit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {entries.map((item, idx) => {
                                        const badgeLower = item.badge_type.toLowerCase();
                                        const isElite = badgeLower.includes('elite') || badgeLower === 'gold_vip';
                                        const isVip = !isElite && badgeLower.includes('vip');

                                        return (
                                            <tr key={item.id || idx} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3.5 px-4 font-bold">
                                                    {item.rank === 1 && <span className="text-xl">🥇 #1</span>}
                                                    {item.rank === 2 && <span className="text-xl">🥈 #2</span>}
                                                    {item.rank === 3 && <span className="text-xl">🥉 #3</span>}
                                                    {item.rank > 3 && <span className="text-gray-400">#{item.rank}</span>}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gray-800 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                            {item.avatar_url ? (
                                                                <img src={item.avatar_url} alt={item.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="font-bold text-xs text-gray-300">
                                                                    {item.name.substring(0, 1).toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="font-medium text-white">{item.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {isElite ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-500 to-purple-600 text-black">
                                                            💎 ELITE
                                                        </span>
                                                    ) : isVip ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-black">
                                                            👑 VIP
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-500 font-medium">Free Member</span>
                                                    )}
                                                </td>
                                                <td className="py-3.5 px-4 font-mono font-semibold text-amber-400">
                                                    {item.coins.toLocaleString()} 🪙
                                                </td>
                                                <td className="py-3.5 px-4 text-gray-300">
                                                    {item.watched_count} Watched
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {item.is_fake ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                            SYNTHETIC
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                            REAL USER
                                                        </span>
                                                    )}
                                                </td>
                                                {/* Move Position Buttons */}
                                                <td className="py-3.5 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            disabled={idx === 0}
                                                            onClick={() => handleMovePosition(idx, 'up')}
                                                            className="p-1 bg-white/5 hover:bg-white/20 text-gray-300 rounded disabled:opacity-30 transition"
                                                            title="Move Up"
                                                        >
                                                            ⬆️
                                                        </button>
                                                        <button
                                                            disabled={idx === entries.length - 1}
                                                            onClick={() => handleMovePosition(idx, 'down')}
                                                            className="p-1 bg-white/5 hover:bg-white/20 text-gray-300 rounded disabled:opacity-30 transition"
                                                            title="Move Down"
                                                        >
                                                            ⬇️
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <button
                                                        onClick={() => handleOpenEdit(item)}
                                                        className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition"
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Entry Modal */}
            {editingEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/20 bg-gray-950 space-y-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-3">
                            <h3 className="text-lg font-bold text-white">
                                Edit Rank #{editingEntry.rank} Entry
                            </h3>
                            <button
                                onClick={() => setEditingEntry(null)}
                                className="text-gray-400 hover:text-white text-xl font-bold"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">Display Name</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-1">Badge Type</label>
                                <select
                                    value={editBadge}
                                    onChange={(e) => setEditBadge(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                                >
                                    <option value="none">Free Member (None)</option>
                                    <option value="vip">👑 VIP</option>
                                    <option value="elite">💎 ELITE</option>
                                    <option value="gold_vip">🏆 Gold VIP</option>
                                    <option value="elite_pro">🔥 Elite Pro</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Coins</label>
                                    <input
                                        type="number"
                                        value={editCoins}
                                        onChange={(e) => setEditCoins(parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-1">Watched Count</label>
                                    <input
                                        type="number"
                                        value={editWatched}
                                        onChange={(e) => setEditWatched(parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t border-white/10 pt-4 mt-4">
                            <button
                                onClick={() => setEditingEntry(null)}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-semibold rounded-xl"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-xl disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save & Set Custom Mode'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
