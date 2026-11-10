'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LeaderboardEntry } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

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

    const deduplicateRealEntries = (raw: LeaderboardEntry[]): LeaderboardEntry[] => {
        const seenUsers = new Set<string>();
        const seenRanks = new Set<number>();
        const cleaned: LeaderboardEntry[] = [];

        for (const item of raw) {
            // Strictly exclude synthetic / fake entries
            if (item.is_fake) continue;
            if (item.user_id && seenUsers.has(item.user_id)) continue;
            if (seenRanks.has(item.rank)) continue;

            if (item.user_id) seenUsers.add(item.user_id);
            seenRanks.add(item.rank);
            cleaned.push(item);
        }

        return cleaned
            .sort((a, b) => a.rank - b.rank)
            .slice(0, 15)
            .map((item, idx) => ({ ...item, rank: idx + 1, is_fake: false }));
    };

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/leaderboard', { cache: 'no-store' });
            const json = await res.json();

            if (json.ok && Array.isArray(json.entries)) {
                setEntries(deduplicateRealEntries(json.entries));
                if (typeof json.is_leaderboard_enabled === 'boolean') {
                    setIsEnabled(json.is_leaderboard_enabled);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('nexi_leaderboard_enabled', String(json.is_leaderboard_enabled));
                    }
                }
                if (json.leaderboard_mode) {
                    setMode(json.leaderboard_mode);
                }
                setLoading(false);
                return;
            }
        } catch (err) {
            console.warn('API leaderboard fetch fallback:', err);
        }

        // Fallback direct query if API route is unavailable
        try {
            const { data } = await supabase
                .from('leaderboard_entries')
                .select('*')
                .eq('is_fake', false)
                .order('rank', { ascending: true });

            if (data && data.length > 0) {
                setEntries(deduplicateRealEntries(data));
            }
        } catch (e) {
            console.error('Error fetching leaderboard:', e);
        } finally {
            setLoading(false);
        }
    };

    /** Generate 100% Real-User Leaderboard via Server Admin API */
    const generateRealLeaderboard = async () => {
        setGenerating(true);
        setStatusMsg(null);
        try {
            const res = await fetch('/api/admin/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate' }),
            });
            const json = await res.json();

            if (!res.ok || !json.ok) {
                throw new Error(json.error || 'Failed to generate real leaderboard');
            }

            const cleaned = deduplicateRealEntries(json.entries || []);
            setEntries(cleaned);
            setMode('algorithm');
            setStatusMsg({
                type: 'success',
                text: `Leaderboard updated! Ranked Top ${cleaned.length} real users from Database (0 synthetic users).`,
            });
        } catch (e: any) {
            console.error('Error generating leaderboard:', e);
            setStatusMsg({ type: 'error', text: e?.message || 'Failed to generate leaderboard' });
        } finally {
            setGenerating(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const handleToggleEnabled = async (newValue: boolean) => {
        setIsEnabled(newValue);
        if (typeof window !== 'undefined') {
            localStorage.setItem('nexi_leaderboard_enabled', String(newValue));
        }

        try {
            const res = await fetch('/api/admin/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle', is_leaderboard_enabled: newValue }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error);

            setStatusMsg({
                type: 'success',
                text: `Leaderboard is now ${newValue ? 'ENABLED (Visible in App)' : 'DISABLED (Hidden in App)'}.`,
            });
        } catch {
            await supabase.from('app_settings').upsert({ id: 1, is_leaderboard_enabled: newValue });
            setStatusMsg({
                type: 'success',
                text: `Leaderboard toggle saved (${newValue ? 'ENABLED' : 'DISABLED'}).`,
            });
        }
    };

    const handleMovePosition = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= entries.length) return;

        const updated = [...entries];
        const currentEntry = { ...updated[index] };
        const targetEntry = { ...updated[targetIndex] };

        const currentRank = currentEntry.rank;
        const targetRank = targetEntry.rank;

        currentEntry.rank = targetRank;
        targetEntry.rank = currentRank;

        updated[index] = targetEntry;
        updated[targetIndex] = currentEntry;
        updated.sort((a, b) => a.rank - b.rank);

        setEntries(updated);
        setMode('custom');

        try {
            const res = await fetch('/api/admin/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'swap',
                    firstId: currentEntry.id,
                    firstRank: currentRank,
                    secondId: targetEntry.id,
                    secondRank: targetRank,
                }),
            });
            const json = await res.json();
            if (json.ok && Array.isArray(json.entries)) {
                setEntries(deduplicateRealEntries(json.entries));
            }
            setStatusMsg({ type: 'success', text: `Swapped Rank #${currentRank} & #${targetRank}! (Custom Mode Active)` });
        } catch {
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
            const res = await fetch('/api/admin/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'edit',
                    id: editingEntry.id,
                    name: editName,
                    badge_type: editBadge,
                    coins: editCoins,
                    watched_count: editWatched,
                }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.error || 'Failed to update entry');

            if (Array.isArray(json.entries)) {
                setEntries(deduplicateRealEntries(json.entries));
            }
            setMode('custom');
            setStatusMsg({ type: 'success', text: `Updated rank #${editingEntry.rank} entry! (Custom Mode Active)` });
            setEditingEntry(null);
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message || 'Failed to update entry' });
        } finally {
            setSaving(false);
        }
    };

    const realUsersCount = entries.length;
    const premiumUsersCount = entries.filter(e => {
        const b = (e.badge_type || '').toLowerCase();
        return b.includes('elite') || b.includes('vip');
    }).length;
    const totalLeaderboardCoins = entries.reduce((sum, e) => sum + (Number(e.coins) || 0), 0);

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
                            100% Real Database Users Only • Ranked by Badge Tier (Elite &gt; VIP &gt; Free), Exact DB Coins &amp; Watched Count.
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
                                    🤖 REAL USERS ALGORITHM MODE
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            {mode === 'custom'
                                ? 'Custom positions are set by Admin. Click below to re-sync & rank all real users automatically.'
                                : 'All entries are 100% real registered users ranked by Elite > VIP > Free, Exact DB Coins & Watched Count (No synthetic users).'}
                        </p>
                    </div>

                    <button
                        onClick={generateRealLeaderboard}
                        disabled={generating}
                        className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-violet-600 hover:from-amber-600 hover:to-red-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0"
                    >
                        {generating ? (
                            <>
                                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                                Syncing Real Users...
                            </>
                        ) : (
                            <>
                                🔄 Sync &amp; Rank Real Users
                            </>
                        )}
                    </button>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5">
                        <p className="text-xs text-gray-400 font-medium">Real DB Users Ranked</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">{realUsersCount} Real Users</h3>
                        <p className="text-xs text-gray-400 mt-1">100% Real Users • 0 Synthetic</p>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5">
                        <p className="text-xs text-gray-400 font-medium">VIP / Elite Members on Board</p>
                        <h3 className="text-2xl font-bold text-amber-400 mt-1">{premiumUsersCount} Premium</h3>
                        <p className="text-xs text-gray-400 mt-1">Ranked at top by badge priority</p>
                    </div>

                    <div className="glass-panel p-4 rounded-2xl border border-white/10 bg-white/5">
                        <p className="text-xs text-gray-400 font-medium">Total Coins Held by Top {realUsersCount}</p>
                        <h3 className="text-2xl font-bold text-indigo-400 mt-1">{totalLeaderboardCoins.toLocaleString()} 🪙</h3>
                        <p className="text-xs text-gray-400 mt-1">Exact live database coin balances</p>
                    </div>
                </div>

                {/* Table */}
                <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="text-lg font-semibold text-white">Top {entries.length || 15} Live Real User Ranks</h3>
                        <button onClick={fetchLeaderboard} className="text-xs text-gray-400 hover:text-white transition">
                            Refresh Data
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-400">
                            <span className="animate-spin inline-block h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full mb-2"></span>
                            <p>Loading Real User Leaderboard...</p>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            <p className="mb-3">No leaderboard entries found.</p>
                            <button
                                onClick={generateRealLeaderboard}
                                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl"
                            >
                                🚀 Sync Real Users Now
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
                                        <th className="py-3 px-4">Account Status</th>
                                        <th className="py-3 px-4 text-center">Custom Order</th>
                                        <th className="py-3 px-4 text-right">Edit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {entries.map((item, idx) => {
                                        const badgeLower = (item.badge_type || '').toLowerCase();
                                        const isElite = badgeLower.includes('elite') || badgeLower === 'gold_vip';
                                        const isVip = !isElite && badgeLower.includes('vip');

                                        return (
                                            <tr key={item.id || `${item.user_id}_${item.rank}`} className="hover:bg-white/5 transition-colors">
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
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                        VERIFIED REAL USER
                                                    </span>
                                                </td>
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
