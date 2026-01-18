'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Comment } from '@/lib/types';
import Link from 'next/link';

export default function CommentsPage() {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchComments();
    }, []);

    async function fetchComments() {
        const { data } = await supabase
            .from('comments')
            .select('*, movies(title, slug)')
            .order('created_at', { ascending: false });

        if (data) {
            // @ts-ignore - Supabase join typing
            setComments(data);
        }
        setLoading(false);
    }

    const deleteComment = async (id: string) => {
        if (!confirm('Are you sure you want to delete this comment?')) return;

        const { error } = await supabase.from('comments').delete().eq('id', id);

        if (error) {
            alert('Error deleting comment');
        } else {
            fetchComments();
        }
    };

    if (loading) return <div className="p-8 text-gray-400">Loading comments...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-2">Comments Management</h1>
                    <p className="text-gray-400">Moderate user comments.</p>
                </div>
                <div className="bg-dark-700 px-4 py-2 rounded-lg border border-white/10 text-sm">
                    Total Comments: <span className="font-bold text-white">{comments.length}</span>
                </div>
            </div>

            <div className="glass rounded-xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-gray-400 font-medium border-b border-white/10">
                            <tr>
                                <th className="p-4">User</th>
                                <th className="p-4">Comment</th>
                                <th className="p-4">Movie</th>
                                <th className="p-4">Date</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {comments.map((comment) => (
                                <tr key={comment.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-white">{comment.name}</div>
                                        <div className="text-xs text-gray-500">{comment.email}</div>
                                    </td>
                                    <td className="p-4">
                                        <p className="max-w-xs truncate text-gray-300" title={comment.message}>
                                            {comment.message}
                                        </p>
                                    </td>
                                    <td className="p-4">
                                        {/* @ts-ignore - Joined data */}
                                        <span className="text-blue-400 hover:text-blue-300">
                                            {/* @ts-ignore */}
                                            {comment.movies?.title || 'Unknown Movie'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 whitespace-nowrap">
                                        {new Date(comment.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => deleteComment(comment.id)}
                                            className="text-red-500 hover:text-red-400 font-medium transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {comments.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        No comments found.
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
