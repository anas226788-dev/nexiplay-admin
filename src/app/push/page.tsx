'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface PushConfigState {
    onesignalAppId: string;
    hasRestApiKey: boolean;
    maskedRestApiKey: string;
    autoPushEpisodes: boolean;
    autoPushMovies: boolean;
    autoPushNotices: boolean;
    keySource: 'database' | 'env' | 'none';
    hasTableSupport: boolean;
}

interface ContentOption {
    id: string;
    title: string;
    slug: string;
    type: string;
    poster_url?: string | null;
}

export default function PushAlertsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [config, setConfig] = useState<PushConfigState>({
        onesignalAppId: '69822dc3-4533-4b09-b105-d0ddaeb22c1f',
        hasRestApiKey: false,
        maskedRestApiKey: '',
        autoPushEpisodes: true,
        autoPushMovies: true,
        autoPushNotices: true,
        keySource: 'none',
        hasTableSupport: false,
    });
    const [restApiKeyInput, setRestApiKeyInput] = useState('');

    // Manual Broadcast State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [channel, setChannel] = useState<'episodes' | 'releases' | 'alerts'>('episodes');
    const [selectedMovieId, setSelectedMovieId] = useState('');
    const [seasonNumber, setSeasonNumber] = useState('');
    const [episodeNumber, setEpisodeNumber] = useState('');
    const [saveToFeed, setSaveToFeed] = useState(true);
    const [movies, setMovies] = useState<ContentOption[]>([]);
    const [movieSearch, setMovieSearch] = useState('');

    useEffect(() => {
        loadInitial();
    }, []);

    async function loadInitial() {
        setLoading(true);
        try {
            const [cfgRes, moviesRes] = await Promise.all([
                fetch('/api/push/config', { cache: 'no-store' }),
                supabase
                    .from('movies')
                    .select('id, title, slug, type, poster_url')
                    .order('updated_at', { ascending: false })
                    .limit(120),
            ]);
            const cfgJson = await cfgRes.json();
            if (cfgRes.ok && cfgJson.ok && cfgJson.config) {
                setConfig(cfgJson.config);
            }
            if (moviesRes.data) {
                setMovies(moviesRes.data);
            }
        } catch (err) {
            console.error('Push init error:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveConfig(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setStatusMsg(null);
        try {
            const res = await fetch('/api/push/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    onesignalAppId: config.onesignalAppId,
                    onesignalRestApiKey: restApiKeyInput.trim() || undefined,
                    autoPushEpisodes: config.autoPushEpisodes,
                    autoPushMovies: config.autoPushMovies,
                    autoPushNotices: config.autoPushNotices,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Failed to save OneSignal configuration');
            }
            setConfig(data.config);
            setRestApiKeyInput('');
            setStatusMsg({ type: 'success', text: 'OneSignal Push configuration saved securely.' });
        } catch (err: any) {
            setStatusMsg({ type: 'error', text: err?.message || 'Failed to save push configuration' });
        } finally {
            setSaving(false);
        }
    }

    async function handleSendBroadcast(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            setStatusMsg({ type: 'error', text: 'Title and message are required.' });
            return;
        }
        setSending(true);
        setStatusMsg(null);
        try {
            const targetMovie = movies.find((m) => m.id === selectedMovieId);
            const res = await fetch('/api/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'manual',
                    title: title.trim(),
                    message: message.trim(),
                    imageUrl: imageUrl.trim() || targetMovie?.poster_url || null,
                    channel,
                    movieId: targetMovie?.id || null,
                    contentType: targetMovie?.type || null,
                    slug: targetMovie?.slug || null,
                    seasonNumber: seasonNumber ? Number(seasonNumber) : null,
                    episodeNumber: episodeNumber ? Number(episodeNumber) : null,
                    saveToInAppFeed: saveToFeed,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'Push dispatch failed');
            }
            setStatusMsg({
                type: 'success',
                text: `Push sent via OneSignal (ID: ${data.notificationId || 'queued'}, recipients: ${data.recipients ?? 0}).`,
            });
        } catch (err: any) {
            setStatusMsg({ type: 'error', text: err?.message || 'Push send failed' });
        } finally {
            setSending(false);
        }
    }

    const filteredMovies = movies.filter((m) =>
        m.title.toLowerCase().includes(movieSearch.trim().toLowerCase())
    );

    if (loading) {
        return <div className="p-8 text-gray-300">Loading Push Notification Center...</div>;
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-400/30 flex items-center justify-center text-lg">
                            🔔
                        </span>
                        Push Notification Center
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Send instant background push notifications to the NexiPlay Android app via OneSignal.
                    </p>
                </div>
                <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border self-start ${
                        config.hasRestApiKey
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                >
                    {config.hasRestApiKey ? `✅ Key Active (${config.keySource})` : '⚠️ REST API Key Missing'}
                </span>
            </div>

            {statusMsg && (
                <div
                    className={`p-4 rounded-xl border text-sm font-medium ${
                        statusMsg.type === 'success'
                            ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
                            : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
                    }`}
                >
                    {statusMsg.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Send Broadcast Push */}
                <form
                    onSubmit={handleSendBroadcast}
                    className="glass p-6 rounded-2xl border border-white/10 space-y-4"
                >
                    <h2 className="text-lg font-bold text-white">Send Instant Push Alert</h2>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            Channel Type
                        </label>
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value as 'episodes' | 'releases' | 'alerts')}
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white"
                        >
                            <option value="episodes">New Episodes (nexiplay_episodes_channel)</option>
                            <option value="releases">New Movies / Anime (nexiplay_releases_channel)</option>
                            <option value="alerts">Official Announcements (nexiplay_alerts_channel)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            Target Movie / Anime (Optional Deep-Link)
                        </label>
                        <input
                            type="text"
                            placeholder="Search title..."
                            value={movieSearch}
                            onChange={(e) => setMovieSearch(e.target.value)}
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2 text-xs text-white mb-2"
                        />
                        <select
                            value={selectedMovieId}
                            onChange={(e) => {
                                const id = e.target.value;
                                setSelectedMovieId(id);
                                const m = movies.find((item) => item.id === id);
                                if (m?.poster_url && !imageUrl) setImageUrl(m.poster_url);
                            }}
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white"
                        >
                            <option value="">-- General Notification (Open Notifications Tab) --</option>
                            {filteredMovies.slice(0, 60).map((m) => (
                                <option key={m.id} value={m.id}>
                                    [{m.type.toUpperCase()}] {m.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedMovieId && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Season # (optional)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={seasonNumber}
                                    onChange={(e) => setSeasonNumber(e.target.value)}
                                    placeholder="1"
                                    className="w-full bg-dark-800 border border-white/10 rounded-xl p-2 text-sm text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Episode # (optional)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={episodeNumber}
                                    onChange={(e) => setEpisodeNumber(e.target.value)}
                                    placeholder="5"
                                    className="w-full bg-dark-800 border border-white/10 rounded-xl p-2 text-sm text-white"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            Notification Title
                        </label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="🔥 Solo Leveling — S2 · EP 12 Out Now!"
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            Message
                        </label>
                        <textarea
                            required
                            rows={3}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="New episode is now streaming in Full HD on NexiPlay!"
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            Banner / Poster Image URL (optional)
                        </label>
                        <input
                            type="url"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white"
                        />
                    </div>

                    <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={saveToFeed}
                            onChange={(e) => setSaveToFeed(e.target.checked)}
                            className="rounded"
                        />
                        Also show inside the in-app Notifications feed
                    </label>

                    <button
                        type="submit"
                        disabled={sending}
                        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
                    >
                        {sending ? 'Sending Push...' : 'Send Push Notification'}
                    </button>
                </form>

                {/* Right: OneSignal Configuration */}
                <form
                    onSubmit={handleSaveConfig}
                    className="glass p-6 rounded-2xl border border-white/10 space-y-4"
                >
                    <h2 className="text-lg font-bold text-white">OneSignal Auto-Push Settings</h2>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            OneSignal App ID (Synced with NexiPlay Android App)
                        </label>
                        <input
                            type="text"
                            value={config.onesignalAppId}
                            onChange={(e) => setConfig({ ...config, onesignalAppId: e.target.value })}
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                            OneSignal REST API Key
                        </label>
                        <input
                            type="password"
                            value={restApiKeyInput}
                            onChange={(e) => setRestApiKeyInput(e.target.value)}
                            placeholder={
                                config.hasRestApiKey
                                    ? `Saved (${config.maskedRestApiKey}) — paste to replace`
                                    : 'Paste OneSignal App API Key (os_v2_app_...)'
                            }
                            className="w-full bg-dark-800 border border-white/10 rounded-xl p-2.5 text-sm text-white font-mono"
                        />
                        <p className="text-[11px] text-gray-500 mt-1">
                            Stored server-side only (blocked from public/anon reads). You can also set{' '}
                            <code className="text-violet-300">ONESIGNAL_REST_API_KEY</code> in Vercel env vars.
                        </p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-white/10">
                        <label className="flex items-center justify-between text-sm text-gray-200 cursor-pointer">
                            <span>Auto-push on New Episode / Cron Scrape</span>
                            <input
                                type="checkbox"
                                checked={config.autoPushEpisodes}
                                onChange={(e) => setConfig({ ...config, autoPushEpisodes: e.target.checked })}
                            />
                        </label>
                        <label className="flex items-center justify-between text-sm text-gray-200 cursor-pointer">
                            <span>Auto-push on New Movie / Anime Added</span>
                            <input
                                type="checkbox"
                                checked={config.autoPushMovies}
                                onChange={(e) => setConfig({ ...config, autoPushMovies: e.target.checked })}
                            />
                        </label>
                        <label className="flex items-center justify-between text-sm text-gray-200 cursor-pointer">
                            <span>Auto-push on New Admin Notice</span>
                            <input
                                type="checkbox"
                                checked={config.autoPushNotices}
                                onChange={(e) => setConfig({ ...config, autoPushNotices: e.target.checked })}
                            />
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-sm transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save OneSignal Settings'}
                    </button>

                    <div className="p-3.5 rounded-xl bg-dark-900/70 border border-white/5 text-xs text-gray-400 space-y-1.5">
                        <p className="font-bold text-gray-200">Required OneSignal Console Check:</p>
                        <p>
                            1. Open OneSignal Dashboard → App <code className="text-violet-300">{config.onesignalAppId}</code> → Settings → Keys & IDs → copy <strong>App API Key</strong> above.
                        </p>
                        <p>
                            2. Under <strong>Platforms → Google Android (FCM)</strong>, verify Firebase project{' '}
                            <code className="text-violet-300">nexiplay-app-f97c1</code> Service Account JSON is uploaded so FCM wakes closed devices immediately.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
