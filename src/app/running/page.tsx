'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Movie } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

type RunningTask = Pick<Movie, 'id' | 'title' | 'type' | 'poster_url' | 'last_episode' | 'next_episode' | 'next_episode_date' | 'admin_note' | 'notify_admin' | 'is_running' | 'running_status' | 'created_at' | 'scraper_url' | 'scraper_source' | 'scraper_resolution' | 'scraper_season'>;

const RUNNING_SCRAPER_SOURCES = new Set(['fxlinks', 'rareanimes', 'movielink', 'bollyflix']);
const isRunningScraperSource = (source?: string | null) => !!source && RUNNING_SCRAPER_SOURCES.has(source);

interface PendingSubInfo {
    linkId: string;
    episodeNumber: number;
    seasonNumber: number;
    resolution: string;
    megaLink: string | null;
    gdriveLink: string | null;
}

export default function RunningTasksPage() {
    const [tasks, setTasks] = useState<RunningTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [checkingId, setCheckingId] = useState<string | null>(null);
    const [checkingAll, setCheckingAll] = useState(false);
    const [editTask, setEditTask] = useState<RunningTask | null>(null);
    // Pending subs state
    const [pendingSubs, setPendingSubs] = useState<Record<string, PendingSubInfo[]>>({});
    const [approvingId, setApprovingId] = useState<string | null>(null);

    useEffect(() => {
        fetchTasks();
        fetchPendingSubs();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('movies')
            .select('id, title, type, poster_url, last_episode, next_episode, next_episode_date, admin_note, notify_admin, is_running, running_status, created_at, scraper_url, scraper_source, scraper_resolution, scraper_season')
            .eq('is_running', true)
            .order('created_at', { ascending: false });

        if (data) {
            const runningOnlyTasks = data.filter(task => !task.scraper_source || isRunningScraperSource(task.scraper_source));
            const sorted = runningOnlyTasks.sort((a, b) => {
                const dateA = a.next_episode_date ? new Date(a.next_episode_date).getTime() : Infinity;
                const dateB = b.next_episode_date ? new Date(b.next_episode_date).getTime() : Infinity;
                return dateA - dateB;
            });
            setTasks(sorted as RunningTask[]);
        }
        if (error) {
            console.error('Error fetching tasks details:', JSON.stringify(error, null, 2));
        }
        setLoading(false);
    };

    const fetchPendingSubs = async () => {
        try {
            const res = await fetch('/api/approve-subs');
            const data = await res.json();
            if (data.success) {
                setPendingSubs(data.pending || {});
            }
        } catch (err) {
            console.error('Failed to fetch pending subs:', err);
        }
    };

    const handleApproveSubs = async (movieId: string) => {
        if (!confirm('Approve all pending Hindi Sub episodes for this series? They will become visible to users.')) return;
        setApprovingId(movieId);
        try {
            const res = await fetch('/api/approve-subs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve', movieId }),
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Approved ${data.count} sub episode(s).`);
                fetchPendingSubs();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`❌ Error: ${err.message}`);
        } finally {
            setApprovingId(null);
        }
    };

    const handleRejectSubs = async (movieId: string) => {
        if (!confirm('Reject all pending Hindi Sub episodes for this series? They will be permanently deleted.')) return;
        setApprovingId(movieId);
        try {
            const res = await fetch('/api/approve-subs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', movieId }),
            });
            const data = await res.json();
            if (data.success) {
                alert(`🗑️ Rejected ${data.count} sub episode(s).`);
                fetchPendingSubs();
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (err: any) {
            alert(`❌ Error: ${err.message}`);
        } finally {
            setApprovingId(null);
        }
    };

    const handleCheckSingle = async (movieId: string) => {
        setCheckingId(movieId);
        try {
            const res = await fetch('/api/cron/check-episodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ movieId })
            });
            const data = await res.json();
            if (data.success) {
                const result = data.results?.[0];
                if (result) {
                    if (result.status === 'success') {
                        const importedCount = result.importedCount ?? result.importedLegacy ?? 0;
                        const latestEpisode = result.lastEpisode ?? 'unchanged';
                        let msg = result.message || `Imported ${importedCount} DUB episode(s) (Latest: Ep ${latestEpisode})`;
                        if (result.pendingSubCount > 0) {
                            msg += `\n${result.pendingSubCount} SUB episode(s) pending your approval.`;
                        }
                        alert(msg);
                        fetchTasks();
                        fetchPendingSubs();
                    } else if (result.status === 'no_updates_found') {
                        alert(`ℹ️ ${result.message || 'No new episodes found.'}`);
                        fetchTasks();
                    } else if (result.status === 'skipped') {
                        alert(`⚠️ Skipped: ${result.reason}`);
                    } else if (result.status === 'error') {
                        alert(`❌ Error checking episodes: ${result.error}`);
                    }
                } else {
                    alert('ℹ️ No scraper settings or results found for this show.');
                }
            } else {
                alert(`❌ Error: ${data.error || 'Failed to trigger scraper'}`);
            }
        } catch (err: any) {
            console.error(err);
            alert(`❌ Error triggering check: ${err.message}`);
        } finally {
            setCheckingId(null);
        }
    };

    const handleCheckAll = async () => {
        if (!confirm('Run auto-scraper checker for all configured series? This might take some time.')) return;
        setCheckingAll(true);
        try {
            const res = await fetch('/api/cron/check-episodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                const summary = data.results || [];
                const successes = summary.filter((r: any) => r.status === 'success');
                const errors = summary.filter((r: any) => r.status === 'error');
                const retries = summary.filter((r: any) => r.status === 'no_updates_found' && r.message?.includes('daily'));
                const pendingSubTotal = successes.reduce((sum: number, r: any) => sum + (r.pendingSubCount || 0), 0);
                
                let msg = `Checked ${summary.length} series.\n`;
                if (successes.length > 0) {
                    msg += `🎉 Imported updates for ${successes.length} series: ${successes.map((s: any) => s.title).join(', ')}\n`;
                }
                if (pendingSubTotal > 0) {
                    msg += `📋 ${pendingSubTotal} Hindi Sub episode(s) pending approval.\n`;
                }
                if (retries.length > 0) {
                    msg += `🔄 Set retry tomorrow for ${retries.length} series.\n`;
                }
                if (errors.length > 0) {
                    msg += `❌ Failed for ${errors.length} series.\n`;
                }
                alert(msg);
                fetchTasks();
                fetchPendingSubs();
            } else {
                alert(`❌ Error: ${data.error || 'Failed to check series'}`);
            }
        } catch (err: any) {
            console.error(err);
            alert(`❌ Error: ${err.message}`);
        } finally {
            setCheckingAll(false);
        }
    };

    const handleMarkDone = async (task: RunningTask) => {
        setUpdatingId(task.id);
        const newLast = (task.last_episode || 0) + 1;
        const newNext = newLast + 1;
        
        let newDate = task.next_episode_date;
        if (newDate) {
            const dateObj = new Date(newDate);
            dateObj.setDate(dateObj.getDate() + 7);
            newDate = dateObj.toISOString();
        }

        const { error } = await supabase
            .from('movies')
            .update({
                last_episode: newLast,
                next_episode: newNext,
                next_episode_date: newDate,
                notify_admin: false
            })
            .eq('id', task.id);

        if (error) {
            alert('Error updating task');
        } else {
            setTasks(tasks.map(t =>
                t.id === task.id
                    ? { ...t, last_episode: newLast, next_episode: newNext, next_episode_date: newDate, notify_admin: false }
                    : t
            ));
        }
        setUpdatingId(null);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTask) return;
        setUpdatingId('edit');

        const { error } = await supabase
            .from('movies')
            .update({
                last_episode: editTask.last_episode,
                next_episode: editTask.next_episode,
                next_episode_date: editTask.next_episode_date,
                admin_note: editTask.admin_note,
                notify_admin: editTask.notify_admin,
                scraper_url: editTask.scraper_source ? editTask.scraper_url : null,
                scraper_source: editTask.scraper_source || null,
                scraper_resolution: editTask.scraper_source ? editTask.scraper_resolution : null,
                scraper_season: editTask.scraper_source ? editTask.scraper_season : 1
            })
            .eq('id', editTask.id);

        if (!error) {
            setTasks(tasks.map(t => t.id === editTask.id ? editTask : t));
            setEditTask(null);
        } else {
            alert('Error updating task');
        }
        setUpdatingId(null);
    };

    const handleToggleRunning = async (task: RunningTask) => {
        if (!confirm('Stop tracking this series? It will be removed from this list.')) return;

        const { error } = await supabase
            .from('movies')
            .update({ is_running: false })
            .eq('id', task.id);

        if (!error) {
            setTasks(tasks.filter(t => t.id !== task.id));
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        const now = new Date();
        
        // Calculate difference in days based on midnight boundaries to get accurate relative day counts
        const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffTime = dateMidnight.getTime() - nowMidnight.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        if (diffDays === 0) return `Today at ${timeString}`;
        if (diffDays === 1) return `Tomorrow at ${timeString}`;
        if (diffDays === -1) return `Overdue by 1 day (${dateString})`;
        if (diffDays < -1) return `Overdue by ${Math.abs(diffDays)} days (${dateString})`;
        
        return `In ${diffDays} days (${dateString} at ${timeString})`;
    };

    const isDue = (dateStr?: string) => {
        if (!dateStr) return false;
        return new Date(dateStr).getTime() <= new Date().getTime();
    };

    return (
        <AdminShell>
            <div className="max-w-6xl mx-auto pb-20">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">⚡ Running Tasks</h1>
                        <p className="text-gray-400">Track ongoing series progress and next uploads.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCheckAll}
                            disabled={checkingAll || loading}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 hover:border-red-500/30 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                        >
                            {checkingAll ? (
                                <span className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full"></span>
                            ) : (
                                <span>🤖 Check All Series</span>
                            )}
                        </button>
                        <button onClick={() => { fetchTasks(); fetchPendingSubs(); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className="glass p-12 rounded-2xl border border-white/5 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🎉</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Running Tasks</h3>
                        <p className="text-gray-400">All caught up! Add a new series and mark it as &quot;Running&quot; to track it here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {tasks.map(task => {
                            const due = task.notify_admin || isDue(task.next_episode_date);
                            const dateLabel = formatDate(task.next_episode_date);
                            const moviePendingSubs = pendingSubs[task.id] || [];
                            const hasPendingSubs = moviePendingSubs.length > 0;

                            return (
                                <div
                                    key={task.id}
                                    className={`
                                        glass p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all
                                        ${due
                                            ? 'border-red-500/30 bg-red-900/5 shadow-lg shadow-red-900/10'
                                            : 'border-white/5 hover:border-white/10'
                                        }
                                        ${task.notify_admin ? 'ring-1 ring-yellow-500/30' : ''}
                                    `}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="h-20 w-14 bg-dark-800 rounded-lg overflow-hidden relative border border-white/10 flex-shrink-0">
                                            {task.poster_url && (
                                                <img src={task.poster_url} alt="" className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <h3 className="font-bold text-white text-lg">{task.title}</h3>
                                                <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-white/10 rounded text-gray-300">
                                                    {task.type}
                                                </span>
                                                {task.notify_admin && (
                                                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-yellow-500/20 text-yellow-500 rounded border border-yellow-500/20 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span>
                                                        Alert
                                                    </span>
                                                )}
                                                {hasPendingSubs && (
                                                    <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-purple-500/20 text-purple-400 rounded border border-purple-500/20 flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></span>
                                                        {moviePendingSubs.length} Sub Pending
                                                    </span>
                                                )}
                                                {task.next_episode_date && (
                                                    <span className={`
                                                        px-2 py-0.5 text-xs font-bold rounded-full border
                                                        ${due
                                                            ? 'bg-red-500 text-white border-red-500 animate-pulse'
                                                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                                                        }
                                                     `}>
                                                        Due: {dateLabel}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                                                <span className="flex items-center gap-1.5">
                                                    Last: <span className="text-white font-mono">{task.last_episode}</span>
                                                </span>
                                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                                <span className="flex items-center gap-1.5 text-green-400">
                                                    Next: <span className="font-mono font-bold bg-green-500/10 px-1.5 rounded">{task.next_episode}</span>
                                                </span>
                                            </div>

                                            {task.scraper_source && isRunningScraperSource(task.scraper_source) && (
                                                <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5 flex-wrap">
                                                    <span>🤖 Auto Scraper:</span>
                                                    <span className="font-semibold text-gray-400 capitalize bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{task.scraper_source}</span>
                                                    <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                                    <span className="text-gray-400 font-medium">{task.scraper_resolution || '720p'}</span>
                                                    <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                                                    <span className="text-gray-400 font-medium">S{task.scraper_season || 1}</span>
                                                </div>
                                            )}

                                            {/* Pending Sub Approval Banner */}
                                            {hasPendingSubs && (
                                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-2 max-w-lg">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-xs font-bold text-purple-300 mb-0.5">
                                                                📋 {moviePendingSubs.length} Hindi Sub episode(s) awaiting approval
                                                            </p>
                                                            <p className="text-[10px] text-purple-400/70">
                                                                Ep {moviePendingSubs.map(s => s.episodeNumber).sort((a, b) => a - b).join(', ')}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <button
                                                                onClick={() => handleApproveSubs(task.id)}
                                                                disabled={approvingId === task.id}
                                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                {approvingId === task.id ? (
                                                                    <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                                                                ) : (
                                                                    <>✅ Approve</>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectSubs(task.id)}
                                                                disabled={approvingId === task.id}
                                                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold rounded-lg transition-all border border-red-500/20 disabled:opacity-50"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {(() => {
                                                const cleanNote = task.admin_note
                                                    ? task.admin_note
                                                        .replace(/\[original_due_date:\s*[^\]]+\]/g, '')
                                                        .replace(/\[pending_subs:\s*[^\]]+\]/g, '')
                                                        .trim()
                                                    : '';
                                                return cleanNote ? (
                                                    <div className="bg-white/5 p-2 rounded text-xs text-gray-300 italic border border-white/5 inline-block max-w-md">
                                                        📝 {cleanNote}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 self-end md:self-center">


                                        <button
                                            onClick={() => handleToggleRunning(task)}
                                            className="p-2 text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-colors border border-white/5"
                                            title="Stop Tracking"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>

                                        {task.scraper_url && task.scraper_source && isRunningScraperSource(task.scraper_source) && (
                                            <button
                                                onClick={() => handleCheckSingle(task.id)}
                                                disabled={checkingId === task.id}
                                                className="p-2 text-gray-400 hover:text-green-400 bg-white/5 hover:bg-green-500/10 rounded-lg transition-colors border border-white/5 disabled:opacity-50"
                                                title="Check Updates"
                                            >
                                                {checkingId === task.id ? (
                                                    <span className="animate-spin block h-5 w-5 border-2 border-green-400 border-t-transparent rounded-full"></span>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                )}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setEditTask(task)}
                                            className="p-2 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
                                            title="Edit Settings"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>

                                        <button
                                            onClick={() => handleMarkDone(task)}
                                            disabled={updatingId === task.id}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-red-900/20"
                                        >
                                            {updatingId === task.id ? (
                                                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    <span className="hidden md:inline">Mark Done</span>
                                                    <span className="md:hidden">Done</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-xl font-bold text-white">Edit: {editTask.title}</h3>
                            <button onClick={() => setEditTask(null)} className="text-gray-400 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Last Episode</label>
                                    <input 
                                        type="number" 
                                        value={editTask.last_episode || 0} 
                                        onChange={e => setEditTask({...editTask, last_episode: parseInt(e.target.value)})}
                                        className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Next Episode</label>
                                    <input 
                                        type="number" 
                                        value={editTask.next_episode || 0} 
                                        onChange={e => setEditTask({...editTask, next_episode: parseInt(e.target.value)})}
                                        className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Next Episode Date</label>
                                <input 
                                    type="datetime-local" 
                                    value={editTask.next_episode_date ? editTask.next_episode_date.slice(0, 16) : ''} 
                                    onChange={e => setEditTask({...editTask, next_episode_date: e.target.value ? new Date(e.target.value).toISOString() : undefined})}
                                    className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white style-color-scheme-dark outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Admin Note</label>
                                <textarea 
                                    value={editTask.admin_note || ''} 
                                    onChange={e => setEditTask({...editTask, admin_note: e.target.value})}
                                    className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white resize-none h-20 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50" 
                                    placeholder="Type an admin note..."
                                />
                            </div>

                            {/* Auto Scraper Configuration in Modal */}
                            <div className="border-t border-white/5 pt-4 space-y-4">
                                <h4 className="text-sm font-bold text-gray-400 flex items-center gap-1.5">
                                    <span>🤖</span> Auto Scraper Settings
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Scraper Source</label>
                                        <select
                                            value={editTask.scraper_source || ''}
                                            onChange={e => setEditTask({...editTask, scraper_source: e.target.value as any})}
                                            className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-sm"
                                        >
                                            <option value="">None (Manual)</option>
                                            <option value="fxlinks">FXLinks</option>
                                            <option value="rareanimes">RareAnimes</option>
                                            <option value="movielink">MovieLinkBD</option>
                                            <option value="bollyflix">BollyFlix</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-400 mb-1">Resolution</label>
                                        <select
                                            value={editTask.scraper_resolution || '720p'}
                                            onChange={e => setEditTask({...editTask, scraper_resolution: e.target.value as any})}
                                            className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-sm"
                                        >
                                            <option value="360p">360p</option>
                                            <option value="480p">480p</option>
                                            <option value="720p">720p</option>
                                            <option value="1080p">1080p</option>
                                        </select>
                                    </div>
                                </div>
                                {editTask.scraper_source && (
                                    <div className="grid grid-cols-3 gap-4 animate-in fade-in">
                                        <div className="col-span-2">
                                            <label className="block text-xs text-gray-400 mb-1">Scraper URL</label>
                                            <input
                                                type="url"
                                                value={editTask.scraper_url || ''}
                                                onChange={e => setEditTask({...editTask, scraper_url: e.target.value})}
                                                className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-sm"
                                                placeholder="https://..."
                                                required={!!editTask.scraper_source}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-400 mb-1">Season</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={editTask.scraper_season || 1}
                                                onChange={e => setEditTask({...editTask, scraper_season: parseInt(e.target.value) || 1})}
                                                className="w-full bg-dark-800 border-[1px] border-white/10 rounded-lg p-2 text-white outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 text-sm text-center font-mono"
                                                required={!!editTask.scraper_source}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 mt-2 transition-colors hover:bg-white/10">
                                <input 
                                    type="checkbox" 
                                    id="notifyAdmin"
                                    checked={editTask.notify_admin || false} 
                                    onChange={e => setEditTask({...editTask, notify_admin: e.target.checked})}
                                    className="w-4 h-4 rounded bg-dark-800 border-white/20 text-red-600 focus:ring-red-500 outline-none cursor-pointer"
                                />
                                <label htmlFor="notifyAdmin" className="text-sm font-medium text-white cursor-pointer select-none">
                                    Trigger Notification Alert 🔔
                                </label>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 border-t border-white/10 mt-4">
                                <button type="button" onClick={() => setEditTask(null)} className="px-4 py-2 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors">Cancel</button>
                                <button type="submit" disabled={updatingId === 'edit'} className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                    {updatingId === 'edit' ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : null}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
