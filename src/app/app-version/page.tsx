'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppConfig } from '@/lib/types';

export default function AppVersionPage() {
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    async function fetchConfig() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_config')
                .select('*')
                .eq('id', 'app_update')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                setConfig(data);
            } else {
                // Set defaults if no row exists
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
        } catch (error) {
            console.error('Error fetching app config:', error);
            setMessage({ type: 'error', text: 'Failed to load app config. Make sure the app_config table exists.' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!config) return;

        setSaving(true);
        setMessage(null);

        try {
            const payload = {
                latest_version_code: config.latest_version_code,
                latest_version_name: config.latest_version_name,
                apk_url: config.apk_url,
                release_notes: config.release_notes,
                force_update: config.force_update,
                min_version_code: config.min_version_code,
                updated_at: new Date().toISOString(),
            };

            // Try update first
            const { data: existing } = await supabase
                .from('app_config')
                .select('id')
                .eq('id', 'app_update')
                .single();

            if (existing) {
                const { error } = await supabase
                    .from('app_config')
                    .update(payload)
                    .eq('id', 'app_update');
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('app_config')
                    .insert({ id: 'app_update', ...payload });
                if (error) throw error;
            }

            setMessage({ type: 'success', text: 'App version config updated successfully!' });
            fetchConfig();
        } catch (error: any) {
            console.error('Error saving app config:', error);
            setMessage({ type: 'error', text: `Failed to save: ${error.message || JSON.stringify(error)}` });
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
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-lg">
                            📱
                        </span>
                        App Version Control
                    </h1>
                    <p className="text-gray-400 mt-1 text-sm">Manage Android app updates • Users will be prompted to download new APK versions</p>
                </div>
            </div>

            {/* Current Status Card */}
            {config && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* Current Version */}
                    <div className="bg-dark-800 rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Current Version</p>
                                <p className="text-xl font-bold text-white">v{config.latest_version_name}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Version Code: {config.latest_version_code}</p>
                    </div>

                    {/* Force Update Status */}
                    <div className="bg-dark-800 rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.force_update ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                <svg className={`w-5 h-5 ${config.force_update ? 'text-red-400' : 'text-green-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={config.force_update ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"} />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Force Update</p>
                                <p className={`text-xl font-bold ${config.force_update ? 'text-red-400' : 'text-green-400'}`}>
                                    {config.force_update ? 'ACTIVE' : 'OFF'}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            {config.force_update ? 'Users MUST update to continue' : 'Users can skip the update'}
                        </p>
                    </div>

                    {/* Last Updated */}
                    <div className="bg-dark-800 rounded-2xl p-6 border border-white/5">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Last Updated</p>
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

            {/* Main Form */}
            <div className="bg-dark-800 rounded-2xl p-8 border border-white/5">
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Status Message */}
                    {message && (
                        <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${
                            message.type === 'success'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                            {message.type === 'success' ? '✅' : '❌'} {message.text}
                        </div>
                    )}

                    {config && (
                        <>
                            {/* Version Info Section */}
                            <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                    <span className="text-blue-400">🏷️</span> Version Information
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Version Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 2.1.0"
                                            value={config.latest_version_name}
                                            onChange={(e) => setConfig({ ...config, latest_version_name: e.target.value })}
                                            className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-gray-600 text-lg font-mono"
                                        />
                                        <p className="mt-1.5 text-xs text-gray-500">Display version shown to users (e.g. 1.0.0, 2.1.3)</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Version Code
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={config.latest_version_code}
                                            onChange={(e) => setConfig({ ...config, latest_version_code: parseInt(e.target.value) || 1 })}
                                            className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white text-lg font-mono"
                                        />
                                        <p className="mt-1.5 text-xs text-gray-500">
                                            Integer that must be higher than the app&apos;s current <code className="text-blue-400/70">versionCode</code> in build.gradle
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Minimum Supported Version Code
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={config.min_version_code}
                                        onChange={(e) => setConfig({ ...config, min_version_code: parseInt(e.target.value) || 1 })}
                                        className="w-32 px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white font-mono"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">Versions below this will be considered outdated (for future use)</p>
                                </div>
                            </div>

                            {/* APK Download URL */}
                            <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                    <span className="text-green-400">📦</span> APK Distribution
                                </h3>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        APK Download URL
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://drive.google.com/uc?export=download&id=... or any direct APK link"
                                        value={config.apk_url}
                                        onChange={(e) => setConfig({ ...config, apk_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-white placeholder-gray-600"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Direct download URL for the APK file. Supports Google Drive, MediaFire, Dropbox direct links, or any URL that serves the .apk file.
                                    </p>
                                </div>

                                {config.apk_url && (
                                    <div className="flex items-center gap-2 p-3 bg-green-500/5 rounded-lg border border-green-500/10">
                                        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        <a href={config.apk_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-400 hover:text-green-300 truncate transition-colors">
                                            {config.apk_url}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Release Notes */}
                            <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                    <span className="text-yellow-400">📝</span> Release Notes
                                </h3>

                                <textarea
                                    placeholder={"• Bug fixes and improvements\n• New streaming player\n• Performance optimization"}
                                    value={config.release_notes}
                                    onChange={(e) => setConfig({ ...config, release_notes: e.target.value })}
                                    rows={5}
                                    className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500 transition-all text-white placeholder-gray-600 resize-none"
                                />
                                <p className="text-xs text-gray-500">
                                    These notes will be shown in the update popup on users&apos; devices. Write what&apos;s new in this version.
                                </p>
                            </div>

                            {/* Force Update Toggle */}
                            <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                            <span className="text-red-400">⚠️</span> Force Update
                                        </h3>
                                        <p className="text-sm text-gray-400 mt-1">
                                            When enabled, users <strong className="text-red-400">cannot</strong> dismiss the update dialog.
                                            They must update to continue using the app.
                                        </p>
                                        {config.force_update && (
                                            <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                                                <p className="text-xs text-red-400 font-medium">
                                                    ⚠️ Force update is ACTIVE — All users with an older version will be blocked until they update.
                                                    Make sure the APK URL is valid and working!
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer ml-6">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={config.force_update}
                                            onChange={(e) => setConfig({ ...config, force_update: e.target.checked })}
                                        />
                                        <div className="w-14 h-7 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                                    </label>
                                </div>
                            </div>

                            {/* How it works info */}
                            <div className="p-6 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-xl border border-blue-500/10">
                                <h3 className="text-sm font-bold text-blue-400 mb-3">💡 How It Works</h3>
                                <div className="space-y-2 text-xs text-gray-400">
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold mt-0.5">1.</span>
                                        <p>Set a <strong className="text-white">Version Code</strong> higher than the current app&apos;s <code className="text-blue-400/70">versionCode</code> in <code className="text-blue-400/70">build.gradle.kts</code> (currently <code className="text-blue-400/70">1</code>).</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold mt-0.5">2.</span>
                                        <p>Upload the new APK to Google Drive, MediaFire, or any file hosting and paste the <strong className="text-white">direct download URL</strong>.</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold mt-0.5">3.</span>
                                        <p>When a user opens the app, it checks this config. If their <code className="text-blue-400/70">versionCode</code> is lower, an update popup appears automatically.</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-400 font-bold mt-0.5">4.</span>
                                        <p>The user taps &quot;Update&quot;, the APK downloads within the app, and the Android installer launches automatically.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                <p className="text-xs text-gray-500">
                                    Changes take effect immediately for all app users
                                </p>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-red-500/10"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Publishing...
                                        </>
                                    ) : (
                                        <>
                                            🚀 Publish Update
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
