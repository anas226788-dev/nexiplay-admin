'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Movie, Season, Episode, EpisodeDownloadLink, DownloadLink } from '@/lib/types';

// ─── Constants ───────────────────────────────────────────────────────
const RESOLUTIONS = ['360p', '480p', '720p', '1080p'] as const;
type Resolution = typeof RESOLUTIONS[number];

const PROVIDER_FIELDS = [
    { key: 'mega_link', label: 'Mega', short: 'Mega' },
    { key: 'gdrive_link', label: 'Google Drive', short: 'GDrive' },
    { key: 'mediafire_link', label: 'MediaFire', short: 'MFire' },
    { key: 'terabox_link', label: 'TeraBox', short: 'Tera' },
    { key: 'pcloud_link', label: 'pCloud', short: 'pCloud' },
    { key: 'youtube_link', label: 'YouTube', short: 'YT' },
] as const;
type ProviderKey = typeof PROVIDER_FIELDS[number]['key'];

// ─── Row type used in the editor ─────────────────────────────────────
interface EditableRow {
    episodeId?: string;          // existing episode ID (undefined = new)
    seasonId?: string;           // for inserts
    episodeNumber: number;
    episodeTitle: string;
    links: Record<Resolution, LinkData>;
    dirty: boolean;
    isNew: boolean;
}

interface LinkData {
    id?: string;
    resolution: Resolution;
    file_size: string;
    mega_link: string;
    gdrive_link: string;
    mediafire_link: string;
    terabox_link: string;
    pcloud_link: string;
    youtube_link: string;
}

// ─── Movie-mode row (single entry for download_links table) ──────────
interface MovieEditableRow {
    links: Record<Resolution, LinkData>;
    dirty: boolean;
}

