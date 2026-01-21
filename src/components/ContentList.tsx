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
        if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) return;

        setDeletingId(id);
        const { error } = await supabase
            .from('movies')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting movie:', error);
            alert('Error deleting content: ' + error.message);
        } else {
            setMovies(movies.filter(m => m.id !== id));
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
