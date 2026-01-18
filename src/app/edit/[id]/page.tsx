import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FullMovie } from '@/lib/types';
import MovieForm from '@/components/admin/MovieForm';

interface EditPageProps {
    params: Promise<{ id: string }>;
}

async function getMovie(id: string): Promise<FullMovie | null> {
    const { data, error } = await supabase
        .from('movies')
        .select(`
      *,
      downloads (*),
      download_links (*),
      screenshots:movie_screenshots (*),
      movie_categories (
        categories (*)
      )
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching movie:', error);
        return null;
    }

    return data as FullMovie;
}

export default async function EditContentPage({ params }: EditPageProps) {
    const { id } = await params;
    const movie = await getMovie(id);

    if (!movie) {
        notFound();
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Edit Content</h1>
                <p className="text-gray-400">Update details for {movie.title}</p>
            </div>

            <MovieForm initialData={movie} />
        </div>
    );
}