const emptyLinkData = (res: Resolution): LinkData => ({
    resolution: res,
    file_size: '',
    mega_link: '',
    gdrive_link: '',
    mediafire_link: '',
    terabox_link: '',
    pcloud_link: '',
    youtube_link: '',
});

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function DownloadsPage() {
    // ── Step 1 selectors ──────────────────────────────────────────────
    const [contentType, setContentType] = useState<'movie' | 'series' | 'anime'>('anime');
    const [titles, setTitles] = useState<Movie[]>([]);
    const [selectedTitleId, setSelectedTitleId] = useState<string>('');
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
    const [loadingTitles, setLoadingTitles] = useState(false);
    const [loadingSeasons, setLoadingSeasons] = useState(false);

    // ── Step 2 editor state ───────────────────────────────────────────
    const [rows, setRows] = useState<EditableRow[]>([]);
    const [movieRow, setMovieRow] = useState<MovieEditableRow | null>(null);
    const [activeRes, setActiveRes] = useState<Resolution>('720p');
    const [loaded, setLoaded] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    // ── Step 3 save state ─────────────────────────────────────────────
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ count: number; success: boolean } | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    // ── Expanded row for mobile ───────────────────────────────────────
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    // ── Search / filter for titles ────────────────────────────────────
    const [titleSearch, setTitleSearch] = useState('');

    // ───────────────────────────────────────────────────────────────────
    // Fetch titles when type changes
    // ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        setSelectedTitleId('');
        setSeasons([]);
        setSelectedSeasonId('');
        setRows([]);
        setMovieRow(null);
        setLoaded(false);
        setSaveResult(null);
        setTitleSearch('');

        const fetchTitles = async () => {
            setLoadingTitles(true);
            const { data } = await supabase
                .from('movies')
                .select('id, title, slug, type')
                .eq('type', contentType)
                .order('title');
            setTitles((data as Movie[]) || []);
            setLoadingTitles(false);
        };
        fetchTitles();
    }, [contentType]);

    // ───────────────────────────────────────────────────────────────────
    // Fetch seasons when title changes (series/anime only)
    // ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        setSeasons([]);
        setSelectedSeasonId('');
        setRows([]);
        setMovieRow(null);
        setLoaded(false);
        setSaveResult(null);

        if (!selectedTitleId || contentType === 'movie') return;

        const fetchSeasons = async () => {
            setLoadingSeasons(true);
            const { data } = await supabase
                .from('seasons')
                .select('id, season_number, season_title')
                .eq('movie_id', selectedTitleId)
                .order('season_number');
            setSeasons((data as Season[]) || []);
            setLoadingSeasons(false);
        };
        fetchSeasons();
    }, [selectedTitleId, contentType]);

    // ───────────────────────────────────────────────────────────────────
    // Load data (episodes or movie links)
    // ───────────────────────────────────────────────────────────────────
    const handleLoad = useCallback(async () => {
        setLoadingData(true);
        setSaveResult(null);

        if (contentType === 'movie') {
            // Load download_links for this movie
            const { data } = await supabase
                .from('download_links')
                .select('*')
                .eq('movie_id', selectedTitleId);

            const links: Record<Resolution, LinkData> = {} as any;
            RESOLUTIONS.forEach(res => {
                const existing = (data || []).find((l: any) => l.resolution === res);
                links[res] = existing ? {
                    id: existing.id,
                    resolution: res,
                    file_size: existing.file_size || '',
                    mega_link: existing.mega_link || '',
                    gdrive_link: existing.gdrive_link || '',
                    mediafire_link: existing.mediafire_link || '',
                    terabox_link: existing.terabox_link || '',
                    pcloud_link: existing.pcloud_link || '',
                    youtube_link: existing.youtube_link || '',
                } : emptyLinkData(res);
            });

            setMovieRow({ links, dirty: false });
            setRows([]);
        } else {
            // Load episodes + links for selected season
            const { data } = await supabase
                .from('episodes')
                .select(`
                    *,
                    download_links:episode_download_links (*)
                `)
                .eq('season_id', selectedSeasonId)
                .order('episode_number');

            const episodeRows: EditableRow[] = ((data as Episode[]) || []).map(ep => {
                const links: Record<Resolution, LinkData> = {} as any;
                RESOLUTIONS.forEach(res => {
                    const existing = ep.download_links?.find(l => l.resolution === res);
                    links[res] = existing ? {
                        id: existing.id,
                        resolution: res,
                        file_size: existing.file_size || '',
                        mega_link: existing.mega_link || '',
                        gdrive_link: existing.gdrive_link || '',
                        mediafire_link: existing.mediafire_link || '',
                        terabox_link: existing.terabox_link || '',
                        pcloud_link: existing.pcloud_link || '',
                        youtube_link: existing.youtube_link || '',
                    } : emptyLinkData(res);
                });
                return {
                    episodeId: ep.id,
                    seasonId: selectedSeasonId,
                    episodeNumber: ep.episode_number,
                    episodeTitle: ep.episode_title || '',
                    links,
                    dirty: false,
                    isNew: false,
                };
            });

            setRows(episodeRows);
            setMovieRow(null);
        }

        setLoaded(true);
        setLoadingData(false);
    }, [contentType, selectedTitleId, selectedSeasonId]);

    // ───────────────────────────────────────────────────────────────────
    // Update a cell in the episode table
    // ───────────────────────────────────────────────────────────────────
    const updateRowLink = (rowIdx: number, field: string, value: string) => {
        setRows(prev => {
            const copy = [...prev];
            const row = { ...copy[rowIdx] };
            if (field === 'episodeTitle') {
                row.episodeTitle = value;
            } else {
                row.links = {
                    ...row.links,
                    [activeRes]: { ...row.links[activeRes], [field]: value },
                };
            }
            row.dirty = true;
            copy[rowIdx] = row;
            return copy;
        });
    };

    // Update movie-mode link
    const updateMovieLink = (field: string, value: string) => {
        setMovieRow(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                links: {
                    ...prev.links,
                    [activeRes]: { ...prev.links[activeRes], [field]: value },
                },
                dirty: true,
            };
        });
    };

    // ───────────────────────────────────────────────────────────────────
    // Add new episode row
    // ───────────────────────────────────────────────────────────────────
    const addEpisodeRow = () => {
        const maxEp = rows.length > 0 ? Math.max(...rows.map(r => r.episodeNumber)) : 0;
        const links: Record<Resolution, LinkData> = {} as any;
        RESOLUTIONS.forEach(res => { links[res] = emptyLinkData(res); });

        setRows(prev => [...prev, {
            seasonId: selectedSeasonId,
            episodeNumber: maxEp + 1,
            episodeTitle: '',
            links,
            dirty: true,
            isNew: true,
        }]);
    };

    // ───────────────────────────────────────────────────────────────────
    // Delete episode row
    // ───────────────────────────────────────────────────────────────────
    const deleteRow = async (idx: number) => {
        const row = rows[idx];
        if (!confirm(`Delete Episode ${row.episodeNumber}?`)) return;

        if (row.episodeId) {
            await supabase.from('episode_download_links').delete().eq('episode_id', row.episodeId);
            await supabase.from('episodes').delete().eq('id', row.episodeId);
        }
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    // ───────────────────────────────────────────────────────────────────
    // SAVE ALL
    // ───────────────────────────────────────────────────────────────────
    const dirtyCount = contentType === 'movie'
        ? (movieRow?.dirty ? 1 : 0)
        : rows.filter(r => r.dirty).length;

    const handleSaveAll = async () => {
        setShowConfirm(false);
        setSaving(true);
        let updatedCount = 0;

        try {
            if (contentType === 'movie' && movieRow?.dirty) {
                // Delete existing + re-insert
                await supabase.from('download_links').delete().eq('movie_id', selectedTitleId);

                const inserts = Object.values(movieRow.links)
                    .filter(link => PROVIDER_FIELDS.some(p => link[p.key as keyof LinkData]))
                    .map(link => ({
                        movie_id: selectedTitleId,
                        resolution: link.resolution,
                        file_size: link.file_size || null,
                        mega_link: link.mega_link || null,
                        gdrive_link: link.gdrive_link || null,
                        mediafire_link: link.mediafire_link || null,
                        terabox_link: link.terabox_link || null,
                        pcloud_link: link.pcloud_link || null,
                        youtube_link: link.youtube_link || null,
                    }));

                if (inserts.length > 0) {
                    await supabase.from('download_links').insert(inserts);
                }
                updatedCount = 1;
                setMovieRow(prev => prev ? { ...prev, dirty: false } : prev);
            } else {
                // Episode mode — save dirty rows
                const dirtyRows = rows.filter(r => r.dirty);

                for (const row of dirtyRows) {
                    let episodeId = row.episodeId;

                    if (row.isNew) {
                        // Insert episode
                        const { data, error } = await supabase.from('episodes').insert({
                            season_id: row.seasonId,
                            episode_number: row.episodeNumber,
                            episode_title: row.episodeTitle || null,
                        }).select().single();
                        if (error) throw error;
                        episodeId = data.id;
                    } else {
                        // Update episode metadata
                        await supabase.from('episodes').update({
                            episode_number: row.episodeNumber,
                            episode_title: row.episodeTitle || null,
                        }).eq('id', episodeId);
                    }

                    // Delete existing links + re-insert
                    await supabase.from('episode_download_links').delete().eq('episode_id', episodeId);

                    const linkInserts = Object.values(row.links)
                        .filter(link => PROVIDER_FIELDS.some(p => link[p.key as keyof LinkData]))
                        .map(link => ({
                            episode_id: episodeId,
                            resolution: link.resolution,
                            file_size: link.file_size || null,
                            mega_link: link.mega_link || null,
                            gdrive_link: link.gdrive_link || null,
                            mediafire_link: link.mediafire_link || null,
                            terabox_link: link.terabox_link || null,
                            pcloud_link: link.pcloud_link || null,
                            youtube_link: link.youtube_link || null,
                        }));

                    if (linkInserts.length > 0) {
                        await supabase.from('episode_download_links').insert(linkInserts);
                    }
                    updatedCount++;
                }

                // Mark all clean + update IDs
                setRows(prev => prev.map(r => ({ ...r, dirty: false, isNew: false })));

                // Reload to get fresh IDs
                await handleLoad();
            }

            setSaveResult({ count: updatedCount, success: true });
        } catch (error) {
            console.error('Error saving:', error);
            setSaveResult({ count: 0, success: false });
        }
        setSaving(false);
    };

    // ───────────────────────────────────────────────────────────────────
    // Helper: check if a resolution has any link for a row
    // ───────────────────────────────────────────────────────────────────
    const hasLinks = (links: Record<Resolution, LinkData>, res: Resolution) =>
        PROVIDER_FIELDS.some(p => links[res]?.[p.key as keyof LinkData]);

    // ───────────────────────────────────────────────────────────────────
    // Filtered titles
    // ───────────────────────────────────────────────────────────────────
    const filteredTitles = titleSearch
        ? titles.filter(t => t.title.toLowerCase().includes(titleSearch.toLowerCase()))
        : titles;

    const selectedTitle = titles.find(t => t.id === selectedTitleId);
    const selectedSeason = seasons.find(s => s.id === selectedSeasonId);
    const canLoad = contentType === 'movie' ? !!selectedTitleId : !!selectedSeasonId;

    // ═══════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════
    return (
        <div className="space-y-6 pb-32">
            {/* Inline animation keyframes */}
            <style jsx>{`
                @keyframes dl-fade-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes dl-slide-in { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes dl-scale-in { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
                @keyframes dl-slide-up { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
                @keyframes dl-toast-in { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes dl-pulse-dot { 0%, 100% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.4); opacity: 1; } }
                .dl-anim-header { animation: dl-fade-up 0.5s ease-out both; }
                .dl-anim-panel-1 { animation: dl-fade-up 0.5s ease-out 0.1s both; }
                .dl-anim-panel-2 { animation: dl-fade-up 0.5s ease-out 0.2s both; }
                .dl-anim-row { animation: dl-slide-in 0.35s ease-out both; }
                .dl-anim-scale { animation: dl-scale-in 0.3s ease-out both; }
                .dl-anim-footer { animation: dl-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                .dl-anim-toast { animation: dl-toast-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
                .dl-anim-pulse { animation: dl-pulse-dot 2s ease-in-out infinite; }
                .dl-anim-overlay { animation: dl-fade-up 0.2s ease-out both; }
            `}</style>
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="flex items-center gap-3 dl-anim-header">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg">
                    ⬇
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Download Manager</h1>
                    <p className="text-sm text-gray-400">Manage all download links in one place</p>
                </div>
            </div>

            {/* ── Step 1: Content Selector ──────────────────────────── */}
            <div className="glass-panel rounded-2xl p-5 space-y-4 dl-anim-panel-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <span className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">1</span>
                    Select Content
                </h2>

                {/* Content Type Tabs */}
                <div className="flex gap-2">
                    {(['anime', 'series', 'movie'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setContentType(type)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${contentType === type
                                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                                }`}
                        >
                            {type === 'anime' ? '🎌 Anime' : type === 'series' ? '📺 Series' : '🎬 Movie'}
                        </button>
                    ))}
                </div>

                {/* Title Selector */}
                <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Title</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder={loadingTitles ? 'Loading...' : `Search ${contentType}s...`}
                            value={titleSearch}
                            onChange={e => { setTitleSearch(e.target.value); setSelectedTitleId(''); }}
                            className="w-full bg-dark-700 border border-white/10 rounded-xl p-3 text-white placeholder-gray-500 focus:border-red-500/50 outline-none transition-all"
                        />
                        {selectedTitle && !titleSearch && (
                            <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                                <span className="text-white font-medium">{selectedTitle.title}</span>
                            </div>
                        )}
                    </div>
                    {titleSearch && (
                        <div className="mt-1 bg-dark-800 border border-white/10 rounded-xl max-h-60 overflow-y-auto shadow-2xl">
                            {filteredTitles.length === 0 ? (
                                <div className="p-3 text-gray-500 text-sm">No results</div>
                            ) : (
                                filteredTitles.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { setSelectedTitleId(t.id); setTitleSearch(''); }}
                                        className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-sm text-gray-300 hover:text-white transition-colors border-b border-white/5 last:border-0"
                                    >
                                        {t.title}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Season Selector (series/anime only) */}
                {contentType !== 'movie' && selectedTitleId && (
                    <div>
                        <label className="block text-sm text-gray-400 mb-1.5">Season</label>
                        {loadingSeasons ? (
                            <div className="bg-dark-700 rounded-xl p-3 text-gray-500 text-sm animate-pulse">Loading seasons...</div>
                        ) : seasons.length === 0 ? (
                            <div className="bg-dark-700 rounded-xl p-3 text-yellow-400/80 text-sm border border-yellow-500/20">
                                ⚠ No seasons found. Add seasons from the Edit page first.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {seasons.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelectedSeasonId(s.id!)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedSeasonId === s.id
                                            ? 'bg-purple-600 text-white shadow-lg'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                                            }`}
                                    >
                                        S{s.season_number}{s.season_title ? `: ${s.season_title}` : ''}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Load Button */}
                {canLoad && (
                    <button
                        onClick={handleLoad}
                        disabled={loadingData}
                        className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
                    >
                        {loadingData ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Load Downloads
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* ── Step 2: Editor ────────────────────────────────────── */}
            {loaded && (
                <div className="glass-panel rounded-2xl overflow-hidden dl-anim-panel-2">
                    {/* Resolution Tabs */}
                    <div className="p-4 border-b border-white/5 flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mr-2">
                            <span className="w-6 h-6 bg-red-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">2</span>
                            Edit Links
                        </h2>
                        <div className="flex gap-1.5 p-1 bg-dark-900/50 rounded-xl border border-white/5">
                            {RESOLUTIONS.map(res => (
                                <button
                                    key={res}
                                    onClick={() => setActiveRes(res)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeRes === res
                                        ? 'bg-red-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {res}
                                </button>
                            ))}
                        </div>
                        {contentType !== 'movie' && (
                            <span className="text-xs text-gray-500 ml-auto hidden md:inline">
                                {rows.length} episode{rows.length !== 1 ? 's' : ''}
                                {dirtyCount > 0 && <span className="text-yellow-400 ml-2">• {dirtyCount} changed</span>}
                            </span>
                        )}
                    </div>

                    {/* ── Movie Mode ────────────────────────────────── */}
                    {contentType === 'movie' && movieRow && (
                        <div className="p-5 space-y-4 dl-anim-scale">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                🎬 {selectedTitle?.title}
                                <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-1 rounded-lg">{activeRes}</span>
                            </h3>
                            {/* File Size */}
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">File Size ({activeRes})</label>
                                <input
                                    type="text"
                                    placeholder="e.g., 800MB"
                                    value={movieRow.links[activeRes]?.file_size || ''}
                                    onChange={e => updateMovieLink('file_size', e.target.value)}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-red-500/50 outline-none"
                                />
                            </div>
                            {/* Providers */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {PROVIDER_FIELDS.map(p => (
                                    <div key={p.key}>
                                        <label className="block text-xs text-gray-400 mb-1">{p.label}</label>
                                        <input
                                            type="url"
                                            placeholder={`Paste ${p.label} link...`}
                                            value={(movieRow.links[activeRes]?.[p.key as keyof LinkData] as string) || ''}
                                            onChange={e => updateMovieLink(p.key, e.target.value)}
                                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:border-red-500/50 outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Episode Mode: Desktop Table ──────────────── */}
                    {contentType !== 'movie' && (
                        <>
                            {/* Desktop View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-dark-800/80 text-gray-400 text-xs uppercase tracking-wider">
                                            <th className="py-3 px-3 text-left font-bold w-16">Ep#</th>
                                            <th className="py-3 px-3 text-left font-bold w-40">Title</th>
                                            <th className="py-3 px-3 text-left font-bold w-20">Size</th>
                                            {PROVIDER_FIELDS.map(p => (
                                                <th key={p.key} className="py-3 px-2 text-left font-bold">{p.short}</th>
                                            ))}
                                            <th className="py-3 px-3 text-center font-bold w-16">Del</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => (
                                            <tr
                                                key={idx}
                                                className={`border-b border-white/5 transition-colors dl-anim-row ${row.dirty ? 'bg-yellow-500/5' : 'hover:bg-white/[0.02]'
                                                    } ${row.isNew ? 'bg-green-500/5' : ''}`}
                                                style={{ animationDelay: `${idx * 0.04}s` }}
                                            >
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={row.episodeNumber}
                                                        onChange={e => {
                                                            const val = Number(e.target.value);
                                                            setRows(prev => {
                                                                const copy = [...prev];
                                                                copy[idx] = { ...copy[idx], episodeNumber: val, dirty: true };
                                                                return copy;
                                                            });
                                                        }}
                                                        className="w-14 bg-dark-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:border-red-500/50 outline-none"
                                                    />
                                                </td>
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Title..."
                                                        value={row.episodeTitle}
                                                        onChange={e => updateRowLink(idx, 'episodeTitle', e.target.value)}
                                                        className="w-full bg-dark-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:border-red-500/50 outline-none"
                                                    />
                                                </td>
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="text"
                                                        placeholder="Size"
                                                        value={row.links[activeRes]?.file_size || ''}
                                                        onChange={e => updateRowLink(idx, 'file_size', e.target.value)}
                                                        className="w-20 bg-dark-700 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:border-red-500/50 outline-none"
                                                    />
                                                </td>
                                                {PROVIDER_FIELDS.map(p => (
                                                    <td key={p.key} className="py-2 px-2">
                                                        <input
                                                            type="url"
                                                            placeholder={p.short}
                                                            value={(row.links[activeRes]?.[p.key as keyof LinkData] as string) || ''}
                                                            onChange={e => updateRowLink(idx, p.key, e.target.value)}
                                                            className={`w-full min-w-[120px] bg-dark-700 border rounded-lg px-2 py-1.5 text-sm outline-none transition-colors ${(row.links[activeRes]?.[p.key as keyof LinkData] as string)
                                                                ? 'border-green-500/30 text-green-300'
                                                                : 'border-white/10 text-white'
                                                                } focus:border-red-500/50`}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        onClick={() => deleteRow(idx)}
                                                        className="text-red-400/60 hover:text-red-400 transition-colors p-1"
                                                        title="Delete episode"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {rows.length === 0 && (
                                    <div className="text-center py-12 text-gray-500">
                                        No episodes. Click "Add Episode" below.
                                    </div>
                                )}
                            </div>

                            {/* Mobile View - Expandable Cards */}
                            <div className="md:hidden p-3 space-y-2">
                                {rows.map((row, idx) => (
                                    <div
                                        key={idx}
                                        className={`rounded-xl border transition-colors dl-anim-row ${row.dirty ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/5 bg-dark-700/30'
                                            }`}
                                        style={{ animationDelay: `${idx * 0.05}s` }}
                                    >
                                        {/* Card Header */}
                                        <button
                                            onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                            className="w-full flex items-center justify-between p-3 text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center text-sm font-bold">
                                                    {row.episodeNumber}
                                                </span>
                                                <div>
                                                    <span className="text-sm font-medium text-white">
                                                        Episode {row.episodeNumber}
                                                    </span>
                                                    {row.episodeTitle && (
                                                        <span className="text-xs text-gray-400 block">{row.episodeTitle}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {row.dirty && <span className="w-2 h-2 rounded-full bg-yellow-400 dl-anim-pulse" />}
                                                <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedRow === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </button>

                                        {/* Card Expanded Content */}
                                        {expandedRow === idx && (
                                            <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Ep#</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={row.episodeNumber}
                                                            onChange={e => {
                                                                const val = Number(e.target.value);
                                                                setRows(prev => {
                                                                    const copy = [...prev];
                                                                    copy[idx] = { ...copy[idx], episodeNumber: val, dirty: true };
                                                                    return copy;
                                                                });
                                                            }}
                                                            className="w-full bg-dark-800 border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:border-red-500/50 outline-none"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Size</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. 250MB"
                                                            value={row.links[activeRes]?.file_size || ''}
                                                            onChange={e => updateRowLink(idx, 'file_size', e.target.value)}
                                                            className="w-full bg-dark-800 border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:border-red-500/50 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Title</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Episode title..."
                                                        value={row.episodeTitle}
                                                        onChange={e => updateRowLink(idx, 'episodeTitle', e.target.value)}
                                                        className="w-full bg-dark-800 border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:border-red-500/50 outline-none"
                                                    />
                                                </div>
                                                {PROVIDER_FIELDS.map(p => (
                                                    <div key={p.key}>
                                                        <label className="block text-xs text-gray-500 mb-1">{p.label}</label>
                                                        <input
                                                            type="url"
                                                            placeholder={`Paste ${p.label} link...`}
                                                            value={(row.links[activeRes]?.[p.key as keyof LinkData] as string) || ''}
                                                            onChange={e => updateRowLink(idx, p.key, e.target.value)}
                                                            className={`w-full bg-dark-800 border rounded-lg px-2.5 py-2 text-sm outline-none transition-colors ${(row.links[activeRes]?.[p.key as keyof LinkData] as string)
                                                                ? 'border-green-500/30 text-green-300'
                                                                : 'border-white/10 text-white'
                                                                } focus:border-red-500/50`}
                                                        />
                                                    </div>
                                                ))}
                                                <button
                                                    onClick={() => deleteRow(idx)}
                                                    className="w-full py-2 text-red-400 text-sm font-medium bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors mt-2"
                                                >
                                                    Delete Episode
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {rows.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No episodes. Tap "Add Episode" below.
                                    </div>
                                )}
                            </div>

                            {/* Add Episode Button */}
                            <div className="p-4 border-t border-white/5">
                                <button
                                    onClick={addEpisodeRow}
                                    className="w-full py-2.5 border-2 border-dashed border-white/10 rounded-xl text-gray-400 text-sm font-medium hover:border-green-500/30 hover:text-green-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Episode
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Step 3: Save All (Sticky Footer) ─────────────────── */}
            {loaded && dirtyCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 p-4 bg-dark-900/95 backdrop-blur-xl border-t border-white/10 shadow-2xl shadow-black/50 dl-anim-footer">
                    <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
                        <div className="text-sm">
                            <span className="text-yellow-400 font-bold">{dirtyCount}</span>
                            <span className="text-gray-400 ml-1">
                                {contentType === 'movie' ? 'movie' : 'episode'}{dirtyCount !== 1 ? 's' : ''} changed
                            </span>
                        </div>
                        <button
                            onClick={() => setShowConfirm(true)}
                            disabled={saving}
                            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/30 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Save All Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Save Result Toast ────────────────────────────────── */}
            {saveResult && (
                <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl border dl-anim-toast flex items-center gap-3 ${saveResult.success
                    ? 'bg-green-600/20 border-green-500/30 text-green-300'
                    : 'bg-red-600/20 border-red-500/30 text-red-300'
                    }`}>
                    {saveResult.success ? (
                        <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            <span className="font-bold">✓ {saveResult.count} record{saveResult.count !== 1 ? 's' : ''} updated</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                            <span className="font-bold">Save failed. Check console.</span>
                        </>
                    )}
                    <button onClick={() => setSaveResult(null)} className="ml-2 text-gray-400 hover:text-white">✕</button>
                </div>
            )}

            {/* ── Confirmation Dialog ──────────────────────────────── */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 dl-anim-overlay">
                    <div className="bg-dark-800 rounded-2xl border border-white/10 p-6 max-w-sm w-full text-center space-y-4 shadow-2xl dl-anim-scale">
                        <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white">Confirm Bulk Update</h3>
                        <p className="text-gray-400 text-sm">
                            You are about to update <span className="text-yellow-400 font-bold">{dirtyCount}</span>{' '}
                            {contentType === 'movie' ? 'movie download' : 'episode'}{dirtyCount !== 1 ? 's' : ''}.
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 py-3 bg-dark-600 text-gray-300 rounded-xl font-medium hover:bg-dark-500 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAll}
                                className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-500 hover:to-emerald-500 transition-all"
                            >
                                Update {dirtyCount}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
