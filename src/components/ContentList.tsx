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
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'anime' | 'series' | 'movie'>('all');

    // Filtered movies
    const filteredMovies = movies.filter((movie) => {
        const matchesSearch = searchQuery === '' ||
            movie.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            movie.slug?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' || movie.type === typeFilter;
        return matchesSearch && matchesType;
    });

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
                        className="w-full pl-11 pr-4 py-3 bg-dark-700 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
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
                    <div className="flex gap-2">
                        {typeButtons.map((btn) => (
                            <button
                                key={btn.value}
                                onClick={() => setTypeFilter(btn.value)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase transition-all ${
                                    typeFilter === btn.value
                                        ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                {btn.label} <span className="opacity-60">({btn.count})</span>
                            </button>
                        ))}
                    </div>
                    <span className="text-xs text-gray-500">
                        {filteredMovies.length} result{filteredMovies.length !== 1 ? 's' : ''}
                    </span>
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
                                        <span className="flex items-center gap-2">
                                            {movie.title}
                                            {movie.is_adult && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-red-600 text-white uppercase tracking-wider shrink-0">18+</span>
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
                                        <h3 className="font-semibold text-white truncate flex items-center gap-2">
                                            {movie.title}
                                            {movie.is_adult && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-red-600 text-white uppercase tracking-wider shrink-0">18+</span>
                                            )}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 text-[10px] rounded bg-white/10 uppercase font-bold text-gray-400">
                                                {movie.type}
                                            </span>
                                            <span className="text-xs text-gray-500">{movie.release_year}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
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
                                            className="p-2 rounded-lg bg-red-500/10 text-red-500 active:bg-red-500/20 disabled:opacity-50"
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
        </div>
    );
}
