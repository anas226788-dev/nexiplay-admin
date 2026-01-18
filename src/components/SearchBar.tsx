'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Movie } from '@/lib/types';

interface SearchBarProps {
    className?: string;
}

export default function SearchBar({ className = '' }: SearchBarProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Movie[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search with debounce
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            const { data, error } = await supabase
                .from('movies')
                .select('*')
                .ilike('title', `%${query}%`)
                .limit(8);

            if (!error && data) {
                setResults(data);
            }
            setIsLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query)}`);
            setIsOpen(false);
        }
    };

    return (
        <div ref={searchRef} className={`relative ${className}`}>
            <form onSubmit={handleSubmit}>
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Search movies, series, anime..."
                        className="w-full h-12 pl-12 pr-4 bg-dark-700/80 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50 focus:bg-dark-600/80 transition-all duration-300"
                    />
                    <svg
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                    {isLoading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            </form>

            {/* Search Results Dropdown */}
            {isOpen && query.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-dark-700 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-[400px] overflow-y-auto">
                    {results.length > 0 ? (
                        <div>
                            {results.map((movie) => (
                                <Link
                                    key={movie.id}
                                    href={`/${movie.type}/${movie.slug}`}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                                >
                                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-dark-600 flex-shrink-0">
                                        {movie.poster_url ? (
                                            <Image
                                                src={movie.poster_url}
                                                alt={movie.title}
                                                width={48}
                                                height={64}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-white truncate">{movie.title}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="uppercase">{movie.type}</span>
                                            {movie.release_year && <span>• {movie.release_year}</span>}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                            <Link
                                href={`/search?q=${encodeURIComponent(query)}`}
                                onClick={() => setIsOpen(false)}
                                className="block p-3 text-center text-sm text-red-400 hover:bg-white/5 border-t border-white/5"
                            >
                                View all results for &quot;{query}&quot;
                            </Link>
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-500">
                            No results found for &quot;{query}&quot;
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
