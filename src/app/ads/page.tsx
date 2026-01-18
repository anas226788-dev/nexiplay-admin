

import { createClient } from '@/lib/supabase';
import { Ad } from '@/lib/types';
import Link from 'next/link';

// Note: Ensure supabase is imported correctly or re-created
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getAds(): Promise<Ad[]> {
    const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching ads:', error);
        return [];
    }
    return data || [];
}

export default async function AdsPage() {
    const ads = await getAds();

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">Ad Management</h1>
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

            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 font-semibold text-gray-300">Title</th>
                                <th className="px-6 py-4 font-semibold text-gray-300">Placement</th>
                                <th className="px-6 py-4 font-semibold text-gray-300">Type</th>
                                <th className="px-6 py-4 font-semibold text-gray-300">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-300 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ads.map((ad) => (
                                <tr key={ad.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-medium">{ad.title}</td>
                                    <td className="px-6 py-4 font-mono text-xs text-red-400">{ad.placement}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold uppercase">{ad.ad_type}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${ad.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {ad.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/ads/edit/${ad.id}`}
                                            className="text-gray-400 hover:text-white transition-colors mr-4"
                                        >
                                            Edit
                                        </Link>
                                        {/* Delete functionality to be implemented in a component */}
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
