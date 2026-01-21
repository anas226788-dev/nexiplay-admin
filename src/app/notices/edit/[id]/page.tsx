'use client';

import { useState, useEffect, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function EditNoticePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        content: '',
        type: 'top_bar',
        pages: 'all',
        bg_color: 'bg-red-600',
        text_color: 'text-white',
        is_active: true
    });

    useEffect(() => {
        async function fetchNotice() {
            const { data } = await supabase
                .from('notices')
                .select('*')
                .eq('id', id)
                .single();

            if (data) setFormData(data);
            setLoading(false);
        }
        fetchNotice();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const { error } = await supabase
            .from('notices')
            .update(formData)
            .eq('id', id);

        if (error) {
            alert(error.message);
        } else {
            router.push('/notices');
        }
        setSaving(false);
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-8">Edit Notice</h1>
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

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <label className="text-white">Active</label>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
}
