'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ContactMessage } from '@/lib/types';
import Link from 'next/link';

export default function MessagesPage() {
    const [messages, setMessages] = useState<ContactMessage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMessages();
    }, []);

    async function fetchMessages() {
        const { data } = await supabase
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setMessages(data);
        setLoading(false);
    }

    async function deleteMessage(id: string) {
        if (!confirm('Are you sure you want to delete this message?')) return;

        const { error } = await supabase
            .from('contact_messages')
            .delete()
            .eq('id', id);

        if (!error) {
            setMessages(messages.filter(msg => msg.id !== id));
        } else {
            alert('Failed to delete message');
        }
    }

    if (loading) return <div className="p-8 text-white">Loading messages...</div>;

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Contact Messages</h1>

            {/* Desktop Table View */}
            <div className="hidden md:block glass-panel rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="p-4 text-gray-400 font-medium text-sm">Date</th>
                                <th className="p-4 text-gray-400 font-medium text-sm">Sender</th>
                                <th className="p-4 text-gray-400 font-medium text-sm">Subject</th>
                                <th className="p-4 text-gray-400 font-medium text-sm">Message</th>
                                <th className="p-4 text-gray-400 font-medium text-sm">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {messages.map((msg) => (
                                <tr key={msg.id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-gray-400 text-sm whitespace-nowrap">
                                        {new Date(msg.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-white text-sm">
                                        <div className="font-bold">{msg.name}</div>
                                        <div className="text-xs text-gray-500">{msg.email}</div>
                                    </td>
                                    <td className="p-4 text-white text-sm">
                                        {msg.subject}
                                    </td>
                                    <td className="p-4 text-gray-300 text-sm max-w-md">
                                        {msg.message}
                                    </td>
                                    <td className="p-4">
                                        <button
                                            onClick={() => deleteMessage(msg.id)}
                                            className="text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded text-xs font-bold transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {messages.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        No messages found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {messages.length === 0 ? (
                    <div className="glass-panel rounded-xl p-8 text-center text-gray-500">
                        No messages found.
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className="glass-panel rounded-xl p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="font-bold text-white">{msg.name}</div>
                                    <div className="text-xs text-gray-500">{msg.email}</div>
                                </div>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {new Date(msg.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            {msg.subject && (
                                <div className="text-sm font-medium text-white">{msg.subject}</div>
                            )}
                            <p className="text-gray-300 text-sm line-clamp-4">{msg.message}</p>
                            <div className="pt-2 border-t border-white/5">
                                <button
                                    onClick={() => deleteMessage(msg.id)}
                                    className="w-full text-red-500 bg-red-500/10 py-2 rounded-lg text-xs font-bold active:bg-red-500/20 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
