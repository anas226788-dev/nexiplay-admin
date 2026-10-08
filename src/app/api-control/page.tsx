'use client';

import { useState, useEffect } from 'react';
import AdminShell from '@/components/AdminShell';

interface StreamApiSettings {
    isEnabled: boolean;
    accessMode: 'strict' | 'demo_allowed' | 'open';
    defaultTtlSeconds: number;
    requireOriginMatch: boolean;
    updatedAt: string;
}

interface StreamApiKey {
    id: string;
    name: string;
    key: string;
    type: 'test' | 'production';
    isActive: boolean;
    allowedOrigins: string[];
    rateLimitPerDay: number;
    totalRequests: number;
    lastUsedAt?: string | null;
    lastUsedIp?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ApiStats {
    totalKeys: number;
    activeKeys: number;
    disabledKeys: number;
    productionKeys: number;
    testKeys: number;
    totalRequests: number;
}

export default function ApiControlPage() {
    const [settings, setSettings] = useState<StreamApiSettings | null>(null);
    const [keys, setKeys] = useState<StreamApiKey[]>([]);
    const [stats, setStats] = useState<ApiStats>({
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
    const [filterTab, setFilterTab] = useState<'all' | 'active' | 'disabled' | 'production' | 'test'>('all');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});

    // Modal State: Create Key
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyType, setNewKeyType] = useState<'production' | 'test'>('production');
    const [newKeyOrigins, setNewKeyOrigins] = useState('*');
    const [newKeyRateLimit, setNewKeyRateLimit] = useState('0');
    const [newKeyExpiry, setNewKeyExpiry] = useState<'never' | '7days' | '30days' | '90days'>('never');
    const [creatingKey, setCreatingKey] = useState(false);

