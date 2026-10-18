'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';

type ContentType = 'movie' | 'series' | 'anime';
type FilterMode = 'new_only' | 'all' | 'in_db';

type TmdbItem = {
    id: number;
    media: 'movie' | 'tv';
    title: string;
    originalTitle: string;
    overview: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    releaseYear: string | null;
    language: string | null;
    rating: number | null;
    adult: boolean;
    inDatabase?: boolean;
    existingId?: string | null;
    existingSlug?: string | null;
    existingType?: string | null;
};

type CatalogStats = {
    database: {
        totalTitles: number;
        tmdbMapped: number;
        movies: number;
        series: number;
        anime: number;
        storageImpact: string;
    };
    tmdb: {
        configured: boolean;
        online: boolean;
        availableUniverse: string;
        trendingToday: number;
        sampleTrending: Array<{
            id: number;
            title: string;
            media_type?: string;
            poster_path?: string | null;
            vote_average?: number;
            inDatabase?: boolean;
            existingSlug?: string | null;
            existingType?: string | null;
        }>;
    };
    architecture: {
        mode: string;
        dbPressure: string;
        caching: string;
        recommendation: string;
    };
};

type KeyConfig = {
    configured: boolean;
    maskedKey: string;
    apiKey?: string;
    nonCommercialConfirmed: boolean;
};

const itemKey = (item: TmdbItem) => `${item.media}-${item.id}`;

