'use client';

import { createClient } from '@/lib/supabase';
import { Notice } from '@/lib/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NoticePage() {
    const [notices, setNotices] = useState<Notice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotices();
    }, []);

    async function fetchNotices() {
        const { data } = await supabase
            .from('notices')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setNotices(data);
        setLoading(false);
    }

    async function toggleStatus(id: string, currentStatus: boolean) {
        const { error } = await supabase
            .from('notices')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) fetchNotices();
    }

    async function deleteNotice(id: string) {
        if (!confirm('Are you sure you want to delete this notice?')) return;

        const { error } = await supabase
            .from('notices')
            .delete()
            .eq('id', id);

        if (!error) setNotices(notices.filter(n => n.id !== id));
    }

    if (loading) return <div className="p-8 text-white">Loading...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold font-outfit text-white">Notice Manager</h1>
                <Link
                    href="/notices/add"
                    className="btn-primary flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Notice
                </Link>
            </div>

            <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white/5 border-b border-white/5">
                            <th className="px-6 py-4 text-gray-300 text-sm">Content</th>
                            <th className="px-6 py-4 text-gray-300 text-sm">Type</th>
                            <th className="px-6 py-4 text-gray-300 text-sm">Pages</th>
                            <th className="px-6 py-4 text-gray-300 text-sm">Status</th>
                            <th className="px-6 py-4 text-gray-300 text-sm text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {notices.map((notice) => (
                            <tr key={notice.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 text-white max-w-xs truncate" title={notice.content}>
                                    <div dangerouslySetInnerHTML={{ __html: notice.content }} />
                                </td>
                                <td className="px-6 py-4 text-gray-300">
                                    <span className="px-2 py-1 bg-white/10 rounded text-xs font-bold uppercase">{notice.type.replace('_', ' ')}</span>
                                </td>
                                <td className="px-6 py-4 text-gray-300 capitalize">{notice.pages}</td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => toggleStatus(notice.id, notice.is_active)}
                                        className={`px-2 py-1 rounded-full text-xs font-bold ${notice.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                        {notice.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                </td>
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                                    <Link href={`/notices/edit/${notice.id}`} className="text-gray-400 hover:text-white">Edit</Link>
                                    <button onClick={() => deleteNotice(notice.id)} className="text-red-500 hover:text-red-400">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
