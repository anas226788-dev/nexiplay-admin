'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Profile = {
    id: string;
    email: string | null;
    display_name: string | null;
    whatsapp_number: string | null;
    avatar_url: string | null;
    hide_nsfw: boolean | null;
    created_at: string | null;
    last_seen_at: string | null;
};

type UserSession = {
    session_id: string;
    user_id: string;
    started_at: string | null;
    last_seen_at: string | null;
    duration_seconds: number | null;
    page_url: string | null;
    device_type: string | null;
    user_agent?: string | null;
};

type UserEvent = {
    id: string;
    user_id: string;
    event_type: 'page_view' | 'watch' | 'download';
    movie_id: string | null;
    episode_id: string | null;
    content_type: string | null;
    content_title: string | null;
    season_number: number | null;
    episode_number: number | null;
    provider: string | null;
    resolution: string | null;
    duration_seconds: number | null;
    metadata?: any;
    created_at: string;
};

type UserNotification = {
    id: string;
    user_id: string;
    message: string;
    is_read: boolean;
    created_at: string;
};

function formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatDate(value?: string | null) {
    if (!value) return 'Never';
    return new Date(value).toLocaleString();
}

function isActive(lastSeen?: string | null) {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export default function UsersPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [events, setEvents] = useState<UserEvent[]>([]);
    const [notifications, setNotifications] = useState<UserNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [activeTab, setActiveTab] = useState<'events' | 'watch' | 'download' | 'sessions' | 'messages'>('events');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [profilesRes, sessionsRes, eventsRes, notifRes] = await Promise.all([
                supabase.from('profiles').select('*').order('created_at', { ascending: false }),
                supabase.from('user_sessions').select('*').order('last_seen_at', { ascending: false }).limit(1000),
                supabase.from('user_events').select('*').order('created_at', { ascending: false }).limit(3000),
                supabase.from('user_notifications').select('*').order('created_at', { ascending: false }).limit(1000)
            ]);

            if (profilesRes.error) throw profilesRes.error;
            if (sessionsRes.error) throw sessionsRes.error;
            if (eventsRes.error) throw eventsRes.error;
            if (notifRes.error) throw notifRes.error;

            setProfiles((profilesRes.data || []) as Profile[]);
            setSessions((sessionsRes.data || []) as UserSession[]);
            setEvents((eventsRes.data || []) as UserEvent[]);
            setNotifications((notifRes.data || []) as UserNotification[]);
        } catch (err: any) {
            setError(err.message || 'Failed to load users analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const analytics = useMemo(() => {
        const activeUsers = profiles.filter(profile => isActive(profile.last_seen_at)).length;
        const totalSeconds = sessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
        const watchEvents = events.filter(event => event.event_type === 'watch');
        const downloadEvents = events.filter(event => event.event_type === 'download');

        const users = profiles.map(profile => {
            const userEvents = events.filter(event => event.user_id === profile.id);
            const userSessions = sessions.filter(session => session.user_id === profile.id);
            const userNotifications = notifications.filter(notif => notif.user_id === profile.id);
            const watches = userEvents.filter(event => event.event_type === 'watch');
            const downloads = userEvents.filter(event => event.event_type === 'download');
            const animeWatches = watches.filter(event => event.content_type === 'anime');
            const animeDownloads = downloads.filter(event => event.content_type === 'anime');
            const watchedTitles = new Set(watches.map(event => event.movie_id || event.content_title).filter(Boolean));
            const downloadedTitles = new Set(downloads.map(event => event.movie_id || event.content_title).filter(Boolean));
            const totalTime = userSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);

            return {
                profile,
                active: isActive(profile.last_seen_at),
                totalTime,
                watchCount: watches.length,
                downloadCount: downloads.length,
                animeWatchCount: animeWatches.length,
                animeDownloadCount: animeDownloads.length,
                uniqueWatched: watchedTitles.size,
                uniqueDownloaded: downloadedTitles.size,
                lastEvent: userEvents[0],
                lastSession: userSessions[0],
                notifications: userNotifications
            };
        });

        users.sort((a, b) => {
            const aTime = a.profile.last_seen_at ? new Date(a.profile.last_seen_at).getTime() : 0;
            const bTime = b.profile.last_seen_at ? new Date(b.profile.last_seen_at).getTime() : 0;
            return bTime - aTime;
        });

        return {
            activeUsers,
            totalSeconds,
            watchEvents,
            downloadEvents,
            users
        };
    }, [events, profiles, sessions, notifications]);

    const [messageModalOpen, setMessageModalOpen] = useState(false);
    const [directMessageText, setDirectMessageText] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);

    const handleSendDirectMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !directMessageText.trim()) return;
        setSendingMessage(true);
        try {
            const res = await fetch('/api/send-user-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: selectedUser.profile.id,
                    message: directMessageText
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            alert('Message sent successfully!');
            setDirectMessageText('');
            setMessageModalOpen(false);
        } catch (err: any) {
            alert(err.message || 'Failed to send message.');
        } finally {
            setSendingMessage(false);
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this event log?')) return;
        try {
            const res = await fetch(`/api/delete-logs?type=event&id=${eventId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (err: any) {
            alert(err.message || 'Failed to delete event log.');
        }
    };

    const handleDeleteNotification = async (notifId: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            const res = await fetch(`/api/delete-logs?type=notification&id=${notifId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setNotifications(prev => prev.filter(n => n.id !== notifId));
        } catch (err: any) {
            alert(err.message || 'Failed to delete message.');
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this session log?')) return;
        try {
            const res = await fetch(`/api/delete-logs?type=session&id=${sessionId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        } catch (err: any) {
            alert(err.message || 'Failed to delete session log.');
        }
    };

    const handleClearAllUserLogs = async (userId: string) => {
        if (!confirm('WARNING: This will permanently delete ALL watch history, downloads, and sessions for this user. Are you sure you want to proceed?')) return;
        try {
            const res = await fetch(`/api/delete-logs?type=user_all&id=${userId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setEvents(prev => prev.filter(e => e.user_id !== userId));
            setSessions(prev => prev.filter(s => s.user_id !== userId));
            setSelectedUser((prev: any) => prev ? {
                ...prev,
                totalTime: 0,
                watchCount: 0,
                downloadCount: 0,
                animeWatchCount: 0,
                animeDownloadCount: 0,
                uniqueWatched: 0,
                uniqueDownloaded: 0
            } : null);
        } catch (err: any) {
            alert(err.message || 'Failed to clear user activity logs.');
        }
    };

    if (selectedUser) {
        const userEvents = events.filter(e => e.user_id === selectedUser.profile.id);
        const userSessions = sessions.filter(s => s.user_id === selectedUser.profile.id);
        const watches = userEvents.filter(e => e.event_type === 'watch');
        const downloads = userEvents.filter(e => e.event_type === 'download');

        return (
            <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header & Back Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => { setSelectedUser(null); setActiveTab('events'); }}
                            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all flex items-center justify-center border border-white/5"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        
                        {selectedUser.profile.avatar_url ? (
                            <img
                                src={selectedUser.profile.avatar_url}
                                alt={selectedUser.profile.display_name || 'User'}
                                className="w-14 h-14 rounded-xl object-cover border border-white/10 shadow-lg"
                            />
                        ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-white font-black text-xl shadow-lg border border-white/10">
                                {(selectedUser.profile.display_name || 'U').charAt(0).toUpperCase()}
                            </div>
                        )}

                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-white">{selectedUser.profile.display_name || 'User'}</h1>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${selectedUser.active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' : 'bg-white/10 text-gray-400 border border-white/10'}`}>
                                    {selectedUser.active ? 'Active Now' : 'Offline'}
                                </span>
                            </div>
                            <p className="text-gray-500 text-sm mt-1 flex flex-wrap items-center gap-2">
                                <span>{selectedUser.profile.email || selectedUser.profile.id}</span>
                                {selectedUser.profile.whatsapp_number && (
                                    <a
                                        href={`https://wa.me/${selectedUser.profile.whatsapp_number.replace(/[^0-9]/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold transition-all"
                                        title="Click to chat on WhatsApp"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        💬 WhatsApp: {selectedUser.profile.whatsapp_number}
                                    </a>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500 sm:text-right flex flex-col items-start sm:items-end gap-2">
                        <div>Account Created: <span className="text-gray-300 font-medium">{formatDate(selectedUser.profile.created_at)}</span></div>
                        <div>Last Active: <span className="text-gray-300 font-medium">{formatDate(selectedUser.profile.last_seen_at)}</span></div>
                        <div>WhatsApp Number: <span className="text-gray-300 font-medium">{selectedUser.profile.whatsapp_number || 'Not provided'}</span></div>
                        <div>18+ Hide Mode: <span className={`font-bold ${selectedUser.profile.hide_nsfw ? 'text-red-400 animate-pulse' : 'text-gray-400'}`}>{selectedUser.profile.hide_nsfw ? 'ENABLED (NSFW Hidden)' : 'DISABLED'}</span></div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            <button
                                onClick={() => setMessageModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Send Message
                            </button>
                            <button
                                onClick={() => handleClearAllUserLogs(selectedUser.profile.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Clear All Activity Logs
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Stat title="Total Sessions" value={userSessions.length.toString()} tone="red" />
                    <Stat title="Total Watch Time" value={formatDuration(selectedUser.totalTime)} tone="green" />
                    <Stat title="Watch Events" value={watches.length.toString()} tone="red" />
                    <Stat title="Downloads" value={downloads.length.toString()} tone="yellow" />
                </div>

                {/* Tabs & Details Area */}
                <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden bg-dark-950">
                    <div className="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/[0.01]">
                        <h2 className="text-lg font-black text-white">Activity Reports</h2>
                        <div className="flex flex-wrap gap-2 text-sm bg-white/5 p-1 rounded-xl border border-white/5 w-fit">
                            {[
                                { id: 'events', label: 'All History' },
                                { id: 'watch', label: 'Watches' },
                                { id: 'download', label: 'Downloads' },
                                { id: 'sessions', label: 'Sessions' },
                                { id: 'messages', label: 'Messages' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-red-600 text-white shadow-md shadow-red-900/20'
                                            : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {activeTab === 'events' && (
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-5 py-4">Event Type</th>
                                        <th className="text-left px-5 py-4">Title / Path</th>
                                        <th className="text-left px-5 py-4">Category</th>
                                        <th className="text-left px-5 py-4">Additional Info</th>
                                        <th className="text-left px-5 py-4">Timestamp</th>
                                        <th className="text-right px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {userEvents.map(event => (
                                        <tr key={event.id} className="hover:bg-white/[0.01]">
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                                                    event.event_type === 'watch' ? 'bg-red-500/15 text-red-400' :
                                                    event.event_type === 'download' ? 'bg-yellow-500/15 text-yellow-400' :
                                                    'bg-blue-500/15 text-blue-400'
                                                }`}>
                                                    {event.event_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-bold text-white">
                                                {event.content_title || (event.metadata?.path ? event.metadata.path : 'Site Visit')}
                                            </td>
                                            <td className="px-5 py-4 text-gray-400 uppercase text-xs font-bold">
                                                {event.content_type || 'system'}
                                            </td>
                                            <td className="px-5 py-4 text-gray-300">
                                                {event.event_type === 'watch' && (
                                                    <span className="flex flex-col gap-0.5 text-xs">
                                                        {event.season_number && <span>Season {event.season_number} Episode {event.episode_number}</span>}
                                                        {event.metadata?.server && <span className="text-gray-500">Server: {event.metadata.server}</span>}
                                                        {event.duration_seconds && <span className="text-red-400 font-semibold">{formatDuration(event.duration_seconds)}</span>}
                                                    </span>
                                                )}
                                                {event.event_type === 'download' && (
                                                    <span className="flex flex-col gap-0.5 text-xs">
                                                        {event.resolution && <span>Quality: {event.resolution}</span>}
                                                        {event.provider && <span className="text-yellow-400 font-semibold">Provider: {event.provider}</span>}
                                                    </span>
                                                )}
                                                {event.event_type === 'page_view' && (
                                                    <span className="text-xs text-gray-500">
                                                        {event.metadata?.query ? `Query: ${event.metadata.query}` : 'N/A'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-gray-400">{formatDate(event.created_at)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteEvent(event.id);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-all inline-flex items-center justify-center"
                                                    title="Delete Log"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {userEvents.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-10 text-center text-gray-500">No activity logs found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'watch' && (
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-5 py-4">Anime/Movie Title</th>
                                        <th className="text-left px-5 py-4">Type</th>
                                        <th className="text-left px-5 py-4">Episode</th>
                                        <th className="text-left px-5 py-4">Quality/Server</th>
                                        <th className="text-left px-5 py-4">Watch Duration</th>
                                        <th className="text-left px-5 py-4">Date</th>
                                        <th className="text-right px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {watches.map(event => (
                                        <tr key={event.id} className="hover:bg-white/[0.01]">
                                            <td className="px-5 py-4 font-bold text-white">{event.content_title}</td>
                                            <td className="px-5 py-4 text-gray-400 uppercase text-xs font-bold">{event.content_type || 'N/A'}</td>
                                            <td className="px-5 py-4 text-gray-300">
                                                {event.season_number ? `Season ${event.season_number} Episode ${event.episode_number}` : 'N/A'}
                                            </td>
                                            <td className="px-5 py-4 text-gray-400">
                                                {event.resolution && <span className="bg-white/5 px-2 py-1 rounded text-xs font-bold text-gray-300 mr-2 border border-white/5">{event.resolution}</span>}
                                                {event.metadata?.server && <span>Server: {event.metadata.server}</span>}
                                            </td>
                                            <td className="px-5 py-4 text-red-300 font-bold">
                                                {event.duration_seconds ? formatDuration(event.duration_seconds) : '0m'}
                                            </td>
                                            <td className="px-5 py-4 text-gray-400">{formatDate(event.created_at)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteEvent(event.id);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-all inline-flex items-center justify-center"
                                                    title="Delete Log"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {watches.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-5 py-10 text-center text-gray-500">No watch history records found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'download' && (
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-5 py-4">Content Title</th>
                                        <th className="text-left px-5 py-4">Type</th>
                                        <th className="text-left px-5 py-4">Episode</th>
                                        <th className="text-left px-5 py-4">Quality</th>
                                        <th className="text-left px-5 py-4">Download Provider</th>
                                        <th className="text-left px-5 py-4">Link Host</th>
                                        <th className="text-left px-5 py-4">Date</th>
                                        <th className="text-right px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {downloads.map(event => (
                                        <tr key={event.id} className="hover:bg-white/[0.01]">
                                            <td className="px-5 py-4 font-bold text-white">{event.content_title}</td>
                                            <td className="px-5 py-4 text-gray-400 uppercase text-xs font-bold">{event.content_type || 'N/A'}</td>
                                            <td className="px-5 py-4 text-gray-300">
                                                {event.season_number ? `Season ${event.season_number} Episode ${event.episode_number}` : 'N/A'}
                                            </td>
                                            <td className="px-5 py-4">
                                                {event.resolution ? (
                                                    <span className="bg-yellow-500/15 px-2.5 py-1 rounded text-xs font-bold text-yellow-300 border border-yellow-500/20">
                                                        {event.resolution}
                                                    </span>
                                                ) : 'N/A'}
                                            </td>
                                            <td className="px-5 py-4 text-gray-300 font-semibold">{event.provider || 'Direct'}</td>
                                            <td className="px-5 py-4 text-gray-500 max-w-[200px] truncate">{event.metadata?.url_host || 'N/A'}</td>
                                            <td className="px-5 py-4 text-gray-400">{formatDate(event.created_at)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteEvent(event.id);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-all inline-flex items-center justify-center"
                                                    title="Delete Log"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {downloads.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-10 text-center text-gray-500">No download logs found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'sessions' && (
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-5 py-4">Session ID</th>
                                        <th className="text-left px-5 py-4">Device</th>
                                        <th className="text-left px-5 py-4">Duration</th>
                                        <th className="text-left px-5 py-4">Last Page Visited</th>
                                        <th className="text-left px-5 py-4">Created At</th>
                                        <th className="text-left px-5 py-4">Last Seen</th>
                                        <th className="text-left px-5 py-4">User Agent</th>
                                        <th className="text-right px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {userSessions.map(session => (
                                        <tr key={session.session_id} className="hover:bg-white/[0.01]">
                                            <td className="px-5 py-4 text-xs font-mono text-gray-400">{session.session_id.substring(0, 8)}...</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    session.device_type === 'mobile' ? 'bg-orange-500/15 text-orange-400' :
                                                    session.device_type === 'tablet' ? 'bg-purple-500/15 text-purple-400' :
                                                    'bg-blue-500/15 text-blue-400'
                                                }`}>
                                                    {session.device_type || 'desktop'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-white font-bold">{formatDuration(session.duration_seconds || 0)}</td>
                                            <td className="px-5 py-4 text-gray-300 max-w-[200px] truncate">{session.page_url || '/'}</td>
                                            <td className="px-5 py-4 text-gray-400">{formatDate(session.started_at)}</td>
                                            <td className="px-5 py-4 text-gray-400">{formatDate(session.last_seen_at)}</td>
                                            <td className="px-5 py-4 text-gray-500 max-w-[220px] truncate" title={session.user_agent || ''}>
                                                {session.user_agent || 'N/A'}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSession(session.session_id);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-all inline-flex items-center justify-center"
                                                    title="Delete Session"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {userSessions.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-5 py-10 text-center text-gray-500">No sessions recorded.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {activeTab === 'messages' && (
                            <table className="w-full min-w-[900px] text-sm">
                                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-5 py-4 w-2/3">Message Content</th>
                                        <th className="text-left px-5 py-4">Status</th>
                                        <th className="text-left px-5 py-4">Sent At</th>
                                        <th className="text-right px-5 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {selectedUser?.notifications?.map((notif: UserNotification) => (
                                        <tr key={notif.id} className="hover:bg-white/[0.01]">
                                            <td className="px-5 py-4 text-white font-medium whitespace-pre-wrap">
                                                {notif.message}
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                                                    notif.is_read ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                                                }`}>
                                                    {notif.is_read ? 'Read' : 'Unread'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-gray-400">{formatDate(notif.created_at)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteNotification(notif.id);
                                                    }}
                                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-gray-500 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-all inline-flex items-center justify-center"
                                                    title="Delete Message"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!selectedUser?.notifications || selectedUser.notifications.length === 0) && (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-10 text-center text-gray-500">No messages sent to this user.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Send Direct Message Modal */}
                {messageModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="glass-panel max-w-md w-full rounded-2xl border border-white/10 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                                <h3 className="text-lg font-bold text-white">Send Message to {selectedUser.profile.display_name || 'User'}</h3>
                                <button
                                    onClick={() => setMessageModalOpen(false)}
                                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                            <form onSubmit={handleSendDirectMessage} className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Message Content</label>
                                    <textarea
                                        value={directMessageText}
                                        onChange={e => setDirectMessageText(e.target.value)}
                                        required
                                        placeholder="Type your official direct message here..."
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setMessageModalOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all border border-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sendingMessage}
                                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold hover:shadow-lg hover:shadow-blue-900/20 disabled:opacity-50 transition-all"
                                    >
                                        {sendingMessage ? 'Sending...' : 'Send Message'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white">Users</h1>
                    <p className="text-gray-500 text-sm mt-1">Registered users, active sessions, watch and download analytics.</p>
                </div>
                <button
                    onClick={loadData}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-colors"
                >
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                <Stat title="Total Users" value={analytics.users.length.toString()} />
                <Stat title="Active Now" value={analytics.activeUsers.toString()} tone="green" />
                <Stat title="Time on Site" value={formatDuration(analytics.totalSeconds)} />
                <Stat title="Watch Events" value={analytics.watchEvents.length.toString()} />
                <Stat title="Downloads" value={analytics.downloadEvents.length.toString()} tone="yellow" />
            </div>

            <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h2 className="text-lg font-black text-white">User Analytics</h2>
                    {loading && <span className="text-xs text-gray-500">Loading...</span>}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-sm">
                        <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                            <tr>
                                <th className="text-left px-5 py-4">User</th>
                                <th className="text-left px-5 py-4">Status</th>
                                <th className="text-left px-5 py-4">Time</th>
                                <th className="text-left px-5 py-4">Watched</th>
                                <th className="text-left px-5 py-4">Downloads</th>
                                <th className="text-left px-5 py-4">Anime</th>
                                <th className="text-left px-5 py-4">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                             {analytics.users.map(user => (
                                <tr 
                                    key={user.profile.id} 
                                    className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                                    onClick={() => setSelectedUser(user)}
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            {user.profile.avatar_url ? (
                                                <img
                                                    src={user.profile.avatar_url}
                                                    alt={user.profile.display_name || 'User'}
                                                    className="w-10 h-10 rounded-lg object-cover border border-white/5 shadow"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-white font-black text-xs shadow">
                                                    {(user.profile.display_name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-bold text-white">{user.profile.display_name || 'User'}</div>
                                                <div className="text-xs text-gray-500">{user.profile.email || user.profile.id}</div>
                                                {user.profile.whatsapp_number && (
                                                    <div className="text-[11px] text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                                        <span>💬</span> {user.profile.whatsapp_number}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${user.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/5'}`}>
                                            {user.active ? 'Active' : 'Offline'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-gray-300 font-bold">{formatDuration(user.totalTime)}</td>
                                    <td className="px-5 py-4 text-gray-300">
                                        {user.uniqueWatched} titles
                                        <div className="text-xs text-gray-500">{user.watchCount} events</div>
                                    </td>
                                    <td className="px-5 py-4 text-gray-300">
                                        {user.uniqueDownloaded} titles
                                        <div className="text-xs text-gray-500">{user.downloadCount} clicks</div>
                                    </td>
                                    <td className="px-5 py-4 text-gray-300">
                                        {user.animeWatchCount} watch
                                        <div className="text-xs text-gray-500">{user.animeDownloadCount} download</div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="text-gray-300">{formatDate(user.profile.last_seen_at)}</div>
                                        {user.lastEvent && (
                                            <div className="text-xs text-gray-500 mt-1">
                                                {user.lastEvent.event_type}: {user.lastEvent.content_title || user.lastEvent.content_type || 'site'}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {!loading && analytics.users.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                                        No registered users yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                     </table>
                </div>
            </div>
        </div>
    );
}

function Stat({ title, value, tone = 'red' }: { title: string; value: string; tone?: 'red' | 'green' | 'yellow' }) {
    const tones = {
        red: 'text-red-300 bg-red-500/10 border-red-500/20',
        green: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
        yellow: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20'
    };

    return (
        <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
            <div className="text-xs uppercase tracking-wider opacity-70 font-bold">{title}</div>
            <div className="text-2xl font-black mt-2">{value}</div>
        </div>
    );
}
