'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Movie } from '@/lib/types';
import AdminShell from '@/components/AdminShell';
import Link from 'next/link';

export default function RunningTasksPage() {
    const [tasks, setTasks] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        fetchTasks();
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('movies')
            .select('*')
            .eq('is_running', true)
            .order('updated_at', { ascending: false });

        if (data) setTasks(data);
        if (error) console.error('Error fetching tasks:', error);
        setLoading(false);
    };

    const handleMarkDone = async (task: Movie) => {
        setUpdatingId(task.id);
        const newLast = (task.last_episode || 0) + 1;
        const newNext = newLast + 1;

        const { error } = await supabase
            .from('movies')
            .update({
                last_episode: newLast,
                next_episode: newNext,
                updated_at: new Date().toISOString()
            })
            .eq('id', task.id);

        if (error) {
            alert('Error updating task');
        } else {
            // Optimistic update
            setTasks(tasks.map(t =>
                t.id === task.id
                    ? { ...t, last_episode: newLast, next_episode: newNext }
                    : t
            ));
        }
        setUpdatingId(null);
    };

    const handleToggleRunning = async (task: Movie) => {
        if (!confirm('Stop tracking this series? It will be removed from this list.')) return;

        const { error } = await supabase
            .from('movies')
            .update({ is_running: false })
            .eq('id', task.id);

        if (!error) {
            setTasks(tasks.filter(t => t.id !== task.id));
        }
    };

    return (
        <AdminShell>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">⚡ Running Tasks</h1>
                        <p className="text-gray-400">Track ongoing series progress and next uploads.</p>
                    </div>
                    <button onClick={fetchTasks} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-20 text-gray-500">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className="glass p-12 rounded-2xl border border-white/5 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🎉</span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Running Tasks</h3>
                        <p className="text-gray-400">All caught up! Add a new series and mark it as "Running" to track it here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {tasks.map(task => (
                            <div key={task.id} className="glass p-5 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-12 bg-dark-800 rounded-lg overflow-hidden relative border border-white/10">
                                        {task.poster_url && (
                                            <img src={task.poster_url} alt="" className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-white text-lg">{task.title}</h3>
                                            <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold bg-white/10 rounded text-gray-300">
                                                {task.type}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1.5">
                                                Last: <span className="text-white font-mono">{task.last_episode}</span>
                                            </span>
                                            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                            <span className="flex items-center gap-1.5 text-green-400">
                                                Next: <span className="font-mono font-bold bg-green-500/10 px-1.5 rounded">{task.next_episode}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleToggleRunning(task)}
                                        className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                        title="Stop Tracking"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                                                <span>Mark Ep {task.next_episode} Done</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AdminShell>
    );
}
