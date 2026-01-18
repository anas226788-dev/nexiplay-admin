'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function DeadLinksPage() {
    const [activeTab, setActiveTab] = useState<'movies' | 'episodes'>('movies');
    const [loading, setLoading] = useState(true);
    const [deadLinks, setDeadLinks] = useState<any[]>([]);

    useEffect(() => {
        fetchDeadLinks();
    }, [activeTab]);

    const fetchDeadLinks = async () => {
        setLoading(true);
        try {
            if (activeTab === 'movies') {
                const { data, error } = await supabase
                    .from('download_links')
                    .select('*, movies(title)')
                    .order('last_checked_at', { ascending: false });

                if (error) {
                    console.error('Supabase Error (Movies):', error);
                    throw error;
                }

                const filtered = (data || []).filter((item: any) =>
                    item.link_status && JSON.stringify(item.link_status).includes('EXPIRED')
                );
                setDeadLinks(filtered);
            } else {
                const { data, error } = await supabase
                    .from('episode_download_links')
                    .select('*, episodes(episode_number, seasons(season_number, movies(title)))')
                    .order('last_checked_at', { ascending: false });

                if (error) {
                    console.error('Supabase Error (Episodes):', error);
                    throw error;
                }

                // Filter and flatten
                const filtered = (data || [])
                    .filter((item: any) => item.link_status && JSON.stringify(item.link_status).includes('EXPIRED'))
                    .map((item: any) => ({
                        ...item,
                        title: item.episodes?.seasons?.movies?.title,
                        season: item.episodes?.seasons?.season_number,
                        episode: item.episodes?.episode_number
                    }));

                setDeadLinks(filtered);
            }
        } catch (err) {
            console.error('FULL Error Details:', err);
        } finally {
            setLoading(false);
        }
    };

    const getExpiredProviders = (status: any) => {
        if (!status) return [];
        return Object.entries(status)
            .filter(([_, val]) => val === 'EXPIRED')
            .map(([key]) => key.replace('_link', ''));
    };

    const markActive = async (id: string, providerKey: string, currentStatus: any) => {
        if (!confirm(`Mark ${providerKey} as ACTIVE manually?`)) return;

        const newStatus = { ...currentStatus, [providerKey]: 'ACTIVE' };

        const table = activeTab === 'movies' ? 'download_links' : 'episode_download_links';
        const { error } = await supabase.from(table).update({ link_status: newStatus }).eq('id', id);

        if (!error) fetchDeadLinks();
    };

    // Helper to format date
    const formatDate = (date: string) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
    };


    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Dead Links Report 💀</h1>
                    <p className="text-gray-400">Automatically detected broken download links</p>
                </div>
                <div className="flex bg-dark-800 p-1 rounded-lg border border-white/10">
                    <button
                        onClick={() => setActiveTab('movies')}
                        className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'movies' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Movies ({activeTab === 'movies' ? deadLinks.length : '...'})
                    </button>
                    <button
                        onClick={() => setActiveTab('episodes')}
                        className={`px-4 py-2 rounded-md font-medium transition-all ${activeTab === 'episodes' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Episodes ({activeTab === 'episodes' ? deadLinks.length : '...'})
                    </button>
                </div>
            </header>

            {/* List */}
            <div className="bg-dark-800 rounded-2xl border border-white/5 overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Scanning database...</div>
                ) : deadLinks.length === 0 ? (
                    <div className="p-12 text-center flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center text-3xl">✅</div>
                        <div>
                            <h3 className="text-xl font-bold text-white">All Links Healthy!</h3>
                            <p className="text-gray-400">No expired links detected in the last scan.</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/5 text-gray-400 text-sm">
                                    <th className="p-4">Content</th>
                                    <th className="p-4">Details</th>
                                    <th className="p-4">Broken Provider</th>
                                    <th className="p-4">Last Checked</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {deadLinks.map((item) => {
                                    const expired = getExpiredProviders(item.link_status);
                                    return expired.map((prov) => (
                                        <tr key={`${item.id}-${prov}`} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-white">
                                                    {activeTab === 'movies'
                                                        ? item.movies?.title
                                                        : item.title || 'Unknown Series'
                                                    }
                                                </div>
                                                <div className="text-xs text-gray-500 uppercase tracking-wider">
                                                    {activeTab === 'episodes' && `S${item.season} E${item.episode}`}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="bg-dark-600 px-2 py-1 rounded text-xs font-mono text-gray-300">
                                                    {item.resolution}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="flex items-center gap-2 text-red-400 font-bold uppercase text-sm">
                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                                    {prov}
                                                </span>
                                                <a href={item[prov + '_link']} target="_blank" className="text-xs text-gray-500 hover:text-white underline mt-1 block max-w-[150px] truncate">
                                                    {item[prov + '_link']}
                                                </a>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400">
                                                {formatDate(item.last_checked_at)}
                                            </td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => markActive(item.id, prov + '_link', item.link_status)}
                                                    className="px-3 py-1 bg-green-600/20 text-green-400 text-xs font-bold rounded hover:bg-green-600/30 transition-colors"
                                                >
                                                    Mark Active
                                                </button>
                                                {/* Edit would imply navigating to the content editor */}
                                                <span className="text-xs text-gray-600">(Edit in Content)</span>
                                            </td>
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
