'use client';

import { useState, useEffect } from 'react';
import { AppConfig } from '@/lib/types';

interface WebLaunchModalState {
    enabled: boolean;
    version_name: string;
    apk_url: string;
    title: string;
    subtitle: string;
    features: string[];
    download_btn_text: string;
    dismiss_btn_text: string;
    updated_at?: string;
}

const DEFAULT_WEB_MODAL: WebLaunchModalState = {
    enabled: false,
    version_name: '1.0.0',
    apk_url: '',
    title: 'NexiPlay Android is here',
    subtitle: 'Meet the smoother way to watch anywhere.',
    features: [
        'Multi-dub audio support for more language options',
        'High-quality streaming with smoother playback',
        'Built for Android phones and Smart TV screens',
        'Faster browsing with a cleaner viewing experience'
    ],
    download_btn_text: 'Get the Android app',
    dismiss_btn_text: 'Maybe later'
};

export default function AppVersionPage() {
    const [activeTab, setActiveTab] = useState<'app_update' | 'web_launch_modal'>('app_update');
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [webModal, setWebModal] = useState<WebLaunchModalState>(DEFAULT_WEB_MODAL);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchAllConfigs();
    }, []);

    async function fetchAllConfigs() {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/app-config');
            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Failed to fetch configurations');
            }

            if (data.appUpdate) {
                setConfig(data.appUpdate);
            } else {
                setConfig({
                    id: 'app_update',
                    latest_version_code: 1,
                    latest_version_name: '1.0.0',
                    apk_url: '',
                    release_notes: '',
                    force_update: false,
                    min_version_code: 1,
                    updated_at: new Date().toISOString(),
                });
            }

            if (data.webLaunchModal) {
                const w = data.webLaunchModal;
                let parsed: any = null;
                try {
                    parsed = JSON.parse(w.release_notes);
                } catch {
                    // Plain text fallback
                }

                setWebModal({
                    enabled: Boolean(w.force_update),
                    version_name: w.latest_version_name || '1.0.0',
                    apk_url: w.apk_url || '',
                    title: parsed?.title || DEFAULT_WEB_MODAL.title,
                    subtitle: parsed?.subtitle || (typeof w.release_notes === 'string' && !parsed ? w.release_notes : DEFAULT_WEB_MODAL.subtitle),
                    features: Array.isArray(parsed?.features) && parsed.features.length > 0
                        ? parsed.features
                        : DEFAULT_WEB_MODAL.features,
                    download_btn_text: parsed?.download_btn_text || DEFAULT_WEB_MODAL.download_btn_text,
                    dismiss_btn_text: parsed?.dismiss_btn_text || DEFAULT_WEB_MODAL.dismiss_btn_text,
                    updated_at: w.updated_at
                });
            }
        } catch (error: any) {
            console.error('Error fetching app configs:', error);
            setMessage({ type: 'error', text: 'Failed to load app config. Make sure the app_config table exists.' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveAppUpdate(e: React.FormEvent) {
        e.preventDefault();
        if (!config) return;

        setSaving(true);
        setMessage(null);

        try {
            const payload = {
                id: 'app_update',
                latest_version_code: config.latest_version_code,
                latest_version_name: config.latest_version_name,
                apk_url: config.apk_url,
                release_notes: config.release_notes,
                force_update: config.force_update,
                min_version_code: config.min_version_code,
            };

            const res = await fetch('/api/admin/app-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.ok) {
                throw new Error(result.error || 'Failed to save app configuration');
            }

            setMessage({ type: 'success', text: 'In-app update configuration saved successfully!' });
            fetchAllConfigs();
        } catch (error: any) {
            console.error('Error saving app config:', error);
            setMessage({ type: 'error', text: `Failed to save: ${error.message || JSON.stringify(error)}` });
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveWebModal(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const payload = {
                id: 'web_launch_modal',
                force_update: webModal.enabled,
                latest_version_name: webModal.version_name.trim(),
                latest_version_code: 1,
                apk_url: webModal.apk_url.trim(),
                release_notes: {
                    title: webModal.title.trim(),
                    subtitle: webModal.subtitle.trim(),
                    features: webModal.features.filter(f => f.trim().length > 0),
                    download_btn_text: webModal.download_btn_text.trim(),
                    dismiss_btn_text: webModal.dismiss_btn_text.trim(),
                }
            };

            const res = await fetch('/api/admin/app-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok || !result.ok) {
                throw new Error(result.error || 'Failed to save website launch modal');
            }

            setMessage({ type: 'success', text: 'Website App Launch Notice updated successfully!' });
            fetchAllConfigs();
        } catch (error: any) {
            console.error('Error saving web modal config:', error);
            setMessage({ type: 'error', text: `Failed to save: ${error.message || JSON.stringify(error)}` });
        } finally {
            setSaving(false);
        }
    }

    const updateFeature = (index: number, val: string) => {
        const next = [...webModal.features];
        next[index] = val;
        setWebModal({ ...webModal, features: next });
    };

    const addFeature = () => {
        if (webModal.features.length >= 6) return;
        setWebModal({ ...webModal, features: [...webModal.features, ''] });
    };

    const removeFeature = (index: number) => {
        if (webModal.features.length <= 1) return;
        const next = webModal.features.filter((_, i) => i !== index);
        setWebModal({ ...webModal, features: next });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-700 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-violet-500/20">
                            📱
                        </span>
                        App Releases & Announcements
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">
                        Manage Android app in-app update popups and website release announcement modals
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex items-center bg-dark-800 p-1.5 rounded-2xl border border-white/5 shrink-0">
                    <button
                        onClick={() => { setActiveTab('app_update'); setMessage(null); }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'app_update'
                                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <span>📲 In-App Update</span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('web_launch_modal'); setMessage(null); }}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'web_launch_modal'
                                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                                : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        <span>🌐 Website Launch Notice</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Freekz UI
                        </span>
                    </button>
                </div>
            </div>

            {/* Status Message */}
            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-fadeIn ${
                    message.type === 'success'
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {/* TAB 1: In-App Update (Android) */}
            {activeTab === 'app_update' && (
                <div className="space-y-6">
                    {/* Status Overview Cards */}
                    {config && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-dark-800 rounded-2xl p-6 border border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider">Current App Version</p>
                                        <p className="text-xl font-bold text-white">v{config.latest_version_name}</p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">Version Code: {config.latest_version_code}</p>
                            </div>

                            <div className="bg-dark-800 rounded-2xl p-6 border border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.force_update ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                        <svg className={`w-5 h-5 ${config.force_update ? 'text-red-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={config.force_update ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider">Force In-App Update</p>
                                        <p className={`text-xl font-bold ${config.force_update ? 'text-red-400' : 'text-green-400'}`}>
                                            {config.force_update ? 'ACTIVE' : 'OFF'}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {config.force_update ? 'Android users MUST update to proceed' : 'Users can skip the update'}
                                </p>
                            </div>

                            <div className="bg-dark-800 rounded-2xl p-6 border border-white/5">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-400 uppercase tracking-wider">Last Published</p>
                                        <p className="text-sm font-semibold text-white">
                                            {config.updated_at ? new Date(config.updated_at).toLocaleString('en-BD', {
                                                dateStyle: 'medium',
                                                timeStyle: 'short',
                                            }) : 'Never'}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500">Min Version Code: {config.min_version_code}</p>
                            </div>
                        </div>
                    )}

                    {/* App Update Form */}
                    <div className="bg-dark-800 rounded-2xl p-8 border border-white/5">
                        <form onSubmit={handleSaveAppUpdate} className="space-y-6">
                            {config && (
                                <>
                                    <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                            <span className="text-blue-400">🏷️</span> Android Version Numbers
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Version Name</label>
                                                <input
                                                    type="text"
                                                    value={config.latest_version_name}
                                                    onChange={(e) => setConfig({ ...config, latest_version_name: e.target.value })}
                                                    className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">Version Code</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={config.latest_version_code}
                                                    onChange={(e) => setConfig({ ...config, latest_version_code: parseInt(e.target.value) || 1 })}
                                                    className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                            <span className="text-green-400">📦</span> APK Distribution URL
                                        </h3>
                                        <input
                                            type="url"
                                            placeholder="https://... or direct APK URL"
                                            value={config.apk_url}
                                            onChange={(e) => setConfig({ ...config, apk_url: e.target.value })}
                                            className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white"
                                        />
                                    </div>

                                    <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                            <span className="text-yellow-400">📝</span> In-App Release Notes
                                        </h3>
                                        <textarea
                                            value={config.release_notes}
                                            onChange={(e) => setConfig({ ...config, release_notes: e.target.value })}
                                            rows={4}
                                            className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl text-white resize-none"
                                        />
                                    </div>

                                    <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                                <span className="text-red-400">⚠️</span> Force Update
                                            </h3>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Android users must update to this version before entering the app
                                            </p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer ml-6">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={config.force_update}
                                                onChange={(e) => setConfig({ ...config, force_update: e.target.checked })}
                                            />
                                            <div className="w-14 h-7 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-violet-600"></div>
                                        </label>
                                    </div>

                                    <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                        <p className="text-xs text-gray-500">Takes effect in Android app immediately</p>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-600/20"
                                        >
                                            {saving ? 'Publishing...' : '🚀 Publish Android Update'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 2: Website Launch Modal (Freekz.to style) */}
            {activeTab === 'web_launch_modal' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Form (7 cols) */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-dark-800 rounded-2xl p-6 sm:p-8 border border-white/5 space-y-6">
                            <form onSubmit={handleSaveWebModal} className="space-y-6">
                                
                                {/* Master Toggle */}
                                <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-950/40 to-dark-700/60 border border-violet-500/20 flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">🌐</span>
                                            <h3 className="text-base font-bold text-white">
                                                Show Release Modal on Website
                                            </h3>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1 max-w-md">
                                            When enabled, visitors to your website will see the launch modal popup. Visitors who dismiss it won&apos;t see it again for 7 days.
                                        </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={webModal.enabled}
                                            onChange={(e) => setWebModal({ ...webModal, enabled: e.target.checked })}
                                        />
                                        <div className="w-14 h-7 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </label>
                                </div>

                                {/* Header Titles & Version */}
                                <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <span>📝</span> Header & Version
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                                Modal Title
                                            </label>
                                            <input
                                                type="text"
                                                value={webModal.title}
                                                onChange={(e) => setWebModal({ ...webModal, title: e.target.value })}
                                                placeholder="e.g. NexiPlay Android is here"
                                                className="w-full px-4 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm focus:border-violet-500 outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                                Version Name
                                            </label>
                                            <input
                                                type="text"
                                                value={webModal.version_name}
                                                onChange={(e) => setWebModal({ ...webModal, version_name: e.target.value })}
                                                placeholder="1.0.0"
                                                className="w-full px-4 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm font-mono focus:border-violet-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                            Modal Subtitle
                                        </label>
                                        <input
                                            type="text"
                                            value={webModal.subtitle}
                                            onChange={(e) => setWebModal({ ...webModal, subtitle: e.target.value })}
                                            placeholder="e.g. Meet the smoother way to watch anywhere."
                                            className="w-full px-4 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm focus:border-violet-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Feature Bullet Points */}
                                <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                            <span>✨</span> Feature Highlights ({webModal.features.length})
                                        </h3>
                                        {webModal.features.length < 6 && (
                                            <button
                                                type="button"
                                                onClick={addFeature}
                                                className="text-xs text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
                                            >
                                                + Add Point
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2.5">
                                        {webModal.features.map((feat, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-gray-500 w-4 text-center">
                                                    {idx + 1}.
                                                </span>
                                                <input
                                                    type="text"
                                                    value={feat}
                                                    onChange={(e) => updateFeature(idx, e.target.value)}
                                                    placeholder="Feature description"
                                                    className="flex-1 px-3.5 py-2 bg-dark-900 border border-white/10 rounded-xl text-white text-xs sm:text-sm focus:border-violet-500 outline-none"
                                                />
                                                {webModal.features.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFeature(idx)}
                                                        className="w-8 h-8 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
                                                        title="Remove"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Buttons & URL */}
                                <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <span>🔘</span> Buttons & Download Target
                                    </h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                                Download Button Label
                                            </label>
                                            <input
                                                type="text"
                                                value={webModal.download_btn_text}
                                                onChange={(e) => setWebModal({ ...webModal, download_btn_text: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                                Dismiss Button Label
                                            </label>
                                            <input
                                                type="text"
                                                value={webModal.dismiss_btn_text}
                                                onChange={(e) => setWebModal({ ...webModal, dismiss_btn_text: e.target.value })}
                                                className="w-full px-4 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                            APK Download URL (Optional Override)
                                        </label>
                                        <input
                                            type="url"
                                            value={webModal.apk_url}
                                            onChange={(e) => setWebModal({ ...webModal, apk_url: e.target.value })}
                                            placeholder="Leave empty to use default: /api/download/apk"
                                            className="w-full px-4 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-xs sm:text-sm font-mono placeholder-gray-600"
                                        />
                                        <p className="text-[11px] text-gray-500 mt-1">
                                            By default, it automatically streams through <code>/api/download/apk</code> using your Android app release link.
                                        </p>
                                    </div>
                                </div>

                                {/* Save Button */}
                                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                    <p className="text-xs text-gray-500">
                                        Updates the live modal on NexiPlay website immediately
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
                                    >
                                        {saving ? 'Saving...' : '💾 Save & Publish to Website'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Live Visual Preview (5 cols) */}
                    <div className="lg:col-span-5 sticky top-6 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Live Website Preview
                            </span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                webModal.enabled
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                                {webModal.enabled ? 'ACTIVE ON WEB' : 'DISABLED'}
                            </span>
                        </div>

                        {/* Simulated Screen / Modal Card */}
                        <div className="relative rounded-3xl p-6 sm:p-7 bg-[#18191c] border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.85)] text-white overflow-hidden">
                            {/* Top Bar: Tag & Close */}
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold tracking-widest text-neutral-400 uppercase">
                                    NEW RELEASE
                                </span>
                                <div className="w-8 h-8 rounded-full bg-white/10 text-neutral-300 flex items-center justify-center">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </div>
                            </div>

                            {/* Titles */}
                            <div className="mt-3">
                                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
                                    {webModal.title || 'NexiPlay Android is here'}
                                </h2>
                                <p className="text-sm text-neutral-400 mt-1.5 leading-relaxed">
                                    {webModal.subtitle || 'Meet the smoother way to watch anywhere.'}
                                </p>
                            </div>

                            {/* Inset Features Box */}
                            <div className="mt-5 rounded-2xl bg-[#121316] border border-white/5 p-4 sm:p-5 space-y-3.5">
                                <div className="flex items-center justify-between pb-1">
                                    <span className="text-sm font-semibold text-white">
                                        Version {webModal.version_name || '1.0.0'}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300 text-xs font-medium">
                                        Latest
                                    </span>
                                </div>

                                <div className="space-y-3 pt-1">
                                    {webModal.features.filter(f => f.trim().length > 0).map((feat, idx) => (
                                        <div key={idx} className="flex items-start gap-3">
                                            <div className="w-4 h-4 rounded-full border border-neutral-500/80 flex items-center justify-center shrink-0 mt-0.5">
                                                <svg className="w-2.5 h-2.5 text-neutral-300" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="2.5 6 5 8.5 9.5 3.5" />
                                                </svg>
                                            </div>
                                            <span className="text-xs sm:text-sm text-neutral-300 leading-snug">
                                                {feat}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-6 flex items-center gap-3">
                                <div className="flex-1 bg-white text-black font-semibold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm">
                                    <svg className="w-4 h-4 text-black shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    <span>{webModal.download_btn_text || 'Get the Android app'}</span>
                                </div>

                                <div className="px-4 py-3 rounded-xl bg-transparent border border-white/10 text-neutral-300 font-medium text-sm flex items-center justify-center gap-1">
                                    <span>{webModal.dismiss_btn_text || 'Maybe later'}</span>
                                    <span className="text-xs">↗</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-dark-800/80 rounded-2xl border border-white/5 text-xs text-gray-400 space-y-1">
                            <p className="font-semibold text-white">💡 Pro Tip:</p>
                            <p>
                                When you change the <strong>Version Name</strong>, users who previously dismissed the notice will see it again automatically for the new version.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
