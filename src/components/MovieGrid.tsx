import { Movie } from '@/lib/types';
import MovieCard, { MovieCardSkeleton } from './MovieCard';

interface MovieGridProps {
    movies: Movie[];
    title?: string;
    showViewAll?: boolean;
    viewAllHref?: string;
}

export default function MovieGrid({
    movies,
    title,
    showViewAll = false,
    viewAllHref = '#'
}: MovieGridProps) {
    return (
        <section className="py-8">
            {title && (
                <div className="flex items-center justify-between mb-6">
                    <h2 className="section-title">{title}</h2>
                    {showViewAll && (
                        <a
                            href={viewAllHref}
                            className="text-sm text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                        >
                            View All
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
                {movies.map((movie, index) => (
                    <div
                        key={movie.id}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <MovieCard movie={movie} />
                    </div>
                ))}
            </div>
        </section>
    );
}

// Skeleton loader for MovieGrid
export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {Array.from({ length: count }).map((_, index) => (
                <MovieCardSkeleton key={index} />
            ))}
        </div>
    );
}
