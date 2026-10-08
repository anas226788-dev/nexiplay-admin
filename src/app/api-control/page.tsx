'use client';

import { useState, useEffect, useMemo } from 'react';
import AdminShell from '@/components/AdminShell';
import { StreamApiSettings, StreamApiKey } from '@/lib/streamApiKeyService';

type ExpiryPreset =
    | '1h'
    | '2h'
    | '3h'
    | '6h'
    | '12h'
    | '24h'
    | '3d'
    | '7d'
    | '14d'
    | '30d'
    | 'custom'
    | 'never';

export default function StreamApiControlPage() {
    const [settings, setSettings] = useState<StreamApiSettings | null>(null);
    const [keys, setKeys] = useState<StreamApiKey[]>([]);
    const [stats, setStats] = useState({
        totalKeys: 0,
        activeKeys: 0,
        disabledKeys: 0,
        productionKeys: 0,
        testKeys: 0,
        totalRequests: 0
    });

    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Filter & Search
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'active' | 'disabled' | 'test' | 'production'>('all');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});
    const [showGuide, setShowGuide] = useState(true);

    // Modal State: Create Key
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState<'production' | 'test'>('test');
    const [expiryCategory, setExpiryCategory] = useState<'hourly' | 'daily' | 'custom' | 'never'>('hourly');
    const [selectedPreset, setSelectedPreset] = useState<ExpiryPreset>('1h');
    const [customAmount, setCustomAmount] = useState('1');
    const [customUnit, setCustomUnit] = useState<'hours' | 'days'>('hours');
    const [newKeyOrigins, setNewKeyOrigins] = useState('*');
    const [showAdvancedModal, setShowAdvancedModal] = useState(false);
    const [creatingKey, setCreatingKey] = useState(false);
    const [newlyCreatedKey, setNewlyCreatedKey] = useState<StreamApiKey | null>(null);

    // Live Tester & Code Generator
    const [testKeyId, setTestKeyId] = useState<string>('');
    const [testSlug, setTestSlug] = useState('hana-kimi-2026');
    const [testSeason, setTestSeason] = useState('1');
    const [testEpisode, setTestEpisode] = useState('1');
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    const showToast = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4500);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/stream-api');
            const data = await res.json();
            if (data.ok || data.success) {
                setSettings(data.settings);
                setKeys(data.keys || []);
                setStats(data.stats || data.metrics || {
                    totalKeys: 0,
                    activeKeys: 0,
                    disabledKeys: 0,
                    productionKeys: 0,
                    testKeys: 0,
                    totalRequests: 0
                });
                if (data.keys?.length > 0 && !testKeyId) {
                    setTestKeyId(data.keys[0].id);
                }
            } else {
                showToast('error', data.error || 'Failed to load Stream API data');
            }
        } catch (err: any) {
            showToast('error', err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Save global settings
    const handleSaveSettings = async (override?: Partial<StreamApiSettings>) => {
        if (!settings) return;
        const target = override ? { ...settings, ...override } : settings;
        setSavingSettings(true);
        try {
            const res = await fetch('/api/admin/stream-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_settings',
                    settings: target
                })
            });
            const data = await res.json();
            if (data.ok || data.success) {
                setSettings(data.settings);
                showToast('success', '✅ সেটিংস সফলভাবে সেভ হয়েছে!');
            } else {
                showToast('error', data.error || 'Failed to save settings');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setSavingSettings(false);
        }
    };

    // Toggle master kill switch
    const toggleMasterSwitch = async () => {
        if (!settings) return;
        const nextState = !settings.isEnabled;
        setSettings({ ...settings, isEnabled: nextState });
        await handleSaveSettings({ isEnabled: nextState });
    };

    // 1-Click Toggle active / disabled state of a key
    const handleToggleKey = async (id: string, currentState: boolean, keyName: string) => {
        try {
            const res = await fetch('/api/admin/stream-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_key',
                    id,
                    isActive: !currentState
                })
            });
            const data = await res.json();
            if (data.ok || data.success) {
                setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: !currentState } : k));
                setStats(prev => ({
                    ...prev,
                    activeKeys: !currentState ? prev.activeKeys + 1 : prev.activeKeys - 1,
                    disabledKeys: !currentState ? prev.disabledKeys - 1 : prev.disabledKeys + 1
                }));
                showToast(
                    'success',
                    !currentState
                        ? `🟢 "${keyName}" এর জন্য অ্যাক্সেস চালু করা হয়েছে!`
                        : `🔴 "${keyName}" এর অ্যাক্সেস সফলভাবে বন্ধ (Disable) করা হয়েছে!`
                );
            } else {
                showToast('error', data.error || 'Failed to toggle key status');
            }
        } catch (err: any) {
            showToast('error', err.message);
        }
    };

    // Delete / revoke key
    const handleDeleteKey = async (id: string, name: string) => {
        if (!window.confirm(`আপনি কি নিশ্চিত "${name}" API Key টি স্থায়ীভাবে মুছে ফেলতে চান?`)) {
            return;
        }
        try {
            const res = await fetch('/api/admin/stream-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete_key',
                    id
                })
            });
            const data = await res.json();
            if (data.ok || data.success) {
                setKeys(prev => prev.filter(k => k.id !== id));
                showToast('success', `🗑️ "${name}" কী মুছে ফেলা হয়েছে।`);
                loadData();
            } else {
                showToast('error', data.error || 'Failed to delete key');
            }
        } catch (err: any) {
            showToast('error', err.message);
        }
    };

    // Compute expiration date
    const computeExpiresAt = (): string | null => {
        if (newKeyType === 'production' && expiryCategory === 'never') {
            return null;
        }
        const now = Date.now();
        if (expiryCategory === 'never') return null;

        if (expiryCategory === 'custom') {
            const amt = Math.max(1, Number(customAmount) || 1);
            const ms = customUnit === 'hours' ? amt * 3600 * 1000 : amt * 86400 * 1000;
            return new Date(now + ms).toISOString();
        }

        switch (selectedPreset) {
            case '1h': return new Date(now + 1 * 3600 * 1000).toISOString();
            case '2h': return new Date(now + 2 * 3600 * 1000).toISOString();
            case '3h': return new Date(now + 3 * 3600 * 1000).toISOString();
            case '6h': return new Date(now + 6 * 3600 * 1000).toISOString();
            case '12h': return new Date(now + 12 * 3600 * 1000).toISOString();
            case '24h': return new Date(now + 24 * 3600 * 1000).toISOString();
            case '3d': return new Date(now + 3 * 86400 * 1000).toISOString();
            case '7d': return new Date(now + 7 * 86400 * 1000).toISOString();
            case '14d': return new Date(now + 14 * 86400 * 1000).toISOString();
            case '30d': return new Date(now + 30 * 86400 * 1000).toISOString();
            default: return null;
        }
    };

    // Create new key
    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) {
            showToast('error', 'দয়া করে ক্লায়েন্ট বা সাইটের একটি নাম দিন');
            return;
        }

        setCreatingKey(true);
        const expiresAt = computeExpiresAt();
        const allowedOrigins = newKeyOrigins.split(',').map(s => s.trim()).filter(Boolean);

        try {
            const res = await fetch('/api/admin/stream-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_key',
                    name: newKeyName.trim(),
                    type: newKeyType,
                    allowedOrigins: allowedOrigins.length ? allowedOrigins : ['*'],
                    expiresAt
                })
            });
            const data = await res.json();
            if (data.ok || data.success) {
                setNewlyCreatedKey(data.key);
                setKeys(prev => [data.key, ...prev]);
                setStats(prev => ({
                    ...prev,
                    totalKeys: prev.totalKeys + 1,
                    activeKeys: prev.activeKeys + 1,
                    testKeys: data.key.type === 'test' ? prev.testKeys + 1 : prev.testKeys,
                    productionKeys: data.key.type === 'production' ? prev.productionKeys + 1 : prev.productionKeys
                }));
                setTestKeyId(data.key.id);
                showToast('success', `🎉 "${data.key.name}" এর জন্য API Key তৈরি হয়েছে!`);
            } else {
                showToast('error', data.error || 'Failed to generate key');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setCreatingKey(false);
        }
    };

    const copyToClipboard = (text: string, identifier: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedKey(identifier);
            setTimeout(() => setCopiedKey(null), 2500);
        }
    };

    const toggleRevealKey = (id: string) => {
        setRevealedKeyIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Format human-friendly remaining time in Bengali
    const formatRemaining = (expiresAt?: string | null) => {
        if (!expiresAt) {
            return {
                text: '♾️ কোনো মেয়াদ নেই (স্থায়ী)',
                badgeClass: 'bg-white/5 text-gray-300 border-white/10',
                isExpired: false
            };
        }
        const diffMs = new Date(expiresAt).getTime() - Date.now();
        if (diffMs <= 0) {
            return {
                text: '❌ মেয়াদ শেষ (Expired)',
                badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30 font-bold',
                isExpired: true
            };
        }

        const totalHours = Math.floor(diffMs / (3600 * 1000));
        const totalMins = Math.floor((diffMs % (3600 * 1000)) / (60 * 1000));
        const days = Math.floor(totalHours / 24);
        const remHours = totalHours % 24;

        if (days > 0) {
            return {
                text: `⏳ বাকি: ${days} দিন ${remHours > 0 ? `${remHours} ঘণ্টা` : ''}`,
                badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-semibold',
                isExpired: false
            };
        }
        if (totalHours > 0) {
            return {
                text: `⚡ বাকি: ${totalHours} ঘণ্টা ${totalMins} মি.`,
                badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold',
                isExpired: false
            };
        }
        return {
            text: `🔥 বাকি মাত্র ${totalMins} মিনিট!`,
            badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40 font-bold animate-pulse',
            isExpired: false
        };
    };

    // Filter keys
    const filteredKeys = useMemo(() => {
        return keys.filter(k => {
            const matchesSearch = k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  k.key.toLowerCase().includes(searchTerm.toLowerCase());
            if (!matchesSearch) return false;

            if (filterTab === 'active') return k.isActive;
            if (filterTab === 'disabled') return !k.isActive;
            if (filterTab === 'test') return k.type === 'test';
            if (filterTab === 'production') return k.type === 'production';
            return true;
        });
    }, [keys, searchTerm, filterTab]);

    const selectedKeyForCode = keys.find(k => k.id === testKeyId) || keys[0];

    // Run test stream
    const runTestStream = async () => {
        const selected = keys.find(k => k.id === testKeyId);
        if (!selected) {
            showToast('error', 'টেস্ট করার জন্য একটি API Key নির্বাচন করুন');
            return;
        }

        setTestLoading(true);
        setTestResult(null);
        const start = performance.now();

        try {
            // Target the public stream API endpoint
            const testUrl = `/api/v1/anime/stream?slug=${encodeURIComponent(testSlug.trim())}&season=${testSeason}&episode=${testEpisode}&apiKey=${encodeURIComponent(selected.key)}`;
            const res = await fetch(testUrl);
            const rawText = await res.text();
            let data: any;
            try {
                data = JSON.parse(rawText);
            } catch {
                data = {
                    success: false,
                    error: res.status === 404
                        ? 'Stream API রুট পাওয়া যায়নি (404 Not Found)'
                        : `সার্ভার এরর (Status ${res.status}): ${rawText.substring(0, 200)}`
                };
            }
            const latency = Math.round(performance.now() - start);

            setTestResult({
                status: res.status,
                ok: res.ok && data?.success !== false,
                latency,
                data
            });
        } catch (err: any) {
            setTestResult({
                status: 500,
                ok: false,
                latency: Math.round(performance.now() - start),
                error: err.message
            });
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <AdminShell>
            <div className="p-4 md:p-8 space-y-7 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="flex items-center gap-2.5 mb-2">
                            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30 flex items-center gap-1.5">
                                <span>🔒</span>
                                <span>RR Nexiplay Stream Protection</span>
                            </span>
                            <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                                settings?.isEnabled
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${settings?.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                                {settings?.isEnabled ? 'API গেটওয়ে চালু আছে (ONLINE)' : 'API গেটওয়ে সাময়িক বন্ধ (OFFLINE)'}
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                            <span>API Control & Client Keys</span>
                        </h1>
                        <p className="text-xs md:text-sm text-gray-400 mt-1">
                            যেকোনো মানুষকে ১ ঘণ্টা বা ৭ দিনের <strong className="text-amber-300">ট্রায়াল কী</strong> অথবা স্থায়ী <strong className="text-emerald-300">লাইভ কী</strong> দিন। পছন্দ না হলে ১-ক্লিকেই অ্যাক্সেস বন্ধ করে দিন।
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowGuide(!showGuide)}
                            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-xs transition-all border border-white/10 flex items-center gap-2"
                        >
                            <span>💡</span>
                            <span>{showGuide ? 'গাইড লুকান' : 'সহজ ব্যবহারের নিয়মাবলী'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setNewlyCreatedKey(null);
                                setIsCreateModalOpen(true);
                            }}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xs transition-all shadow-lg shadow-red-900/30 flex items-center gap-2 active:scale-95"
                        >
                            <span className="text-base leading-none">+</span>
                            <span>নতুন API Key তৈরি করুন</span>
                        </button>
                    </div>
                </div>

                {/* Toast Notification */}
                {message && (
                    <div className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between transition-all shadow-xl animate-fade-in ${
                        message.type === 'success'
                            ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-200'
                            : 'bg-red-950/80 border border-red-500/40 text-red-200'
                    }`}>
                        <div className="flex items-center gap-3">
                            <span className="text-xl">{message.type === 'success' ? '✅' : '⚠️'}</span>
                            <span>{message.text}</span>
                        </div>
                        <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white text-base font-bold px-2">✕</button>
                    </div>
                )}

                {/* 3-STEP QUICK GUIDE (SUPER SIMPLE) */}
                {showGuide && (
                    <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-blue-950/30 via-[#13131c] to-purple-950/20 border border-blue-500/20 shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black text-blue-300 flex items-center gap-2">
                                <span>📖</span>
                                <span>খুব সহজ ৩ ধাপে কিভাবে API ব্যবহার করবেন?</span>
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowGuide(false)}
                                className="text-xs text-gray-500 hover:text-gray-300"
                            >
                                বুঝেছি, বন্ধ করুন ✕
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                                <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 font-black flex items-center justify-center text-xs">১</div>
                                <h3 className="font-bold text-white text-xs">কী তৈরি করুন (Generate)</h3>
                                <p className="text-gray-400 leading-relaxed text-[11px]">
                                    <strong className="text-white">+ নতুন API Key তৈরি করুন</strong> বাটনে চাপ দিন। নাম লিখুন এবং <strong>১ ঘণ্টা, ২৪ ঘণ্টা বা ৭ দিন</strong> ট্রায়াল সিলেক্ট করে চাবি বানিয়ে নিন।
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-xs">২</div>
                                <h3 className="font-bold text-white text-xs">ক্লায়েন্টকে দিন (Share)</h3>
                                <p className="text-gray-400 leading-relaxed text-[11px]">
                                    তৈরি হওয়া <strong>nxp_test_...</strong> কী-টি কপি করে ডেভেলপারকে দিন। সে তার সাইটে অ্যানিমে স্ট্রিমিং লিঙ্ক কল করতে পারবে।
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1.5">
                                <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 font-black flex items-center justify-center text-xs">৩</div>
                                <h3 className="font-bold text-white text-xs">১-ক্লিকে অফ করুন (Instant Cutoff)</h3>
                                <p className="text-gray-400 leading-relaxed text-[11px]">
                                    কাউকে আর দেখতে দিতে না চাইলে টেবিল থেকে শুধু <strong className="text-red-400">অ্যাক্সেস বন্ধ করুন</strong> বাটনে চাপ দিন। সাথে সাথে তার সাইটে ভিডিও প্লে হওয়া থেমে যাবে!
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* TOP CARDS: QUICK CONTROLS & STATS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Master Kill Switch Card */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 flex flex-col justify-between space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">🔌 মাস্টার পাওয়ার সুইচ</span>
                            <span className={`w-2.5 h-2.5 rounded-full ${settings?.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                        </div>
                        <div>
                            <div className={`text-xl font-black ${settings?.isEnabled ? 'text-emerald-400' : 'text-red-400'}`}>
                                {settings?.isEnabled ? 'সবাইর জন্য চালু (ON)' : 'সবাইর জন্য বন্ধ (OFF)'}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                {settings?.isEnabled ? 'ক্লায়েন্টরা বর্তমানে API ব্যবহার করতে পারছে।' : 'পুরো API বন্ধ রাখা হয়েছে (সবার অ্যাক্সেস অফ)।'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleMasterSwitch}
                            disabled={savingSettings}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                                settings?.isEnabled
                                    ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30'
                                    : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                            }`}
                        >
                            <span>{settings?.isEnabled ? '⛔ পুরো API বন্ধ করুন' : '⚡ পুরো API চালু করুন'}</span>
                        </button>
                    </div>

                    {/* Active vs Disabled Keys */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 flex flex-col justify-between space-y-2 shadow-lg">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">🔑 সক্রিয় ও নিষ্ক্রিয় চাবি</span>
                        <div>
                            <div className="text-3xl font-black text-white flex items-baseline gap-2">
                                <span className="text-emerald-400">{stats.activeKeys}</span>
                                <span className="text-xs text-gray-500 font-semibold">চালু / {stats.totalKeys} মোট</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                                {stats.disabledKeys} টি কী সাময়িক বন্ধ (Disabled) রাখা আছে
                            </p>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-emerald-500 h-full rounded-full transition-all"
                                style={{ width: `${stats.totalKeys ? (stats.activeKeys / stats.totalKeys) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* Total Stream Requests Served */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 flex flex-col justify-between space-y-2 shadow-lg">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">📊 মোট ভিডিও প্লে রিকোয়েস্ট</span>
                        <div>
                            <div className="text-3xl font-black text-purple-400">
                                {stats.totalRequests.toLocaleString()}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">
                                ক্লায়েন্টদের সাইট থেকে মোট এতবার অ্যানিমে প্লে হয়েছে
                            </p>
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono">স্বয়ংক্রিয়ভাবে ট্র্যাকিং হচ্ছে</span>
                    </div>

                    {/* Key Types Distribution */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 flex flex-col justify-between space-y-2 shadow-lg">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">🏷️ কী ক্যাটাগরি</span>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-amber-400 flex items-center gap-1">🧪 ট্রায়াল কী:</span>
                                <span className="text-white">{stats.testKeys} টি</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-emerald-400 flex items-center gap-1">🚀 লাইভ কী:</span>
                                <span className="text-white">{stats.productionKeys} টি</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="text-[11px] text-red-400 hover:text-red-300 font-bold text-left underline"
                        >
                            + আরও কী তৈরি করুন
                        </button>
                    </div>
                </div>

                {/* GLOBAL SECURITY SETTINGS (CLEAN & SIMPLE) */}
                {settings && (
                    <div className="p-6 rounded-3xl bg-[#111118] border border-white/10 space-y-4 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                            <div>
                                <h2 className="text-sm font-black text-white flex items-center gap-2">
                                    <span>⚙️</span>
                                    <span>অ্যাক্সেস মোড সেটিংস (Security Mode)</span>
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    কারা আপনার সাইটের বাইরে থেকে API কল করতে পারবে তা নির্বাচন করুন।
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSaveSettings()}
                                disabled={savingSettings}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md shadow-red-900/30 disabled:opacity-50 self-start sm:self-auto"
                            >
                                {savingSettings ? 'সেভ হচ্ছে...' : 'সেটিংস সেভ করুন'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            {/* Mode 1 */}
                            <label
                                onClick={() => setSettings({ ...settings, accessMode: 'demo_allowed' })}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1 block ${
                                    settings.accessMode === 'demo_allowed'
                                        ? 'bg-red-600/10 border-red-500 text-white shadow-lg shadow-red-950/30'
                                        : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between font-black text-xs">
                                    <span className="flex items-center gap-1.5">
                                        <span>⭐</span>
                                        <span>সাধারণ মোড (রিকমেন্ডেড)</span>
                                    </span>
                                    {settings.accessMode === 'demo_allowed' && <span className="text-red-400">✓ সক্রিয়</span>}
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                                    আপনার নিজস্ব ওয়েবসাইট ও ডেমোতে কোনো কী লাগবে না। কিন্তু বাইরের মানুষ বা সাইট থেকে চালাতে চাইলে আপনার দেওয়া <strong className="text-white">API Key</strong> লাগবে।
                                </p>
                            </label>

                            {/* Mode 2 */}
                            <label
                                onClick={() => setSettings({ ...settings, accessMode: 'strict' })}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1 block ${
                                    settings.accessMode === 'strict'
                                        ? 'bg-red-600/10 border-red-500 text-white shadow-lg shadow-red-950/30'
                                        : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between font-black text-xs">
                                    <span className="flex items-center gap-1.5">
                                        <span>🔒</span>
                                        <span>কঠোর মোড (Strict)</span>
                                    </span>
                                    {settings.accessMode === 'strict' && <span className="text-red-400">✓ সক্রিয়</span>}
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                                    আপনার সাইট সহ যে কেউই কল করুক না কেন, বৈধ ও সক্রিয় API Key ছাড়া কোনো স্ট্রিম দেওয়া হবে না।
                                </p>
                            </label>

                            {/* Mode 3 */}
                            <label
                                onClick={() => setSettings({ ...settings, accessMode: 'open' })}
                                className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1 block ${
                                    settings.accessMode === 'open'
                                        ? 'bg-red-600/10 border-red-500 text-white shadow-lg shadow-red-950/30'
                                        : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center justify-between font-black text-xs">
                                    <span className="flex items-center gap-1.5">
                                        <span>🌐</span>
                                        <span>উন্মুক্ত মোড (Open Public)</span>
                                    </span>
                                    {settings.accessMode === 'open' && <span className="text-red-400">✓ সক্রিয়</span>}
                                </div>
                                <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
                                    যে কেউ কোনো কী ছাড়াই সরাসরি স্ট্রিম চালাতে পারবে (সাধারণত টেস্টিং ছাড়া এটি ব্যবহার করবেন না)।
                                </p>
                            </label>
                        </div>
                    </div>
                )}

                {/* API KEYS TABLE & CLIENT MANAGEMENT */}
                <div className="p-6 rounded-3xl bg-[#111118] border border-white/10 space-y-5 shadow-xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <div>
                            <h2 className="text-base font-black text-white flex items-center gap-2">
                                <span>🔑</span>
                                <span>তৈরি করা চাবি / কী তালিকা ({filteredKeys.length})</span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                যাকে যাকে কী দিয়েছেন তাদের তালিকা। যেকোনো সময়ে অ্যাক্সেস চালু বা বন্ধ করুন।
                            </p>
                        </div>

                        {/* Search & Tabs */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <input
                                type="text"
                                placeholder="🔍 নাম বা কী দিয়ে খুঁজুন..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-3.5 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 w-full sm:w-56"
                            />

                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('all')}
                                    className={`px-3 py-1 rounded-lg font-bold transition-all ${filterTab === 'all' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    সব ({keys.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('active')}
                                    className={`px-3 py-1 rounded-lg font-bold transition-all ${filterTab === 'active' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    🟢 চালু ({stats.activeKeys})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('disabled')}
                                    className={`px-3 py-1 rounded-lg font-bold transition-all ${filterTab === 'disabled' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    🔴 বন্ধ ({stats.disabledKeys})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('test')}
                                    className={`px-3 py-1 rounded-lg font-bold transition-all ${filterTab === 'test' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    🧪 ট্রায়াল ({stats.testKeys})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('production')}
                                    className={`px-3 py-1 rounded-lg font-bold transition-all ${filterTab === 'production' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    🚀 লাইভ ({stats.productionKeys})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    {loading ? (
                        <div className="py-16 text-center text-gray-500 text-xs space-y-3">
                            <span className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin inline-block" />
                            <p>API Keys লোড হচ্ছে...</p>
                        </div>
                    ) : filteredKeys.length === 0 ? (
                        <div className="py-16 text-center text-gray-500 text-xs space-y-3">
                            <p className="text-base text-gray-300 font-bold">কোনো API Key পাওয়া যায়নি</p>
                            <p className="text-gray-500 max-w-sm mx-auto">
                                অন্য কাউকে টেস্ট বা ব্যবহারের জন্য দিতে উপরের <strong className="text-white">&quot;+ নতুন API Key তৈরি করুন&quot;</strong> বাটনে চাপ দিন।
                            </p>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-white font-black inline-flex items-center gap-2 shadow-lg"
                            >
                                <span>+ প্রথম কী তৈরি করুন</span>
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-white/5 text-gray-400 font-black uppercase tracking-wider text-[11px]">
                                        <th className="py-3 px-3">ক্লায়েন্ট / নাম</th>
                                        <th className="py-3 px-3">API Key (চাবি)</th>
                                        <th className="py-3 px-3 text-center">১-ক্লিক অ্যাক্সেস কন্ট্রোল</th>
                                        <th className="py-3 px-3">মেয়াদ ও কাউন্টডাউন</th>
                                        <th className="py-3 px-3 text-center">প্লে রিকোয়েস্ট</th>
                                        <th className="py-3 px-3 text-right">অ্যাকশন</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {filteredKeys.map((item) => {
                                        const isRevealed = revealedKeyIds[item.id];
                                        const displayKey = isRevealed
                                            ? item.key
                                            : item.key.slice(0, 12) + '••••••••••••••••' + item.key.slice(-4);
                                        const remainingInfo = formatRemaining(item.expiresAt);

                                        return (
                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                {/* Client Name & Type Badge */}
                                                <td className="py-4 px-3">
                                                    <div className="font-black text-white text-sm flex items-center gap-2">
                                                        <span>{item.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wide border ${
                                                            item.type === 'production'
                                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                                        }`}>
                                                            {item.type === 'production' ? '🚀 লাইভ' : '🧪 ট্রায়াল'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 block mt-1">
                                                        তৈরি: {new Date(item.createdAt).toLocaleString()}
                                                    </span>
                                                </td>

                                                {/* API Key Box with Instant Copy */}
                                                <td className="py-4 px-3 font-mono text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-black/70 px-2.5 py-1.5 rounded-xl border border-white/10 text-gray-200 select-all">
                                                            {displayKey}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleRevealKey(item.id)}
                                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-xs transition-colors"
                                                            title={isRevealed ? 'লুকান' : 'দেখুন'}
                                                        >
                                                            {isRevealed ? '👁️' : '🔒'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(item.key, item.id)}
                                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                                                copiedKey === item.id
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-white/5 hover:bg-red-600/20 text-gray-300 hover:text-red-300 border border-white/5'
                                                            }`}
                                                            title="কী কপি করুন"
                                                        >
                                                            <span>{copiedKey === item.id ? '✓' : '📋'}</span>
                                                            <span className="text-[11px]">{copiedKey === item.id ? 'কপি হয়েছে' : 'কপি'}</span>
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* 1-Click Access Toggle Switch */}
                                                <td className="py-4 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleKey(item.id, item.isActive, item.name)}
                                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all inline-flex items-center gap-2 border shadow-sm ${
                                                            item.isActive
                                                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'
                                                                : 'bg-red-500/15 text-red-300 border-red-500/40 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/40'
                                                        }`}
                                                        title="ক্লিক করে সাথে সাথে অ্যাক্সেস চালু বা বন্ধ করুন"
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${item.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                                                        <span>{item.isActive ? '🟢 চালু আছে (বন্ধ করতে চাপুন)' : '🔴 বন্ধ আছে (চালু করতে চাপুন)'}</span>
                                                    </button>
                                                </td>

                                                {/* Expiration Countdown */}
                                                <td className="py-4 px-3">
                                                    <div className="space-y-1">
                                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] border inline-block ${remainingInfo.badgeClass}`}>
                                                            {remainingInfo.text}
                                                        </span>
                                                        {item.expiresAt && (
                                                            <span className="block text-[10px] text-gray-500">
                                                                শেষ: {new Date(item.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, {new Date(item.expiresAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Requests Counter */}
                                                <td className="py-4 px-3 text-center">
                                                    <span className="font-black text-white text-sm">
                                                        {item.totalRequests.toLocaleString()}
                                                    </span>
                                                    <span className="block text-[10px] text-gray-500 mt-0.5">
                                                        {item.lastUsedAt
                                                            ? `সর্বশেষ: ${new Date(item.lastUsedAt).toLocaleDateString()}`
                                                            : 'এখনও ব্যবহার করেনি'}
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-4 px-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setTestKeyId(item.id);
                                                                // Scroll down to tester
                                                                document.getElementById('api-tester-section')?.scrollIntoView({ behavior: 'smooth' });
                                                            }}
                                                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold text-[11px] border border-white/5 transition-all"
                                                        >
                                                            🧪 টেস্ট
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteKey(item.id, item.name)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/25 text-red-400 hover:text-red-300 font-bold text-[11px] border border-red-500/20 transition-all"
                                                            title="স্থায়ীভাবে মুছে ফেলুন"
                                                        >
                                                            🗑️ ডিলিট
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* LIVE API TESTER & QUICK CLIENT CODE SNIPPETS */}
                <div id="api-tester-section" className="p-6 rounded-3xl bg-[#111118] border border-white/10 space-y-5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                        <div>
                            <h2 className="text-base font-black text-white flex items-center gap-2">
                                <span>🧪</span>
                                <span>লাইভ API টেস্টার ও ক্লায়েন্ট কোড জেনারেটর</span>
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                যেকোনো কী নির্বাচন করে টেস্ট করুন এবং ক্লায়েন্টকে দেওয়ার রেডিমেড কোড কপি করে নিন।
                            </p>
                        </div>
                        {selectedKeyForCode && (
                            <span className="text-xs font-mono px-3 py-1 rounded-xl bg-black/60 border border-white/5 text-gray-300">
                                নির্বাচিত চাবি: <strong className="text-red-400">{selectedKeyForCode.name}</strong>
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4 space-y-1.5">
                            <label className="text-xs font-bold text-gray-300">১. কোন কী দিয়ে টেস্ট করবেন?</label>
                            <select
                                value={testKeyId}
                                onChange={(e) => setTestKeyId(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                            >
                                {keys.map(k => (
                                    <option key={k.id} value={k.id}>
                                        {k.name} ({k.type === 'production' ? 'PROD' : 'TEST'}) - {k.isActive ? 'Active' : 'Disabled'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-4 space-y-1.5">
                            <label className="text-xs font-bold text-gray-300">২. অ্যানিমে স্লাগ (Slug)</label>
                            <input
                                type="text"
                                value={testSlug}
                                onChange={(e) => setTestSlug(e.target.value)}
                                placeholder="e.g. hana-kimi-2026 or bleach-..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                            />
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-gray-300">এপিসোড</label>
                            <input
                                type="number"
                                min={1}
                                value={testEpisode}
                                onChange={(e) => setTestEpisode(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <button
                                type="button"
                                onClick={runTestStream}
                                disabled={testLoading || !testKeyId}
                                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xs transition-all shadow-md shadow-red-900/30 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                            >
                                {testLoading ? (
                                    <span>টেস্ট হচ্ছে...</span>
                                ) : (
                                    <>
                                        <span>▶</span>
                                        <span>টেস্ট রান করুন</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Test Results Output */}
                    {testResult && (
                        <div className={`p-4 rounded-2xl border text-xs font-mono space-y-2.5 animate-fade-in ${
                            testResult.ok
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                : 'bg-red-950/20 border-red-500/30 text-red-200'
                        }`}>
                            <div className="flex items-center justify-between font-bold">
                                <span>
                                    HTTP {testResult.status} &bull; {testResult.latency} ms
                                </span>
                                <span>
                                    {testResult.ok ? '✅ অনুমোদন সফল! (ভিডিও স্ট্রিমিং লিঙ্ক প্রস্তুত)' : '❌ অ্যাক্সেস ব্লক বা ত্রুটি'}
                                </span>
                            </div>
                            <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap break-all text-[11px] text-gray-300 p-2.5 bg-black/50 rounded-xl border border-white/5">
                                {JSON.stringify(testResult.data || testResult.error, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Ready Snippets for Client */}
                    {selectedKeyForCode && (
                        <div className="space-y-3 pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <span className="text-xs font-black text-gray-300 flex items-center gap-1.5">
                                    <span>📋</span>
                                    <span>ক্লায়েন্ট ডেভেলপারকে দেওয়ার রেডি কোড:</span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(
                                            `https://your-domain.com/api/v1/anime/stream?slug=${testSlug}&season=${testSeason}&episode=${testEpisode}&apiKey=${selectedKeyForCode.key}`,
                                            'direct-url'
                                        )}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-red-400 font-bold border border-white/5"
                                    >
                                        {copiedKey === 'direct-url' ? '✓ লিংক কপি হয়েছে' : '🔗 ডাইরেক্ট API URL কপি'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(
                                            `fetch('https://your-domain.com/api/v1/anime/stream?slug=${testSlug}&season=${testSeason}&episode=${testEpisode}&apiKey=${selectedKeyForCode.key}')\n  .then(res => res.json())\n  .then(data => {\n    if (data.success) {\n      console.log('Stream URL:', data.playbackUrl);\n    }\n  });`,
                                            'js-code'
                                        )}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold"
                                    >
                                        {copiedKey === 'js-code' ? '✓ কোড কপি হয়েছে' : '⚡ JS Code কপি'}
                                    </button>
                                </div>
                            </div>
                            <pre className="p-4 rounded-2xl bg-black/80 border border-white/10 font-mono text-xs text-blue-300 overflow-x-auto leading-relaxed">
{`// ক্লায়েন্ট তার ওয়েবসাইটে এই কোডটি দিয়ে অ্যানিমে স্ট্রিম প্লে করবে:
const res = await fetch('https://your-domain.com/api/v1/anime/stream?slug=${testSlug}&season=${testSeason}&episode=${testEpisode}&apiKey=${selectedKeyForCode.key}');
const data = await res.json();

if (data.success) {
  // data.playbackUrl টি যেকোনো প্লেয়ারে (Video.js, HLS.js, Plyr ইত্যাদি) দিয়ে দিন
  console.log("HLS Video Stream URL:", data.playbackUrl);
}`}
                            </pre>
                        </div>
                    )}
                </div>
            </div>

            {/* ============================================================== */}
            {/* MODAL: ISSUE NEW API KEY (HOURLY, DAILY, PERMANENT) */}
            {/* ============================================================== */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in overflow-y-auto">
                    <div className="bg-[#111118] border border-white/10 rounded-3xl p-6 md:p-7 max-w-lg w-full space-y-6 shadow-2xl relative my-8">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <span>🔑</span>
                                    <span>নতুন API Key তৈরি করুন</span>
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    টেস্ট বা লাইভ ব্যবহারের জন্য সময়সীমা নির্ধারণ করে কী তৈরি করুন।
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-gray-400 hover:text-white text-lg font-bold p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* If key was just created, show instant celebration & copy box */}
                        {newlyCreatedKey ? (
                            <div className="space-y-5 animate-fade-in text-center py-2">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 text-2xl flex items-center justify-center mx-auto">
                                    ✓
                                </div>
                                <div>
                                    <h4 className="text-base font-black text-white">API Key সফলভাবে তৈরি হয়েছে!</h4>
                                    <p className="text-xs text-gray-400 mt-1">
                                        এই চাবিটি কপি করে ক্লায়েন্ট বা ডেভেলপারকে দিয়ে দিন।
                                    </p>
                                </div>

                                <div className="p-4 rounded-2xl bg-black/80 border border-emerald-500/30 text-left space-y-2 font-mono text-xs">
                                    <span className="text-[11px] text-gray-400 block font-sans">ক্লায়েন্ট: {newlyCreatedKey.name}</span>
                                    <div className="text-emerald-300 font-bold select-all break-all text-sm">
                                        {newlyCreatedKey.key}
                                    </div>
                                    <span className="text-[10px] text-amber-400 block">
                                        {formatRemaining(newlyCreatedKey.expiresAt).text}
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(newlyCreatedKey.key, 'modal-key')}
                                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        <span>{copiedKey === 'modal-key' ? '✓ কপি হয়েছে!' : '📋 কী কপি করুন'}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewlyCreatedKey(null);
                                            setIsCreateModalOpen(false);
                                        }}
                                        className="py-3 px-5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs"
                                    >
                                        সম্পন্ন
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleCreateKey} className="space-y-5">
                                {/* 1. Client Name */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-gray-200 block">
                                        ১. ক্লায়েন্ট বা সাইটের নাম <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="যেমন: Moviebari Web, Karim Bhai Android App, Test User"
                                        value={newKeyName}
                                        onChange={(e) => setNewKeyName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-2xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 placeholder-gray-500 font-medium"
                                    />
                                    <p className="text-[11px] text-gray-500">
                                        কার জন্য বানাচ্ছেন তা সহজে চেনার জন্য নাম দিন।
                                    </p>
                                </div>

                                {/* 2. Purpose / Tier (Test vs Live) */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-200 block">
                                        ২. কী-এর ধরণ নির্বাচন করুন
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Test Key Card */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewKeyType('test');
                                                if (expiryCategory === 'never') setExpiryCategory('hourly');
                                            }}
                                            className={`p-3.5 rounded-2xl border text-left transition-all ${
                                                newKeyType === 'test'
                                                    ? 'bg-amber-500/15 border-amber-500 text-amber-200 shadow-lg shadow-amber-950/30'
                                                    : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="font-black text-xs flex items-center gap-1.5">
                                                <span>🧪</span>
                                                <span>টেস্ট / ট্রায়াল কী</span>
                                            </div>
                                            <div className="text-[11px] text-gray-400 mt-1 leading-snug">
                                                নির্দিষ্ট সময় পর (যেমন ১ ঘণ্টা বা ৭ দিন) নিজে নিজেই বন্ধ হবে।
                                            </div>
                                        </button>

                                        {/* Production Key Card */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewKeyType('production');
                                                setExpiryCategory('never');
                                            }}
                                            className={`p-3.5 rounded-2xl border text-left transition-all ${
                                                newKeyType === 'production'
                                                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-950/30'
                                                    : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                            }`}
                                        >
                                            <div className="font-black text-xs flex items-center gap-1.5">
                                                <span>🚀</span>
                                                <span>লাইভ / স্থায়ী কী</span>
                                            </div>
                                            <div className="text-[11px] text-gray-400 mt-1 leading-snug">
                                                আসল ব্যবহারের জন্য। কোনো মেয়াদ শেষ হবে না (যতক্ষণ না আপনি অফ করেন)।
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* 3. DURATION / EXPIRATION SELECTION (HOURLY / DAILY) */}
                                <div className="space-y-3 pt-1 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-gray-200">
                                            ৩. মেয়াদ নির্ধারণ করুন (Expiration Duration)
                                        </label>
                                        <span className="text-[11px] text-amber-400 font-semibold">
                                            {newKeyType === 'test' ? '⚡ ট্রায়াল সময়' : 'স্থায়ী বা মেয়াদ'}
                                        </span>
                                    </div>

                                    {/* Category Tabs: Hourly vs Daily vs Custom vs Never */}
                                    <div className="grid grid-cols-4 gap-1.5 bg-black/60 p-1 rounded-2xl border border-white/5 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExpiryCategory('hourly');
                                                setSelectedPreset('1h');
                                            }}
                                            className={`py-2 px-1 rounded-xl font-bold transition-all text-center ${
                                                expiryCategory === 'hourly'
                                                    ? 'bg-amber-600 text-white shadow-md'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            ⚡ ঘণ্টা (Hourly)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExpiryCategory('daily');
                                                setSelectedPreset('7d');
                                            }}
                                            className={`py-2 px-1 rounded-xl font-bold transition-all text-center ${
                                                expiryCategory === 'daily'
                                                    ? 'bg-amber-600 text-white shadow-md'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            📅 দিন (Daily)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpiryCategory('custom')}
                                            className={`py-2 px-1 rounded-xl font-bold transition-all text-center ${
                                                expiryCategory === 'custom'
                                                    ? 'bg-amber-600 text-white shadow-md'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            ⚙️ কাস্টম
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpiryCategory('never')}
                                            className={`py-2 px-1 rounded-xl font-bold transition-all text-center ${
                                                expiryCategory === 'never'
                                                    ? 'bg-emerald-600 text-white shadow-md'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            ♾️ স্থায়ী
                                        </button>
                                    </div>

                                    {/* Sub-presets for Hourly */}
                                    {expiryCategory === 'hourly' && (
                                        <div className="space-y-2 animate-fade-in">
                                            <span className="text-[11px] text-gray-400 block">কত ঘণ্টা টেস্ট করতে পারবে?</span>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: '1h', label: '⚡ ১ ঘণ্টা', sub: '1 Hour' },
                                                    { id: '2h', label: '⚡ ২ ঘণ্টা', sub: '2 Hours' },
                                                    { id: '3h', label: '⚡ ৩ ঘণ্টা', sub: '3 Hours' },
                                                    { id: '6h', label: '⚡ ৬ ঘণ্টা', sub: '6 Hours' },
                                                    { id: '12h', label: '⚡ ১২ ঘণ্টা', sub: '12 Hours' },
                                                    { id: '24h', label: '⚡ ২৪ ঘণ্টা', sub: '1 Day' }
                                                ].map(item => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setSelectedPreset(item.id as any)}
                                                        className={`p-2.5 rounded-xl border text-center transition-all ${
                                                            selectedPreset === item.id
                                                                ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-black shadow-md'
                                                                : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5 font-semibold'
                                                        }`}
                                                    >
                                                        <div className="text-xs">{item.label}</div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">{item.sub}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-presets for Daily */}
                                    {expiryCategory === 'daily' && (
                                        <div className="space-y-2 animate-fade-in">
                                            <span className="text-[11px] text-gray-400 block">কত দিন টেস্ট করতে পারবে?</span>
                                            <div className="grid grid-cols-4 gap-2">
                                                {[
                                                    { id: '3d', label: '📅 ৩ দিন' },
                                                    { id: '7d', label: '📅 ৭ দিন' },
                                                    { id: '14d', label: '📅 ১৪ দিন' },
                                                    { id: '30d', label: '📅 ৩০ দিন' }
                                                ].map(item => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setSelectedPreset(item.id as any)}
                                                        className={`p-2.5 rounded-xl border text-center transition-all ${
                                                            selectedPreset === item.id
                                                                ? 'bg-amber-500/20 border-amber-500 text-amber-200 font-black shadow-md'
                                                                : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5 font-semibold'
                                                        }`}
                                                    >
                                                        <div className="text-xs">{item.label}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Duration Input */}
                                    {expiryCategory === 'custom' && (
                                        <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 space-y-2 animate-fade-in">
                                            <span className="text-[11px] text-gray-400 block">কাস্টম সময় লিখে দিন:</span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={customAmount}
                                                    onChange={(e) => setCustomAmount(e.target.value)}
                                                    className="w-24 px-3 py-2 rounded-xl bg-black/80 border border-white/10 text-xs text-white text-center font-bold"
                                                />
                                                <select
                                                    value={customUnit}
                                                    onChange={(e) => setCustomUnit(e.target.value as any)}
                                                    className="flex-1 px-3 py-2 rounded-xl bg-black/80 border border-white/10 text-xs text-white font-bold"
                                                >
                                                    <option value="hours">ঘণ্টা (Hours)</option>
                                                    <option value="days">দিন (Days)</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Permanent Banner */}
                                    {expiryCategory === 'never' && (
                                        <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2 animate-fade-in">
                                            <span>♾️</span>
                                            <span>এই কী-টির কোনো মেয়াদ শেষ হবে না। আপনি ম্যানুয়ালি বন্ধ না করা পর্যন্ত অনির্দিষ্টকাল চলবে।</span>
                                        </div>
                                    )}

                                    {/* Expiry summary hint */}
                                    {expiryCategory !== 'never' && (
                                        <p className="text-[11px] text-amber-400/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-1.5">
                                            <span>⏳</span>
                                            <span>
                                                এই কী-টি তৈরির পর ঠিক{' '}
                                                <strong>
                                                    {expiryCategory === 'hourly'
                                                        ? selectedPreset.replace('h', ' ঘণ্টা')
                                                        : expiryCategory === 'daily'
                                                        ? selectedPreset.replace('d', ' দিন')
                                                        : `${customAmount} ${customUnit === 'hours' ? 'ঘণ্টা' : 'দিন'}`}
                                                </strong>{' '}
                                                পর নিজে থেকেই অকার্যকর (Expire) হয়ে যাবে।
                                            </span>
                                        </p>
                                    )}
                                </div>

                                {/* Advanced Accordion (Optional Domain Whitelist) */}
                                <div className="pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowAdvancedModal(!showAdvancedModal)}
                                        className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 font-semibold"
                                    >
                                        <span>{showAdvancedModal ? '▼' : '▶'}</span>
                                        <span>উন্নত অপশন: নির্দিষ্ট ডোমেইন বেঁধে দিন (ঐচ্ছিক)</span>
                                    </button>

                                    {showAdvancedModal && (
                                        <div className="mt-2.5 p-3.5 rounded-2xl bg-black/50 border border-white/5 space-y-1.5 animate-fade-in">
                                            <label className="text-[11px] text-gray-300 block">Allowed Domain(s)</label>
                                            <input
                                                type="text"
                                                value={newKeyOrigins}
                                                onChange={(e) => setNewKeyOrigins(e.target.value)}
                                                placeholder="* অথবা https://moviebari.com"
                                                className="w-full px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-white font-mono"
                                            />
                                            <p className="text-[10px] text-gray-500">
                                                &apos;*&apos; রাখলে যেকোনো সাইট থেকে কল করা যাবে। আর যদি চান শুধু তার ওয়েবসাইট ছাড়া আর কেউ চালাতে না পারে, তবে তার সাইটের লিংক লিখে দিন।
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Modal Actions */}
                                <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                                    >
                                        বাতিল
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingKey}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black text-xs transition-all shadow-lg shadow-red-900/30 disabled:opacity-50 active:scale-95 flex items-center gap-2"
                                    >
                                        {creatingKey ? 'তৈরি হচ্ছে...' : '⚡ API Key তৈরি করুন'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
