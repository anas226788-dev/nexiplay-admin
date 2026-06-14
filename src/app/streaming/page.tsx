'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Movie } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

interface MatchResult {
    id: string; // TMDB ID or MAL ID
    title: string;
    year: string;
    type: 'movie' | 'series' | 'anime';
    posterUrl: string | null;
    originalData: any;
}

export default function StreamingPage() {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'series' | 'anime'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'missing'>('all');
    
    // TMDB Settings in LocalStorage
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    
    // Auto Match Modal State
    const [matchingMovie, setMatchingMovie] = useState<Movie | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
    const [searchSource, setSearchSource] = useState<'tmdb' | 'jikan'>('tmdb');

    // Bulk Auto Match State
    const [isBulkMatching, setIsBulkMatching] = useState(false);
    const [bulkMatchProgress, setBulkMatchProgress] = useState({ current: 0, total: 0 });

    // Manage Episodes Modal State
    const [editingEpisodesMovie, setEditingEpisodesMovie] = useState<Movie | null>(null);
    const [seasons, setSeasons] = useState<any[]>([]);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
    const [localEpisodeUrls, setLocalEpisodeUrls] = useState<Record<string, string>>({});
    const [savingEpisodes, setSavingEpisodes] = useState(false);

    // Message notification toast
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchMovies();
        // Load TMDB API key from local storage on client side
        const savedKey = localStorage.getItem('nexiplay_tmdb_api_key') || '';
        setTmdbApiKey(savedKey);
    }, []);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    const fetchMovies = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('movies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setMovies(data);
        } catch (e: any) {
            showMessage('error', 'Failed to fetch content: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = (key: string) => {
        setTmdbApiKey(key);
        localStorage.setItem('nexiplay_tmdb_api_key', key.trim());
        showMessage('success', 'TMDB API Key saved successfully!');
    };

    // Update single movie record
    const handleUpdateMovie = async (movieId: string, updates: Partial<Movie>) => {
        setSavingId(movieId);
        try {
            const { error } = await supabase
                .from('movies')
                .update({
                    tmdb_id: updates.tmdb_id || null,
                    imdb_id: updates.imdb_id || null,
                    mal_id: updates.mal_id || null,
                    streaming_url: updates.streaming_url || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', movieId);

            if (error) throw error;

            setMovies(prev => prev.map(m => m.id === movieId ? { ...m, ...updates } : m));
            showMessage('success', 'Streaming IDs updated successfully!');
        } catch (e: any) {
            showMessage('error', 'Update failed: ' + e.message);
        } finally {
            setSavingId(null);
        }
    };

    // Inline field edit changes state locally before save
    const handleFieldChange = (movieId: string, field: keyof Movie, value: string) => {
        setMovies(prev => prev.map(m => m.id === movieId ? { ...m, [field]: value } : m));
    };

    // Start auto config lookup
    const handleOpenMatchModal = (movie: Movie) => {
        setMatchingMovie(movie);
        setSearchQuery(movie.title);
        setSearchResults([]);
        // Default search source is always TMDB since setting TMDB ID is most crucial for the player
        setSearchSource('tmdb');
    };

    // Execute lookup
    const handleSearchSource = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);

        try {
            if (searchSource === 'jikan') {
                // Fetch from server proxy for Jikan
                const url = `/api/streaming/search?source=jikan&query=${encodeURIComponent(searchQuery)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Jikan API request failed');
                const result = await res.json();
                
                const mapped: MatchResult[] = (result.data || []).map((item: any) => ({
                    id: String(item.mal_id),
                    title: item.title,
                    year: item.aired?.prop?.from?.year ? String(item.aired.prop.from.year) : 'N/A',
                    type: 'anime',
                    posterUrl: item.images?.jpg?.image_url || null,
                    originalData: item
                }));
                setSearchResults(mapped);
            } else {
                // Fetch from server proxy for TMDB
                if (!tmdbApiKey) {
                    throw new Error('Please save your TMDB API Key first to search TMDB.');
                }
                
                // For movies/series/anime, determine correct search endpoint
                const searchType = matchingMovie?.type === 'movie' ? 'movie' : 'tv';
                const url = `/api/streaming/search?source=tmdb&type=${searchType}&apiKey=${encodeURIComponent(tmdbApiKey)}&query=${encodeURIComponent(searchQuery)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('TMDB API request failed. Check your API key.');
                const result = await res.json();

                const mapped: MatchResult[] = (result.results || []).map((item: any) => ({
                    id: String(item.id),
                    title: item.title || item.name,
                    year: (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A',
                    type: matchingMovie?.type || 'movie',
                    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : null,
                    originalData: item
                }));
                setSearchResults(mapped);
            }
        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setSearching(false);
        }
    };

    // Apply matched IDs to content
    const handleApplyMatch = async (match: MatchResult) => {
        if (!matchingMovie) return;
        
        let tmdbVal = matchingMovie.tmdb_id || '';
        let malVal = matchingMovie.mal_id || '';
        let imdbVal = matchingMovie.imdb_id || '';

        if (searchSource === 'jikan') {
            malVal = match.id;
        } else {
            tmdbVal = match.id;
            // Fetch TMDB external IDs via server proxy
            if (tmdbApiKey) {
                try {
                    const detailType = matchingMovie.type === 'movie' ? 'movie' : 'tv';
                    const url = `/api/streaming/search?mode=detail&type=${detailType}&id=${match.id}&apiKey=${encodeURIComponent(tmdbApiKey)}`;
                    const detailRes = await fetch(url);
                    if (detailRes.ok) {
                        const ids = await detailRes.json();
                        if (ids.imdb_id) {
                            imdbVal = ids.imdb_id;
                        }
                    }
                } catch (err) {
                    console.warn('Failed to fetch external IDs from TMDB:', err);
                }
            }
        }

        const updates = {
            tmdb_id: tmdbVal,
            mal_id: malVal,
            imdb_id: imdbVal
        };

        // Instantly save
        await handleUpdateMovie(matchingMovie.id, updates);
        setMatchingMovie(null);
    };

    const handleBulkAutoMatch = async () => {
        const missingList = movies.filter(m => !m.tmdb_id && !m.mal_id && !m.streaming_url);
        if (missingList.length === 0) {
            showMessage('success', 'All content already has streaming IDs!');
            return;
        }

        if (!confirm(`Are you sure you want to auto match all ${missingList.length} missing titles? This may take some time.`)) {
            return;
        }

        setIsBulkMatching(true);
        setBulkMatchProgress({ current: 0, total: missingList.length });
        
        const localApiKey = typeof window !== 'undefined' ? localStorage.getItem('nexiplay_tmdb_api_key') : null;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < missingList.length; i++) {
            const movie = missingList[i];
            try {
                const res = await fetch('/api/auto-match-streaming', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        movieId: movie.id,
                        title: movie.title,
                        type: movie.type,
                        releaseYear: movie.release_year,
                        tmdbApiKey: localApiKey
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.matched) {
                        successCount++;
                        setMovies(prev => prev.map(m => m.id === movie.id ? {
                            ...m,
                            tmdb_id: data.matched.tmdb_id || m.tmdb_id,
                            imdb_id: data.matched.imdb_id || m.imdb_id,
                            mal_id: data.matched.mal_id || m.mal_id
                        } : m));
                    } else {
                        failedCount++;
                    }
                } else {
                    failedCount++;
                }
            } catch (err) {
                console.error(`Error bulk matching "${movie.title}":`, err);
                failedCount++;
            }
            setBulkMatchProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setIsBulkMatching(false);
        showMessage('success', `Bulk matching completed! Successfully matched ${successCount} titles. Failed: ${failedCount}.`);
    };

    // Fetch seasons and episodes for series/anime
    useEffect(() => {
        if (!editingEpisodesMovie) return;
        
        const fetchSeasonsAndEpisodes = async () => {
            setLoadingEpisodes(true);
            try {
                // 1. Fetch seasons
                const { data: seasonsData, error: seasonsError } = await supabase
                    .from('seasons')
                    .select('*')
                    .eq('movie_id', editingEpisodesMovie.id)
                    .order('season_number', { ascending: true });

                if (seasonsError) throw seasonsError;

                if (seasonsData && seasonsData.length > 0) {
                    // 2. Fetch episodes for these seasons
                    const seasonIds = seasonsData.map(s => s.id);
                    const { data: episodesData, error: episodesError } = await supabase
                        .from('episodes')
                        .select('*')
                        .in('season_id', seasonIds)
                        .order('episode_number', { ascending: true });

                    if (episodesError) throw episodesError;

                    const mappedSeasons = seasonsData.map(s => ({
                        ...s,
                        episodes: (episodesData || []).filter(e => e.season_id === s.id)
                    }));

                    setSeasons(mappedSeasons);
                    
                    // Initialize local URLs state
                    const urls: Record<string, string> = {};
                    (episodesData || []).forEach(e => {
                        urls[e.id] = e.streaming_url || '';
                    });
                    setLocalEpisodeUrls(urls);
                    
                    setActiveSeasonId(mappedSeasons[0].id);
                } else {
                    setSeasons([]);
                }
            } catch (e: any) {
                showMessage('error', 'Failed to load episodes: ' + e.message);
            } finally {
                setLoadingEpisodes(false);
            }
        };

        fetchSeasonsAndEpisodes();
    }, [editingEpisodesMovie]);

    const handleEpisodeUrlChange = (episodeId: string, url: string) => {
        setLocalEpisodeUrls(prev => ({ ...prev, [episodeId]: url }));
    };

    // Save streaming URLs for the active season's episodes
    const handleSaveEpisodes = async () => {
        if (!activeSeasonId) return;
        setSavingEpisodes(true);
        try {
            const activeSeason = seasons.find(s => s.id === activeSeasonId);
            if (!activeSeason) return;

            const updatePromises = activeSeason.episodes.map(async (ep: any) => {
                const newUrl = localEpisodeUrls[ep.id] || '';
                if (newUrl !== (ep.streaming_url || '')) {
                    const { error } = await supabase
                        .from('episodes')
                        .update({ streaming_url: newUrl || null })
                        .eq('id', ep.id);
                    
                    if (error) throw error;
                    
                    // Update memory state
                    ep.streaming_url = newUrl;
                }
            });

            await Promise.all(updatePromises);
            showMessage('success', 'Episode streaming URLs saved successfully!');
        } catch (e: any) {
            showMessage('error', 'Failed to save episodes: ' + e.message);
        } finally {
            setSavingEpisodes(false);
        }
    };

    // Filters and search logic
    const filteredMovies = movies.filter(movie => {
        const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (movie.tmdb_id && movie.tmdb_id.includes(searchTerm)) ||
                             (movie.mal_id && movie.mal_id.includes(searchTerm));
        
        const matchesTab = activeTab === 'all' || movie.type === activeTab;
        
        const hasStreaming = movie.tmdb_id || movie.mal_id || movie.streaming_url;
        const matchesStatus = statusFilter === 'all' || 
                             (statusFilter === 'ready' && hasStreaming) ||
                             (statusFilter === 'missing' && !hasStreaming);

        return matchesSearch && matchesTab && matchesStatus;
    });

    // Statistics calculations
    const totalCount = movies.length;
    const readyCount = movies.filter(m => m.tmdb_id || m.mal_id || m.streaming_url).length;
    const missingCount = totalCount - readyCount;

    return (
        <AdminShell>
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Notification toast */}
                {message && (
                    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl text-sm font-semibold shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
                        message.type === 'success' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/5' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5'
                    }`}>
                        {message.type === 'success' ? '🟢 ' : '🔴 '}
                        {message.text}
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            📺 Streaming & Embeds Manager
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Configure TMDB, MAL, and IMDb IDs or Custom Player URLs to enable automatic video playback on the web portal.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={handleBulkAutoMatch}
                            disabled={isBulkMatching || missingCount === 0}
                            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2"
                        >
                            {isBulkMatching ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Matching ({bulkMatchProgress.current}/{bulkMatchProgress.total})...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>Auto Match All ({missingCount})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Total Catalog</span>
                            <span className="text-2xl font-black text-white mt-1 block">{totalCount}</span>
                        </div>
                        <span className="text-3xl">🗄️</span>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-2 border-l-green-500">
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Streaming Ready</span>
                            <span className="text-2xl font-black text-green-400 mt-1 block">{readyCount}</span>
                        </div>
                        <span className="text-3xl">🟢</span>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-2 border-l-red-500">
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Missing Config</span>
                            <span className="text-2xl font-black text-red-400 mt-1 block">{missingCount}</span>
                        </div>
                        <span className="text-3xl">🔴</span>
                    </div>
                </div>

                {/* Search, Filter & Settings Panel */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                        
                        {/* Search & Tabs */}
                        <div className="flex flex-col sm:flex-row gap-3 flex-1">
                            <input
                                type="text"
                                placeholder="Search by title, TMDB ID, or MAL ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 flex-1"
                            />
                            
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                            >
                                <option value="all">All Statuses</option>
                                <option value="ready">Streaming Ready</option>
                                <option value="missing">Not Configured</option>
                            </select>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                            {(['all', 'movie', 'series', 'anime'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                                        activeTab === tab 
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' 
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {tab === 'all' ? 'All Content' : tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TMDB API Key settings widget */}
                    <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 block">🗝️ TMDB API Key:</span>
                            <span className="text-[10px] text-gray-500">(Required for auto matching movies/series)</span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input
                                type="password"
                                placeholder="Paste TMDB v3 API Key..."
                                value={tmdbApiKey}
                                onChange={(e) => setTmdbApiKey(e.target.value)}
                                className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 flex-1 sm:w-64"
                            />
                            <button
                                onClick={() => handleSaveKey(tmdbApiKey)}
                                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-bold transition-all shrink-0"
                            >
                                Save Key
                            </button>
                        </div>
                    </div>
                </div>

                {/* Movies Streaming Settings List */}
                <div className="glass-panel rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-20 text-center text-gray-400">
                            <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            Loading content from database...
                        </div>
                    ) : filteredMovies.length === 0 ? (
                        <div className="p-20 text-center text-gray-500">
                            No content found matching the filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Content Info</th>
                                        <th className="px-6 py-4 font-bold">TMDB ID</th>
                                        <th className="px-6 py-4 font-bold">MAL ID</th>
                                        <th className="px-6 py-4 font-bold">IMDb ID</th>
                                        <th className="px-6 py-4 font-bold">Custom URL</th>
                                        <th className="px-6 py-4 font-bold text-center">Status</th>
                                        <th className="px-6 py-4 font-bold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {filteredMovies.map((movie) => {
                                        const hasStreaming = movie.tmdb_id || movie.mal_id || movie.streaming_url;
                                        const isSeriesOrAnime = movie.type === 'series' || movie.type === 'anime';
                                        
                                        return (
                                            <tr key={movie.id} className="hover:bg-white/5 transition-colors group">
                                                
                                                {/* Content Details */}
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative w-10 h-14 bg-dark-800 rounded-lg overflow-hidden shrink-0 shadow-md">
                                                            {movie.poster_url ? (
                                                                <img
                                                                    src={movie.poster_url}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">
                                                                    🎬
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-white truncate max-w-[200px]" title={movie.title}>
                                                                {movie.title}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs text-gray-400">{movie.release_year}</span>
                                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                                                                    movie.type === 'movie' ? 'bg-red-500/20 text-red-400' :
                                                                    movie.type === 'series' ? 'bg-blue-500/20 text-blue-400' :
                                                                    'bg-purple-500/20 text-purple-400'
                                                                }`}>
                                                                    {movie.type}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* TMDB ID */}
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="text"
                                                        value={movie.tmdb_id || ''}
                                                        onChange={(e) => handleFieldChange(movie.id, 'tmdb_id', e.target.value)}
                                                        placeholder="e.g. 299534"
                                                        className="w-24 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                                                    />
                                                </td>

                                                {/* MAL ID */}
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="text"
                                                        value={movie.mal_id || ''}
                                                        onChange={(e) => handleFieldChange(movie.id, 'mal_id', e.target.value)}
                                                        placeholder="e.g. 51009"
                                                        className="w-24 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                                                    />
                                                </td>

                                                {/* IMDb ID */}
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="text"
                                                        value={movie.imdb_id || ''}
                                                        onChange={(e) => handleFieldChange(movie.id, 'imdb_id', e.target.value)}
                                                        placeholder="e.g. tt4154796"
                                                        className="w-28 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                                                    />
                                                </td>

                                                {/* Custom URL / Episodes Action */}
                                                <td className="px-6 py-4">
                                                    {isSeriesOrAnime ? (
                                                        <button
                                                            onClick={() => setEditingEpisodesMovie(movie)}
                                                            className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/25 text-purple-400 hover:text-purple-300 text-xs font-bold rounded-lg border border-purple-500/20 transition-all flex items-center gap-1.5"
                                                        >
                                                            <span>📺</span> Manage Episodes
                                                        </button>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={movie.streaming_url || ''}
                                                            onChange={(e) => handleFieldChange(movie.id, 'streaming_url', e.target.value)}
                                                            placeholder="Direct movie link..."
                                                            className="w-40 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
                                                        />
                                                    )}
                                                </td>

                                                {/* Streaming Status */}
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                        hasStreaming 
                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/15' 
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/15'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${hasStreaming ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        {hasStreaming ? 'Streaming' : 'Not Set'}
                                                    </span>
                                                </td>

                                                {/* Save / Match / Preview Actions */}
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        
                                                        {/* Auto Match Button */}
                                                        <button
                                                            onClick={() => handleOpenMatchModal(movie)}
                                                            className="p-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/20 transition-all"
                                                            title="Auto Match IDs"
                                                        >
                                                            🤖 Auto
                                                        </button>

                                                        {/* Save Button */}
                                                        <button
                                                            onClick={() => handleUpdateMovie(movie.id, movie)}
                                                            disabled={savingId === movie.id}
                                                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-white disabled:opacity-50 text-xs font-bold rounded-lg border border-green-500/20 transition-all"
                                                        >
                                                            {savingId === movie.id ? '...' : 'Save'}
                                                        </button>

                                                        {/* Preview button - Live URL nexiplay.vercel.app */}
                                                        <a
                                                            href={`https://nexiplay.vercel.app/${movie.type}/${movie.slug}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg border border-white/5 transition-all text-xs"
                                                            title="Preview Playback on Live Web"
                                                        >
                                                            👁️
                                                        </a>
                                                    </div>
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

            {/* Auto-Config/Match Modal */}
            {matchingMovie && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>🤖</span> Auto-Config IDs
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Automatically find IDs for: <strong className="text-white">&ldquo;{matchingMovie.title}&rdquo;</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setMatchingMovie(null)}
                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            
                            {/* Source Selection & Search Bar */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Metadata Source</label>
                                    <select
                                        value={searchSource}
                                        onChange={(e) => setSearchSource(e.target.value as any)}
                                        className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500 font-semibold"
                                    >
                                        <option value="tmdb">TheMovieDB (TMDB)</option>
                                        {matchingMovie.type === 'anime' && (
                                            <option value="jikan">MyAnimeList (Jikan)</option>
                                        )}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search Term</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="flex-1 bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                                            placeholder="Search title..."
                                        />
                                        <button
                                            onClick={handleSearchSource}
                                            disabled={searching}
                                            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {searching ? (
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                'Search'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Search Results list */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                                    Search Matches ({searchResults.length})
                                </h4>

                                {searching ? (
                                    <div className="space-y-2.5">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="h-16 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden bg-dark-900/50 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map((result, idx) => (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-12 bg-dark-800 rounded overflow-hidden shrink-0 shadow-sm">
                                                        {result.posterUrl ? (
                                                            <img
                                                                src={result.posterUrl}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">
                                                                🖼️
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-semibold text-sm truncate">{result.title}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            Year: {result.year} | ID: {result.id}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleApplyMatch(result)}
                                                    className="shrink-0 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-white text-xs font-bold rounded-lg border border-green-500/10 transition-all"
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500 text-sm bg-dark-900/30 rounded-xl border border-dashed border-white/10">
                                        {searchSource === 'tmdb' && !tmdbApiKey 
                                            ? '⚠️ Save your TMDB API Key above to search the TMDB catalog.' 
                                            : 'No results found. Modify your search query above.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Episode Management Modal */}
            {editingEpisodesMovie && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>📺</span> Episode Streaming URL Override
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Configure episode-wise streaming override URLs for: <strong className="text-white">&ldquo;{editingEpisodesMovie.title}&rdquo;</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingEpisodesMovie(null)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {loadingEpisodes ? (
                                <div className="p-20 text-center text-gray-400">
                                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    Loading seasons and episodes...
                                </div>
                            ) : seasons.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 bg-dark-900/30 rounded-xl border border-dashed border-white/10">
                                    ⚠️ No seasons or episodes have been imported for this series/anime yet.
                                    <p className="text-xs text-gray-600 mt-2">Go to Edit Content and use the scraper/importer to populate seasons and episodes first.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Season Tabs */}
                                    <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
                                        {seasons.map((season) => (
                                            <button
                                                key={season.id}
                                                onClick={() => setActiveSeasonId(season.id)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                    activeSeasonId === season.id
                                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                S{season.season_number}: {season.season_title || `Season ${season.season_number}`} ({season.episodes?.length || 0} EPs)
                                            </button>
                                        ))}
                                    </div>

                                    {/* Episodes List under Active Season */}
                                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                                        {seasons
                                            .find(s => s.id === activeSeasonId)
                                            ?.episodes?.map((ep: any) => (
                                                <div key={ep.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-black/25 rounded-xl border border-white/5">
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">EPISODE {ep.episode_number}</span>
                                                        <span className="text-sm font-semibold text-white truncate block max-w-sm mt-0.5">{ep.episode_title}</span>
                                                    </div>
                                                    <div className="flex-1 sm:max-w-xl">
                                                        <input
                                                            type="text"
                                                            value={localEpisodeUrls[ep.id] || ''}
                                                            onChange={(e) => handleEpisodeUrlChange(ep.id, e.target.value)}
                                                            placeholder="Paste custom episode streaming player URL..."
                                                            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        {(!seasons.find(s => s.id === activeSeasonId)?.episodes || 
                                          seasons.find(s => s.id === activeSeasonId)?.episodes.length === 0) && (
                                            <div className="p-8 text-center text-gray-600 text-xs">
                                                No episodes found in this season.
                                            </div>
                                        )}
                                    </div>

                                    {/* Save Button for active season */}
                                    <div className="flex justify-end pt-4 border-t border-white/5 gap-3">
                                        <button
                                            onClick={() => setEditingEpisodesMovie(null)}
                                            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg text-sm transition-all"
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={handleSaveEpisodes}
                                            disabled={savingEpisodes}
                                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
                                        >
                                            {savingEpisodes ? 'Saving...' : 'Save Season Episodes'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
