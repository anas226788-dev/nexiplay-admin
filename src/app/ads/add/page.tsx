'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddAdPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        placement: 'home_top',
        ad_type: 'script',
        script_code: '',
        image_url: '',
        destination_url: '',
        is_active: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase
            .from('ads')
            .insert([formData]);

        setLoading(false);

        if (error) {
            alert('Error creating ad: ' + error.message);
        } else {
            router.push('/ads');
            router.refresh();
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/ads" className="text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="text-2xl font-bold text-white">Create New Ad</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-dark-800 p-8 rounded-xl border border-white/5 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Ad Title / Name</label>
                    <input
                        type="text"
                        required
                        className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Home Header Banner"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Placement</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                            value={formData.placement}
                            onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                        >
                            <option value="home_top">Homepage Top</option>
                            <option value="home_bottom">Homepage Bottom</option>
                            <option value="movie_sidebar">Movie Sidebar</option>
                            <option value="download_bottom">Download Page Bottom</option>
                            <option value="episode_list">Episode List</option>
                            <option value="popup_global">Global Popunder/Popup</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Ad Type</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                            value={formData.ad_type}
                            onChange={(e) => setFormData({ ...formData, ad_type: e.target.value })}
                        >
                            <option value="script">Script / Code (Adsterra)</option>
                            <option value="image">Image Banner</option>
                        </select>
                    </div>
                </div>

                {formData.ad_type === 'script' ? (
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Script Code</label>
                        <textarea
                            rows={8}
                            required
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-600"
                            value={formData.script_code}
                            onChange={(e) => setFormData({ ...formData, script_code: e.target.value })}
                            placeholder="<script ...> ... </script>"
                        />
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Image URL</label>
                            <input
                                type="url"
                                required
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                                value={formData.image_url}
                                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Destination URL</label>
                            <input
                                type="url"
                                required
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                                value={formData.destination_url}
                                onChange={(e) => setFormData({ ...formData, destination_url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                    </>
                )}

                <div className="flex items-center gap-3 p-4 bg-dark-900 rounded-lg">
                    <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-5 h-5 accent-red-600"
                    />
                    <span className="text-white font-medium">Active</span>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 flex items-center justify-center"
                >
                    {loading ? (
                        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : 'Create Ad'}
                </button>
            </form>
        </div>
    );
}