    // Live Tester State
    const [testKeyId, setTestKeyId] = useState<string>('');
    const [testSlug, setTestSlug] = useState('blue-box-2026');
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/stream-api');
            const data = await res.json();
            if (data.ok) {
                setSettings(data.settings);
                setKeys(data.keys);
                setStats(data.stats);
                if (data.keys.length > 0 && !testKeyId) {
                    setTestKeyId(data.keys[0].id);
                }
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to load Stream API data' });
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showToast = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    // Save global settings
    const handleSaveSettings = async () => {
        if (!settings) return;
        setSavingSettings(true);
        try {
            const res = await fetch('/api/admin/stream-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_settings',
                    settings
                })
            });
            const data = await res.json();
            if (data.ok) {
                setSettings(data.settings);
                showToast('success', 'Stream API settings saved successfully!');
            } else {
                showToast('error', data.error || 'Failed to save settings');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setSavingSettings(false);
        }
    };

    // Toggle active / disabled state of key
    const handleToggleKey = async (id: string, currentState: boolean) => {
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
            if (data.ok) {
                setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: !currentState } : k));
                setStats(prev => ({
                    ...prev,
                    activeKeys: !currentState ? prev.activeKeys + 1 : prev.activeKeys - 1,
                    disabledKeys: !currentState ? prev.disabledKeys - 1 : prev.disabledKeys + 1
                }));
                showToast('success', `API Key ${!currentState ? 'activated' : 'disabled / suspended'}.`);
            } else {
                showToast('error', data.error || 'Failed to toggle key status');
            }
        } catch (err: any) {
            showToast('error', err.message);
        }
    };

    // Delete / revoke key
    const handleDeleteKey = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to permanently revoke and delete the API key for "${name}"?`)) {
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
            if (data.ok) {
                setKeys(prev => prev.filter(k => k.id !== id));
                showToast('success', `API Key for "${name}" revoked and deleted.`);
                loadData();
            } else {
                showToast('error', data.error || 'Failed to delete key');
            }
        } catch (err: any) {
            showToast('error', err.message);
        }
    };

    // Create new key
    const handleCreateKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyName.trim()) {
            showToast('error', 'Please enter a client or integration name');
            return;
        }

        setCreatingKey(true);
        let expiresAt: string | null = null;
        if (newKeyExpiry === '7days') {
            expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        } else if (newKeyExpiry === '30days') {
            expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
        } else if (newKeyExpiry === '90days') {
            expiresAt = new Date(Date.now() + 90 * 86400000).toISOString();
        }

        const allowedOrigins = newKeyOrigins.split(',').map(s => s.trim()).filter(Boolean);

        try {
            const res = await fetch('/api/admin/stream-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create_key',
                    name: newKeyName,
                    type: newKeyType,
                    allowedOrigins: allowedOrigins.length ? allowedOrigins : ['*'],
                    rateLimitPerDay: Number(newKeyRateLimit) || 0,
                    expiresAt
                })
            });
            const data = await res.json();
            if (data.ok) {
                setIsCreateModalOpen(false);
                setNewKeyName('');
                setNewKeyOrigins('*');
                setNewKeyRateLimit('0');
                setNewKeyExpiry('never');
                showToast('success', `API Key created for "${data.key.name}"!`);
                loadData();
            } else {
                showToast('error', data.error || 'Failed to create key');
            }
        } catch (err: any) {
            showToast('error', err.message);
        } finally {
            setCreatingKey(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
            setCopiedKey(id);
            setTimeout(() => setCopiedKey(null), 2000);
        }
    };

    const toggleRevealKey = (id: string) => {
        setRevealedKeyIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Run test stream with selected key
    const runTestStream = async () => {
        const selected = keys.find(k => k.id === testKeyId);
        if (!selected) {
            showToast('error', 'Select a key to test');
            return;
        }

        setTestLoading(true);
        setTestResult(null);
        const start = performance.now();

        try {
            const testUrl = `http://localhost:3000/api/v1/anime/stream?slug=${encodeURIComponent(testSlug.trim())}&season=1&episode=1&apiKey=${encodeURIComponent(selected.key)}`;
            const res = await fetch(testUrl);
            const data = await res.json();
            const latency = Math.round(performance.now() - start);

            setTestResult({
                status: res.status,
                ok: res.ok,
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

    // Filter keys
    const filteredKeys = keys.filter(k => {
        const matchesSearch = k.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              k.key.toLowerCase().includes(searchTerm.toLowerCase());
        if (!matchesSearch) return false;

        if (filterTab === 'active') return k.isActive;
        if (filterTab === 'disabled') return !k.isActive;
        if (filterTab === 'production') return k.type === 'production';
        if (filterTab === 'test') return k.type === 'test';
        return true;
    });

    const selectedKeyForCode = keys.find(k => k.id === testKeyId) || keys[0];

    return (
        <AdminShell>
            <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-600/20 text-red-400 border border-red-500/30">
                                🔐 Protected Core Engine
                            </span>
                            <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                                settings?.isEnabled
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${settings?.isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                                {settings?.isEnabled ? 'API Gateway Active' : 'API Gateway Paused'}
                            </span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">
                            Stream API Control & Keys Management
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Issue test & production API keys, grant or revoke client access with 1 click, and protect your streaming infrastructure.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs transition-all shadow-lg shadow-red-900/30 flex items-center gap-2"
                        >
                            <span>+</span>
                            <span>Issue New API Key</span>
                        </button>
                    </div>
                </div>

                {/* Toast Notification */}
                {message && (
                    <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between transition-all ${
                        message.type === 'success'
                            ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                            : 'bg-red-950/60 border border-red-500/30 text-red-300'
                    }`}>
                        <span>{message.text}</span>
                        <button onClick={() => setMessage(null)} className="text-gray-400 hover:text-white">✕</button>
                    </div>
                )}

                {/* 1. Stats Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Master Switch Card */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-2">
                        <span className="text-[11px] font-bold uppercase text-gray-500">Master Switch</span>
                        <div className="flex items-center justify-between">
                            <span className={`text-xl font-black ${settings?.isEnabled ? 'text-emerald-400' : 'text-red-500'}`}>
                                {settings?.isEnabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!settings) return;
                                    setSettings({ ...settings, isEnabled: !settings.isEnabled });
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                    settings?.isEnabled
                                        ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                }`}
                            >
                                {settings?.isEnabled ? 'Turn Off' : 'Turn On'}
                            </button>
                        </div>
                    </div>

                    {/* Active Keys */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
                        <span className="text-[11px] font-bold uppercase text-gray-500">Active Keys</span>
                        <div className="text-2xl font-black text-white">
                            {stats.activeKeys}
                            <span className="text-xs font-normal text-gray-500 ml-2">/ {stats.totalKeys} total</span>
                        </div>
                        <p className="text-[11px] text-gray-400">{stats.disabledKeys} suspended / revoked</p>
                    </div>

                    {/* Requests Served */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
                        <span className="text-[11px] font-bold uppercase text-gray-500">Total Stream Requests</span>
                        <div className="text-2xl font-black text-purple-400">
                            {stats.totalRequests.toLocaleString()}
                        </div>
                        <p className="text-[11px] text-gray-400">Across all connected clients</p>
                    </div>

                    {/* Tiers Distribution */}
                    <div className="p-5 rounded-2xl bg-[#111118] border border-white/10 space-y-1">
                        <span className="text-[11px] font-bold uppercase text-gray-500">Key Distribution</span>
                        <div className="text-2xl font-black text-orange-400">
                            {stats.productionKeys} <span className="text-xs text-gray-400 font-medium">Prod</span> &bull; {stats.testKeys} <span className="text-xs text-gray-400 font-medium">Test</span>
                        </div>
                        <p className="text-[11px] text-gray-400">Categorized by client purpose</p>
                    </div>
                </div>

                {/* 2. Global Stream Settings Card */}
                {settings && (
                    <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <div>
                                <h2 className="text-base font-bold text-white flex items-center gap-2">
                                    <span>⚙️</span> Global Security & Gateway Rules
                                </h2>
                                <p className="text-xs text-gray-400">
                                    Control how strictly requests must be authenticated and how long tokens remain valid.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md shadow-red-900/30 disabled:opacity-50"
                            >
                                {savingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Access Mode */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-300 block">
                                    Security Enforcement Mode
                                </label>
                                <select
                                    value={settings.accessMode}
                                    onChange={(e) => setSettings({ ...settings, accessMode: e.target.value as any })}
                                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                                >
                                    <option value="demo_allowed">Demo Allowed (Internal Free, External Requires Key)</option>
                                    <option value="strict">Strict Mode (Valid API Key Required for ALL)</option>
                                    <option value="open">Open Mode (Public Access without Key)</option>
                                </select>
                                <p className="text-[11px] text-gray-500">
                                    {settings.accessMode === 'strict' && '🔒 All requests must pass a valid, active API key.'}
                                    {settings.accessMode === 'demo_allowed' && '⚡ NexiPlay playground is free; outside websites require an API key.'}
                                    {settings.accessMode === 'open' && '🌐 Anyone can use the API without authentication.'}
                                </p>
                            </div>

                            {/* Token Validity */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-300 block">
                                    AES Token Expiration (TTL)
                                </label>
                                <select
                                    value={settings.defaultTtlSeconds}
                                    onChange={(e) => setSettings({ ...settings, defaultTtlSeconds: Number(e.target.value) })}
                                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                                >
                                    <option value={3600}>1 Hour (3,600s)</option>
                                    <option value={7200}>2 Hours (7,200s - Recommended)</option>
                                    <option value={21600}>6 Hours (21,600s)</option>
                                    <option value={86400}>24 Hours (86,400s)</option>
                                </select>
                                <p className="text-[11px] text-gray-500">
                                    Generated playback tokens auto-expire after this duration to prevent link sharing.
                                </p>
                            </div>

                            {/* Origin Whitelist Enforcement */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-300 block">
                                    Domain / Origin Validation
                                </label>
                                <div className="flex items-center gap-3 pt-1">
                                    <input
                                        type="checkbox"
                                        id="originMatch"
                                        checked={settings.requireOriginMatch}
                                        onChange={(e) => setSettings({ ...settings, requireOriginMatch: e.target.checked })}
                                        className="w-4 h-4 rounded text-red-600 bg-black/50 border-white/20 focus:ring-0"
                                    />
                                    <label htmlFor="originMatch" className="text-xs text-gray-300 font-medium cursor-pointer">
                                        Enforce Allowed Domains / Origins
                                    </label>
                                </div>
                                <p className="text-[11px] text-gray-500">
                                    Block requests if the browser Origin/Referer does not match the key&apos;s allowed domain list.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. API Keys Table & Management */}
                <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <span>🔑</span> Client API Keys ({filteredKeys.length})
                            </h2>
                            <p className="text-xs text-gray-400">
                                Give keys to third-party developers, test users, or your mobile apps. Toggle status to instantly cut off access.
                            </p>
                        </div>

                        {/* Search & Tabs */}
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            <input
                                type="text"
                                placeholder="Search client or key..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                            />

                            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('all')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterTab === 'all' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('active')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterTab === 'active' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Active
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('disabled')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterTab === 'disabled' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Disabled
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('test')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterTab === 'test' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Test
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('production')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterTab === 'production' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    Prod
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Keys Table */}
                    {loading ? (
                        <div className="py-12 text-center text-gray-500 text-xs">
                            <span className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin inline-block mb-2" />
                            <p>Loading API Keys...</p>
                        </div>
                    ) : filteredKeys.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 text-xs">
                            <p className="text-base mb-1">No API keys found.</p>
                            <p className="text-gray-600 mb-4">Issue a new key above to grant access to clients or tests.</p>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold"
                            >
                                + Issue First API Key
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b border-white/5 text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                                        <th className="py-3 px-3">Client / Name</th>
                                        <th className="py-3 px-3">API Key</th>
                                        <th className="py-3 px-3 text-center">Status Access</th>
                                        <th className="py-3 px-3">Allowed Domains</th>
                                        <th className="py-3 px-3 text-center">Requests</th>
                                        <th className="py-3 px-3">Expires</th>
                                        <th className="py-3 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {filteredKeys.map((item) => {
                                        const isRevealed = revealedKeyIds[item.id];
                                        const displayKey = isRevealed
                                            ? item.key
                                            : item.key.slice(0, 12) + '••••••••••••••••' + item.key.slice(-4);

                                        return (
                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                {/* Client Name & Type */}
                                                <td className="py-3.5 px-3">
                                                    <div className="font-bold text-white flex items-center gap-2">
                                                        <span>{item.name}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide ${
                                                            item.type === 'production'
                                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                        }`}>
                                                            {item.type}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-500 block mt-0.5">
                                                        Issued: {new Date(item.createdAt).toLocaleDateString()}
                                                    </span>
                                                </td>

                                                {/* API Key */}
                                                <td className="py-3.5 px-3 font-mono text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-black/60 px-2 py-1 rounded-lg border border-white/5 text-gray-300">
                                                            {displayKey}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleRevealKey(item.id)}
                                                            className="text-gray-400 hover:text-white text-[11px]"
                                                            title={isRevealed ? 'Hide' : 'Reveal'}
                                                        >
                                                            {isRevealed ? '👁️' : '🔒'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(item.key, item.id)}
                                                            className="text-gray-400 hover:text-red-400 text-[11px]"
                                                            title="Copy Key"
                                                        >
                                                            {copiedKey === item.id ? '✓' : '📋'}
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Status (1-Click Toggle Switch) */}
                                                <td className="py-3.5 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleKey(item.id, item.isActive)}
                                                        className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1.5 ${
                                                            item.isActive
                                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30'
                                                                : 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-emerald-500/15 hover:text-emerald-300 hover:border-emerald-500/30'
                                                        }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                        {item.isActive ? 'Active (ON)' : 'Disabled (OFF)'}
                                                    </button>
                                                </td>

                                                {/* Allowed Domains */}
                                                <td className="py-3.5 px-3">
                                                    <span className="font-mono text-[11px] text-gray-400">
                                                        {item.allowedOrigins?.join(', ') || '*'}
                                                    </span>
                                                </td>

                                                {/* Requests */}
                                                <td className="py-3.5 px-3 text-center">
                                                    <span className="font-bold text-white">
                                                        {item.totalRequests.toLocaleString()}
                                                    </span>
                                                    {item.lastUsedAt && (
                                                        <span className="block text-[10px] text-gray-500">
                                                            {new Date(item.lastUsedAt).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Expires */}
                                                <td className="py-3.5 px-3">
                                                    {item.expiresAt ? (
                                                        <span className={`text-[11px] ${
                                                            new Date(item.expiresAt).getTime() < Date.now()
                                                                ? 'text-red-400 font-bold'
                                                                : 'text-amber-400'
                                                        }`}>
                                                            {new Date(item.expiresAt).toLocaleDateString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-gray-500">Never</span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteKey(item.id, item.name)}
                                                        className="px-2.5 py-1 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 font-bold text-[11px] border border-red-500/10 transition-colors"
                                                    >
                                                        Revoke
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 4. Live API Tester & Snippet Generator */}
                <div className="p-6 rounded-2xl bg-[#111118] border border-white/10 space-y-5">
                    <div className="border-b border-white/5 pb-4">
                        <h2 className="text-base font-bold text-white flex items-center gap-2">
                            <span>🧪</span> Test API Key & Quick Code Generator
                        </h2>
                        <p className="text-xs text-gray-400">
                            Test any active key against the live server and get instant copy-paste code snippets for your clients.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-5 space-y-1.5">
                            <label className="text-xs font-bold text-gray-400">Select API Key</label>
                            <select
                                value={testKeyId}
                                onChange={(e) => setTestKeyId(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                            >
                                {keys.map(k => (
                                    <option key={k.id} value={k.id}>
                                        {k.name} ({k.type.toUpperCase()}) - {k.isActive ? 'Active' : 'Disabled'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-4 space-y-1.5">
                            <label className="text-xs font-bold text-gray-400">Anime Slug</label>
                            <input
                                type="text"
                                value={testSlug}
                                onChange={(e) => setTestSlug(e.target.value)}
                                placeholder="e.g. blue-box-2026 or bleach-thousand-year-blood-war-2026"
                                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                            />
                        </div>

                        <div className="md:col-span-3">
                            <button
                                type="button"
                                onClick={runTestStream}
                                disabled={testLoading || !testKeyId}
                                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs transition-all shadow-md shadow-red-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {testLoading ? 'Testing...' : '▶ Test Stream with Key'}
                            </button>
                        </div>
                    </div>

                    {/* Test Results Output */}
                    {testResult && (
                        <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                            testResult.ok
                                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                                : 'bg-red-950/20 border-red-500/30 text-red-200'
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="font-bold">
                                    HTTP {testResult.status} &bull; {testResult.latency} ms
                                </span>
                                <span>{testResult.ok ? '✓ Authorization Passed' : '✕ Authorization Rejected'}</span>
                            </div>
                            <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-all text-[11px] text-gray-300">
                                {JSON.stringify(testResult.data || testResult.error, null, 2)}
                            </pre>
                        </div>
                    )}

                    {/* Code Snippet Box */}
                    {selectedKeyForCode && (
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">
                                    📋 Code Snippet for Client: {selectedKeyForCode.name}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(
                                        `fetch('https://your-domain.com/api/v1/anime/stream?slug=${testSlug}&season=1&episode=1&apiKey=${selectedKeyForCode.key}')\n  .then(res => res.json())\n  .then(data => console.log(data.playbackUrl));`,
                                        'snippet'
                                    )}
                                    className="text-xs text-red-400 hover:text-white font-bold underline"
                                >
                                    {copiedKey === 'snippet' ? '✓ Copied' : 'Copy JS Snippet'}
                                </button>
                            </div>
                            <pre className="p-3.5 rounded-xl bg-black/60 border border-white/5 font-mono text-xs text-blue-300 overflow-x-auto">
{`// 1. Fetch direct HLS Stream using client's API Key
const res = await fetch('https://your-domain.com/api/v1/anime/stream?slug=${testSlug}&season=1&episode=1&apiKey=${selectedKeyForCode.key}');
const data = await res.json();

if (data.success) {
  // Pass data.playbackUrl into video player (HLS.js / Plyr / ExoPlayer)
  console.log("Stream URL:", data.playbackUrl);
}`}
                            </pre>
                        </div>
                    )}
                </div>
            </div>

            {/* CREATE API KEY MODAL */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#111118] border border-white/10 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <span>🔑</span> Issue New API Key
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-gray-400 hover:text-white text-sm"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateKey} className="space-y-4">
                            {/* Client Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300">
                                    Client / Integration Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. MovieBari Web, Test User - Karim, iOS App"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                                />
                            </div>

                            {/* Tier Type */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300">Access Purpose</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setNewKeyType('production')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            newKeyType === 'production'
                                                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                                                : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="font-bold text-xs">🚀 Production (Real Use)</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">Permanent / Live website access</div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setNewKeyType('test')}
                                        className={`p-3 rounded-xl border text-left transition-all ${
                                            newKeyType === 'test'
                                                ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                                                : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="font-bold text-xs">🧪 Test / Trial</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">Evaluation or temporary testing</div>
                                    </button>
                                </div>
                            </div>

                            {/* Allowed Domains */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300">
                                    Allowed Domains / Origins (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="* for any, or https://moviebari.space, https://app.com"
                                    value={newKeyOrigins}
                                    onChange={(e) => setNewKeyOrigins(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
                                />
                                <p className="text-[10px] text-gray-500">
                                    Leave as &quot;*&quot; to allow requests from any website or mobile app.
                                </p>
                            </div>

                            {/* Expiration */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-300">Key Expiration (Trial Duration)</label>
                                <select
                                    value={newKeyExpiry}
                                    onChange={(e) => setNewKeyExpiry(e.target.value as any)}
                                    className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                                >
                                    <option value="never">Never (Permanent Key)</option>
                                    <option value="7days">7 Days Trial</option>
                                    <option value="30days">30 Days Trial</option>
                                    <option value="90days">90 Days</option>
                                </select>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingKey}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold text-xs transition-all shadow-md shadow-red-900/30 disabled:opacity-50"
                                >
                                    {creatingKey ? 'Generating...' : 'Generate API Key'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
