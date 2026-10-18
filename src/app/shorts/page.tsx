'use client';

import { useState, useEffect } from 'react';
import AdminShell from '@/components/AdminShell';

interface CustomShort {
    id: string;
    youtube_id: string;
    title: string;
    channel_name: string;
    kind: 'short' | 'trailer';
    thumbnail: string;
    movie_slug?: string;
    movie_title?: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminShortsPage() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalActive: 32, upstreamCount: 20, customCount: 0 });
    const [customShorts, setCustomShorts] = useState<CustomShort[]>([]);
    
    // Add form state
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [channelName, setChannelName] = useState('Nexiplay Highlights');
    const [kind, setKind] = useState<'short' | 'trailer'>('short');
    const [movieSlug, setMovieSlug] = useState('');
    const [saving, setSaving] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/shorts');
            if (res.ok) {
                const data = await res.json();
                setCustomShorts(data.customShorts || []);
                setStats({
                    totalActive: data.totalActive || 32,
                    upstreamCount: data.upstreamCount || 20,
                    customCount: (data.customShorts || []).length,
                });
            }
        } catch { /* ignore */ }
        finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Extract ID for preview
    const extractId = (input: string) => {
        if (!input) return null;
        const clean = input.trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
        const match = clean.match(/(?:shorts\/|v=|youtu\.be\/|\/embed\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    };

    const previewId = extractId(url);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || !title) return;

        setSaving(true);
        setStatusMsg(null);
        try {
            const res = await fetch('/api/admin/shorts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    title,
                    channel_name: channelName,
                    kind,
                    movie_slug: movieSlug,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add short');

            setStatusMsg({ type: 'success', text: 'Short added successfully! It is now live on Nexiplay Shorts feed.' });
            setUrl('');
            setTitle('');
            setMovieSlug('');
            loadData();
        } catch (err: any) {
            setStatusMsg({ type: 'error', text: err.message || 'Error adding short' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this short?')) return;
        try {
            const res = await fetch(`/api/admin/shorts?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setCustomShorts(prev => prev.filter(item => item.id !== id));
                setStatusMsg({ type: 'success', text: 'Short removed.' });
            }
        } catch (err: any) {
            setStatusMsg({ type: 'error', text: err.message || 'Error deleting short' });
        }
    };

    return (
        <AdminShell>
            <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">⚡</span>
                            <h1 className="text-3xl font-black text-white">Shorts Feed Manager</h1>
                        </div>
                        <p className="text-sm text-gray-400">
                            Manage viral mini-dramas, trailer clips, and vertical reels on Nexiplay
                        </p>
                    </div>

                    <a
                        href="http://localhost:3001/shorts"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition active:scale-95 self-start md:self-auto"
                    >
                        <span>👀 View Live Shorts Feed</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>

                {/* Status Message */}
                {statusMsg && (
                    <div className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
                        statusMsg.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}>
                        <span>{statusMsg.text}</span>
                        <button onClick={() => setStatusMsg(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
                    </div>
                )}

                {/* Counters Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-dark-800/80 border border-white/10 rounded-2xl p-5 shadow-lg">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Active in Feed</span>
                        <p className="text-3xl font-black text-white mt-2">{stats.totalActive}+</p>
                        <p className="text-xs text-emerald-400 mt-1">✓ Instant zero-buffer vertical reels</p>
                    </div>
                    <div className="bg-dark-800/80 border border-white/10 rounded-2xl p-5 shadow-lg">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Viral Mini-Dramas (Live)</span>
                        <p className="text-3xl font-black text-violet-400 mt-2">{stats.upstreamCount + 12}</p>
                        <p className="text-xs text-gray-400 mt-1">ReelShort, DramaBox, FlexTV</p>
                    </div>
                    <div className="bg-dark-800/80 border border-white/10 rounded-2xl p-5 shadow-lg">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Custom Pinned by Admin</span>
                        <p className="text-3xl font-black text-amber-400 mt-2">{stats.customCount}</p>
                        <p className="text-xs text-gray-400 mt-1">Added via Admin Panel</p>
                    </div>
                </div>

                {/* Add New Short Card */}
                <div className="bg-dark-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span>➕</span>
                        <span>Add New YouTube Short / Trailer</span>
                    </h2>

                    <form onSubmit={handleAdd} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                                    YouTube Short URL or Video ID *
                                </label>
                                <input
                                    type="text"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="e.g. https://www.youtube.com/shorts/Fu1Bzz_evRk"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                                    required
                                />
                                <p className="text-[11px] text-gray-400 mt-1">Supports any YouTube Short or standard YouTube video link.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                                    Short Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. The CEO's Secret Identity Revealed #viral"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                                    Channel / Creator Name
                                </label>
                                <input
                                    type="text"
                                    value={channelName}
                                    onChange={e => setChannelName(e.target.value)}
                                    placeholder="e.g. FlexTV or ReelShort"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                                    Category / Type
                                </label>
                                <select
                                    value={kind}
                                    onChange={e => setKind(e.target.value as any)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition"
                                >
                                    <option value="short">🎭 Viral Mini-Drama / Reel</option>
                                    <option value="trailer">🎬 Official Movie/Anime Trailer</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                                    Linked Movie Slug (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={movieSlug}
                                    onChange={e => setMovieSlug(e.target.value)}
                                    placeholder="e.g. spider-man-brand-new-day-movie-2026"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">Shows a "Watch Full Movie" button linking directly to this slug.</p>
                            </div>
                        </div>

                        {/* Live Thumbnail Preview */}
                        {previewId && (
                            <div className="flex items-center gap-4 p-3 bg-black/30 border border-white/10 rounded-xl">
                                <img
                                    src={`https://i.ytimg.com/vi/${previewId}/hqdefault.jpg`}
                                    alt="Preview"
                                    className="w-20 h-28 object-cover rounded-lg border border-white/20 shadow"
                                />
                                <div>
                                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                                        ✓ Valid YouTube ID: {previewId}
                                    </span>
                                    <p className="text-sm font-bold text-white mt-1">{title || 'Your short title will appear here'}</p>
                                    <p className="text-xs text-gray-400">{channelName} • {kind === 'trailer' ? 'Movie Trailer' : 'Mini-Drama'}</p>
                                </div>
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={saving || !url || !title}
                                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg transition active:scale-95"
                            >
                                {saving ? 'Adding to Feed…' : '✓ Publish Short to Feed'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Custom Shorts List */}
                <div className="bg-dark-800/80 border border-white/10 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-bold text-white mb-4">Custom Added Shorts ({customShorts.length})</h2>

                    {loading ? (
                        <div className="py-12 text-center text-gray-400 text-sm">Loading shorts…</div>
                    ) : customShorts.length === 0 ? (
                        <div className="py-12 text-center text-gray-400 text-sm bg-black/20 rounded-xl border border-white/5">
                            <span className="text-3xl block mb-2">🎬</span>
                            <p className="font-semibold text-white">No custom shorts added yet</p>
                            <p className="text-xs text-gray-500 mt-1">The public feed is currently serving viral short dramas from ReelShort, FlexTV, and DramaBox automatically.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {customShorts.map(item => (
                                <div key={item.id} className="p-3 bg-black/40 border border-white/10 rounded-xl flex gap-3 group relative">
                                    <img
                                        src={`https://i.ytimg.com/vi/${item.youtube_id}/hqdefault.jpg`}
                                        alt={item.title}
                                        className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0 pr-6">
                                        <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded font-bold uppercase">
                                            {item.kind}
                                        </span>
                                        <h4 className="text-xs font-bold text-white mt-1 line-clamp-2">{item.title}</h4>
                                        <p className="text-[11px] text-gray-400 mt-1 truncate">{item.channel_name}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="absolute top-2 right-2 text-gray-500 hover:text-rose-400 p-1 transition"
                                        title="Delete short"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AdminShell>
    );
}
