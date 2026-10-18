'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Profile = { id: string; label: string; description: string; genres: string[]; types: string[] };
export default function MoodPicksAdminPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [setupMessage, setSetupMessage] = useState('');
    const [writable, setWritable] = useState(true);
    useEffect(() => {
        fetch('/api/admin/mood-profiles', { cache: 'no-store' }).then(async response => {
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Could not load mood profiles.');
            setProfiles(payload.profiles);
            setWritable(payload.writable !== false);
            setSetupMessage(payload.setupMessage || '');
        }).catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load mood profiles.')).finally(() => setLoading(false));
    }, []);
    function update(index: number, patch: Partial<Profile>) {
        setProfiles(current => current.map((profile, i) => i === index ? { ...profile, ...patch } : profile));
    }
    async function save(event: FormEvent) {
        event.preventDefault(); setSaving(true); setError(''); setNotice('');
        try {
            const response = await fetch('/api/admin/mood-profiles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profiles }) });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Could not save profiles.');
            setProfiles(payload.profiles); setNotice('Mood profiles saved.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save profiles.'); }
        finally { setSaving(false); }
    }
    return <div className="mx-auto max-w-5xl space-y-7">
        <header><p className="text-xs font-bold uppercase tracking-[.22em] text-violet-300">Engagement settings</p><h1 className="mt-2 text-3xl font-black text-white">Vibe Check</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">Configure the vibe cards and catalog genres used to build instant recommendations.</p></header>
        {setupMessage && <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-100">{setupMessage}</p>}
        {loading ? <div className="rounded-2xl border border-white/10 bg-white/[.03] p-8 text-gray-400">Loading profiles…</div> : <form onSubmit={save} className="space-y-5">
            {profiles.map((profile, index) => <section key={profile.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">Profile {String(index + 1).padStart(2, '0')}</p><h2 className="mt-1 text-lg font-bold text-white">{profile.label}</h2></div><code className="rounded-lg bg-black/30 px-2 py-1 text-xs text-gray-400">{profile.id}</code></div>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm text-gray-300">Display name<input maxLength={40} value={profile.label} onChange={event => update(index, { label: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>
                    <label className="text-sm text-gray-300">Description<input maxLength={180} value={profile.description} onChange={event => update(index, { description: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-violet-400" /></label>
                    <label className="text-sm text-gray-300 md:col-span-2">Genre slugs, comma separated<input value={profile.genres.join(', ')} onChange={event => update(index, { genres: [...new Set(event.target.value.toLowerCase().split(',').map(slug => slug.trim()).filter(Boolean))] })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-white outline-none focus:border-violet-400" placeholder="comedy, family, romance" /><span className="mt-1 block text-xs text-gray-500">Use the exact category slugs in the content catalog.</span></label>
                    <fieldset className="md:col-span-2"><legend className="mb-2 text-sm text-gray-300">Content formats</legend><div className="flex flex-wrap gap-2">{(['movie', 'series', 'anime'] as const).map(type => <label key={type} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm capitalize text-gray-200"><input type="checkbox" checked={profile.types.includes(type)} onChange={event => update(index, { types: event.target.checked ? [...profile.types, type] : profile.types.filter(value => value !== type) })} />{type}</label>)}</div></fieldset>
                </div>
            </section>)}
            {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}{notice && <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4"><p className="max-w-xl text-xs leading-5 text-gray-500">Changes are stored in Supabase and appear on the website Vibe Check page.</p><button disabled={!writable || saving || !profiles.length} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : writable ? 'Save profiles' : 'Database setup required'}</button></div>
        </form>}
    </div>;
}
