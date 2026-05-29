'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DMCARequest } from '@/lib/types';

export default function DmcaRequestsPage() {
    const [requests, setRequests] = useState<DMCARequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    async function fetchRequests() {
        const { data } = await supabase
            .from('dmca_requests')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setRequests(data);
        setLoading(false);
    }

    async function updateStatus(id: string, status: 'approved' | 'rejected') {
        const { error } = await supabase
            .from('dmca_requests')
            .update({ status })
            .eq('id', id);

        if (!error) {
            setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
        } else {
            alert('Failed to update status');
        }
    }

    async function deleteRequest(id: string) {
        if (!confirm('Are you sure you want to delete this request?')) return;

        const { error } = await supabase
            .from('dmca_requests')
            .delete()
            .eq('id', id);

        if (!error) {
            setRequests(requests.filter(req => req.id !== id));
        } else {
            alert('Failed to delete request');
        }
    }

    if (loading) return <div className="p-8 text-white">Loading DMCA requests...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">DMCA Takedown Requests</h1>

            <div className="space-y-4">
                {requests.map((req) => (
                    <div key={req.id} className="bg-dark-800 rounded-xl border border-white/5 p-6 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${req.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                        req.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                                            'bg-red-500/20 text-red-500'
                                        }`}>
                                        {req.status}
                                    </span>
                                    <span className="text-gray-500 text-sm">
                                        {new Date(req.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-white">{req.name} {req.company ? `(${req.company})` : ''}</h3>
                                <p className="text-sm text-gray-400">{req.email}</p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                {req.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => updateStatus(req.id, 'approved')}
                                            className="px-4 py-2 bg-green-600/20 text-green-500 hover:bg-green-600/30 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Approve (Remove Content)
                                        </button>
                                        <button
                                            onClick={() => updateStatus(req.id, 'rejected')}
                                            className="px-4 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/30 rounded-lg text-sm font-bold transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </>
                                )}
                                <button
                                    onClick={() => deleteRequest(req.id)}
                                    className="px-4 py-2 bg-gray-700/50 text-gray-400 hover:bg-red-600/20 hover:text-red-500 rounded-lg text-sm font-bold transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20 p-4 rounded-lg">
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Infringing Link (Nexiplay)</p>
                                <a href={req.infringing_link} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline break-all text-sm">
                                    {req.infringing_link}
                                </a>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 uppercase mb-1">Original Content (Proof)</p>
                                <a href={req.original_link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all text-sm">
                                    {req.original_link}
                                </a>
                            </div>
                        </div>

                        {req.message && (
                            <div className="text-sm text-gray-300 italic border-l-2 border-white/10 pl-3">
                                "{req.message}"
                            </div>
                        )}
                    </div>
                ))}

                {requests.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                        No DMCA requests found.
                    </div>
                )}
            </div>
        </div>
    );
}
