'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Upcoming } from '@/lib/types';
import Image from 'next/image';
import { uploadPoster } from '@/lib/upload';

export default function UpcomingManager() {
    const [upcoming, setUpcoming] = useState<Upcoming[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingItem, setEditingItem] = useState<Upcoming | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [posterUrl, setPosterUrl] = useState('');
    const [type, setType] = useState<'anime' | 'series' | 'movie'>('movie');
    const [releaseDate, setReleaseDate] = useState('');
    const [status, setStatus] = useState<'announced' | 'confirmed' | 'delayed'>('announced');
    const [trailerUrl, setTrailerUrl] = useState('');
    const [uploadingPoster, setUploadingPoster] = useState(false);

    useEffect(() => {
        fetchUpcoming();
    }, []);

    const fetchUpcoming = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('upcoming')
                .select('*')
                .order('release_date', { ascending: true });

            if (error) throw error;
            setUpcoming(data || []);
        } catch (err: any) {
            console.error('Error fetching upcoming:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingPoster(true);
        try {
            const publicUrl = await uploadPoster(file);
            if (publicUrl) {
                setPosterUrl(publicUrl);
            }
        } catch (err) {
            console.error('Error uploading poster:', err);
            alert('Failed to upload poster.');
        } finally {
            setUploadingPoster(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const payload = {
                title,
                slug,
                poster_url: posterUrl,
                type,
                release_date: releaseDate,
                status,
                trailer_url: trailerUrl || null
            };

            if (editingItem) {
                const { error } = await supabase
                    .from('upcoming')
                    .update(payload)
                    .eq('id', editingItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('upcoming')
                    .insert(payload);
                if (error) throw error;
            }

            // Reset and refresh
            setIsEditing(false);
            setEditingItem(null);
            resetForm();
            fetchUpcoming();
        } catch (err: any) {
            console.error('Error saving upcoming:', err);
            setError(err?.message || err?.details || JSON.stringify(err) || 'Unknown error. Make sure the "upcoming" table exists in Supabase.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this upcoming release?')) return;

        try {
            const { error } = await supabase
                .from('upcoming')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchUpcoming();
        } catch (err) {
            console.error('Error deleting upcoming:', err);
            alert('Failed to delete.');
        }
    };

    const openEdit = (item: Upcoming) => {
        setEditingItem(item);
        setTitle(item.title);
        setSlug(item.slug);
        setPosterUrl(item.poster_url);
        setType(item.type);
        setReleaseDate(item.release_date);
        setStatus(item.status);
        setTrailerUrl(item.trailer_url || '');
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const resetForm = () => {
        setTitle('');
        setSlug('');
        setPosterUrl('');
        setType('movie');
        setReleaseDate('');
        setStatus('announced');
        setTrailerUrl('');
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'confirmed': return <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/20">CONFIRMED</span>;
            case 'delayed': return <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/20">DELAYED</span>;
            default: return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full border border-blue-500/20">COMING SOON</span>;
        }
    };

    const TypeBadge = ({ type }: { type: string }) => {
        switch (type) {
            case 'anime': return <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full border border-purple-500/20 uppercase">ANIME</span>;
            case 'series': return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs rounded-full border border-orange-500/20 uppercase">SERIES</span>;
            default: return <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-full border border-gray-500/20 uppercase">MOVIE</span>;
        }
    }

    if (loading && !upcoming.length) return <div className="p-8 text-center text-gray-400">Loading...</div>;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-dark-800 p-6 rounded-2xl border border-white/5 shadow-2xl">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Upcoming Releases</h1>
                    <p className="text-gray-400">Manage upcoming movies, series, and anime.</p>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => {
                            resetForm();
                            setEditingItem(null);
                            setIsEditing(true);
                        }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add Upcoming
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
                    {error}
                </div>
            )}

            {isEditing && (
                <div className="bg-dark-800 p-6 rounded-2xl border border-white/5 shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">{editingItem ? 'Edit Release' : 'Add New Release'}</h2>
                        <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Title</label>
                                    <input
                                        type="text"
                                        required
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                        placeholder="e.g. Demon Slayer Infinity Castle"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Slug (for URL link)</label>
                                    <input
                                        type="text"
                                        required
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                        placeholder="demon-slayer-infinity-castle"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Must match the slug of the actual content if it already exists, or what it will be.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Type</label>
                                        <select
                                            value={type}
                                            onChange={(e) => setType(e.target.value as any)}
                                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                        >
                                            <option value="movie">Movie</option>
                                            <option value="series">Series</option>
                                            <option value="anime">Anime</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Status</label>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as any)}
                                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                        >
                                            <option value="announced">Announced / Coming Soon</option>
                                            <option value="confirmed">Confirmed Date</option>
                                            <option value="delayed">Delayed</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Release Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={releaseDate}
                                        onChange={(e) => setReleaseDate(e.target.value)}
                                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Trailer URL (YouTube)</label>
                                    <input
                                        type="url"
                                        value={trailerUrl}
                                        onChange={(e) => setTrailerUrl(e.target.value)}
                                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                        placeholder="https://youtube.com/watch?v=..."
                                    />
                                </div>
                            </div>

                            {/* Poster Upload */}
                            <div className="space-y-4">
                                <label className="block text-sm text-gray-400 mb-1">Poster Image</label>
                                <div className="aspect-[2/3] w-48 bg-dark-700 rounded-xl overflow-hidden relative border border-white/10 group">
                                    {posterUrl ? (
                                        <Image src={posterUrl} alt="Poster" fill className="object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">No Image</div>
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <label className="cursor-pointer bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-white text-sm backdrop-blur-sm transition-colors">
                                            {uploadingPoster ? 'Uploading...' : 'Upload Poster'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePosterUpload}
                                                disabled={uploadingPoster}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                                {!posterUrl && <p className="text-red-400 text-xs">Poster is required.</p>}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 pt-4 border-t border-white/5">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-6 py-2.5 rounded-lg font-medium bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving || !posterUrl}
                                className="btn-primary disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : (editingItem ? 'Update Release' : 'Add Release')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {upcoming.map(item => (
                        <div key={item.id} className="bg-dark-800 rounded-2xl border border-white/5 overflow-hidden flex shadow-lg">
                            <div className="w-1/3 relative aspect-[2/3] bg-dark-700">
                                {item.poster_url && (
                                    <Image src={item.poster_url} alt={item.title} fill className="object-cover" />
                                )}
                            </div>
                            <div className="w-2/3 p-4 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-bold text-white text-sm line-clamp-2">{item.title}</h3>
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => openEdit(item)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-3 font-mono">/{item.type}/{item.slug}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <TypeBadge type={item.type} />
                                        <StatusBadge status={item.status} />
                                    </div>
                                </div>
                                
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <p className="text-xs text-gray-500 mb-1">Release Date</p>
                                    <p className="text-sm font-medium text-white">
                                        {new Date(item.release_date).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {upcoming.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 bg-dark-800 rounded-2xl border border-white/5 border-dashed">
                            No upcoming releases added yet.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
