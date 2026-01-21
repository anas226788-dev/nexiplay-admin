import { createClient } from '@/lib/supabase';
import { Movie } from '@/lib/types';
import Link from 'next/link';
import ContentList from '@/components/ContentList';

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

// Force dynamic rendering to ensure fresh data
export const dynamic = 'force-dynamic';

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

            <ContentList initialMovies={movies} />
        </div>
    );
}
