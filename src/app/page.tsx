import { createClient } from '@/lib/supabase';
import { Movie } from '@/lib/types';
import Link from 'next/link';

// Note: In a real app, you should add authentication check here
// to prevent unauthorized access.

// Re-creating client here to ensure fresh data
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getMovies(): Promise<Movie[]> {
    const { data, error } = await supabase
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching movies:', error);
        return [];
    }

    return data || [];
}

export default async function AdminDashboard() {
    const movies = await getMovies();

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">Content Management</h1>
                <Link
                    href="/add"
                    className="btn-primary flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New
                </Link>
            </div>

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
                                        <button className="text-red-400 hover:text-red-300 transition-colors">
                                            Delete
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
        </div>
    );
}
