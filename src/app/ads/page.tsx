'use client';

import { Ad } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery';

export default function AdsPage() {
    const [mounted, setMounted] = useState(false);
    const [sdkExpanded, setSdkExpanded] = useState(true);

    // Use SWR hook for caching
    const { data: ads = [], isLoading, mutate } = useSupabaseQuery<Ad[]>(
        'ads_list',
        'ads',
        (q) => q.order('created_at', { ascending: false })
    );

    // App Ads SDK & Adsterra Direct Link Configuration state
    const [appAdsConfig, setAppAdsConfig] = useState({
        app_ad_network: 'startio' as 'startio' | 'unity' | 'both',
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
        is_test_ads_enabled: false,
        is_ads_enabled: true,
        direct_link_url: '',
        is_download_verification_enabled: false,
        download_ad_url_1: '',
    });
    const [appAdsLoading, setAppAdsLoading] = useState(true);
    const [appAdsSaving, setAppAdsSaving] = useState(false);
    const [appAdsMsg, setAppAdsMsg] = useState('');

    useEffect(() => {
        setMounted(true);
        // Load app ads config via admin API (uses server-side service_role key)
        (async () => {
            try {
                const res = await fetch('/api/admin/ads-config', { cache: 'no-store' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.error || 'Failed to load config');
                const data = result.settings;
                if (data) {
                    setAppAdsConfig({
                        app_ad_network: (data.app_ad_network === 'admob' ? 'startio' : data.app_ad_network) || 'startio',
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
                        is_test_ads_enabled: data.is_test_ads_enabled ?? false,
                        is_ads_enabled: data.is_ads_enabled ?? true,
                        direct_link_url: data.direct_link_url || '',
                        is_download_verification_enabled: data.is_download_verification_enabled ?? false,
                        download_ad_url_1: data.download_ad_url_1 || '',
                    });
                }
            } catch (err: any) {
                console.error('Failed to load app ads config:', err);
                setAppAdsMsg('Error: ' + (err.message || 'Failed to load config'));
            } finally {
                setAppAdsLoading(false);
            }
        })();
    }, []);

    async function saveAppAdsConfig() {
        setAppAdsSaving(true);
        setAppAdsMsg('');
        try {
            const res = await fetch('/api/admin/ads-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(appAdsConfig),
            });
            const result = await res.json();
            if (!res.ok || !result.ok) {
                throw new Error(result.error || 'Failed to save config to database');
            }
            const saved = result.settings;
            if (saved) {
                setAppAdsConfig({
                    app_ad_network: (saved.app_ad_network === 'admob' ? 'startio' : saved.app_ad_network) || 'startio',
                    startio_app_id: saved.startio_app_id || '',
                    unity_app_key: saved.unity_app_key || '',
                    unity_banner_id: saved.unity_banner_id || '',
                    unity_interstitial_id: saved.unity_interstitial_id || '',
                    unity_rewarded_id: saved.unity_rewarded_id || '',
                    is_banner_enabled: saved.is_banner_enabled ?? true,
                    is_interstitial_enabled: saved.is_interstitial_enabled ?? true,
                    is_rewarded_enabled: saved.is_rewarded_enabled ?? true,
                    is_native_enabled: saved.is_native_enabled ?? false,
                    is_app_open_enabled: saved.is_app_open_enabled ?? false,
                    is_premium_server_ad_enabled: saved.is_premium_server_ad_enabled ?? true,
                    is_test_ads_enabled: saved.is_test_ads_enabled ?? false,
                    is_ads_enabled: saved.is_ads_enabled ?? true,
                    direct_link_url: saved.direct_link_url || '',
                    is_download_verification_enabled: saved.is_download_verification_enabled ?? false,
                    download_ad_url_1: saved.download_ad_url_1 || '',
                });
            }
            setAppAdsMsg('App Ads configuration saved to database!');
            setTimeout(() => setAppAdsMsg(''), 4000);
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
        { id: 'startio', label: 'Start.io (Recommended)', icon: '🟣', desc: 'Best fill & eCPM for BD & APK', color: 'from-purple-600 to-violet-600' },
        { id: 'both', label: 'Start.io + Unity', icon: '⚡', desc: 'Start.io → Unity waterfall', color: 'from-amber-500 to-orange-600' },
        { id: 'unity', label: 'Unity LevelPlay', icon: '🎮', desc: 'Unity LevelPlay Mediation only', color: 'from-indigo-600 to-blue-600' },
    ];

    const adToggles = [
        { key: 'is_app_open_enabled', label: 'App Open', icon: '🚀', desc: 'Splash screen ad' },
        { key: 'is_interstitial_enabled', label: 'Interstitial', icon: '📺', desc: 'Full-screen between actions' },
        { key: 'is_rewarded_enabled', label: 'Rewarded', icon: '🎁', desc: 'Watch ad for coins' },
        { key: 'is_banner_enabled', label: 'Banner', icon: '🏷️', desc: 'Bottom sticky banner' },
        { key: 'is_native_enabled', label: 'Native', icon: '📰', desc: 'In-feed native ads' },
        { key: 'is_premium_server_ad_enabled', label: 'Premium Server Gate', icon: '🔒', desc: 'Ad before premium server' },
        { key: 'is_test_ads_enabled', label: 'Test Mode', icon: '🧪', desc: 'Show test ads only' },
    ];

    const activeAdCount = ads.filter(a => a.is_active).length;
    const enabledTogglesCount = adToggles.filter(t => (appAdsConfig as any)[t.key]).length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* ══ Page Header with Stats ══ */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white font-outfit flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-lg shadow-lg shadow-purple-900/30">📢</span>
                        Ads Control Center
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">Manage in-app SDK ads and custom web banners</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Quick Stats */}
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-xs text-gray-400">Network:</span>
                        <span className="text-xs font-bold text-white capitalize">{appAdsConfig.app_ad_network === 'both' ? 'Waterfall' : appAdsConfig.app_ad_network === 'unity' ? 'Unity LP' : 'Start.io'}</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-bold text-emerald-400">{enabledTogglesCount}/{adToggles.length} Active</span>
                    </div>
                </div>
            </div>

            {/* ══ App Ads SDK Configuration ══ */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(88,28,135,0.08), rgba(15,15,25,0.95))' }}>
                {/* Collapsible Header (no nested <button> inside <button>) */}
                <div className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors">
                    <button
                        type="button"
                        onClick={() => setSdkExpanded(!sdkExpanded)}
                        className="flex-1 flex items-center gap-3 text-left cursor-pointer"
                    >
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-lg shadow-lg shadow-purple-900/30">📱</div>
                        <div className="text-left">
                            <h2 className="text-base font-bold text-white font-outfit">In-App Ad SDK Configuration</h2>
                            <p className="text-xs text-gray-500">Unity LevelPlay & Start.io network settings</p>
                        </div>
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => saveAppAdsConfig()}
                            disabled={appAdsSaving || appAdsLoading}
                            className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-purple-900/20 cursor-pointer"
                        >
                            {appAdsSaving ? '⏳ Saving...' : '💾 Save Config'}
                        </button>
                        <button
                            type="button"
                            aria-label="Toggle SDK configuration"
                            onClick={() => setSdkExpanded(!sdkExpanded)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${sdkExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {appAdsMsg && (
                    <div className={`mx-5 mb-3 text-sm font-bold px-4 py-3 rounded-xl border ${appAdsMsg.startsWith('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                        {appAdsMsg.startsWith('Error') ? '❌' : '✅'} {appAdsMsg}
                    </div>
                )}

                {/* Collapsible Content */}
                <div className={`transition-all duration-300 overflow-hidden ${sdkExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    {appAdsLoading ? (
                        <div className="p-8 text-center text-gray-400">Loading configuration...</div>
                    ) : (
                        <div className="px-5 pb-5 space-y-5">
                            {/* ── Network Selection Cards ── */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-widest">Active Ad Network</label>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {networkOptions.map(opt => {
                                        const isSelected = appAdsConfig.app_ad_network === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setAppAdsConfig({ ...appAdsConfig, app_ad_network: opt.id as any })}
                                                className={`relative p-4 rounded-xl border-2 transition-all text-left group ${
                                                    isSelected
                                                        ? `border-transparent bg-gradient-to-br ${opt.color} shadow-lg`
                                                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                                                }`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xl">{opt.icon}</span>
                                                    <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-200'}`}>{opt.label}</span>
                                                </div>
                                                <p className={`text-[11px] ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>{opt.desc}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ── SDK Keys ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Unity LevelPlay Section */}
                                <div className="p-4 rounded-xl border border-indigo-500/15 bg-indigo-950/15 space-y-3">
                                    <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-2 uppercase tracking-wider">
                                        🎮 Unity LevelPlay (ironSource)
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'unity_app_key', label: 'App Key', placeholder: 'e.g. 800107394' },
                                            { key: 'unity_banner_id', label: 'Banner ID', placeholder: 'e.g. Banner_Android' },
                                            { key: 'unity_interstitial_id', label: 'Interstitial ID', placeholder: 'e.g. Interstitial_Android' },
                                            { key: 'unity_rewarded_id', label: 'Rewarded ID', placeholder: 'e.g. Rewarded_Android' },
                                        ].map(field => (
                                            <div key={field.key}>
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">{field.label}</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 font-mono transition-colors"
                                                    placeholder={field.placeholder}
                                                    value={(appAdsConfig as any)[field.key]}
                                                    onChange={(e) => setAppAdsConfig({ ...appAdsConfig, [field.key]: e.target.value })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Start.io Section */}
                                <div className="p-4 rounded-xl border border-purple-500/15 bg-purple-950/15 space-y-3">
                                    <h3 className="text-xs font-bold text-purple-400 flex items-center gap-2 uppercase tracking-wider">
                                        🟣 Start.io
                                    </h3>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">App ID</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500 placeholder:text-gray-600 font-mono transition-colors"
                                            placeholder="Enter your Start.io App ID"
                                            value={appAdsConfig.startio_app_id}
                                            onChange={(e) => setAppAdsConfig({ ...appAdsConfig, startio_app_id: e.target.value })}
                                        />
                                    </div>
                                    <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                        <p className="text-[11px] text-gray-400 leading-relaxed">
                                            💡 <strong className="text-gray-300">Tip:</strong> Start.io handles Banner, MREC, Interstitial, and Rewarded (Video + Non-Video fallback). Keep Test Mode OFF in production.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* ── Adsterra Direct Link Configuration ── */}
                            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/15 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                                            🔗 Adsterra Direct Link (Watch, Download, Coin Offer & Fallback)
                                        </h3>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            Synced with Settings. Triggers with a live countdown overlay on Watch Now / Episode Watch (5s), Download Gate (6s), Bonus Coin Explorer (+15 Coins, 10s), and Start.io No-Fill fallback (10s).
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAppAdsConfig({ ...appAdsConfig, is_ads_enabled: !appAdsConfig.is_ads_enabled })}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                                appAdsConfig.is_ads_enabled
                                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                                    : 'border-white/10 bg-white/5 text-gray-400'
                                            }`}
                                        >
                                            {appAdsConfig.is_ads_enabled ? '● Direct Link On' : '○ Direct Link Off'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAppAdsConfig({ ...appAdsConfig, is_download_verification_enabled: !appAdsConfig.is_download_verification_enabled })}
                                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                                appAdsConfig.is_download_verification_enabled
                                                    ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                                    : 'border-white/10 bg-white/5 text-gray-400'
                                            }`}
                                        >
                                            {appAdsConfig.is_download_verification_enabled ? '● Download Gate On' : '○ Download Gate Off'}
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Primary Adsterra Direct Link URL</label>
                                        <input
                                            type="url"
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-600 font-mono transition-colors"
                                            placeholder="https://www.profitablecpmrate.com/..."
                                            value={appAdsConfig.direct_link_url}
                                            onChange={(e) => setAppAdsConfig({ ...appAdsConfig, direct_link_url: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Download Direct Link Override (Optional)</label>
                                        <input
                                            type="url"
                                            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 placeholder:text-gray-600 font-mono transition-colors"
                                            placeholder="Uses Primary Direct Link if empty"
                                            value={appAdsConfig.download_ad_url_1}
                                            onChange={(e) => setAppAdsConfig({ ...appAdsConfig, download_ad_url_1: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* ── Ad Type Toggle Grid ── */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 mb-3 uppercase tracking-widest">Master Ad Toggles</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                    {adToggles.map(toggle => {
                                        const isEnabled = (appAdsConfig as any)[toggle.key];
                                        return (
                                            <button
                                                key={toggle.key}
                                                type="button"
                                                onClick={() => setAppAdsConfig({ ...appAdsConfig, [toggle.key]: !isEnabled })}
                                                className={`relative flex flex-col items-start p-3 rounded-xl border transition-all ${
                                                    isEnabled
                                                        ? toggle.key === 'is_test_ads_enabled'
                                                            ? 'border-amber-500/30 bg-amber-500/10'
                                                            : 'border-emerald-500/30 bg-emerald-500/10'
                                                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                                }`}
                                            >
                                                {/* Toggle dot */}
                                                <div className="absolute top-3 right-3">
                                                    <div className={`w-8 h-4.5 rounded-full transition-colors relative ${isEnabled ? (toggle.key === 'is_test_ads_enabled' ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-gray-700'}`} style={{ height: '18px' }}>
                                                        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-[calc(100%-16px)]' : 'left-0.5'}`} style={{ height: '14px', width: '14px' }}></div>
                                                    </div>
                                                </div>
                                                <span className="text-lg mb-1">{toggle.icon}</span>
                                                <span className={`text-xs font-bold ${isEnabled ? 'text-white' : 'text-gray-400'}`}>{toggle.label}</span>
                                                <span className="text-[10px] text-gray-500 mt-0.5">{toggle.desc}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ══ Custom Web Banners / Ads List Section ══ */}
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(15,15,25,0.98), rgba(20,20,35,0.95))' }}>
                <div className="flex items-center justify-between p-5 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-lg shadow-lg shadow-cyan-900/20">🌐</div>
                        <div>
                            <h2 className="text-base font-bold text-white font-outfit">Custom Web Ads</h2>
                            <p className="text-xs text-gray-500">
                                {ads.length === 0 ? 'No ads configured' : `${activeAdCount} active / ${ads.length} total`}
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/ads/add"
                        className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/20"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Ad
                    </Link>
                </div>

                {ads.length === 0 ? (
                    <div className="text-center py-16 px-8">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">📭</span>
                        </div>
                        <p className="text-gray-400 font-bold mb-1">No custom ads yet</p>
                        <p className="text-xs text-gray-500 mb-6">Create banner ads for your web & app sections</p>
                        <Link
                            href="/ads/add"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 transition-all"
                        >
                            + Create Your First Ad
                        </Link>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {ads.map((ad) => (
                            <div key={ad.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group">
                                {/* Status Indicator */}
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ad.is_active ? 'bg-emerald-400' : 'bg-gray-600'}`}></div>
                                
                                {/* Ad Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-bold text-white truncate">{ad.title}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                            ad.ad_type === 'script' 
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                        }`}>
                                            {ad.ad_type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[11px] text-gray-500">
                                        <span className="font-mono">{ad.placement}</span>
                                        <span>•</span>
                                        <span className="capitalize">{ad.device_target}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => toggleAdStatus(ad.id, ad.is_active)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                            ad.is_active
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                                                : 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-violet-500/25'
                                        }`}
                                    >
                                        {ad.is_active ? '● Active' : '○ Inactive'}
                                    </button>
                                    <Link
                                        href={`/ads/edit/${ad.id}`}
                                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 text-[11px] font-bold rounded-lg border border-white/10 transition-all"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        onClick={() => deleteAd(ad.id)}
                                        className="px-3 py-1.5 bg-red-500/10 hover:bg-violet-500/20 text-red-400 text-[11px] font-bold rounded-lg border border-red-500/15 transition-all"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
