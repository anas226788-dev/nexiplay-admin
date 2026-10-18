'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';

export default function VibeManagerPage() {
    const [rowId, setRowId] = useState<string | number | null>(null);
    const [models, setModels] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const { data, error: loadError } = await supabase.from('chatbot_settings').select('id,openrouter_models').single();
                if (loadError || !data) setError('Could not load Vibe Manager routing settings.');
                else {
                    setRowId(data.id);
                    const saved = (data.openrouter_models || '').split(',').map((value: string) => value.trim()).filter(Boolean);
                    const freeOnly = saved.filter((model: string) => model.endsWith(':free'));
                    setModels(freeOnly.join(','));
                    if (saved.length !== freeOnly.length) setMessage('Skipped older paid model entries. Only free models are shown here.');
                }
            } catch { setError('Could not load Vibe Manager routing settings.'); }
            finally { setLoading(false); }
        }
        void load();
    }, []);

    async function save() {
        if (rowId === null) return;
        const entered = [...new Set(models.split(',').map(value => value.trim()).filter(Boolean))];
        const list = entered.filter(model => /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+:free$/.test(model));
        setSaving(true); setError(''); setMessage('');
        const { error: saveError } = await supabase.from('chatbot_settings').update({ openrouter_models: list.join(',') }).eq('id', rowId);
        if (saveError) setError('Could not save the free model order. Check admin access and retry.');
        else { setModels(list.join(',')); setMessage(entered.length !== list.length ? 'Saved the free model order. Paid or invalid entries were removed.' : 'Free model fallback order saved.'); }
        setSaving(false);
    }

    return <AdminShell><main className="mx-auto max-w-4xl space-y-6">
        <header><p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">Discovery controls</p><h1 className="mt-2 text-3xl font-black text-white">Vibe Manager</h1><p className="mt-2 text-sm leading-6 text-gray-400">Manage the private recommendation assistant and its free-model fallback order.</p></header>
        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-6">
            <h2 className="text-lg font-bold text-white">Model fallback order</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">The Vibe Manager tries these models in order. If one is unavailable or rate-limited, it tries the next. Only IDs ending in <code className="text-violet-300">:free</code> are accepted here. If every model fails, Nexiplay uses its catalog-based fallback. Provider and model details are never sent to the website UI.</p>
            {loading ? <p className="mt-5 text-sm text-gray-500">Loading settings…</p> : <>
                <label className="mt-5 block text-sm font-medium text-gray-300" htmlFor="free-models">OpenRouter free model IDs, in priority order</label>
                <textarea id="free-models" rows={5} value={models} onChange={event => setModels(event.target.value)} placeholder="provider/model:free, another-provider/model:free" className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-sm text-white outline-none focus:border-violet-400" />
                <p className="mt-2 text-xs leading-5 text-gray-500">Add the server-only <code>OPENROUTER_API_KEY</code> to the Nexiplay website deployment environment. The admin panel stores only model IDs; secret keys are not stored here. Free tiers have provider-set usage limits and may become temporarily unavailable.</p>
            </>}
            {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{message && <p role="status" className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}
            <div className="mt-5 flex justify-end"><button onClick={save} disabled={loading || saving || rowId === null} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save fallback order'}</button></div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-bold text-white">Free fallback behavior</h2><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-gray-400"><li>Try each configured free model in sequence.</li><li>Use the optional Groq free-tier route only when <code>GROQ_API_KEY</code> and <code>GROQ_FREE_TIER_CONFIRMED=true</code> are configured on the website host.</li><li>If no AI route responds, rank Nexiplay database titles locally. No model names or provider errors are shown to users.</li></ol></section>
    </main></AdminShell>;
}
