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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this content? This will permanently remove all data including seasons, episodes, and images. This action cannot be undone.')) return;

        setDeletingId(id);

        try {
            // 1. First, get the movie data to find storage URLs
            const { data: movie } = await supabase
                .from('movies')
                .select('poster_url, banner_url_desktop, banner_url_mobile')
                .eq('id', id)
                .single();

            // 2. Get all screenshots for this movie
            const { data: screenshots } = await supabase
                .from('movie_screenshots')
                .select('image_url')
                .eq('movie_id', id);

            // 3. Delete storage files
            const filesToDelete: string[] = [];

            // Helper to extract storage path from URL
            const extractStoragePath = (url: string | null): string | null => {
                if (!url) return null;
                // Supabase Storage URLs contain /storage/v1/object/public/[bucket]/[path]
                const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
                if (match) return match[2]; // Return just the path within bucket
                return null;
            };

            // Add poster
            const posterPath = extractStoragePath(movie?.poster_url);
            if (posterPath) filesToDelete.push(posterPath);

            // Add banners
            const desktopBannerPath = extractStoragePath(movie?.banner_url_desktop);
            if (desktopBannerPath) filesToDelete.push(desktopBannerPath);

            const mobileBannerPath = extractStoragePath(movie?.banner_url_mobile);
            if (mobileBannerPath) filesToDelete.push(mobileBannerPath);

            // Add screenshots
            screenshots?.forEach(s => {
                const screenshotPath = extractStoragePath(s.image_url);
                if (screenshotPath) filesToDelete.push(screenshotPath);
            });

            // Delete from storage (errors are logged but don't stop the process)
            if (filesToDelete.length > 0) {
                const { error: storageError } = await supabase.storage
                    .from('posters') // Assuming all images are in 'posters' bucket
                    .remove(filesToDelete);

                if (storageError) {
                    console.warn('Storage cleanup warning:', storageError);
                    // Continue with DB deletion even if storage fails
                }
            }

            // 4. Delete from database (CASCADE handles related tables)
            const { error: dbError } = await supabase
                .from('movies')
                .delete()
                .eq('id', id);

            if (dbError) {
                throw dbError;
            }

            // Success - update UI
            setMovies(movies.filter(m => m.id !== id));

        } catch (error: any) {
            console.error('Error deleting content:', error);
            alert('Error deleting content: ' + (error.message || 'Unknown error'));
        }

        setDeletingId(null);
    };

    return (
        <div className="glass rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
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
                        {movies.map((movie) => (
                            <tr key={movie.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium">
                                    {movie.title}
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
                        {movies.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                    No content found. Click "Add New" to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
