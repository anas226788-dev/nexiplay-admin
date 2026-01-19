

'use client';

import { createClient } from '@/lib/supabase';
import { Ad } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdsPage() {
    const [ads, setAds] = useState<Ad[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAds();
    }, []);

    async function fetchAds() {
        const { data, error } = await supabase
            .from('ads')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setAds(data);
        }
        setLoading(false);
    }

    async function deleteAd(id: string) {
        if (!confirm('Are you sure you want to delete this ad? This will remove it from the website immediately.')) return;

        const { error } = await supabase
            .from('ads')
            .delete()
            .eq('id', id);

        if (!error) {
            setAds(ads.filter(ad => ad.id !== id));
        } else {
            alert('Failed to delete ad');
        }
    }

    if (loading) return <div className="p-8 text-white">Loading ads...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold font-outfit text-white">Ad Manager</h1>
                <Link
                    href="/ads/add"
                    className="btn-primary flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Ad
                </Link>
            </div>

            <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 font-semibold text-gray-300 text-sm">Title</th>
                                <th className="px-6 py-4 font-semibold text-gray-300 text-sm">Placement</th>
                                <th className="px-6 py-4 font-semibold text-gray-300 text-sm">Type</th>
                                <th className="px-6 py-4 font-semibold text-gray-300 text-sm">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-300 text-sm text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {ads.map((ad) => (
                                <tr key={ad.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium text-white">{ad.title}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-red-400 font-bold">{ad.placement}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold uppercase text-gray-300">{ad.ad_type}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${ad.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {ad.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                                        {/* <Link
                                            href={`/ads/edit/${ad.id}`}
                                            className="text-gray-400 hover:text-white transition-colors"
                                        >
                                            Edit
                                        </Link> */}
                                        <button
                                            onClick={() => deleteAd(ad.id)}
                                            className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {ads.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        No ads found. Create your first ad campaign.
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
