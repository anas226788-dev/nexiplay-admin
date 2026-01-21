'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddNoticePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        content: '',
        type: 'top_bar',
        pages: 'all',
        bg_color: 'bg-red-600',
        text_color: 'text-white',
        is_active: true
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase
            .from('notices')
            .insert([formData]);

        if (error) {
            alert(error.message);
        } else {
            router.push('/notices');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-8">Create Notice</h1>
            <form onSubmit={handleSubmit} className="bg-dark-800 p-8 rounded-xl border border-white/5 space-y-6">
                <div>
                    <label className="block text-gray-400 mb-2">Message Content (HTML Supported)</label>
                    <textarea
                        required
                        className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                        rows={4}
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-400 mb-2">Type</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="top_bar">Top Bar</option>
                            <option value="popup">Popup Modal</option>
                            <option value="inline">Inline (In Page)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2">Show On</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                            value={formData.pages}
                            onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        >
                            <option value="all">All Pages</option>
                            <option value="home">Homepage Only</option>
                            <option value="movie">Movie/Episode Pages</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-400 mb-2">Background Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                className="h-11 w-12 bg-dark-900 border border-white/10 rounded-lg p-1 cursor-pointer"
                                value={formData.bg_color.startsWith('#') ? formData.bg_color : '#ff0000'}
                                onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                            />
                            <input
                                type="text"
                                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                                value={formData.bg_color}
                                onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                                placeholder="#RRGGBB or bg-red-600"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2">Text Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                className="h-11 w-12 bg-dark-900 border border-white/10 rounded-lg p-1 cursor-pointer"
                                value={formData.text_color.startsWith('#') ? formData.text_color : '#ffffff'}
                                onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                            />
                            <input
                                type="text"
                                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                                value={formData.text_color}
                                onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                                placeholder="#RRGGBB or text-white"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
                >
                    {loading ? 'Creating...' : 'Create Notice'}
                </button>
            </form>
        </div>
    );
}
