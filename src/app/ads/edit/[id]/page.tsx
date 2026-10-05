'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Use safe placements that match the DB check constraint
const VALID_PLACEMENTS = [
    { value: 'home_top', label: 'Homepage Top (320x50 / 728x90)' },
    { value: 'home_bottom', label: 'Homepage Bottom (300x250)' },
    { value: 'movie_sidebar', label: 'Movie/Series Sidebar (160x600)' },
    { value: 'download_bottom', label: 'Download Page Bottom' },
    { value: 'episode_list', label: 'Episode List' },
    { value: 'popup_global', label: 'Global Popunder/Popup' },
    { value: 'native_list', label: 'Native Horizontal List' },
    { value: 'social_bar', label: 'Social Bar (Floating)' }
];

export default function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        placement: 'home_top',
        ad_type: 'script',
        script_code: '',
        image_url: '',
        destination_url: '',
        device_target: 'both',
        is_active: true
    });

    useEffect(() => {
        async function fetchAd() {
            try {
                const { data, error } = await supabase
                    .from('ads')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                if (data) {
                    setFormData({
                        ...data,
                        script_code: data.script_code || '',
                        image_url: data.image_url || '',
                        destination_url: data.destination_url || ''
                    });
                }
            } catch (err: any) {
                console.error('Fetch Error:', err);
                setError('Failed to load ad details.');
            } finally {
                setLoading(false);
            }
        }

        fetchAd();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        // Basic Validation
        if (formData.ad_type === 'script' && !formData.script_code.trim()) {
            setError('Script code is required for script ads.');
            setSaving(false);
            return;
        }

        try {
            const { error: updateError } = await supabase
                .from('ads')
                .update({
                    title: formData.title.trim(),
                    placement: formData.placement,
                    ad_type: formData.ad_type,
                    script_code: formData.ad_type === 'script' ? formData.script_code : null,
                    image_url: formData.ad_type === 'image' ? formData.image_url.trim() : null,
                    destination_url: formData.ad_type === 'image' ? formData.destination_url.trim() : null,
                    device_target: formData.device_target,
                    is_active: formData.is_active
                })
                .eq('id', id);

            if (updateError) throw updateError;

            // Success
            router.push('/ads');
            router.refresh();
        } catch (err: any) {
            console.error('Update Error:', err);
            setError(err.message || 'Failed to update ad.');
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/ads" className="text-gray-400 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </Link>
                <h1 className="text-2xl font-bold text-white font-outfit">Edit Ad</h1>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-xl space-y-6">

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-bold">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Ad Title / Name</label>
                    <input
                        type="text"
                        required
                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="e.g. Homepage Top Banner"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Placement</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all"
                            value={formData.placement}
                            onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                        >
                            {VALID_PLACEMENTS.map(p => (
                                <option key={p.value} value={p.value} className="bg-dark-900">{p.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Ad Type</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all"
                            value={formData.ad_type}
                            onChange={(e) => setFormData({ ...formData, ad_type: e.target.value })}
                        >
                            <option value="script" className="bg-dark-900">Script / Code (Adsterra)</option>
                            <option value="image" className="bg-dark-900">Image Banner</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Device Targeting</label>
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { id: 'both', label: 'All Devices', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' },
                            { id: 'desktop', label: 'Desktop Only', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                            { id: 'mobile', label: 'Mobile Only', icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z' }
                        ].map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, device_target: option.id })}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${formData.device_target === option.id
                                        ? 'border-red-600 bg-red-600/10 text-white'
                                        : 'border-white/5 bg-dark-900 text-gray-400 hover:border-white/20'
                                    }`}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                                </svg>
                                <span className="text-xs font-bold">{option.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {formData.ad_type === 'script' ? (
                    <div>
                        <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">
                            Script Code (Paste exactly as provided)
                        </label>
                        <textarea
                            rows={8}
                            required
                            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all placeholder:text-gray-600"
                            value={formData.script_code}
                            onChange={(e) => setFormData({ ...formData, script_code: e.target.value })}
                            placeholder="<script ...> ... </script>"
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Paste the full script code from Adsterra. Do not modify IDs or attributes.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Image URL</label>
                            <input
                                type="url"
                                required
                                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all"
                                value={formData.image_url}
                                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                placeholder="https://example.com/banner.jpg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Destination URL</label>
                            <input
                                type="url"
                                required
                                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all"
                                value={formData.destination_url}
                                onChange={(e) => setFormData({ ...formData, destination_url: e.target.value })}
                                placeholder="https://example.com/click-target"
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 p-4 bg-dark-900/50 border border-white/5 rounded-xl">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-dark-900 peer-focus:outline-none border border-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600 peer-checked:border-red-600"></div>
                        <span className="ml-3 text-sm font-bold text-white uppercase">Active Immediately</span>
                    </label>
                </div>

                <div className="pt-4 flex gap-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Saving...
                            </>
                        ) : 'Save Changes'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-8 py-4 bg-dark-900 hover:bg-white/5 text-gray-400 font-bold rounded-xl border border-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}
