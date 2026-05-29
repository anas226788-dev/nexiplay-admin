import Link from 'next/link';
import { Category } from '@/lib/types';

interface CategoryMenuProps {
    categories: Category[];
    activeSlug?: string;
}

export default function CategoryMenu({ categories, activeSlug }: CategoryMenuProps) {
    const allCategories = [
        { id: 'all', name: 'All', slug: '' },
        ...categories,
    ];

    return (
        <div className="overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 pb-2">
                {allCategories.map((category) => {
                    const isActive = activeSlug === category.slug || (!activeSlug && category.slug === '');
                    const href = category.slug ? `/genre/${category.slug}` : '/';

                    return (
                        <Link
                            key={category.id}
                            href={href}
                            className={`
                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300
                ${isActive
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                                    : 'bg-dark-600/80 text-gray-300 hover:bg-dark-500 hover:text-white border border-white/5'
                                }
              `}
                        >
                            {category.name}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

// Quick type filter tabs
interface TypeTabsProps {
    activeType?: 'all' | 'movie' | 'series' | 'anime';
}

export function TypeTabs({ activeType = 'all' }: TypeTabsProps) {
    const types = [
        { key: 'all', label: 'All', href: '/' },
        { key: 'movie', label: 'Movies', href: '/movies' },
        { key: 'series', label: 'Series', href: '/series' },
        { key: 'anime', label: 'Anime', href: '/anime' },
    ];

    return (
        <div className="flex items-center gap-1 p-1 bg-dark-700/50 rounded-xl border border-white/5 w-fit">
            {types.map((type) => (
                <Link
                    key={type.key}
                    href={type.href}
                    className={`
            px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300
            ${activeType === type.key
                            ? 'bg-red-600 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }
          `}
                >
                    {type.label}
                </Link>
            ))}
        </div>
    );
}
