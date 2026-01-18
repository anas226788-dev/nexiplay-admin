'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ContentRequest } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

export default function RequestsPage() {
    const [requests, setRequests] = useState<ContentRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('content_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setRequests(data);
        setLoading(false);
    };

    const updateStatus = async (id: string, status: 'added' | 'rejected') => {
        const { error } = await supabase
            .from('content_requests')
            .update({ status })
            .eq('id', id);

        if (!error) {
            setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
        }
    };

    const deleteRequest = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        const { error } = await supabase.from('content_requests').delete().eq('id', id);
        if (!error) {
            setRequests(requests.filter(r => r.id !== id));
        }
    };

    if (loading) return <AdminShell><div className="p-8 text-white">Loading...</div></AdminShell>;

    return (
        <AdminShell>
            <div className="max-w-5xl mx-auto space-y-8">
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    📥 Content Requests
                    <span className="px-3 py-1 bg-white/10 text-base rounded-full text-gray-300">
                        {requests.length}
                    </span>
                </h1>

                <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-4">Request Content</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-white font-medium">
                                            {req.content_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-xs font-bold rounded capitalize ${req.status === 'added' ? 'bg-green-500/20 text-green-400' :
                                                    req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 flex items-center justify-end gap-2">
                                            {req.status === 'pending' && (
                                                <button
                                                    onClick={() => updateStatus(req.id, 'added')}
                                                    className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30"
                                                    title="Mark as Added"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteRequest(req.id)}
                                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                                                title="Delete"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {requests.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                                            No pending requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
