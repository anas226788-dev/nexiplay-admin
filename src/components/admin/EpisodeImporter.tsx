'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ScrapedEpisode {
    number: number;
    title: string;
    link: string;
    selected: boolean;
}

interface ScrapeResult {
    pageTitle: string;
    resolution: string;
    seasonZipLink: string | null;
    episodes: ScrapedEpisode[];
}

interface EpisodeImporterProps {
    movieId: string;
    movieType: 'series' | 'anime';
    onImportComplete?: () => void;
}

interface SeasonInfo {
    id: string;
    season_number: number;
    season_title: string | null;
    season_zip_link: string | null;
    episode_count: number;
}

const RESOLUTIONS = ['360p', '480p', '720p', '1080p'] as const;

export default function EpisodeImporter({ movieId, movieType, onImportComplete }: EpisodeImporterProps) {
    const [sourceUrl, setSourceUrl] = useState('');
    const [scraping, setScraping] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ScrapeResult | null>(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Import settings
    const [seasonNumber, setSeasonNumber] = useState(1);
    const [resolution, setResolution] = useState('720p');
    const [importZipLink, setImportZipLink] = useState(true);

    // Progress
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);

    // Season management
    const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
    const [loadingSeasons, setLoadingSeasons] = useState(true);
    const [deletingSeason, setDeletingSeason] = useState<string | null>(null);

    // Fetch existing seasons for this content
    const fetchSeasons = async () => {
        setLoadingSeasons(true);
        try {
            const { data, error } = await supabase
                .from('seasons')
                .select(`
                    id,
                    season_number,
                    season_title,
                    season_zip_link,
                    episodes (id)
                `)
                .eq('movie_id', movieId)
                .order('season_number');

            if (data) {
                const mapped: SeasonInfo[] = data.map((s: any) => ({
                    id: s.id,
                    season_number: s.season_number,
                    season_title: s.season_title,
                    season_zip_link: s.season_zip_link,
                    episode_count: s.episodes?.length || 0,
                }));
                setSeasons(mapped);
            }
        } catch (err) {
            console.error('Error fetching seasons:', err);
        }
        setLoadingSeasons(false);
    };

    useEffect(() => {
        if (movieId) fetchSeasons();
    }, [movieId]);

    const handleDeleteSeason = async (season: SeasonInfo) => {
        const confirmed = confirm(
            `⚠️ Delete Season ${season.season_number}${season.season_title ? ` (${season.season_title})` : ''}?\n\nThis will permanently delete:\n• The season\n• ${season.episode_count} episodes\n• All download links for those episodes\n\nThis cannot be undone!`
        );

        if (!confirmed) return;

        setDeletingSeason(season.id);
        setError('');

        try {
            // Step 1: Get all episode IDs for this season
            const { data: episodes } = await supabase
                .from('episodes')
                .select('id')
                .eq('season_id', season.id);

            if (episodes && episodes.length > 0) {
                const episodeIds = episodes.map(ep => ep.id);

                // Step 2: Delete all download links for these episodes
                await supabase
                    .from('episode_download_links')
                    .delete()
                    .in('episode_id', episodeIds);

                // Step 3: Delete all episodes
                await supabase
                    .from('episodes')
                    .delete()
                    .eq('season_id', season.id);
            }

            // Step 4: Delete the season itself
            const { error: deleteError } = await supabase
                .from('seasons')
                .delete()
                .eq('id', season.id);

            if (deleteError) throw deleteError;

            setSuccessMessage(`🗑️ Season ${season.season_number} deleted with ${season.episode_count} episodes!`);

            // Refresh seasons list
            await fetchSeasons();

            // Refresh SeasonEditor
            if (onImportComplete) {
                onImportComplete();
            }

            // Clear success message after a while
            setTimeout(() => setSuccessMessage(''), 4000);

        } catch (err: any) {
            console.error('Delete error:', err);
            setError(`Delete failed: ${err.message}`);
        } finally {
            setDeletingSeason(null);
        }
    };

    const handleScrape = async () => {
        if (!sourceUrl.trim()) {
            setError('URL দাও ভাই!');
            return;
        }

        setScraping(true);
        setError('');
        setResult(null);
        setSuccessMessage('');

        try {
            const res = await fetch('/api/scrape-episodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: sourceUrl.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Scraping failed');
                return;
            }

            // Add 'selected' flag to each episode
            const episodes = data.episodes.map((ep: any) => ({
                ...ep,
                selected: true,
            }));

            setResult({
                ...data,
                episodes,
            });

            // Auto-set resolution from detected
            if (data.resolution) {
                setResolution(data.resolution);
            }

        } catch (err: any) {
            setError(`Network error: ${err.message}`);
        } finally {
            setScraping(false);
        }
    };

    const toggleEpisode = (index: number) => {
        if (!result) return;
        const updated = [...result.episodes];
        updated[index] = { ...updated[index], selected: !updated[index].selected };
        setResult({ ...result, episodes: updated });
    };

    const toggleAll = () => {
        if (!result) return;
        const allSelected = result.episodes.every(ep => ep.selected);
        const updated = result.episodes.map(ep => ({ ...ep, selected: !allSelected }));
        setResult({ ...result, episodes: updated });
    };

    const handleImport = async () => {
        if (!result) return;

        const selectedEpisodes = result.episodes.filter(ep => ep.selected);
        if (selectedEpisodes.length === 0) {
            setError('কমপক্ষে ১টা episode select করো!');
            return;
        }

        setImporting(true);
        setError('');
        setSuccessMessage('');
        setImportProgress(0);
        setImportTotal(selectedEpisodes.length);

        try {
            // Step 1: Check if season exists, if not create it
            const { data: existingSeason } = await supabase
                .from('seasons')
                .select('id')
                .eq('movie_id', movieId)
                .eq('season_number', seasonNumber)
                .maybeSingle();

            let seasonId: string;

            if (existingSeason) {
                seasonId = existingSeason.id;
            } else {
                const { data: newSeason, error: seasonError } = await supabase
                    .from('seasons')
                    .insert({
                        movie_id: movieId,
                        season_number: seasonNumber,
                        season_title: `Season ${seasonNumber}`,
                        season_zip_link: (importZipLink && result.seasonZipLink) ? result.seasonZipLink : null,
                    })
                    .select()
                    .single();

                if (seasonError) throw seasonError;
                seasonId = newSeason.id;
            }

            // If season existed but we have a zip link, update it
            if (existingSeason && importZipLink && result.seasonZipLink) {
                await supabase
                    .from('seasons')
                    .update({ season_zip_link: result.seasonZipLink })
                    .eq('id', seasonId);
            }

            // Step 2: Insert episodes one by one with download links
            let successCount = 0;

            for (const ep of selectedEpisodes) {
                try {
                    // Check if episode already exists
                    const { data: existingEp } = await supabase
                        .from('episodes')
                        .select('id')
                        .eq('season_id', seasonId)
                        .eq('episode_number', ep.number)
                        .maybeSingle();

                    let episodeId: string;

                    if (existingEp) {
                        episodeId = existingEp.id;
                    } else {
                        const { data: newEp, error: epError } = await supabase
                            .from('episodes')
                            .insert({
                                season_id: seasonId,
                                episode_number: ep.number,
                                episode_title: null,
                            })
                            .select()
                            .single();

                        if (epError) throw epError;
                        episodeId = newEp.id;
                    }

                    // Insert/update download link for this resolution
                    const { data: existingLink } = await supabase
                        .from('episode_download_links')
                        .select('id')
                        .eq('episode_id', episodeId)
                        .eq('resolution', resolution)
                        .maybeSingle();

                    if (existingLink) {
                        await supabase
                            .from('episode_download_links')
                            .update({ gdrive_link: ep.link })
                            .eq('id', existingLink.id);
                    } else {
                        await supabase
                            .from('episode_download_links')
                            .insert({
                                episode_id: episodeId,
                                resolution: resolution,
                                gdrive_link: ep.link,
                            });
                    }

                    successCount++;
                } catch (epErr) {
                    console.error(`Error importing Episode ${ep.number}:`, epErr);
                }

                setImportProgress(prev => prev + 1);
            }

            setSuccessMessage(`✅ ${successCount}/${selectedEpisodes.length} episodes successfully imported to Season ${seasonNumber}!`);
            
            // Refresh seasons list and SeasonEditor
            await fetchSeasons();
            if (onImportComplete) {
                onImportComplete();
            }

            // Clear result after successful import
            setTimeout(() => {
                setResult(null);
                setSourceUrl('');
            }, 3000);

        } catch (err: any) {
            console.error('Import error:', err);
            setError(`Import failed: ${err.message}`);
        } finally {
            setImporting(false);
        }
    };

    const selectedCount = result?.episodes.filter(ep => ep.selected).length || 0;

    return (
        <div className="glass p-6 rounded-xl border border-white/5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">🔗</span>
                    Auto Import Episodes
                </h2>
                <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">
                    Agent System
                </span>
            </div>

            <p className="text-sm text-gray-400">
                Paste a source URL (FXLinks, or any site with episode download links) and the system will scrape all episode links automatically.
            </p>

            {/* URL Input */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🌐</span>
                    <input
                        type="url"
                        placeholder="https://fxlinks.rest/elinks/..."
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                        disabled={scraping || importing}
                        className="w-full pl-10 bg-dark-700 border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    />
                </div>
                <button
                    type="button"
                    onClick={handleScrape}
                    disabled={scraping || importing || !sourceUrl.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold rounded-xl hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/30"
                >
                    {scraping ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Scraping...
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Scrape
                        </>
                    )}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-start gap-3">
                    <span className="text-lg">❌</span>
                    <p>{error}</p>
                </div>
            )}

            {/* Success */}
            {successMessage && (
                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl text-green-400 text-sm flex items-start gap-3 animate-fadeIn">
                    <span className="text-lg">🎉</span>
                    <p className="font-medium">{successMessage}</p>
                </div>
            )}

            {/* Scrape Results */}
            {result && (
                <div className="space-y-5 animate-fadeIn">
                    {/* Page Info */}
                    <div className="p-4 bg-dark-700/50 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-green-400 text-lg">✅</span>
                            <h3 className="font-bold text-white text-sm truncate">{result.pageTitle}</h3>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400">
                            <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-bold">
                                {result.episodes.length} episodes found
                            </span>
                            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">
                                {result.resolution} detected
                            </span>
                            {result.seasonZipLink && (
                                <span className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold">
                                    Season ZIP found
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Import Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-dark-700/30 rounded-xl border border-white/5">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Season Number</label>
                            <input
                                type="number"
                                min="1"
                                value={seasonNumber}
                                onChange={(e) => setSeasonNumber(Number(e.target.value))}
                                className="w-full bg-dark-600 border border-white/10 rounded-lg p-2.5 text-white font-bold text-center focus:ring-2 focus:ring-cyan-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Resolution</label>
                            <select
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded-lg p-2.5 text-white font-bold focus:ring-2 focus:ring-cyan-500 outline-none"
                            >
                                {RESOLUTIONS.map(res => (
                                    <option key={res} value={res}>{res}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            {result.seasonZipLink && (
                                <label className="flex items-center gap-3 p-2.5 bg-dark-600 w-full rounded-lg border border-white/10 cursor-pointer hover:bg-dark-500 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={importZipLink}
                                        onChange={(e) => setImportZipLink(e.target.checked)}
                                        className="w-5 h-5 rounded border-gray-500 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-white text-sm font-medium">Import ZIP link</span>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Episode List */}
                    <div className="bg-dark-700/30 rounded-xl border border-white/5 overflow-hidden">
                        {/* List Header */}
                        <div className="flex items-center justify-between p-3 bg-dark-600/50 border-b border-white/5">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={result.episodes.every(ep => ep.selected)}
                                    onChange={toggleAll}
                                    className="w-4 h-4 rounded border-gray-500 text-cyan-600 focus:ring-cyan-500"
                                />
                                <span className="text-sm font-bold text-gray-300">
                                    Select All ({selectedCount}/{result.episodes.length})
                                </span>
                            </label>
                        </div>

                        {/* Episode Rows */}
                        <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                            {result.episodes.map((ep, index) => (
                                <div
                                    key={ep.number}
                                    className={`flex items-center gap-3 p-3 transition-colors ${
                                        ep.selected
                                            ? 'bg-cyan-900/10 hover:bg-cyan-900/20'
                                            : 'opacity-50 hover:opacity-70'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={ep.selected}
                                        onChange={() => toggleEpisode(index)}
                                        className="w-4 h-4 rounded border-gray-500 text-cyan-600 focus:ring-cyan-500 flex-shrink-0"
                                    />
                                    <span className="bg-dark-600 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-lg min-w-[48px] text-center">
                                        {String(ep.number).padStart(2, '0')}
                                    </span>
                                    <span className="text-white text-sm font-medium flex-1 truncate">
                                        {ep.title}
                                    </span>
                                    <a
                                        href={ep.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-cyan-400 hover:text-cyan-300 text-xs flex-shrink-0"
                                        title={ep.link}
                                    >
                                        🔗
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Import Progress */}
                    {importing && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Importing episodes...</span>
                                <span>{importProgress}/{importTotal}</span>
                            </div>
                            <div className="w-full bg-dark-600 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                                    style={{ width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setResult(null);
                                setError('');
                                setSuccessMessage('');
                            }}
                            className="px-5 py-2.5 bg-dark-600 text-gray-300 font-medium rounded-xl hover:bg-dark-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleImport}
                            disabled={importing || selectedCount === 0}
                            className="px-8 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/30 transition-all flex items-center gap-2"
                        >
                            {importing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Import {selectedCount} Episodes → Season {seasonNumber}
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ═══════════ Manage Imported Seasons ═══════════ */}
            {seasons.length > 0 && (
                <div className="border-t border-white/5 pt-5 space-y-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span>🗂️</span> Manage Imported Seasons
                    </h3>

                    <div className="space-y-2">
                        {seasons.map((season) => (
                            <div
                                key={season.id}
                                className="flex items-center justify-between p-3 bg-dark-700/50 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="bg-purple-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                                        S{season.season_number}
                                    </span>
                                    <div>
                                        <p className="text-white text-sm font-medium">
                                            Season {season.season_number}
                                            {season.season_title && season.season_title !== `Season ${season.season_number}`
                                                ? `: ${season.season_title}`
                                                : ''
                                            }
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {season.episode_count} episodes
                                            {season.season_zip_link && ' • ZIP link attached'}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleDeleteSeason(season)}
                                    disabled={deletingSeason === season.id}
                                    className="px-4 py-2 bg-red-600/15 text-red-400 text-sm font-bold rounded-lg hover:bg-red-600/30 disabled:opacity-50 transition-all flex items-center gap-2 border border-red-500/20 hover:border-red-500/40"
                                >
                                    {deletingSeason === season.id ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin"></div>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete Season
                                        </>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

