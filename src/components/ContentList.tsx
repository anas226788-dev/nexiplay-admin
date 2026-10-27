'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Movie } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface ContentListProps {
    initialMovies: Movie[];
}

export default function ContentList({ initialMovies }: ContentListProps) {
    const [movies, setMovies] = useState<Movie[]>(initialMovies);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pinningId, setPinningId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'anime' | 'series' | 'movie' | 'pinned'>('all');

    // TMDB / IMDb Pinning Modal State
    const [isTmdbPinModalOpen, setIsTmdbPinModalOpen] = useState(false);
    const [tmdbSearchQuery, setTmdbSearchQuery] = useState('');
    const [tmdbMediaType, setTmdbMediaType] = useState<'multi' | 'movie' | 'tv'>('multi');
    const [tmdbSearching, setTmdbSearching] = useState(false);
    const [tmdbSearchResults, setTmdbSearchResults] = useState<any[]>([]);
    const [pinningTmdbId, setPinningTmdbId] = useState<number | null>(null);
    const [pinSuccessToast, setPinSuccessToast] = useState<string | null>(null);

    const handleSearchTmdb = async (query: string, media: 'multi' | 'movie' | 'tv') => {
        if (!query || query.trim().length < 2) {
            setTmdbSearchResults([]);
            return;
        }
        setTmdbSearching(true);
        try {
            const res = await fetch(`/api/admin/tmdb/search?query=${encodeURIComponent(query.trim())}&media=${media}`);
            const data = await res.json();
            if (res.ok && Array.isArray(data.results)) {
                setTmdbSearchResults(data.results);
            } else {
                setTmdbSearchResults([]);
            }
        } catch (err) {
            console.error('TMDB search error:', err);
            setTmdbSearchResults([]);
        } finally {
            setTmdbSearching(false);
        }
    };

    const handlePinTmdbTitle = async (item: any) => {
        setPinningTmdbId(item.id);
        try {
            const contentType = item.media === 'tv' ? 'series' : 'movie';
            const res = await fetch('/api/admin/tmdb/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tmdbId: item.id,
                    media: item.media,
                    contentType: contentType,
                    isPinned: true
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to pin title');

            if (data.movie) {
                const saved = { ...data.movie, is_pinned: true };
                setMovies(prev => {
                    const exists = prev.some(m => m.id === saved.id || (saved.tmdb_id && m.tmdb_id === saved.tmdb_id));
                    if (exists) {
                        return prev.map(m => (m.id === saved.id || (saved.tmdb_id && m.tmdb_id === saved.tmdb_id)) ? saved : m);
                    }
                    return [saved, ...prev];
                });
            }

            // Mark as pinned in search results
            setTmdbSearchResults(prev => prev.map(r => r.id === item.id ? { ...r, inDatabase: true, is_pinned: true } : r));

            setPinSuccessToast(`📌 "${item.title}" successfully pinned to Homepage Latest Additions!`);
            setTimeout(() => setPinSuccessToast(null), 4000);
        } catch (err: any) {
            alert(err.message || 'Failed to pin');
        } finally {
            setPinningTmdbId(null);
        }
    };

    // Filtered movies
    const filteredMovies = movies.filter((movie) => {
        const matchesSearch = searchQuery === '' ||
            movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            movie.slug?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' 
            ? true 
            : typeFilter === 'pinned'
                ? Boolean(movie.is_pinned)
                : movie.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const handleTogglePin = async (movie: Movie) => {
        const nextState = !movie.is_pinned;
        setPinningId(movie.id);
        try {
            const res = await fetch('/api/admin/movies/pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: movie.id, is_pinned: nextState }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to toggle pin');

            setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, is_pinned: nextState } : m));
        } catch (err: any) {
            console.error('Error toggling pin:', err);
            alert('Failed to update pin: ' + (err.message || 'Unknown error'));
        } finally {
            setPinningId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this content? This will permanently remove all data including seasons, episodes, and images. This action cannot be undone.')) return;

        setDeletingId(id);

        try {
            const { data: movie } = await supabase
                .from('movies')
                .select('poster_url, banner_url_desktop, banner_url_mobile')
                .eq('id', id)
                .single();

            const { data: screenshots } = await supabase
                .from('movie_screenshots')
                .select('image_url')
                .eq('movie_id', id);

            const filesToDelete: string[] = [];

            const extractStoragePath = (url: string | null): string | null => {
                if (!url) return null;
                const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
                if (match) return match[2];
                return null;
            };

            const posterPath = extractStoragePath(movie?.poster_url);
            if (posterPath) filesToDelete.push(posterPath);

            const desktopBannerPath = extractStoragePath(movie?.banner_url_desktop);
            if (desktopBannerPath) filesToDelete.push(desktopBannerPath);

            const mobileBannerPath = extractStoragePath(movie?.banner_url_mobile);
            if (mobileBannerPath) filesToDelete.push(mobileBannerPath);

            screenshots?.forEach(s => {
                const screenshotPath = extractStoragePath(s.image_url);
                if (screenshotPath) filesToDelete.push(screenshotPath);
            });

            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('posters')
                    .remove(filesToDelete);

                if (storageError) {
                    console.warn('Storage cleanup warning:', storageError);
                }
            }

            const { error: dbError } = await supabase
                .from('movies')
                .delete()
                .eq('id', id);

            if (dbError) {
                throw dbError;
            }

            setMovies(movies.filter(m => m.id !== id));

        } catch (error: any) {
            console.error('Error deleting content:', error);
            alert('Error deleting content: ' + (error.message || 'Unknown error'));
        }

        setDeletingId(null);
    };

    const typeButtons = [
        { value: 'all' as const, label: 'All', count: movies.length },
        { value: 'pinned' as const, label: '📌 Pinned', count: movies.filter(m => m.is_pinned).length },
        { value: 'anime' as const, label: 'Anime', count: movies.filter(m => m.type === 'anime').length },
        { value: 'series' as const, label: 'Series', count: movies.filter(m => m.type === 'series').length },
        { value: 'movie' as const, label: 'Movie', count: movies.filter(m => m.type === 'movie').length },
    ];

    return (
        <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="glass rounded-xl border border-white/5 p-4 space-y-3">
                {/* Search Input */}
                <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-violet-400 transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Type Filter + Count */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                        {typeButtons.map((btn) => (
                            <button
                                key={btn.value}
                                onClick={() => setTypeFilter(btn.value)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition-all ${
                                    typeFilter === btn.value
                                        ? btn.value === 'pinned'
                                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                                            : 'bg-violet-600 text-white shadow-lg shadow-red-900/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {btn.label} <span className="opacity-60">({btn.count})</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-gray-500">
                            {filteredMovies.length} result{filteredMovies.length !== 1 ? 's' : ''}
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsTmdbPinModalOpen(true)}
                            className="px-3 py-1.5 text-xs font-black rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
                        >
                            <span>📌</span>
                            <span>Pin from IMDb / TMDB</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Table */}
            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 font-semibold text-gray-300">Title</th>
                                <th className="px-6 py-4 font-semibold text-gray-300">Type</th>
                                <th className="px-6 py-4 font-semibold text-gray-300">Year</th>
                                <th className="px-6 py-4 font-semibold text-gray-300 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMovies.map((movie) => (
                                <tr key={movie.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium">
                                        <span className="flex items-center gap-2 flex-wrap">
                                            {movie.is_pinned && (
                                                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider shrink-0 flex items-center gap-1">
                                                    <span>📌</span> PINNED
                                                </span>
                                            )}
                                            <span className="text-white">{movie.title}</span>
                                            {movie.is_adult && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-violet-600 text-white uppercase tracking-wider shrink-0">18+</span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 text-xs rounded bg-white/10 uppercase font-bold text-gray-300">
                                            {movie.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400">
                                        {movie.release_year}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleTogglePin(movie)}
                                            disabled={pinningId === movie.id}
                                            title={movie.is_pinned ? 'Unpin from top' : 'Pin to top of Latest Additions'}
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-all mr-3 ${
                                                movie.is_pinned
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20 hover:bg-amber-500/30'
                                                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-amber-300 hover:border-amber-500/30'
                                            }`}
                                        >
                                            {pinningId === movie.id ? (
                                                <span className="w-3.5 h-3.5 border-2 border-amber-500/20 border-t-amber-400 rounded-full animate-spin block"></span>
                                            ) : (
                                                <span>📌 {movie.is_pinned ? 'Pinned' : 'Pin'}</span>
                                            )}
                                        </button>
                                        <Link
                                            href={`/edit/${movie.id}`}
                                            className="text-gray-400 hover:text-white transition-colors mr-4"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(movie.id)}
                                            disabled={deletingId === movie.id}
                                            className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                                        >
                                            {deletingId === movie.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredMovies.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        {searchQuery || typeFilter !== 'all'
                                            ? 'No content matches your search.'
                                            : 'No content found. Click "Add New" to get started.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-white/5">
                    {filteredMovies.length === 0 ? (
                        <div className="px-4 py-12 text-center text-gray-500">
                            {searchQuery || typeFilter !== 'all'
                                ? 'No content matches your search.'
                                : 'No content found. Tap "Add New" to get started.'}
                        </div>
                    ) : (
                        filteredMovies.map((movie) => (
                            <div key={movie.id} className="p-4 active:bg-white/5 transition-colors">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-white truncate flex items-center gap-2 flex-wrap">
                                            {movie.is_pinned && (
                                                <span className="px-2 py-0.5 text-[9px] font-black rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider shrink-0">
                                                    📌 PINNED
                                                </span>
                                            )}
                                            <span>{movie.title}</span>
                                            {movie.is_adult && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-violet-600 text-white uppercase tracking-wider shrink-0">18+</span>
                                            )}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 text-[10px] rounded bg-white/10 uppercase font-bold text-gray-400">
                                                {movie.type}
                                            </span>
                                            <span className="text-xs text-gray-500">{movie.release_year}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleTogglePin(movie)}
                                            disabled={pinningId === movie.id}
                                            title={movie.is_pinned ? 'Unpin' : 'Pin'}
                                            className={`p-2 rounded-lg border text-xs font-bold transition-all ${
                                                movie.is_pinned
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                    : 'bg-white/5 text-gray-400 border-white/10'
                                            }`}
                                        >
                                            {pinningId === movie.id ? (
                                                <span className="w-4 h-4 border-2 border-amber-500/20 border-t-amber-400 rounded-full animate-spin block"></span>
                                            ) : (
                                                <span>📌</span>
                                            )}
                                        </button>
                                        <Link
                                            href={`/edit/${movie.id}`}
                                            className="p-2 rounded-lg bg-white/5 text-gray-400 active:bg-white/10"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </Link>
                                        <button
                                            onClick={() => handleDelete(movie.id)}
                                            disabled={deletingId === movie.id}
                                            className="p-2 rounded-lg bg-red-500/10 text-violet-300 active:bg-red-500/20 disabled:opacity-50"
                                        >
                                            {deletingId === movie.id ? (
                                                <span className="w-5 h-5 border-2 border-red-500/20 border-t-red-500 rounded-full animate-spin block"></span>
                                            ) : (
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
            {/* TMDB / IMDb Pinning Modal */}
            {isTmdbPinModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="glass bg-dark-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-dark-850">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <span className="text-amber-400">📌</span>
                                    <span>Pin Content from IMDb / TMDB</span>
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Search across 10 Lakh+ Movies, Series & Anime from IMDb/TMDB to pin to Homepage Latest Additions.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsTmdbPinModalOpen(false);
                                    setTmdbSearchResults([]);
                                    setTmdbSearchQuery('');
                                }}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search & Media Filter Controls */}
                        <div className="p-4 bg-dark-800 border-b border-white/5 space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={tmdbSearchQuery}
                                    onChange={(e) => {
                                        setTmdbSearchQuery(e.target.value);
                                        handleSearchTmdb(e.target.value, tmdbMediaType);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearchTmdb(tmdbSearchQuery, tmdbMediaType);
                                    }}
                                    placeholder="Search by title, or enter IMDb ID (e.g. tt1375666, Avatar, Naruto)..."
                                    className="flex-1 bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                    autoFocus
                                />
                                <button
                                    onClick={() => handleSearchTmdb(tmdbSearchQuery, tmdbMediaType)}
                                    disabled={tmdbSearching || !tmdbSearchQuery.trim()}
                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition-all disabled:opacity-50"
                                >
                                    {tmdbSearching ? 'Searching...' : 'Search'}
                                </button>
                            </div>

                            <div className="flex gap-2 text-xs">
                                {(
                                    [
                                        { id: 'multi', label: 'All Media' },
                                        { id: 'movie', label: 'Movies' },
                                        { id: 'tv', label: 'TV Series & Anime' }
                                    ] as const
                                ).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setTmdbMediaType(tab.id);
                                            if (tmdbSearchQuery.trim().length >= 2) {
                                                handleSearchTmdb(tmdbSearchQuery, tab.id);
                                            }
                                        }}
                                        className={`px-3 py-1 rounded-lg font-bold transition-all ${
                                            tmdbMediaType === tab.id
                                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                                                : 'bg-white/5 text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Results List */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
                            {tmdbSearching ? (
                                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-3">
                                    <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-xs font-semibold">Searching IMDb & TMDB catalog...</p>
                                </div>
                            ) : tmdbSearchResults.length === 0 ? (
                                <div className="py-12 text-center text-gray-500 text-xs">
                                    {tmdbSearchQuery.trim().length >= 2
                                        ? 'No results found on TMDB/IMDb. Try another title or IMDb ID.'
                                        : 'Type a title or IMDb ID above to search and pin content.'}
                                </div>
                            ) : (
                                tmdbSearchResults.map((item) => (
                                    <div
                                        key={`${item.media}-${item.id}`}
                                        className="p-3 bg-dark-800/80 hover:bg-dark-750 border border-white/5 rounded-xl flex items-center justify-between gap-4 transition-all"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            {item.posterUrl ? (
                                                <img
                                                    src={item.posterUrl}
                                                    alt={item.title}
                                                    className="w-12 h-16 object-cover rounded-lg shrink-0 border border-white/10"
                                                />
                                            ) : (
                                                <div className="w-12 h-16 bg-white/5 rounded-lg flex items-center justify-center text-gray-500 text-xs shrink-0">
                                                    🎬
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="text-sm font-bold text-white truncate max-w-[280px]">
                                                        {item.title}
                                                    </h4>
                                                    {item.releaseYear && (
                                                        <span className="text-[11px] text-gray-400 font-semibold">
                                                            ({item.releaseYear})
                                                        </span>
                                                    )}
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                        item.media === 'tv'
                                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                                    }`}>
                                                        {item.media === 'tv' ? 'SERIES' : 'MOVIE'}
                                                    </span>
                                                    {item.rating && (
                                                        <span className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                                                            ⭐ {Number(item.rating).toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                                                    {item.overview || 'No description available.'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handlePinTmdbTitle(item)}
                                                disabled={pinningTmdbId === item.id}
                                                className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                                                    item.is_pinned
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-amber-500/20'
                                                }`}
                                            >
                                                {pinningTmdbId === item.id ? (
                                                    <>
                                                        <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                        <span>Pinning...</span>
                                                    </>
                                                ) : item.is_pinned ? (
                                                    <>
                                                        <span>✓</span>
                                                        <span>Pinned</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>📌</span>
                                                        <span>Pin to Top</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-white/5 bg-dark-850 flex justify-end">
                            <button
                                onClick={() => {
                                    setIsTmdbPinModalOpen(false);
                                    setTmdbSearchResults([]);
                                    setTmdbSearchQuery('');
                                }}
                                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Toast */}
            {pinSuccessToast && (
                <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-dark-900 border border-amber-500/50 rounded-xl text-xs font-bold text-amber-300 shadow-2xl flex items-center gap-2 animate-in fade-in duration-200">
                    <span>✨</span>
                    <span>{pinSuccessToast}</span>
                </div>
            )}
        </div>
    );
}
