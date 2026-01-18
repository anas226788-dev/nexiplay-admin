'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();

    const navLinks = [
        { href: '/', label: 'Home' },
        { href: '/movies', label: 'Movies' },
        { href: '/series', label: 'Series' },
        { href: '/anime', label: 'Anime' },
    ];

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    return (
        <header className="glass fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-xl bg-black/40 border-b border-white/5">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo with Glow */}
                    <Link href="/" className="flex items-center gap-3 group relative">
                        <div className="absolute inset-0 bg-red-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
                        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-dark-800 to-black border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <span className="text-red-600 font-bold text-xl">N</span>
                        </div>
                        <span className="text-xl md:text-2xl font-black tracking-tight text-white group-hover:text-red-500 transition-colors">
                            NEXI<span className="text-red-600">PLAY</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center bg-black/20 p-1.5 rounded-full border border-white/5 backdrop-blur-md">
                        {navLinks.map((link) => {
                            const active = isActive(link.href);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 relative ${active
                                            ? 'text-white bg-white/10 shadow-lg'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {link.label}
                                    {active && (
                                        <span className="absolute inset-0 rounded-full ring-1 ring-white/10 animate-pulse-glow" />
                                    )}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Search & Mobile Menu */}
                    <div className="flex items-center gap-3">
                        {/* Search Button */}
                        <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>

                        <MobileMenu navLinks={navLinks} isActive={isActive} />
                    </div>
                </div>
            </div>
        </header>
    );
}

function MobileMenu({
    navLinks,
    isActive
}: {
    navLinks: { href: string; label: string }[];
    isActive: (href: string) => boolean;
}) {
    return (
        <div className="md:hidden relative group">
            <button className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-2 w-48 py-2 glass rounded-xl border border-white/10 opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`block px-4 py-2 hover:bg-white/5 transition-colors ${isActive(link.href) ? 'text-red-500' : 'text-gray-300'
                            }`}
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}