export default function TmdbCatalogPage() {
    const [stats, setStats] = useState<CatalogStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [keyConfig, setKeyConfig] = useState<KeyConfig | null>(null);

    // Conflict prevention & deduplication filter mode
    const [filterMode, setFilterMode] = useState<FilterMode>('new_only');

    const [query, setQuery] = useState('');
    const [media, setMedia] = useState<'movie' | 'tv'>('movie');
    const [results, setResults] = useState<TmdbItem[]>([]);
    const [contentTypes, setContentTypes] = useState<Record<string, ContentType>>({});
    const [importedIds, setImportedIds] = useState<Record<string, string>>({});
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searching, setSearching] = useState(false);
    const [importingId, setImportingId] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // API Key setup state
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [inputApiKey, setInputApiKey] = useState('');
    const [savingKey, setSavingKey] = useState(false);

    // Fetch stats and key configuration on mount
    async function loadStats() {
        try {
            setStatsLoading(true);
            const res = await fetch('/api/admin/tmdb/stats', { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error('Failed to load catalog stats:', e);
        } finally {
            setStatsLoading(false);
        }
    }

    async function loadKeyConfig() {
        try {
            const res = await fetch('/api/admin/tmdb/config', { cache: 'no-store' });
            if (res.ok) {
                const data: KeyConfig = await res.json();
                setKeyConfig(data);
                if (data.apiKey) {
                    setInputApiKey(data.apiKey);
                }
            }
        } catch (e) {
            console.error('Failed to load TMDB key config:', e);
        }
    }

    useEffect(() => {
        loadStats();
        loadKeyConfig();
    }, []);

    async function search(event?: FormEvent, requestedPage = 1) {
        event?.preventDefault();
        const term = query.trim();
        if (term.length < 2) {
            setError('Enter at least two characters to search.');
            return;
        }
        setSearching(true);
        setError('');
        setNotice('');
        try {
            const params = new URLSearchParams({ query: term, media, page: String(requestedPage) });
            const response = await fetch(`/api/admin/tmdb/search?${params.toString()}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'TMDB search failed.');
            setResults(payload.results || []);
            setPage(payload.page || requestedPage);
            setTotalPages(payload.totalPages || 1);
            setContentTypes(current => {
                const next = { ...current };
                for (const item of payload.results as TmdbItem[]) {
                    if (!next[itemKey(item)]) next[itemKey(item)] = item.media === 'movie' ? 'movie' : 'series';
                }
                return next;
            });
        } catch (requestError) {
            setResults([]);
            setError(requestError instanceof Error ? requestError.message : 'TMDB search failed. Please try again.');
        } finally {
            setSearching(false);
        }
    }

    async function importTitle(item: TmdbItem) {
        setImportingId(itemKey(item));
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/admin/tmdb/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tmdbId: item.id,
                    media: item.media,
                    contentType: contentTypes[itemKey(item)] || (item.media === 'movie' ? 'movie' : 'series'),
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Could not import this title.');
            setImportedIds(current => ({ ...current, [itemKey(item)]: payload.action }));
            setNotice(`${payload.action === 'updated' ? 'Updated' : 'Added'} “${payload.title}” in the NexiPlay catalog.`);
            loadStats();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Could not import this title. Please try again.');
        } finally {
            setImportingId(null);
        }
    }

    async function handleSaveKey(e: FormEvent) {
        e.preventDefault();
        const trimmed = inputApiKey.trim();
        if (!trimmed) return;
        setSavingKey(true);
        setError('');
        try {
            const res = await fetch('/api/admin/tmdb/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save key');
            
            // Update local state immediately
            setKeyConfig({
                configured: true,
                maskedKey: `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`,
                apiKey: trimmed,
                nonCommercialConfirmed: true,
            });
            setNotice(data.message || 'TMDB API key verified and saved successfully!');
            setShowKeyModal(false);
            
            // Reload stats and trending titles
            loadStats();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save TMDB key.');
        } finally {
            setSavingKey(false);
        }
    }

    // Filter items based on active deduplication mode
    const displayedTrending = (stats?.tmdb.sampleTrending || []).filter(item => {
        if (filterMode === 'new_only') return !item.inDatabase;
        if (filterMode === 'in_db') return item.inDatabase;
        return true;
    });

    const displayedResults = results.filter(item => {
        if (filterMode === 'new_only') return !item.inDatabase;
        if (filterMode === 'in_db') return item.inDatabase;
        return true;
    });

    const hiddenSearchCount = results.filter(item => item.inDatabase).length;

    return (
        <div className="mx-auto max-w-7xl space-y-8 pb-16">
            {/* Header */}
            <header className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300">Catalog Engine & Sync Hub</p>
                </div>
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">TMDB Catalog & Sync</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                            Monitor catalog stats, resolve millions of titles on-demand, and manage custom stream overrides with zero database pressure.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* API Key Status Pill */}
                        <button
                            onClick={() => {
                                if (keyConfig?.apiKey) setInputApiKey(keyConfig.apiKey);
                                setShowKeyModal(true);
                            }}
                            className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition flex items-center gap-2 ${
                                keyConfig?.configured
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            }`}
                        >
                            <span>{keyConfig?.configured ? '🟢' : '⚠️'}</span>
                            <span>{keyConfig?.configured ? `TMDB Key: ${keyConfig.maskedKey}` : 'Configure TMDB API Key'}</span>
                        </button>

                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Zero DB Pressure Active
                        </span>
                    </div>
                </div>
            </header>

            {/* Catalog Analytics & Counters Cards */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Database Titles */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/10 rounded-full blur-2xl group-hover:bg-violet-500/20 transition" />
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Database Custom Titles</p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">
                            {statsLoading ? '...' : (stats?.database.totalTitles ?? 0)}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">titles in Supabase</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
                        <span>🎬 Movies: <strong className="text-white">{stats?.database.movies ?? 0}</strong></span>
                        <span>📺 Series: <strong className="text-white">{stats?.database.series ?? 0}</strong></span>
                        <span>⛩️ Anime: <strong className="text-white">{stats?.database.anime ?? 0}</strong></span>
                    </div>
                </div>

                {/* 2. TMDB Mapped Titles */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition" />
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">TMDB Mapped</p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-sky-300">
                            {statsLoading ? '...' : (stats?.database.tmdbMapped ?? 0)}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">with custom links</span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                        Titles with custom servers or overrides in local catalog.
                    </p>
                </div>

                {/* 3. Live TMDB On-Demand Universe */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition" />
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Live TMDB Universe</p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-400">1,000,000+</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-emerald-300/80">
                        <span>{stats?.tmdb.online ? '🟢 API Online' : 'On-Demand Ready'}</span>
                        <span className="bg-emerald-400/10 px-2 py-0.5 rounded text-[11px] font-bold">Infinite</span>
                    </div>
                </div>

                {/* 4. DB Pressure & Cloudflare Status */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition" />
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Database Pressure</p>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-400">0%</span>
                        <span className="text-xs font-semibold text-emerald-300">Protected</span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400 leading-relaxed">
                        Cloudflare Edge Caching keeps Supabase 500MB free quota completely safe.
                    </p>
                </div>
            </section>

            {/* Deduplication & Database Conflict Filter Bar */}
            <section className="rounded-2xl border border-white/10 bg-[#161224] p-4 sm:p-5 shadow-lg">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-base">🛡️</span>
                            <h3 className="text-sm font-bold text-white">Database Deduplication &amp; Conflict Filter</h3>
                        </div>
                        <p className="text-xs text-gray-400">
                            Prevents duplicate TMDB titles from masking your custom download links, Bangla dubs, or local servers.
                        </p>
                    </div>

                    {/* Filter Mode Selector Pills */}
                    <div className="flex flex-wrap items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                        <button
                            type="button"
                            onClick={() => setFilterMode('new_only')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                                filterMode === 'new_only'
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <span>⚡</span>
                            <span>Hide Titles Already in DB (Safe)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                                filterMode === 'all'
                                    ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <span>🌐</span>
                            <span>Show All (With DB Badges)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('in_db')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                                filterMode === 'in_db'
                                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <span>✓</span>
                            <span>Only Titles in DB</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Live TMDB Trending On-Demand Showcase */}
            {displayedTrending.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <h2 className="text-base font-bold text-white">Live TMDB Trending Right Now (On-Demand Preview)</h2>
                        </div>
                        <span className="text-xs text-gray-400">
                            {filterMode === 'new_only' ? 'Showing fresh titles only · DB duplicates filtered out' : 'Live from TMDB API'}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        {displayedTrending.map(item => (
                            <div key={item.id} className="group relative rounded-xl overflow-hidden border border-white/10 bg-[#161320] flex flex-col">
                                <div className="relative aspect-[2/3] w-full bg-black/40">
                                    {item.poster_path ? (
                                        <img src={item.poster_path} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500">No poster</div>
                                    )}
                                    <span className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-md text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        ★ {item.vote_average ? item.vote_average.toFixed(1) : '0'}
                                    </span>
                                    {item.inDatabase && (
                                        <span className="absolute bottom-1.5 left-1.5 right-1.5 bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded text-center backdrop-blur-sm">
                                            ✓ In Your DB
                                        </span>
                                    )}
                                </div>
                                <div className="p-2 flex-1 flex flex-col justify-between">
                                    <p className="text-[11px] font-bold text-white line-clamp-1 group-hover:text-violet-300">{item.title}</p>
                                    <span className="text-[10px] text-gray-500 uppercase font-semibold mt-1">
                                        {item.media_type || 'movie'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* TMDB API Key Modal / Form */}
            {showKeyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#171522] p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Configure TMDB API Key</h3>
                            <button onClick={() => setShowKeyModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        {/* Existing Key Status Banner */}
                        {keyConfig?.configured ? (
                            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                                    <span>✅</span>
                                    <span>Key is saved and verified</span>
                                </div>
                                <span className="font-mono text-emerald-400 bg-black/50 px-2.5 py-1 rounded border border-emerald-500/20 text-[11px]">
                                    {keyConfig.maskedKey}
                                </span>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 flex items-center gap-2 text-xs text-amber-300">
                                <span>⚠️</span>
                                <span>No TMDB key configured yet.</span>
                            </div>
                        )}

                        <p className="text-xs text-gray-400 leading-relaxed">
                            Enter your v3 API Key from <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline">themoviedb.org</a>. It is saved directly to your local <code className="text-gray-300 bg-white/5 px-1 py-0.5 rounded">.env.local</code> file for both Admin and Web.
                        </p>

                        <form onSubmit={handleSaveKey} className="space-y-4">
                            <input
                                type="text"
                                value={inputApiKey}
                                onChange={e => setInputApiKey(e.target.value)}
                                placeholder="Paste your 32-character TMDB API Key"
                                className="w-full font-mono rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                                required
                            />
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowKeyModal(false)}
                                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-white/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingKey}
                                    className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50 transition shadow-lg shadow-violet-900/40"
                                >
                                    {savingKey ? 'Verifying & Saving...' : 'Save API Key'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Search and Stage Workspace */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-xl sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">Search TMDB &amp; Create Custom Overrides</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Find any movie or TV series on TMDB to link custom stream URLs, add Bangla dubs, or pin to the homepage.</p>
                    </div>
                </div>

                <form onSubmit={event => search(event, 1)} className="space-y-4 pt-2">
                    <div className="flex flex-col gap-3 md:flex-row">
                        <div className="flex shrink-0 rounded-xl border border-white/10 bg-black/30 p-1" role="group" aria-label="TMDB media type">
                            {(['movie', 'tv'] as const).map(option => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => { setMedia(option); setResults([]); setError(''); setNotice(''); }}
                                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold capitalize transition ${media === option ? 'bg-violet-500 text-white shadow-lg shadow-violet-950/50' : 'text-gray-400 hover:text-white'}`}
                                    aria-pressed={media === option}
                                >
                                    {option === 'tv' ? 'TV / Series' : 'Movies'}
                                </button>
                            ))}
                        </div>
                        <input
                            id="tmdb-query"
                            value={query}
                            onChange={event => setQuery(event.target.value)}
                            placeholder="Search by title, e.g. Interstellar, Breaking Bad, Solo Leveling..."
                            maxLength={100}
                            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/10"
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            className="rounded-xl bg-violet-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60"
                        >
                            {searching ? 'Searching…' : 'Search TMDB'}
                        </button>
                    </div>
                </form>
            </section>

            {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
            {notice && <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

            {/* Results Grid */}
            {results.length > 0 && (
                <section className="space-y-4" aria-label="TMDB results">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                            <span>Showing {displayedResults.length} of {results.length} results</span>
                            {filterMode === 'new_only' && hiddenSearchCount > 0 && (
                                <span className="bg-emerald-500/10 text-emerald-300 text-xs px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                                    🛡️ {hiddenSearchCount} already in your DB (hidden to avoid duplicates)
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => search(undefined, page - 1)} disabled={page <= 1 || searching} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40 hover:bg-white/5">Previous</button>
                            <button onClick={() => search(undefined, page + 1)} disabled={page >= totalPages || searching} className="rounded-lg border border-white/10 px-3 py-2 disabled:opacity-40 hover:bg-white/5">Next</button>
                        </div>
                    </div>

                    {displayedResults.length === 0 && (
                        <div className="rounded-2xl border border-white/10 bg-[#161224] p-8 text-center space-y-2">
                            <p className="text-white font-bold">All {results.length} search results are already in your Supabase database!</p>
                            <p className="text-xs text-gray-400">Switch filter to "Show All" above if you wish to update or override existing titles.</p>
                        </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                        {displayedResults.map(item => {
                            const key = itemKey(item);
                            const saved = importedIds[key];
                            const selectedType = contentTypes[key] || (item.media === 'movie' ? 'movie' : 'series');
                            return (
                                <article key={`${item.media}-${item.id}`} className="flex min-h-52 overflow-hidden rounded-2xl border border-white/10 bg-[#15131c]">
                                    <div className="relative hidden w-32 shrink-0 bg-black/30 sm:block">
                                        {item.posterUrl ? <img src={item.posterUrl} alt={`${item.title} poster`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 grid place-items-center text-xs text-gray-500">No poster</div>}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h2 className="line-clamp-2 text-base font-bold text-white">{item.title} <span className="font-medium text-gray-400">{item.releaseYear ? `(${item.releaseYear})` : ''}</span></h2>
                                                </div>
                                                {item.originalTitle !== item.title && <p className="mt-1 truncate text-xs text-gray-500">{item.originalTitle}</p>}
                                                {item.inDatabase && (
                                                    <div className="mt-1.5 flex items-center gap-1.5">
                                                        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                                            ✓ In Your DB (Custom Streams Active)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {item.rating !== null && <span className="shrink-0 rounded-lg bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-200">★ {item.rating.toFixed(1)}</span>}
                                        </div>
                                        <p className="mt-3 line-clamp-3 text-xs leading-5 text-gray-400">{item.overview || 'No overview provided by TMDB.'}</p>
                                        <div className="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                            <label className="flex items-center gap-2 text-xs text-gray-400">
                                                Store as
                                                <select
                                                    value={selectedType}
                                                    onChange={event => setContentTypes(current => ({ ...current, [key]: event.target.value as ContentType }))}
                                                    className="rounded-lg border border-white/10 bg-[#211d2b] px-2 py-1.5 text-white outline-none focus:border-violet-400/60"
                                                >
                                                    {item.media === 'movie' ? <option value="movie">Movie</option> : <><option value="series">Series</option><option value="anime">Anime</option></>}
                                                </select>
                                            </label>
                                            <button
                                                onClick={() => importTitle(item)}
                                                disabled={importingId !== null}
                                                className={`rounded-lg px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
                                                    item.inDatabase
                                                        ? 'border border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'
                                                        : saved
                                                        ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15'
                                                        : 'bg-white text-[#15131c] hover:bg-violet-100'
                                                }`}
                                            >
                                                {importingId === key ? 'Saving…' : item.inDatabase ? 'Update DB Overrides' : saved === 'updated' ? 'Update again' : saved === 'created' ? 'Added · update' : 'Import / Add to DB'}
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-gray-500">No results yet. Try another title or media type.</div>
            )}

            {results.length === 0 && !searching && !error && (
                <div className="grid gap-4 md:grid-cols-3">
                    {[
                        ['01', 'Conflict-Free Discovery', 'Titles already present in your Supabase DB are automatically isolated to preserve your custom links and dubs.'],
                        ['02', 'Cloudflare Edge Caching', 'Catalog listings are served from Cloudflare cache with 0 DB queries, preventing Supabase free tier crashes.'],
                        ['03', 'Selective DB Overrides', 'Use the search above only when you want to add custom m3u8 streams, Bangla dubs, or pin to the homepage.'],
                    ].map(([number, title, body]) => (
                        <div key={number} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                            <span className="text-xs font-black tracking-widest text-violet-300">{number}</span>
                            <h2 className="mt-3 font-bold text-white">{title}</h2>
                            <p className="mt-2 text-sm leading-6 text-gray-500">{body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
