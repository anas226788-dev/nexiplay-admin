'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ChatbotSettings, FAQ } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

export default function ChatbotPage() {
    const [settings, setSettings] = useState<ChatbotSettings | null>(null);
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // FAQ Form State
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [keywords, setKeywords] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Settings
        const { data: settingsData } = await supabase.from('chatbot_settings').select('*').single();
        if (settingsData) setSettings(settingsData);

        // Fetch FAQs
        const { data: faqsData } = await supabase.from('faqs').select('*').order('created_at', { ascending: false });
        if (faqsData) setFaqs(faqsData);
        setLoading(false);
    };

    const handleSettingsUpdate = async () => {
        if (!settings) return;
        setSaving(true);
        const { error } = await supabase
            .from('chatbot_settings')
            .update({
                is_enabled: settings.is_enabled,
                bot_name: settings.bot_name,
                welcome_message: settings.welcome_message,
                placeholder_text: settings.placeholder_text
            })
            .eq('id', settings.id);

        if (error) alert('Error updating settings');
        else alert('Settings updated!');
        setSaving(false);
    };

    const handleAddFAQ = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!question || !answer || !keywords) return;

        const { data, error } = await supabase
            .from('faqs')
            .insert({
                question,
                answer,
                keywords,
                is_active: true
            })
            .select()
            .single();

        if (error) {
            alert('Error adding FAQ');
            console.error(error);
        } else if (data) {
            setFaqs([data, ...faqs]);
            setQuestion('');
            setAnswer('');
            setKeywords('');
        }
    };

    const handleDeleteFAQ = async (id: string) => {
        if (!confirm('Are you sure?')) return;
        const { error } = await supabase.from('faqs').delete().eq('id', id);
        if (!error) {
            setFaqs(faqs.filter(f => f.id !== id));
        }
    };

    if (loading) return <AdminShell><div className="p-8 text-white">Loading...</div></AdminShell>;

    return (
        <AdminShell>
            <div className="max-w-5xl mx-auto space-y-8">
                <h1 className="text-3xl font-black text-white">🤖 Chatbot Manager</h1>

                {/* Settings Section */}
                {settings && (
                    <div className="glass p-6 rounded-xl border border-white/5 space-y-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            ⚙️ General Settings
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center gap-4">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.is_enabled}
                                        onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                    <span className="ml-3 text-sm font-medium text-gray-300">Enable Chatbot</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Bot Name</label>
                                <input
                                    type="text"
                                    value={settings.bot_name}
                                    onChange={(e) => setSettings({ ...settings, bot_name: e.target.value })}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm text-gray-400 mb-1">Welcome Message</label>
                                <textarea
                                    value={settings.welcome_message}
                                    onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                    rows={2}
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleSettingsUpdate}
                            disabled={saving}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                )}

                {/* FAQ Section */}
                <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
                    {/* Add FAQ Form */}
                    <div className="glass p-6 rounded-xl border border-white/5 h-fit sticky top-8">
                        <h2 className="text-xl font-bold text-white mb-4">➕ Add New FAQ</h2>
                        <form onSubmit={handleAddFAQ} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Question (Internal Use)</label>
                                <input
                                    required
                                    type="text"
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="e.g. How to download?"
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Keywords (Comma Separated)</label>
                                <input
                                    required
                                    type="text"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder="download, link, save"
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                                <p className="text-xs text-gray-500 mt-1">Bot matches these words in user query.</p>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Bot Answer</label>
                                <textarea
                                    required
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    placeholder="Click the red button below the poster..."
                                    rows={4}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors"
                            >
                                Add FAQ
                            </button>
                        </form>
                    </div>

                    {/* FAQ List */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-white">📚 Knowledge Base ({faqs.length})</h2>
                        {faqs.map((faq) => (
                            <div key={faq.id} className="glass p-5 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{faq.question}</h3>
                                        <div className="flex flex-wrap gap-2 my-2">
                                            {faq.keywords.split(',').map((k, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-white/10 text-xs rounded text-gray-300">
                                                    {k.trim()}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-gray-400 text-sm whitespace-pre-wrap">{faq.answer}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteFAQ(faq.id)}
                                        className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {faqs.length === 0 && (
                            <div className="text-center py-10 text-gray-500">
                                No FAQs yet. Add one to start training your bot!
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
