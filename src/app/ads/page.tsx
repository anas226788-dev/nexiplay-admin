'use client';

import { supabase } from '@/lib/supabase';
import { Ad } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export default function AdsPage() {
    const [mounted, setMounted] = useState(false);

    // Use SWR hook for caching
    const { data: ads = [], isLoading, mutate } = useSupabaseQuery<Ad[]>(
        'ads_list',
        'ads',
        (q) => q.order('created_at', { ascending: false })
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    async function deleteAd(id: string) {
        if (!confirm('Are you sure you want to delete this ad? This action cannot be undone.')) return;

        // Optimistic update
        mutate(ads.filter((ad) => ad.id !== id), false);

        try {
            // Use server-side API route to bypass browser extension blocking
            const res = await fetch(`/api/manage-ads?id=${id}`, { method: 'DELETE' });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Delete failed');

            // Revalidate
            mutate();
        } catch (error: any) {
            console.error('Delete Error:', error);
            alert('Failed to delete ad: ' + error.message);
            // Revert changes on error
            mutate();
        }
    }

    async function toggleAdStatus(id: string, currentStatus: boolean) {
        // Optimistic update
        mutate(ads.map((ad) =>
            ad.id === id ? { ...ad, is_active: !currentStatus } : ad
        ), false);

        try {
            const { error } = await supabase
                .from('ads')
                .update({ is_active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            // Revalidate
            mutate();
        } catch (error: any) {
            console.error('Toggle Error:', error);
            alert('Failed to toggle ad status');
            // Revert
            mutate();
        }
    }

    // Load state
    if (!mounted || isLoading) {
        return (
            <div className="p-8">
                <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-8"></div>
                <div className="bg-dark-800 rounded-xl border border-white/5 p-8">
                    <div className="h-6 w-32 bg-white/5 rounded animate-pulse"></div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold font-outfit text-white">Ad Manager</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage all your ad units and placements</p>
                </div>
                <Link
                    href="/ads/add"
                    className="btn-primary flex items-center gap-2 shadow-lg shadow-red-900/20 hover:shadow-red-900/40 transition-all"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create New Ad
                </Link>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block glass-panel rounded-xl overflow-hidden shadow-xl border border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 font-bold text-gray-400 text-xs uppercase tracking-wider">Title</th>
                                <th className="px-6 py-4 font-bold text-gray-400 text-xs uppercase tracking-wider">Placement</th>
                                <th className="px-6 py-4 font-bold text-gray-400 text-xs uppercase tracking-wider">Type / Device</th>
                                <th className="px-6 py-4 font-bold text-gray-400 text-xs uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 font-bold text-gray-400 text-xs uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {ads.map((ad) => (
                                <tr key={ad.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-white group-hover:text-red-400 transition-colors">
                                        {ad.title}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                                            {ad.placement}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs text-gray-300 font-bold uppercase">{ad.ad_type}</span>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wide">{ad.device_target}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${ad.is_active
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-gray-500/10 text-gray-400 border-white/10'}`}>
                                            {ad.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-100">
                                            <button
                                                onClick={() => toggleAdStatus(ad.id, ad.is_active)}
                                                className={`p-2 rounded-lg transition-colors ${ad.is_active
                                                    ? 'text-yellow-400 hover:bg-yellow-500/10'
                                                    : 'text-green-400 hover:bg-green-500/10'}`}
                                                title={ad.is_active ? 'Disable Ad' : 'Enable Ad'}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {ad.is_active
                                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                    }
                                                </svg>
                                            </button>
                                            <Link
                                                href={`/ads/edit/${ad.id}`}
                                                className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Edit Ad"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </Link>
                                            <button
                                                onClick={() => deleteAd(ad.id)}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Delete Ad"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {ads.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                            <p className="text-lg font-medium">No active ad campaigns</p>
                                            <p className="text-sm mt-1 mb-6">Create your first ad slot to start monetizing</p>
                                            <Link
                                                href="/ads/add"
                                                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors text-sm font-bold border border-white/10"
                                            >
                                                Create Ad
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {ads.length === 0 ? (
                    <div className="glass-panel rounded-xl p-12 text-center text-gray-500">
                        <p>No ads found. Create your first ad campaign.</p>
                        <Link
                            href="/ads/add"
                            className="inline-block mt-4 px-6 py-2 bg-red-600 text-white rounded-lg text-sm font-bold"
                        >
                            Create Ad
                        </Link>
                    </div>
                ) : (
                    ads.map((ad) => (
                        <div key={ad.id} className="glass-panel rounded-xl p-4 space-y-4 border border-white/5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-white text-lg leading-tight">{ad.title}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="font-mono text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                            {ad.placement}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ad.is_active
                                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                            : 'bg-gray-500/10 text-gray-400 border-white/10'}`}>
                                            {ad.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-500 uppercase font-bold block">{ad.device_target}</span>
                                    <span className="text-[10px] text-gray-400 uppercase block mt-1">{ad.ad_type}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                                <button
                                    onClick={() => toggleAdStatus(ad.id, ad.is_active)}
                                    className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all ${ad.is_active
                                        ? 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
                                        : 'text-green-400 bg-green-500/10 border border-green-500/20'}`}
                                >
                                    {ad.is_active ? 'Disable' : 'Enable'}
                                </button>
                                <Link
                                    href={`/ads/edit/${ad.id}`}
                                    className="flex-1 py-3 rounded-lg text-xs font-bold text-center text-blue-400 bg-blue-500/10 border border-blue-500/20"
                                >
                                    Edit
                                </Link>
                                <button
                                    onClick={() => deleteAd(ad.id)}
                                    className="flex-1 py-3 rounded-lg text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/20"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
