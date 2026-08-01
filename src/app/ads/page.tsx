'use client';

import { supabase } from '@/lib/supabase';
import { Ad, AppSettings } from '@/lib/types';
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

    // App Ads SDK Configuration state (Unity LevelPlay & Start.io)
    const [appAdsConfig, setAppAdsConfig] = useState({
        app_ad_network: 'unity' as 'startio' | 'unity' | 'both',
        startio_app_id: '',
        unity_app_key: '',
        unity_banner_id: '',
        unity_interstitial_id: '',
        unity_rewarded_id: '',
        is_banner_enabled: true,
        is_interstitial_enabled: true,
        is_rewarded_enabled: true,
        is_native_enabled: false,
        is_app_open_enabled: false,
        is_premium_server_ad_enabled: true,
        is_test_ads_enabled: true,
    });
    const [appAdsLoading, setAppAdsLoading] = useState(true);
    const [appAdsSaving, setAppAdsSaving] = useState(false);
    const [appAdsMsg, setAppAdsMsg] = useState('');

    useEffect(() => {
        setMounted(true);
        // Load app ads config from app_settings
        (async () => {
            try {
                const { data } = await supabase.from('app_settings').select('*').single();
                if (data) {
                    setAppAdsConfig({
                        app_ad_network: (data.app_ad_network === 'admob' ? 'unity' : data.app_ad_network) || 'unity',
                        startio_app_id: data.startio_app_id || '',
                        unity_app_key: data.unity_app_key || '',
                        unity_banner_id: data.unity_banner_id || '',
                        unity_interstitial_id: data.unity_interstitial_id || '',
                        unity_rewarded_id: data.unity_rewarded_id || '',
                        is_banner_enabled: data.is_banner_enabled ?? true,
                        is_interstitial_enabled: data.is_interstitial_enabled ?? true,
                        is_rewarded_enabled: data.is_rewarded_enabled ?? true,
                        is_native_enabled: data.is_native_enabled ?? false,
                        is_app_open_enabled: data.is_app_open_enabled ?? false,
                        is_premium_server_ad_enabled: data.is_premium_server_ad_enabled ?? true,
                        is_test_ads_enabled: data.is_test_ads_enabled ?? true,
                    });
                }
            } catch (err) {
                console.error('Failed to load app ads config:', err);
            } finally {
                setAppAdsLoading(false);
            }
        })();
    }, []);

    async function saveAppAdsConfig() {
        setAppAdsSaving(true);
        setAppAdsMsg('');
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({
                    app_ad_network: appAdsConfig.app_ad_network,
                    startio_app_id: appAdsConfig.startio_app_id,
                    unity_app_key: appAdsConfig.unity_app_key,
                    unity_banner_id: appAdsConfig.unity_banner_id,
                    unity_interstitial_id: appAdsConfig.unity_interstitial_id,
                    unity_rewarded_id: appAdsConfig.unity_rewarded_id,
                    is_banner_enabled: appAdsConfig.is_banner_enabled,
                    is_interstitial_enabled: appAdsConfig.is_interstitial_enabled,
                    is_rewarded_enabled: appAdsConfig.is_rewarded_enabled,
                    is_native_enabled: appAdsConfig.is_native_enabled,
                    is_app_open_enabled: appAdsConfig.is_app_open_enabled,
                    is_premium_server_ad_enabled: appAdsConfig.is_premium_server_ad_enabled,
                    is_test_ads_enabled: appAdsConfig.is_test_ads_enabled,
                })
                .eq('id', 1);
            if (error) throw error;
            setAppAdsMsg('App Ads configuration saved successfully!');
            setTimeout(() => setAppAdsMsg(''), 3000);
        } catch (err: any) {
            setAppAdsMsg('Error: ' + (err.message || 'Failed to save'));
        } finally {
            setAppAdsSaving(false);
        }
    }

    async function deleteAd(id: string) {
        if (!confirm('Are you sure you want to delete this ad? This action cannot be undone.')) return;

        mutate(ads.filter((ad) => ad.id !== id), false);

        try {
            const res = await fetch(`/api/manage-ads?id=${id}`, { method: 'DELETE' });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || 'Delete failed');
            mutate();
        } catch (error: any) {
            alert('Failed to delete: ' + error.message);
            mutate();
        }
    }

    async function toggleAdStatus(id: string, currentStatus: boolean) {
        mutate(
            ads.map((ad) => (ad.id === id ? { ...ad, is_active: !currentStatus } : ad)),
            false
        );

        try {
            const res = await fetch('/api/manage-ads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentStatus }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Update failed');
            mutate();
        } catch (error: any) {
            alert('Failed to update status: ' + error.message);
            mutate();
        }
    }

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

    const networkOptions = [
        { id: 'unity', label: 'Unity LevelPlay', icon: '🎮', desc: 'Unity LevelPlay Mediation ads (Primary)' },
        { id: 'startio', label: 'Start.io Only', icon: '🟣', desc: 'Start.io ads only' },
        { id: 'both', label: 'All (Waterfall)', icon: '⚡', desc: 'Unity LevelPlay -> Start.io fallback' },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* ══ App Ads SDK Configuration ══ */}
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-lg shadow-lg">📱</div>
                        <div>
                            <h2 className="text-lg font-bold text-white font-outfit">App Ads Configuration</h2>
                            <p className="text-xs text-gray-400">Control in-app Ad SDK settings (Unity LevelPlay & Start.io)</p>
                        </div>
                    </div>
                    <button
                        onClick={saveAppAdsConfig}
                        disabled={appAdsSaving || appAdsLoading}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg"
                    >
                        {appAdsSaving ? 'Saving...' : 'Save Config'}
                    </button>
                </div>

                {appAdsMsg && (
                    <div className={`text-sm font-bold mb-4 px-4 py-3 rounded-xl border ${appAdsMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                        {appAdsMsg}
                    </div>
                )}

                {appAdsLoading ? (
                    <div className="p-8 text-center text-gray-400">Loading configuration...</div>
                ) : (
                    <div className="space-y-6">
                        {/* Network Selection */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Active Ad Network</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {networkOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        onClick={() => setAppAdsConfig({ ...appAdsConfig, app_ad_network: opt.id as any })}
                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                            appAdsConfig.app_ad_network === opt.id
                                                ? 'border-purple-500 bg-purple-500/10 shadow-lg'
                                                : 'border-white/10 bg-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xl">{opt.icon}</span>
                                            <span className="font-bold text-white text-sm">{opt.label}</span>
                                        </div>
                                        <p className="text-[11px] text-gray-400">{opt.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Unity LevelPlay Configuration Section */}
                        <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 space-y-4">
                            <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                                🎮 Unity LevelPlay (ironSource) Configuration
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Unity LevelPlay App Key</label>
                                    <input
                                        type="text"
                                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 font-mono"
                                        placeholder="e.g. 800107394"
                                        value={appAdsConfig.unity_app_key}
                                        onChange={(e) => setAppAdsConfig({ ...appAdsConfig, unity_app_key: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Unity Banner Placement / ID</label>
                                    <input
                                        type="text"
                                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 font-mono"
                                        placeholder="e.g. Banner_Android"
                                        value={appAdsConfig.unity_banner_id}
                                        onChange={(e) => setAppAdsConfig({ ...appAdsConfig, unity_banner_id: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Unity Interstitial Placement / ID</label>
                                    <input
                                        type="text"
                                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 font-mono"
                                        placeholder="e.g. Interstitial_Android"
                                        value={appAdsConfig.unity_interstitial_id}
                                        onChange={(e) => setAppAdsConfig({ ...appAdsConfig, unity_interstitial_id: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Unity Rewarded Placement / ID</label>
                                    <input
                                        type="text"
                                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 font-mono"
                                        placeholder="e.g. Rewarded_Android"
                                        value={appAdsConfig.unity_rewarded_id}
                                        onChange={(e) => setAppAdsConfig({ ...appAdsConfig, unity_rewarded_id: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Start.io ID Field */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Start.io App ID</label>
                            <input
                                type="text"
                                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all placeholder:text-gray-600 font-mono"
                                placeholder="Enter your Start.io App ID"
                                value={appAdsConfig.startio_app_id}
                                onChange={(e) => setAppAdsConfig({ ...appAdsConfig, startio_app_id: e.target.value })}
                            />
                        </div>

                        {/* Master Ad Type Toggles */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">Master Ad Toggles (Applies to all networks)</label>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { key: 'is_app_open_enabled', label: 'App Open (Splash)' },
                                    { key: 'is_interstitial_enabled', label: 'Interstitial' },
                                    { key: 'is_rewarded_enabled', label: 'Rewarded Video' },
                                    { key: 'is_banner_enabled', label: 'Banner' },
                                    { key: 'is_native_enabled', label: 'Native' },
                                    { key: 'is_premium_server_ad_enabled', label: 'Premium Server Ad' },
                                    { key: 'is_test_ads_enabled', label: 'Test Ads Mode' },
                                ].map(toggle => (
                                    <button
                                        key={toggle.key}
                                        type="button"
                                        onClick={() => setAppAdsConfig({ ...appAdsConfig, [toggle.key]: !(appAdsConfig as any)[toggle.key] })}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                                            (appAdsConfig as any)[toggle.key]
                                                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                                                : 'border-white/10 bg-white/5 text-gray-400'
                                        }`}
                                    >
                                        {(appAdsConfig as any)[toggle.key] ? '✓ ' : '✗ '}{toggle.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ══ Custom Web Banners / Ads List Section ══ */}
            <div className="glass-panel rounded-2xl border border-white/10 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-lg font-bold text-white font-outfit">Web Banner / Custom Ads List</h2>
                        <p className="text-xs text-gray-400">Custom banner ads displayed in web/app sections</p>
                    </div>
                    <Link
                        href="/ads/new"
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                    >
                        + Create Custom Ad
                    </Link>
                </div>

                {ads.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 bg-white/5 rounded-xl border border-dashed border-white/10">
                        No custom ads found. Click "+ Create Custom Ad" to add one.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-black/40 text-xs uppercase text-gray-400 font-semibold">
                                    <th className="py-3 px-4">Title</th>
                                    <th className="py-3 px-4">Placement</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4">Device</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-sm">
                                {ads.map((ad) => (
                                    <tr key={ad.id} className="hover:bg-white/5 transition-colors">
                                        <td className="py-3.5 px-4 font-medium text-white">{ad.title}</td>
                                        <td className="py-3.5 px-4 text-gray-300 font-mono text-xs">{ad.placement}</td>
                                        <td className="py-3.5 px-4 text-gray-300 uppercase text-xs font-bold">{ad.ad_type}</td>
                                        <td className="py-3.5 px-4 text-gray-300 capitalize text-xs">{ad.device_target}</td>
                                        <td className="py-3.5 px-4">
                                            <button
                                                onClick={() => toggleAdStatus(ad.id, ad.is_active)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                    ad.is_active
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                                                }`}
                                            >
                                                {ad.is_active ? 'ACTIVE' : 'INACTIVE'}
                                            </button>
                                        </td>
                                        <td className="py-3.5 px-4 text-right space-x-2">
                                            <Link
                                                href={`/ads/edit/${ad.id}`}
                                                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition"
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                onClick={() => deleteAd(ad.id)}
                                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs rounded-lg transition"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
