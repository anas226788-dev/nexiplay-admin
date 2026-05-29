'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DownloadTutorial } from '@/lib/types';

const SOURCE_CONFIG: { key: string; name: string; icon: string; color: string }[] = [
    { key: 'gdrive', name: 'Google Drive', icon: '📁', color: 'from-blue-600 to-blue-700' },
    { key: 'mega', name: 'Mega', icon: '☁️', color: 'from-red-600 to-red-700' },
    { key: 'terabox', name: 'TeraBox', icon: '📦', color: 'from-cyan-500 to-cyan-600' },
    { key: 'mediafire', name: 'MediaFire', icon: '🔥', color: 'from-orange-500 to-orange-600' },
    { key: 'pcloud', name: 'pCloud', icon: '💾', color: 'from-green-500 to-green-600' },
    { key: 'youtube', name: 'YouTube', icon: '▶️', color: 'from-red-500 to-pink-600' },
];

export default function TutorialsPage() {
    const [tutorials, setTutorials] = useState<Record<string, DownloadTutorial>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchTutorials();
    }, []);

    async function fetchTutorials() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('download_tutorials')
                .select('*');

            if (error) throw error;

            const map: Record<string, DownloadTutorial> = {};
            (data || []).forEach((t: DownloadTutorial) => {
                map[t.source_key] = t;
            });
            setTutorials(map);
        } catch (error) {
            console.error('Error fetching tutorials:', error);
            setMessage({ type: 'error', text: 'Failed to load tutorials.' });
        } finally {
            setLoading(false);
        }
    }

    function updateTutorial(sourceKey: string, field: keyof DownloadTutorial, value: string | boolean) {
        setTutorials(prev => ({
            ...prev,
            [sourceKey]: {
                ...prev[sourceKey],
                source_key: sourceKey,
                source_name: SOURCE_CONFIG.find(s => s.key === sourceKey)?.name || sourceKey,
                [field]: value,
            } as DownloadTutorial,
        }));
    }

    async function handleSave() {
        setSaving(true);
        setMessage(null);

        try {
            for (const source of SOURCE_CONFIG) {
                const tutorial = tutorials[source.key];
                const payload = {
                    source_key: source.key,
                    source_name: source.name,
                    tutorial_url: tutorial?.tutorial_url || '',
                    is_active: tutorial?.is_active ?? true,
                    updated_at: new Date().toISOString(),
                };

                if (tutorial?.id) {
                    // Update existing
                    const { error } = await supabase
                        .from('download_tutorials')
                        .update(payload)
                        .eq('id', tutorial.id);
                    if (error) throw error;
                } else {
                    // Insert new
                    const { error } = await supabase
                        .from('download_tutorials')
                        .upsert(payload, { onConflict: 'source_key' });
                    if (error) throw error;
                }
            }

            setMessage({ type: 'success', text: 'Tutorials saved successfully!' });
            // Reload to get fresh IDs
            await fetchTutorials();
        } catch (error) {
            console.error('Error saving tutorials:', error);
            setMessage({ type: 'error', text: 'Failed to save tutorials.' });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg">
                    📖
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Download Tutorials</h1>
                    <p className="text-sm text-gray-400">Set YouTube tutorial URLs for each download source. Users will see a &quot;How To Download?&quot; button next to each provider.</p>
                </div>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Tutorial Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SOURCE_CONFIG.map((source) => {
                    const tutorial = tutorials[source.key];
                    const hasUrl = !!(tutorial?.tutorial_url);
                    const isActive = tutorial?.is_active ?? true;

                    return (
                        <div
                            key={source.key}
                            className={`bg-dark-800 rounded-2xl border overflow-hidden transition-all ${hasUrl && isActive
                                    ? 'border-green-500/20'
                                    : 'border-white/5'
                                }`}
                        >
                            {/* Card Header */}
                            <div className={`p-4 bg-gradient-to-r ${source.color} flex items-center justify-between`}>
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{source.icon}</span>
                                    <span className="text-white font-bold">{source.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasUrl && (
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive
                                                ? 'bg-green-500/20 text-green-300'
                                                : 'bg-gray-500/20 text-gray-300'
                                            }`}>
                                            {isActive ? '✓ Active' : 'Inactive'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1.5">
                                        YouTube Tutorial URL
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://www.youtube.com/watch?v=..."
                                        value={tutorial?.tutorial_url || ''}
                                        onChange={(e) => updateTutorial(source.key, 'tutorial_url', e.target.value)}
                                        className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-white text-sm placeholder-gray-600"
                                    />
                                </div>

                                {/* Active Toggle */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-400">Show button to users</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isActive}
                                            onChange={(e) => updateTutorial(source.key, 'is_active', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* How It Works */}
            <div className="bg-dark-800/50 rounded-2xl border border-white/5 p-5">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">How It Works</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        Paste a YouTube tutorial URL for any download source above.
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        Users will see a small &quot;How to download?&quot; button next to each download provider.
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        Clicking it opens a modal with the YouTube video embedded — no page redirect.
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-red-500 mt-0.5">•</span>
                        If no URL is set or the source is inactive, the button is hidden automatically.
                    </li>
                </ul>
            </div>

            {/* Save Button */}
            <div className="flex justify-end sticky bottom-4 z-10">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-900/30"
                >
                    {saving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save All Tutorials'
                    )}
                </button>
            </div>
        </div>
    );
}
