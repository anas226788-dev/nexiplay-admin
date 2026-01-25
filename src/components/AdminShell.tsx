'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminShell({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    const menuItems = [
        { name: 'Dashboard', path: '/', icon: 'M4 6h16M4 12h16M4 18h16' },
        { name: 'Add Content', path: '/add', icon: 'M12 4v16m8-8H4' },
        { name: 'Running Tasks', path: '/running', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        { name: 'Ads', path: '/ads', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
        { name: 'Comments', path: '/comments', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
        { name: 'Requests', path: '/requests', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        { name: 'Notices', path: '/notices', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
        { name: 'Messages', path: '/messages', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
        { name: 'DMCA', path: '/dmca', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
        { name: 'Chatbot', path: '/chatbot', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
        { name: 'Dead Links', path: '/dead-links', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
        { name: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    ];

    return (
        <div className="flex min-h-screen bg-black">
            {/* Sidebar (Desktop Only) */}
            <aside className="
                hidden md:block fixed top-0 left-0 bottom-0 w-64
                bg-dark-800 border-r border-white/5 z-50
            ">
                <div className="p-6">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
                        Nexiplay Admin
                    </h1>
                </div>

                <nav className="px-4 space-y-2 mt-4">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path));
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive
                                    ? 'bg-red-600/10 text-red-400 border border-red-500/10'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                </svg>
                                {item.name}
                            </Link>
                        );
                    })}

                    <div className="border-t border-white/5 my-4 mx-4" />

                    <a
                        href="http://localhost:3000"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                        target="_blank"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View Site
                    </a>
                </nav>
            </aside>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-dark-800/95 backdrop-blur-xl border-t border-white/10 z-50 pb-safe">
                <nav className="flex items-center justify-around p-2">
                    {menuItems.slice(0, 5).map((item) => { // Show top 5 items on mobile bar
                        const isActive = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path));
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${isActive
                                    ? 'text-red-500'
                                    : 'text-gray-500'
                                    }`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                </svg>
                                <span className="text-[10px] font-medium">{item.name}</span>
                            </Link>
                        );
                    })}
                    {/* More Menu (for remaining items) */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl text-gray-500 ${sidebarOpen ? 'text-white' : ''}`}
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span className="text-[10px] font-medium">More</span>
                    </button>
                </nav>
            </div>

            {/* Mobile Full Menu Overlay (when "More" is clicked) */}
            {sidebarOpen && (
                <div className="fixed inset-0 z-40 bg-dark-900/95 backdrop-blur-md md:hidden flex flex-col p-6 animate-fade-in-up">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-white">Menu</h2>
                        <button onClick={() => setSidebarOpen(false)} className="p-2 bg-white/10 rounded-full">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        {menuItems.slice(5).map((item) => (
                            <Link
                                key={item.path}
                                href={item.path}
                                onClick={() => setSidebarOpen(false)}
                                className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 active:scale-95 transition-transform"
                            >
                                <div className="w-10 h-10 bg-dark-800 rounded-full flex items-center justify-center text-gray-300">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                                    </svg>
                                </div>
                                <span className="text-xs text-gray-400 font-medium">{item.name}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <main className="flex-1 min-w-0 p-4 pb-24 md:p-8 md:pl-72">
                <div className="md:hidden mb-6 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-white">Nexiplay Admin</h1>
                </div>
                {children}
            </main>
        </div>
    );
}
