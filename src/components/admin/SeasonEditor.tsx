'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Season, Episode, EpisodeDownloadLink } from '@/lib/types';

interface SeasonEditorProps {
    movieId: string;
    movieType: 'movie' | 'series' | 'anime';
}

const RESOLUTIONS = ['360p', '480p', '720p', '1080p'] as const;

const PROVIDER_FIELDS = [
    { key: 'mega_link', label: 'Mega' },
    { key: 'gdrive_link', label: 'Google Drive' },
    { key: 'mediafire_link', label: 'MediaFire' },
    { key: 'terabox_link', label: 'TeraBox' },
    { key: 'pcloud_link', label: 'pCloud' },
    { key: 'youtube_link', label: 'YouTube' },
] as const;

export default function SeasonEditor({ movieId, movieType }: SeasonEditorProps) {
    const [seasons, setSeasons] = useState<Season[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modal states
    const [showSeasonModal, setShowSeasonModal] = useState(false);
    const [showEpisodeModal, setShowEpisodeModal] = useState(false);
    const [editingSeason, setEditingSeason] = useState<Season | null>(null);
    const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
    const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

    // Form states
    const [seasonNumber, setSeasonNumber] = useState(1);
    const [seasonTitle, setSeasonTitle] = useState('');
    const [seasonZipLink, setSeasonZipLink] = useState('');
    const [episodeNumber, setEpisodeNumber] = useState(1);
    const [episodeTitle, setEpisodeTitle] = useState('');
    const [episodeLinks, setEpisodeLinks] = useState<Record<string, EpisodeDownloadLink>>({});
    const [activeResolution, setActiveResolution] = useState('720p');

    // Only show for series/anime
    if (movieType === 'movie') {
        return null;
    }

    // Fetch seasons with episodes
    const fetchSeasons = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('seasons')
            .select(`
                *,
                episodes (
                    *,
                    download_links:episode_download_links (*)
                )
            `)
            .eq('movie_id', movieId)
            .order('season_number');

        if (data) {
            setSeasons(data as Season[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (movieId) {
            fetchSeasons();
        }
    }, [movieId]);

    // Initialize episode links for editing
    const initEpisodeLinks = (episode?: Episode) => {
        const links: Record<string, EpisodeDownloadLink> = {};
        RESOLUTIONS.forEach(res => {
            const existing = episode?.download_links?.find(l => l.resolution === res);
            links[res] = existing || {
                resolution: res,
                file_size: '',
                mega_link: '',
                gdrive_link: '',
                mediafire_link: '',
                terabox_link: '',
                pcloud_link: '',
                youtube_link: '',
            };
        });
        return links;
    };

    // Season CRUD
    const openAddSeason = () => {
        setEditingSeason(null);
        setSeasonNumber(seasons.length + 1);
        setSeasonTitle(`Season ${seasons.length + 1}`);
        setSeasonZipLink('');
        setShowSeasonModal(true);
    };

    const openEditSeason = (season: Season) => {
        setEditingSeason(season);
        setSeasonNumber(season.season_number);
        setSeasonTitle(season.season_title || '');
        setSeasonZipLink(season.season_zip_link || '');
        setShowSeasonModal(true);
    };

    const saveSeason = async () => {
        setSaving(true);
        try {
            if (editingSeason?.id) {
                await supabase.from('seasons').update({
                    season_number: seasonNumber,
                    season_title: seasonTitle || null,
                    season_zip_link: seasonZipLink || null,
                }).eq('id', editingSeason.id);
            } else {
                await supabase.from('seasons').insert({
                    movie_id: movieId,
                    season_number: seasonNumber,
                    season_title: seasonTitle || null,
                    season_zip_link: seasonZipLink || null,
                });
            }
            await fetchSeasons();
            setShowSeasonModal(false);
        } catch (error) {
            console.error('Error saving season:', error);
            alert('Failed to save season');
        }
        setSaving(false);
    };

    const deleteSeason = async (seasonId: string) => {
        if (!confirm('Delete this season and all its episodes?')) return;
        await supabase.from('seasons').delete().eq('id', seasonId);
        await fetchSeasons();
    };

    // Episode CRUD
    const openAddEpisode = (season: Season) => {
        setSelectedSeason(season);
        setEditingEpisode(null);
        setEpisodeNumber((season.episodes?.length || 0) + 1);
        setEpisodeTitle('');
        setEpisodeLinks(initEpisodeLinks());
        setActiveResolution('720p');
        setShowEpisodeModal(true);
    };

    const openEditEpisode = (season: Season, episode: Episode) => {
        setSelectedSeason(season);
        setEditingEpisode(episode);
        setEpisodeNumber(episode.episode_number);
        setEpisodeTitle(episode.episode_title || '');
        setEpisodeLinks(initEpisodeLinks(episode));
        setActiveResolution('720p');
        setShowEpisodeModal(true);
    };

    const saveEpisode = async () => {
        if (!selectedSeason) return;
        setSaving(true);

        try {
            let episodeId = editingEpisode?.id;

            if (episodeId) {
                // Update episode
                await supabase.from('episodes').update({
                    episode_number: episodeNumber,
                    episode_title: episodeTitle || null,
                }).eq('id', episodeId);
            } else {
                // Insert episode
                const { data, error } = await supabase.from('episodes').insert({
                    season_id: selectedSeason.id,
                    episode_number: episodeNumber,
                    episode_title: episodeTitle || null,
                }).select().single();

                if (error) throw error;
                episodeId = data.id;
            }

            // Save download links
            await supabase.from('episode_download_links').delete().eq('episode_id', episodeId);

            const linkInserts = Object.values(episodeLinks)
                .filter(link =>
                    link.mega_link || link.gdrive_link || link.mediafire_link ||
                    link.terabox_link || link.pcloud_link || link.youtube_link
                )
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

            await fetchSeasons();
            setShowEpisodeModal(false);
        } catch (error) {
            console.error('Error saving episode:', error);
            alert('Failed to save episode');
        }
        setSaving(false);
    };

    const deleteEpisode = async (episodeId: string) => {
        if (!confirm('Delete this episode?')) return;
        await supabase.from('episodes').delete().eq('id', episodeId);
        await fetchSeasons();
    };

    const updateEpisodeLink = (resolution: string, field: string, value: string) => {
        setEpisodeLinks(prev => ({
            ...prev,
            [resolution]: {
                ...prev[resolution],
                [field]: value,
            }
        }));
    };

    const hasAnyLink = (resolution: string) => {
        const link = episodeLinks[resolution];
        return PROVIDER_FIELDS.some(p => link?.[p.key as keyof EpisodeDownloadLink]);
    };

    if (loading) {
        return (
            <div className="glass p-6 rounded-xl border border-white/5">
                <div className="animate-pulse">
                    <div className="h-6 bg-dark-600 rounded w-1/3 mb-4"></div>
                    <div className="h-20 bg-dark-600 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-purple-500">📺</span> Seasons & Episodes
                </h2>
                <button
                    type="button"
                    onClick={openAddSeason}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Season
                </button>
            </div>

            {/* Seasons List */}
            {seasons.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <p>No seasons yet. Click "Add Season" to create one.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {seasons.map((season) => (
                        <div key={season.id} className="bg-dark-700/50 rounded-xl border border-white/5 overflow-hidden">
                            {/* Season Header */}
                            <div className="p-4 flex items-center justify-between bg-dark-600/50">
                                <div>
                                    <h3 className="font-bold text-white">
                                        Season {season.season_number}
                                        {season.season_title && `: ${season.season_title}`}
                                    </h3>
                                    <p className="text-sm text-gray-400">
                                        {season.episodes?.length || 0} episodes
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openAddEpisode(season)}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-green-900/20 flex items-center gap-2"
                                    >
                                        <span className="text-lg leading-none">+</span> Add Episode
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openEditSeason(season)}
                                        className="px-3 py-1.5 bg-blue-600/20 text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-600/30 transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => deleteSeason(season.id!)}
                                        className="px-3 py-1.5 bg-red-600/20 text-red-400 text-sm font-medium rounded-lg hover:bg-red-600/30 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            {/* Episodes List */}
                            {season.episodes && season.episodes.length > 0 && (
                                <div className="p-4 space-y-2">
                                    {season.episodes
                                        .sort((a, b) => a.episode_number - b.episode_number)
                                        .map((episode) => (
                                            <div
                                                key={episode.id}
                                                className="flex items-center justify-between p-3 bg-dark-700 rounded-lg"
                                            >
                                                <div>
                                                    <span className="font-medium text-white">
                                                        Episode {episode.episode_number}
                                                    </span>
                                                    {episode.episode_title && (
                                                        <span className="text-gray-400 ml-2">
                                                            - {episode.episode_title}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-500 ml-2">
                                                        ({episode.download_links?.length || 0} resolutions)
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditEpisode(season, episode)}
                                                        className="text-blue-400 hover:text-blue-300 text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteEpisode(episode.id!)}
                                                        className="text-red-400 hover:text-red-300 text-sm"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Season Modal */}
            {showSeasonModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-2xl border border-white/10 w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">
                            {editingSeason ? 'Edit Season' : 'Add Season'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Season Number</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={seasonNumber}
                                    onChange={(e) => setSeasonNumber(Number(e.target.value))}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Season Title (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., The Beginning"
                                    value={seasonTitle}
                                    onChange={(e) => setSeasonTitle(e.target.value)}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Full Season ZIP Download Link (optional)</label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={seasonZipLink}
                                    onChange={(e) => setSeasonZipLink(e.target.value)}
                                    className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setShowSeasonModal(false)}
                                className="flex-1 px-4 py-2.5 bg-dark-600 text-gray-300 rounded-lg hover:bg-dark-500"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveSeason}
                                disabled={saving}
                                className="flex-1 px-4 py-2.5 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Episode Modal */}
            {showEpisodeModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-800 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-900/20">
                        <div className="sticky top-0 bg-dark-800/95 backdrop-blur z-10 p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                <span className="bg-purple-600 text-white w-8 h-8 rounded-lg flex items-center justify-center text-sm">
                                    S{selectedSeason?.season_number}
                                </span>
                                {editingEpisode ? 'Edit Episode' : 'Add New Episode'}
                            </h3>
                            <button
                                onClick={() => setShowEpisodeModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* CAUTION: Episode Info Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Episode Number</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={episodeNumber}
                                        onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                                        className="w-full bg-dark-700 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all font-bold text-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Episode Title <span className="text-gray-500 font-normal">(Optional)</span></label>
                                    <input
                                        type="text"
                                        placeholder="e.g., The Beginning"
                                        value={episodeTitle}
                                        onChange={(e) => setEpisodeTitle(e.target.value)}
                                        className="w-full bg-dark-700 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Download Links Section */}
                            <div className="bg-dark-700/30 rounded-2xl p-6 border border-white/5">
                                <div className="flex items-center justify-between mb-6">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                        🔗 Download Links
                                        <span className="text-xs font-normal text-gray-400 bg-white/5 px-2 py-1 rounded">
                                            Configure per resolution
                                        </span>
                                    </h4>
                                </div>

                                {/* Resolution Tabs */}
                                <div className="flex flex-wrap gap-2 mb-6 p-1 bg-dark-900/50 rounded-xl border border-white/5 w-fit">
                                    {RESOLUTIONS.map((res) => (
                                        <button
                                            key={res}
                                            type="button"
                                            onClick={() => setActiveResolution(res)}
                                            className={`
                                                px-6 py-2.5 rounded-lg text-sm font-bold transition-all relative
                                                ${activeResolution === res
                                                    ? 'bg-purple-600 text-white shadow-lg'
                                                    : hasAnyLink(res)
                                                        ? 'text-green-400 hover:bg-white/5'
                                                        : 'text-gray-400 hover:bg-white/5'
                                                }
                                            `}
                                        >
                                            {res}
                                            {hasAnyLink(res) && (
                                                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${activeResolution === res ? 'bg-white' : 'bg-green-500'}`}></span>
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Link Inputs Grid */}
                                <div className="space-y-4 animate-fadeIn">
                                    {/* File Size */}
                                    <div>
                                        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1.5 font-bold">File Size ({activeResolution})</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">📊</span>
                                            <input
                                                type="text"
                                                placeholder="e.g., 250MB"
                                                value={episodeLinks[activeResolution]?.file_size || ''}
                                                onChange={(e) => updateEpisodeLink(activeResolution, 'file_size', e.target.value)}
                                                className="w-full pl-10 bg-dark-600 border border-white/5 rounded-lg p-2.5 text-white text-sm focus:border-purple-500/50 outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Provider Links Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {PROVIDER_FIELDS.map((provider) => (
                                            <div key={provider.key} className="group">
                                                <label className="block text-xs text-gray-400 mb-1.5 group-hover:text-purple-400 transition-colors">
                                                    {provider.label}
                                                </label>
                                                <input
                                                    type="url"
                                                    placeholder="Paste link here..."
                                                    value={(episodeLinks[activeResolution]?.[provider.key as keyof EpisodeDownloadLink] as string) || ''}
                                                    onChange={(e) => updateEpisodeLink(activeResolution, provider.key, e.target.value)}
                                                    className="w-full bg-dark-600 border border-white/5 rounded-lg p-2.5 text-white text-sm focus:border-purple-500/50 focus:bg-dark-500 outline-none transition-all"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="sticky bottom-0 bg-dark-800/95 backdrop-blur p-6 border-t border-white/10 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowEpisodeModal(false)}
                                className="px-6 py-3 bg-dark-700 text-gray-300 font-medium rounded-xl hover:bg-dark-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveEpisode}
                                disabled={saving}
                                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/30 transition-all flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Episode'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
