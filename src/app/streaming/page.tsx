'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Movie } from '@/lib/types';
import AdminShell from '@/components/AdminShell';
import { mergeMoviesWithStreaming, upsertStreamingRow } from '@/lib/streaming-table';

type ScraperLinkMode = 'single' | 'separate' | 'episode';

interface MatchResult {
    id: string; // TMDB ID or MAL ID
    title: string;
    year: string;
    type: 'movie' | 'series' | 'anime';
    posterUrl: string | null;
    originalData: any;
}

export default function StreamingPage() {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'movie' | 'series' | 'anime'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'missing'>('all');
    
    // TMDB Settings in LocalStorage
    const [tmdbApiKey, setTmdbApiKey] = useState('');
    
    // Auto Match Modal State
    const [matchingMovie, setMatchingMovie] = useState<Movie | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<MatchResult[]>([]);
    const [searchSource, setSearchSource] = useState<'tmdb' | 'jikan'>('tmdb');

    // Bulk Auto Match State
    const [isBulkMatching, setIsBulkMatching] = useState(false);
    const [bulkMatchProgress, setBulkMatchProgress] = useState({ current: 0, total: 0 });

    // Manage Episodes Modal State
    const [editingEpisodesMovie, setEditingEpisodesMovie] = useState<Movie | null>(null);
    const [seasons, setSeasons] = useState<any[]>([]);
    const [loadingEpisodes, setLoadingEpisodes] = useState(false);
    const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
    const [localEpisodeUrls, setLocalEpisodeUrls] = useState<Record<string, Record<string, string>>>({});
    const [editingServerKey, setEditingServerKey] = useState<string>('custom');
    const [savingEpisodes, setSavingEpisodes] = useState(false);

    // Movie Multi-Servers Modal State
    const [editingMovieServers, setEditingMovieServers] = useState<Movie | null>(null);
    const [movieServerUrls, setMovieServerUrls] = useState<Record<string, string>>({});
    const [savingMovieServers, setSavingMovieServers] = useState<boolean>(false);

    const handleOpenMovieServers = (m: Movie) => {
        setEditingMovieServers(m);
        let initialUrls: Record<string, string> = {};
        if (m.streaming_url && m.streaming_url.trim().startsWith('{')) {
            try {
                initialUrls = JSON.parse(m.streaming_url);
            } catch {}
        } else if (m.streaming_url) {
            initialUrls.custom = m.streaming_url;
        }
        setMovieServerUrls(initialUrls);
    };

    const handleSaveMovieServers = async () => {
        if (!editingMovieServers) return;
        setSavingMovieServers(true);
        try {
            const cleaned: Record<string, string> = {};
            Object.entries(movieServerUrls).forEach(([k, v]) => {
                if (v && v.trim()) cleaned[k] = v.trim();
            });
            let newStreamingUrl: string | null = null;
            if (Object.keys(cleaned).length > 0) {
                if (Object.keys(cleaned).length === 1 && cleaned['custom']) {
                    newStreamingUrl = cleaned['custom'];
                } else {
                    newStreamingUrl = JSON.stringify(cleaned);
                }
            }

            const { error } = await supabase
                .from('movies')
                .update({ streaming_url: newStreamingUrl, updated_at: new Date().toISOString() })
                .eq('id', editingMovieServers.id);
            if (error) throw error;

            await upsertStreamingRow(supabase, editingMovieServers.id, { streaming_url: newStreamingUrl });

            setMovies(prev => prev.map(m => m.id === editingMovieServers.id ? { ...m, streaming_url: newStreamingUrl || undefined } : m));
            showMessage('success', 'Movie servers saved successfully!');
            setEditingMovieServers(null);
        } catch (e: any) {
            showMessage('error', 'Failed to save movie servers: ' + e.message);
        } finally {
            setSavingMovieServers(false);
        }
    };

    // Message notification toast
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    
        // Selection state for bulk matching specific rows
    const [selectedMovieIds, setSelectedMovieIds] = useState<string[]>([]);

        // Global Settings State
    const [settings, setSettings] = useState<any>(null);
    const [savingSettings, setSavingSettings] = useState(false);

        // Edit Scraper Modal State
    const [editingScraperMovie, setEditingScraperMovie] = useState<Movie | null>(null);
    const [scrapingLoader, setScrapingLoader] = useState(false);

        // Season Scraper URL States
    const [scraperSeasons, setScraperSeasons] = useState<any[]>([]);
    const [scraperEpisodes, setScraperEpisodes] = useState<any[]>([]);

    // Scrapers states
    const [rareanimesLinkMode, setRareanimesLinkMode] = useState<ScraperLinkMode>('single');
    const [rareanimesUrl, setRareanimesUrl] = useState<string>('');
    const [rareanimesUrls, setRareanimesUrls] = useState<Record<number, string>>({});
    const [rareanimesEpisodeUrls, setRareanimesEpisodeUrls] = useState<Record<string, string>>({});

    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    useEffect(() => {
        if (editingScraperMovie) {
            // Parse scrapers
            const sUrl = editingScraperMovie.scraper_url || '';
            let parsedOther: Record<string, any> = {};
            if (sUrl.trim().startsWith('{')) {
                try {
                    parsedOther = JSON.parse(sUrl);
                } catch(e) {}
            }
            const readEpisodeUrls = (config: any) => {
                const episodeUrls: Record<string, string> = {};
                if (config?.episodeUrls) {
                    for (const [k, v] of Object.entries(config.episodeUrls)) {
                        if (v) episodeUrls[k] = v as string;
                    }
                }
                return episodeUrls;
            };

            // RareAnimes
            const ra = parsedOther.rareanimes || {};
            setRareanimesLinkMode(ra.mode || 'single');
            setRareanimesUrl(ra.url || '');
            const raUrls: Record<number, string> = {};
            if (ra.urls) {
                for (const [k, v] of Object.entries(ra.urls)) {
                    raUrls[parseInt(k)] = v as string;
                }
            }
            setRareanimesUrls(raUrls);
            const raEpisodeUrls = readEpisodeUrls(ra);
            setRareanimesEpisodeUrls(raEpisodeUrls);

            if (editingScraperMovie.type === 'anime' || editingScraperMovie.type === 'series') {
                supabase
                    .from('seasons')
                    .select('id, season_number, season_title')
                    .eq('movie_id', editingScraperMovie.id)
                    .order('season_number', { ascending: true })
                    .then(({ data }) => {
                        const dbSeasons = data || [];
                        const dbSeasonNums = new Set(dbSeasons.map(s => s.season_number));
                        
                        // Parse JSON from urls to find if there are any other seasons configured
                        const extraSeasonNums = new Set<number>();
                        Object.keys(raUrls).forEach(k => extraSeasonNums.add(parseInt(k)));
                        [raEpisodeUrls].forEach(map => {
                            Object.keys(map).forEach(key => {
                                const [seasonPart] = key.split('_');
                                const seasonNum = parseInt(seasonPart, 10);
                                if (!Number.isNaN(seasonNum)) extraSeasonNums.add(seasonNum);
                            });
                        });

                        const finalSeasons = [...dbSeasons];
                        Array.from(extraSeasonNums).sort((a, b) => a - b).forEach(sNum => {
                            if (!dbSeasonNums.has(sNum)) {
                                finalSeasons.push({
                                    id: `virtual_${sNum}`,
                                    season_number: sNum,
                                    season_title: `Season ${sNum}`
                                });
                            }
                        });
                        
                        // Sort by season_number
                        finalSeasons.sort((a, b) => a.season_number - b.season_number);
                        setScraperSeasons(finalSeasons);

                        const seasonNumberById = new Map(dbSeasons.map(s => [s.id, s.season_number]));
                        if (dbSeasons.length > 0) {
                            supabase
                                .from('episodes')
                                .select('id, season_id, episode_number, episode_title')
                                .in('season_id', dbSeasons.map(s => s.id))
                                .order('episode_number', { ascending: true })
                                .then(({ data: episodesData }) => {
                                    const existingEpisodes = (episodesData || []).map(ep => ({
                                        id: ep.id,
                                        season_number: seasonNumberById.get(ep.season_id) || 1,
                                        episode_number: ep.episode_number,
                                        episode_title: ep.episode_title
                                    }));
                                    const byKey = new Map(existingEpisodes.map(ep => [`${ep.season_number}_${ep.episode_number}`, ep]));
                                    [raEpisodeUrls].forEach(map => {
                                        Object.keys(map).forEach(key => {
                                            if (byKey.has(key)) return;
                                            const [seasonPart, episodePart] = key.split('_');
                                            const seasonNum = parseInt(seasonPart, 10);
                                            const episodeNum = parseInt(episodePart, 10);
                                            if (Number.isNaN(seasonNum) || Number.isNaN(episodeNum)) return;
                                            byKey.set(key, {
                                                id: `virtual_ep_${key}`,
                                                season_number: seasonNum,
                                                episode_number: episodeNum,
                                                episode_title: `Episode ${episodeNum}`
                                            });
                                        });
                                    });
                                    setScraperEpisodes(Array.from(byKey.values()).sort((a, b) =>
                                        a.season_number - b.season_number || a.episode_number - b.episode_number
                                    ));
                                });
                        } else {
                            setScraperEpisodes([]);
                        }
                    });
            } else {
                setScraperSeasons([]);
                setScraperEpisodes([]);
            }
        } else {
            setScraperSeasons([]);
            setScraperEpisodes([]);
            setRareanimesLinkMode('single');
            setRareanimesUrl('');
            setRareanimesUrls({});
            setRareanimesEpisodeUrls({});
            setExpandedSection(null);
        }
    }, [editingScraperMovie]);

    const getOtherScrapersJsonToSave = () => {
        const payload: Record<string, any> = {};

        const filterGenericSeasonUrls = (source: Record<number, string>) => {
            const filtered: Record<number, string> = {};
            for (const [k, v] of Object.entries(source)) {
                if (v && v.trim()) filtered[parseInt(k)] = v.trim();
            }
            return filtered;
        };
        
        const filterGenericEpisodeUrls = (source: Record<string, string>) => {
            const filtered: Record<string, string> = {};
            for (const [k, v] of Object.entries(source)) {
                if (v && v.trim()) filtered[k] = v.trim();
            }
            return filtered;
        };

        // RareAnimes
        const raFiltered = filterGenericSeasonUrls(rareanimesUrls);
        const raEpisodeFiltered = filterGenericEpisodeUrls(rareanimesEpisodeUrls);
        if (rareanimesUrl.trim() || Object.keys(raFiltered).length > 0 || Object.keys(raEpisodeFiltered).length > 0) {
            payload.rareanimes = {
                mode: rareanimesLinkMode,
                url: rareanimesLinkMode === 'single' ? rareanimesUrl.trim() : '',
                urls: rareanimesLinkMode === 'separate' ? raFiltered : {},
                episodeUrls: rareanimesLinkMode === 'episode' ? raEpisodeFiltered : {}
            };
        }

        return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
    };

    useEffect(() => {
        fetchMovies();
        fetchSettings();
        // Load TMDB API key: try database first via settings, then localStorage
        const loadTmdbKey = async () => {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('tmdb_api_key')
                    .eq('id', 1)
                    .single();
                if (data?.tmdb_api_key) {
                    setTmdbApiKey(data.tmdb_api_key);
                    localStorage.setItem('nexiplay_tmdb_api_key', data.tmdb_api_key);
                    return;
                }
            } catch { /* ignore */ }
            // Fallback to localStorage
            const savedKey = localStorage.getItem('nexiplay_tmdb_api_key') || '';
            setTmdbApiKey(savedKey);
        };
        loadTmdbKey();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            if (data) setSettings(data);
        } catch (err) {
            console.error('Error fetching settings:', err);
        }
    };

    const getEnabledServers = (code: string | undefined | null) => {
        if (code === undefined || code === null) {
            return [
                'custom',
                'circleftp',
                'moviebox',
                'miruro',
                'aniclover',
                'animekhor',
                'doodstream',
                'streamtape',
                'voe',
                'abyss',
                'vidsrc_to',
                'vidsrc_me',
                'rareanimes'
            ];
        }
        if (code.trim() === '' || code.trim().toLowerCase() === 'none') {
            return [];
        }
        return code.split(',').map(s => s.trim().toLowerCase());
    };

    const handleServerToggle = async (serverId: string, isChecked: boolean) => {
        if (!settings) return;
        setSavingSettings(true);
        try {
            let currentEnabled = getEnabledServers(settings.social_bar_code);
            if (isChecked) {
                if (!currentEnabled.includes(serverId)) {
                    currentEnabled.push(serverId);
                }
            } else {
                currentEnabled = currentEnabled.filter(id => id !== serverId);
            }
            const valueToSave = currentEnabled.length === 0 ? 'none' : currentEnabled.join(',');
            
            const { error } = await supabase
                .from('app_settings')
                .update({
                    social_bar_code: valueToSave,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) throw error;
            
            setSettings({
                ...settings,
                social_bar_code: valueToSave
            });
            showMessage('success', 'Web streaming server configuration updated!');
        } catch (err: any) {
            showMessage('error', 'Failed to update Web server configuration: ' + err.message);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleAppServerToggle = async (serverId: string, isChecked: boolean) => {
        if (!settings) return;
        setSavingSettings(true);
        try {
            const currentCode = settings.app_enabled_servers ?? settings.social_bar_code;
            let currentEnabled = getEnabledServers(currentCode);
            if (isChecked) {
                if (!currentEnabled.includes(serverId)) {
                    currentEnabled.push(serverId);
                }
            } else {
                currentEnabled = currentEnabled.filter(id => id !== serverId);
            }
            const valueToSave = currentEnabled.length === 0 ? 'none' : currentEnabled.join(',');
            
            const { error } = await supabase
                .from('app_settings')
                .update({
                    app_enabled_servers: valueToSave,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) throw error;
            
            setSettings({
                ...settings,
                app_enabled_servers: valueToSave
            });
            showMessage('success', 'App streaming server configuration updated!');
        } catch (err: any) {
            if (err?.message?.includes('app_enabled_servers') || err?.details?.includes('app_enabled_servers')) {
                showMessage('error', '⚠️ Supabase app_settings টেবিলে "app_enabled_servers" কলাম নেই। অনুগ্রহ করে Supabase SQL Editor-এ চালান: ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS app_enabled_servers TEXT;');
            } else {
                showMessage('error', 'Failed to update App server configuration: ' + err.message);
            }
        } finally {
            setSavingSettings(false);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), type === 'error' ? 12000 : 4000);
    };

    const fetchMovies = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('movies')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) {
                const merged = await mergeMoviesWithStreaming(supabase, data as Movie[]);
                setMovies(merged as Movie[]);
            }
        } catch (e: any) {
            showMessage('error', 'Failed to fetch content: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = async (key: string) => {
        const trimmedKey = key.trim();
        setTmdbApiKey(trimmedKey);
        localStorage.setItem('nexiplay_tmdb_api_key', trimmedKey);
        
        // Also save to database for persistence across sessions
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({ tmdb_api_key: trimmedKey })
                .eq('id', 1);
            if (error) throw error;
            showMessage('success', 'TMDB API Key saved to database!');
        } catch (e: any) {
            console.error('Failed to save TMDB key to DB:', e);
            showMessage('success', 'TMDB API Key saved locally (DB save failed).');
        }
    };

            // Update single movie record
    const handleUpdateMovie = async (movieId: string, updates: Partial<Movie>) => {
        setSavingId(movieId);
        const originalMovie = movies.find(m => m.id === movieId);
        const title = updates.title !== undefined ? updates.title : (originalMovie?.title || '');
        const type = updates.type !== undefined ? updates.type : (originalMovie?.type || '');
        const releaseYear = updates.release_year !== undefined ? updates.release_year : originalMovie?.release_year;

        try {
            const res = await fetch('/api/auto-match-streaming', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movieId,
                    title,
                    type,
                    releaseYear,
                    tmdbApiKey,
                    tmdbId: updates.tmdb_id !== undefined ? updates.tmdb_id : (originalMovie?.tmdb_id || ''),
                    malId: updates.mal_id !== undefined ? updates.mal_id : (originalMovie?.mal_id || ''),
                    imdbId: updates.imdb_id !== undefined ? updates.imdb_id : (originalMovie?.imdb_id || ''),
                    streamingUrl: updates.streaming_url !== undefined ? updates.streaming_url : (originalMovie?.streaming_url || '')
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'API call failed');
            }

            const data = await res.json();
            if (data.success && data.matched) {
                setMovies(prev => prev.map(m => m.id === movieId ? {
                    ...m,
                    tmdb_id: data.matched.tmdb_id,
                    imdb_id: data.matched.imdb_id,
                    mal_id: data.matched.mal_id,
                    streaming_url: data.matched.streaming_url,
                    scraper_source: data.matched.scraper_source,
                    scraper_url: data.matched.scraper_url,
                    scraper_season: data.matched.scraper_season,
                    scraper_resolution: data.matched.scraper_resolution
                } : m));
                showMessage('success', 'Streaming config saved and scraper triggered!');
            } else {
                setMovies(prev => prev.map(m => m.id === movieId ? { ...m, ...updates } : m));
                showMessage('success', 'Streaming config updated successfully!');
            }
        } catch (e: any) {
            showMessage('error', 'Update failed: ' + e.message);
        } finally {
            setSavingId(null);
        }
    };

        // Toggle streaming status (enabled/disabled) using 'disabled' in streaming_url
    const handleToggleStreaming = async (movie: Movie) => {
        const isCurrentlyDisabled = movie.streaming_url === 'disabled';
        const newStreamingUrl = isCurrentlyDisabled ? '' : 'disabled';
        
        setSavingId(movie.id);
        try {
            const { error } = await supabase
                .from('movies')
                .update({
                    streaming_url: newStreamingUrl || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', movie.id);

            if (error) throw error;
            await upsertStreamingRow(supabase, movie.id, { streaming_url: newStreamingUrl || null });
            
            setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, streaming_url: newStreamingUrl } : m));
            showMessage('success', isCurrentlyDisabled ? 'Streaming turned ON!' : 'Streaming turned OFF!');
        } catch (e: any) {
            showMessage('error', 'Failed to toggle streaming: ' + e.message);
        } finally {
            setSavingId(null);
        }
    };

    // Inline field edit changes state locally before save
    const handleFieldChange = (movieId: string, field: keyof Movie, value: string) => {
        setMovies(prev => prev.map(m => m.id === movieId ? { ...m, [field]: value } : m));
    };

    // Start auto config lookup
    const handleOpenMatchModal = (movie: Movie) => {
        setMatchingMovie(movie);
        setSearchQuery(movie.title);
        setSearchResults([]);
        // Default search source is always TMDB since setting TMDB ID is most crucial for the player
        setSearchSource('tmdb');
    };

    // Execute lookup
    const handleSearchSource = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);

        try {
            if (searchSource === 'jikan') {
                // Fetch from server proxy for Jikan
                const url = `/api/streaming/search?source=jikan&query=${encodeURIComponent(searchQuery)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('Jikan API request failed');
                const result = await res.json();
                
                const mapped: MatchResult[] = (result.data || []).map((item: any) => ({
                    id: String(item.mal_id),
                    title: item.title,
                    year: item.aired?.prop?.from?.year ? String(item.aired.prop.from.year) : 'N/A',
                    type: 'anime',
                    posterUrl: item.images?.jpg?.image_url || null,
                    originalData: item
                }));
                setSearchResults(mapped);
            } else {
                // Fetch from server proxy for TMDB
                if (!tmdbApiKey) {
                    throw new Error('Please save your TMDB API Key first to search TMDB.');
                }
                
                // For movies/series/anime, determine correct search endpoint
                const searchType = matchingMovie?.type === 'movie' ? 'movie' : 'tv';
                const url = `/api/streaming/search?source=tmdb&type=${searchType}&apiKey=${encodeURIComponent(tmdbApiKey)}&query=${encodeURIComponent(searchQuery)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('TMDB API request failed. Check your API key.');
                const result = await res.json();

                const mapped: MatchResult[] = (result.results || []).map((item: any) => ({
                    id: String(item.id),
                    title: item.title || item.name,
                    year: (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A',
                    type: matchingMovie?.type || 'movie',
                    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : null,
                    originalData: item
                }));
                setSearchResults(mapped);
            }
        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setSearching(false);
        }
    };

    // Apply matched IDs to content
    const handleApplyMatch = async (match: MatchResult) => {
        if (!matchingMovie) return;
        
        let tmdbVal = matchingMovie.tmdb_id || '';
        let malVal = matchingMovie.mal_id || '';
        let imdbVal = matchingMovie.imdb_id || '';

        if (searchSource === 'jikan') {
            malVal = match.id;
        } else {
            tmdbVal = match.id;
            // Fetch TMDB external IDs via server proxy
            if (tmdbApiKey) {
                try {
                    const detailType = matchingMovie.type === 'movie' ? 'movie' : 'tv';
                    const url = `/api/streaming/search?mode=detail&type=${detailType}&id=${match.id}&apiKey=${encodeURIComponent(tmdbApiKey)}`;
                    const detailRes = await fetch(url);
                    if (detailRes.ok) {
                        const ids = await detailRes.json();
                        if (ids.imdb_id) {
                            imdbVal = ids.imdb_id;
                        }
                    }
                } catch (err) {
                    console.warn('Failed to fetch external IDs from TMDB:', err);
                }
            }
        }

        const updates = {
            tmdb_id: tmdbVal,
            mal_id: malVal,
            imdb_id: imdbVal
        };

        // Instantly save
        await handleUpdateMovie(matchingMovie.id, updates);
        setMatchingMovie(null);
    };

        const handleBulkAutoMatch = async (onlySelected: boolean = false) => {
        let targets = [];
        if (onlySelected) {
            targets = movies.filter(m => selectedMovieIds.includes(m.id));
        } else {
            targets = movies.filter(m => !m.tmdb_id && !m.mal_id && !m.streaming_url);
        }

        if (targets.length === 0) {
            showMessage('success', onlySelected ? 'No selected content found!' : 'All content already has streaming IDs!');
            return;
        }

        if (!confirm(`Are you sure you want to auto match ${onlySelected ? 'the ' + targets.length + ' selected' : 'all ' + targets.length + ' missing'} titles? This may take some time.`)) {
            return;
        }

        setIsBulkMatching(true);
        setBulkMatchProgress({ current: 0, total: targets.length });
        
        const localApiKey = typeof window !== 'undefined' ? localStorage.getItem('nexiplay_tmdb_api_key') : null;
        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < targets.length; i++) {
            const movie = targets[i];
            try {
                const res = await fetch('/api/auto-match-streaming', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        movieId: movie.id,
                        title: movie.title,
                        type: movie.type,
                        releaseYear: movie.release_year,
                        tmdbApiKey: localApiKey
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.matched) {
                        successCount++;
                        setMovies(prev => prev.map(m => m.id === movie.id ? {
                            ...m,
                            tmdb_id: data.matched.tmdb_id || m.tmdb_id,
                            imdb_id: data.matched.imdb_id || m.imdb_id,
                            mal_id: data.matched.mal_id || m.mal_id,
                            scraper_source: data.matched.scraper_source || m.scraper_source,
                            scraper_url: data.matched.scraper_url || m.scraper_url,
                            scraper_season: data.matched.scraper_season || m.scraper_season,
                            scraper_resolution: data.matched.scraper_resolution || m.scraper_resolution
                        } : m));
                    } else {
                        failedCount++;
                    }
                } else {
                    failedCount++;
                }
            } catch (err) {
                console.error(`Error matching "${movie.title}":`, err);
                failedCount++;
            }
            setBulkMatchProgress(prev => ({ ...prev, current: i + 1 }));
        }

        setIsBulkMatching(false);
        setSelectedMovieIds([]);
        showMessage('success', `Matching completed! Successfully matched ${successCount} titles. Failed: ${failedCount}.`);
    };

    // Fetch seasons and episodes for series/anime
    useEffect(() => {
        if (!editingEpisodesMovie) return;
        
        const fetchSeasonsAndEpisodes = async () => {
            setLoadingEpisodes(true);
            try {
                // 1. Fetch seasons
                const { data: seasonsData, error: seasonsError } = await supabase
                    .from('seasons')
                    .select('*')
                    .eq('movie_id', editingEpisodesMovie.id)
                    .order('season_number', { ascending: true });

                if (seasonsError) throw seasonsError;

                if (seasonsData && seasonsData.length > 0) {
                    // 2. Fetch episodes for these seasons
                    const seasonIds = seasonsData.map(s => s.id);
                    const { data: episodesData, error: episodesError } = await supabase
                        .from('episodes')
                        .select('*')
                        .in('season_id', seasonIds)
                        .order('episode_number', { ascending: true });

                    if (episodesError) throw episodesError;

                    const mappedSeasons = seasonsData.map(s => ({
                        ...s,
                        episodes: (episodesData || []).filter(e => e.season_id === s.id)
                    }));

                    setSeasons(mappedSeasons);
                    
                    // Initialize local URLs state
                    const urls: Record<string, Record<string, string>> = {};
                    (episodesData || []).forEach(e => {
                        let parsed: Record<string, string> = {};
                        if (e.streaming_url && e.streaming_url.trim().startsWith('{')) {
                            try {
                                parsed = JSON.parse(e.streaming_url);
                            } catch {}
                        } else if (e.streaming_url) {
                            parsed.custom = e.streaming_url;
                        }
                        urls[e.id] = parsed;
                    });
                    setLocalEpisodeUrls(urls);
                    
                    setActiveSeasonId(mappedSeasons[0].id);
                } else {
                    setSeasons([]);
                }
            } catch (e: any) {
                showMessage('error', 'Failed to load episodes: ' + e.message);
            } finally {
                setLoadingEpisodes(false);
            }
        };

        fetchSeasonsAndEpisodes();
    }, [editingEpisodesMovie]);

    const handleEpisodeUrlChange = (episodeId: string, serverKey: string, url: string) => {
        setLocalEpisodeUrls(prev => ({
            ...prev,
            [episodeId]: {
                ...(prev[episodeId] || {}),
                [serverKey]: url
            }
        }));
    };

    // Save streaming URLs for the active season's episodes
    const handleSaveEpisodes = async () => {
        if (!activeSeasonId) return;
        setSavingEpisodes(true);
        try {
            const activeSeason = seasons.find(s => s.id === activeSeasonId);
            if (!activeSeason) return;

            const updatePromises = activeSeason.episodes.map(async (ep: any) => {
                const urlMap = localEpisodeUrls[ep.id] || {};
                const cleanedMap: Record<string, string> = {};
                Object.entries(urlMap).forEach(([k, v]) => {
                    if (v && typeof v === 'string' && v.trim()) {
                        cleanedMap[k] = v.trim();
                    }
                });

                let newUrl = '';
                if (Object.keys(cleanedMap).length > 0) {
                    if (Object.keys(cleanedMap).length === 1 && cleanedMap['custom']) {
                        newUrl = cleanedMap['custom'];
                    } else {
                        newUrl = JSON.stringify(cleanedMap);
                    }
                }

                if (newUrl !== (ep.streaming_url || '')) {
                    const { error } = await supabase
                        .from('episodes')
                        .update({ streaming_url: newUrl || null })
                        .eq('id', ep.id);
                    
                    if (error) throw error;
                    
                    // Update memory state
                    ep.streaming_url = newUrl;
                }
            });

            await Promise.all(updatePromises);
            showMessage('success', 'Episode streaming URLs saved successfully!');
        } catch (e: any) {
            showMessage('error', 'Failed to save episodes: ' + e.message);
        } finally {
            setSavingEpisodes(false);
        }
    };

    // Filters and search logic
    const filteredMovies = movies.filter(movie => {
        const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (movie.tmdb_id && movie.tmdb_id.includes(searchTerm)) ||
                             (movie.mal_id && movie.mal_id.includes(searchTerm));
        
        const matchesTab = activeTab === 'all' || movie.type === activeTab;
        
                                                const hasStreaming = (movie.tmdb_id || movie.mal_id || movie.streaming_url) && movie.streaming_url !== 'disabled';
        const matchesStatus = statusFilter === 'all' || 
                             (statusFilter === 'ready' && hasStreaming) ||
                             (statusFilter === 'missing' && !hasStreaming);

        return matchesSearch && matchesTab && matchesStatus;
    });

    // Statistics calculations
    const totalCount = movies.length;
    const readyCount = movies.filter(m => m.tmdb_id || m.mal_id || m.streaming_url).length;
    const missingCount = totalCount - readyCount;

    return (
        <AdminShell>
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Notification toast */}
                {message && (
                    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl text-sm font-semibold shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
                        message.type === 'success' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/5' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5'
                    }`}>
                        {message.type === 'success' ? '🟢 ' : '🔴 '}
                        {message.text}
                    </div>
                )}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            📺 Streaming & Embeds Manager
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Configure TMDB, MAL, and IMDb IDs or Custom Player URLs to enable automatic video playback on the web portal.
                        </p>
                    </div>
                                        <div className="flex items-center gap-3 shrink-0">
                        {selectedMovieIds.length > 0 && (
                            <button
                                onClick={() => handleBulkAutoMatch(true)}
                                disabled={isBulkMatching}
                                className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-green-900/30 flex items-center gap-2"
                            >
                                {isBulkMatching ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Matching...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>⚡</span>
                                        <span>Auto Match Selected ({selectedMovieIds.length})</span>
                                    </>
                                )}
                            </button>
                        )}
                        <button
                            onClick={() => handleBulkAutoMatch(false)}
                            disabled={isBulkMatching || missingCount === 0}
                            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30 flex items-center gap-2"
                        >
                            {isBulkMatching ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Matching ({bulkMatchProgress.current}/{bulkMatchProgress.total})...</span>
                                </>
                            ) : (
                                <>
                                    <span>🚀</span>
                                    <span>Auto Match All ({missingCount})</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Total Catalog</span>
                            <span className="text-2xl font-black text-white mt-1 block">{totalCount}</span>
                        </div>
                        <span className="text-3xl">🗄️</span>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-2 border-l-green-500">
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Streaming Ready</span>
                            <span className="text-2xl font-black text-green-400 mt-1 block">{readyCount}</span>
                        </div>
                        <span className="text-3xl">🟢</span>
                    </div>
                    <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-2 border-l-red-500">
                        <div>
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Missing Config</span>
                            <span className="text-2xl font-black text-red-400 mt-1 block">{missingCount}</span>
                        </div>
                        <span className="text-3xl">🔴</span>
                    </div>
                                </div>

                {/* Streaming Servers Toggle Cards */}
                {settings && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 🌐 Web Servers Control */}
                        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-blue-500/20">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <span>🌐</span> Web Enabled Streaming Servers
                                </h3>
                                <p className="text-gray-400 text-xs mt-1">
                                    Toggle which servers are active on the Web site. Disabled servers are hidden on Web.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                                {[
                                    { id: 'custom', name: 'Server Nexiplay', icon: '⭐', desc: 'Custom/Direct URLs' },
                                    { id: 'circleftp', name: 'CircleFTP (BDIX)', icon: '🇧🇩', desc: 'BDIX 100Mbps Local FTP Stream' },
                                    { id: 'moviebox', name: 'MovieBox HD', icon: '🎬', desc: 'Direct HLS/MP4 Cloud Stream' },
                                    { id: 'miruro', name: 'Miruro Anime', icon: '⛩️', desc: 'Fast Anime Sub & Dub' },
                                    { id: 'aniclover', name: 'Aniclover', icon: '🍀', desc: 'Direct Anime API Stream' },
                                    { id: 'animekhor', name: 'AnimeKhor', icon: '🎌', desc: 'Bangla & Hindi Dubbed Anime' },
                                    { id: 'doodstream', name: 'Nexi Turbo Server', icon: '⚡', desc: 'Turbo Fast Stream' },
                                    { id: 'streamtape', name: 'Nexi Pulse Server', icon: '📼', desc: 'Pulse HD Stream' },
                                    { id: 'voe', name: 'Nexi Spark Server', icon: '🚀', desc: 'Spark Pro Stream' },
                                    { id: 'vidmoly', name: 'Vidmoly Server', icon: '🎬', desc: 'Custom video host links' },
                                    { id: 'abyss', name: 'Nexi Vault Server', icon: '🌌', desc: 'Vault CDN Stream' },
                                    { id: 'vidsrc_to', name: 'VidSrc (Pro)', icon: '🔥', desc: 'Auto Embed' },
                                    { id: 'vidsrc_me', name: 'VidSrc.me', icon: '🚀', desc: 'Auto Embed' },
                                    { id: 'rareanimes', name: 'RR Nexiplay Server', icon: '🎴', desc: 'RareAnimes Scraper' }
                                ].map((server) => {
                                    const isEnabled = getEnabledServers(settings.social_bar_code).includes(server.id);
                                    return (
                                        <div 
                                            key={`web-${server.id}`} 
                                            className="flex flex-col justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xl">{server.icon}</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isEnabled}
                                                        disabled={savingSettings}
                                                        onChange={(e) => handleServerToggle(server.id, e.target.checked)}
                                                    />
                                                    <div className="w-9 h-5 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white leading-tight">{server.name}</h4>
                                                <p className="text-[10px] text-gray-500 mt-0.5">{server.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 📱 Android App Servers Control */}
                        <div className="glass-panel p-6 rounded-2xl space-y-4 border border-green-500/20">
                            <div>
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <span>📱</span> Android App Enabled Streaming Servers
                                </h3>
                                <p className="text-gray-400 text-xs mt-1">
                                    Toggle which servers are active in the Android App. Independent from Web!
                                </p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                                {[
                                    { id: 'custom', name: 'Server Nexiplay', icon: '⭐', desc: 'Custom/Direct URLs' },
                                    { id: 'circleftp', name: 'CircleFTP (BDIX)', icon: '🇧🇩', desc: 'BDIX 100Mbps Local FTP Stream' },
                                    { id: 'moviebox', name: 'MovieBox HD', icon: '🎬', desc: 'Direct HLS/MP4 Cloud Stream' },
                                    { id: 'miruro', name: 'Miruro Anime', icon: '⛩️', desc: 'Fast Anime Sub & Dub' },
                                    { id: 'aniclover', name: 'Aniclover', icon: '🍀', desc: 'Direct Anime API Stream' },
                                    { id: 'animekhor', name: 'AnimeKhor', icon: '🎌', desc: 'Bangla & Hindi Dubbed Anime' },
                                    { id: 'doodstream', name: 'Nexi Turbo Server', icon: '⚡', desc: 'Turbo Fast Stream' },
                                    { id: 'streamtape', name: 'Nexi Pulse Server', icon: '📼', desc: 'Pulse HD Stream' },
                                    { id: 'voe', name: 'Nexi Spark Server', icon: '🚀', desc: 'Spark Pro Stream' },
                                    { id: 'vidmoly', name: 'Vidmoly Server', icon: '🎬', desc: 'Custom video host links' },
                                    { id: 'abyss', name: 'Nexi Vault Server', icon: '🌌', desc: 'Vault CDN Stream' },
                                    { id: 'vidsrc_to', name: 'VidSrc (Pro)', icon: '🔥', desc: 'Auto Embed' },
                                    { id: 'vidsrc_me', name: 'VidSrc.me', icon: '🚀', desc: 'Auto Embed' },
                                    { id: 'rareanimes', name: 'RR Nexiplay Server', icon: '🎴', desc: 'RareAnimes Scraper' }
                                ].map((server) => {
                                    const appCode = settings.app_enabled_servers ?? settings.social_bar_code;
                                    const isEnabled = getEnabledServers(appCode).includes(server.id);
                                    return (
                                        <div 
                                            key={`app-${server.id}`} 
                                            className="flex flex-col justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-all"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xl">{server.icon}</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        className="sr-only peer"
                                                        checked={isEnabled}
                                                        disabled={savingSettings}
                                                        onChange={(e) => handleAppServerToggle(server.id, e.target.checked)}
                                                    />
                                                    <div className="w-9 h-5 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                                                </label>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-white leading-tight">{server.name}</h4>
                                                <p className="text-[10px] text-gray-500 mt-0.5">{server.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Search, Filter & Settings Panel */}
                <div className="glass-panel p-6 rounded-2xl space-y-4">
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                        
                        {/* Search & Tabs */}
                        <div className="flex flex-col sm:flex-row gap-3 flex-1">
                            <input
                                type="text"
                                placeholder="Search by title, TMDB ID, or MAL ID..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 flex-1"
                            />
                            
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 font-semibold"
                            >
                                <option value="all">All Statuses</option>
                                <option value="ready">Streaming Ready</option>
                                <option value="missing">Not Configured</option>
                            </select>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex flex-wrap gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                            {(['all', 'movie', 'series', 'anime'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                                        activeTab === tab 
                                        ? 'bg-violet-600 text-white shadow-lg shadow-red-900/30' 
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                                >
                                    {tab === 'all' ? 'All Content' : tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TMDB API Key settings widget */}
                    <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 block">🗝️ TMDB API Key:</span>
                            <span className="text-[10px] text-gray-500">(Required for auto matching movies/series)</span>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input
                                type="password"
                                placeholder="Paste TMDB v3 API Key..."
                                value={tmdbApiKey}
                                onChange={(e) => setTmdbApiKey(e.target.value)}
                                className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500 flex-1 sm:w-64"
                            />
                            <button
                                onClick={() => handleSaveKey(tmdbApiKey)}
                                className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-bold transition-all shrink-0"
                            >
                                Save Key
                            </button>
                        </div>
                    </div>
                </div>

                                {/* Movies Streaming Settings List - Card Layout */}
                <div className="space-y-3">
                    {/* Select All / Bulk Header */}
                    <div className="flex items-center gap-3 px-2">
                        <input
                            type="checkbox"
                            checked={filteredMovies.length > 0 && filteredMovies.every(m => selectedMovieIds.includes(m.id))}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    const allFilteredIds = filteredMovies.map(m => m.id);
                                    setSelectedMovieIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
                                } else {
                                    const allFilteredIds = filteredMovies.map(m => m.id);
                                    setSelectedMovieIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                                }
                            }}
                            className="rounded border-white/10 bg-black/40 text-red-600 focus:ring-red-500 focus:ring-opacity-25 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-gray-400 uppercase">Select All ({filteredMovies.length} items)</span>
                    </div>

                    {loading ? (
                        <div className="p-20 text-center text-gray-400 glass-panel rounded-2xl">
                            <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            Loading content from database...
                        </div>
                    ) : filteredMovies.length === 0 ? (
                        <div className="p-20 text-center text-gray-500 glass-panel rounded-2xl">
                            No content found matching the filters.
                        </div>
                    ) : (
                        filteredMovies.map((movie) => {
                            const hasStreaming = (movie.tmdb_id || movie.mal_id || movie.streaming_url) && movie.streaming_url !== 'disabled';
                            const isSeriesOrAnime = movie.type === 'series' || movie.type === 'anime';
                            
                            return (
                                <div key={movie.id} className="glass-panel rounded-2xl p-4 hover:border-white/10 transition-all group">
                                    {/* Top Row: Poster + Title + Status + Checkbox */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedMovieIds.includes(movie.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedMovieIds(prev => [...prev, movie.id]);
                                                } else {
                                                    setSelectedMovieIds(prev => prev.filter(id => id !== movie.id));
                                                }
                                            }}
                                            className="rounded border-white/10 bg-black/40 text-red-600 focus:ring-red-500 focus:ring-opacity-25 w-4 h-4 cursor-pointer shrink-0"
                                        />
                                        <div className="relative w-10 h-14 bg-dark-800 rounded-lg overflow-hidden shrink-0 shadow-md">
                                            {movie.poster_url ? (
                                                <img src={movie.poster_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-600">🎬</div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-white truncate" title={movie.title}>{movie.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-gray-400">{movie.release_year}</span>
                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded ${
                                                    movie.type === 'movie' ? 'bg-red-500/20 text-red-400' :
                                                    movie.type === 'series' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-purple-500/20 text-purple-400'
                                                }`}>{movie.type}</span>
                                                {movie.scraper_source && (
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-500/15 text-cyan-400">🤖 {movie.scraper_source}</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Status Badge */}
                                        <div className="shrink-0">
                                            {movie.streaming_url === 'disabled' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/15">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                                                    Disabled
                                                </span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    hasStreaming 
                                                    ? 'bg-green-500/10 text-green-400 border border-green-500/15' 
                                                    : 'bg-red-500/10 text-red-400 border border-red-500/15'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${hasStreaming ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    {hasStreaming ? 'Ready' : 'Not Set'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle Row: IDs in compact grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">TMDB ID</label>
                                            <input
                                                type="text"
                                                value={movie.tmdb_id || ''}
                                                onChange={(e) => handleFieldChange(movie.id, 'tmdb_id', e.target.value)}
                                                placeholder="299534"
                                                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">MAL ID</label>
                                            <input
                                                type="text"
                                                value={movie.mal_id || ''}
                                                onChange={(e) => handleFieldChange(movie.id, 'mal_id', e.target.value)}
                                                placeholder="51009"
                                                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">IMDb ID</label>
                                            <input
                                                type="text"
                                                value={movie.imdb_id || ''}
                                                onChange={(e) => handleFieldChange(movie.id, 'imdb_id', e.target.value)}
                                                placeholder="tt4154796"
                                                className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">
                                                {isSeriesOrAnime ? 'Episodes' : 'Custom URL'}
                                            </label>
                                            {isSeriesOrAnime ? (
                                                <button
                                                    onClick={() => setEditingEpisodesMovie(movie)}
                                                    className="w-full px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/25 text-purple-400 hover:text-purple-300 text-xs font-bold rounded-lg border border-purple-500/20 transition-all flex items-center justify-center gap-1"
                                                >
                                                    📺 Manage
                                                </button>
                                            ) : (
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={movie.streaming_url || ''}
                                                        onChange={(e) => handleFieldChange(movie.id, 'streaming_url', e.target.value)}
                                                        placeholder={movie.streaming_url?.trim().startsWith('{') ? 'Multi-servers set' : 'Direct link...'}
                                                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenMovieServers(movie)}
                                                        className="mt-1.5 w-full px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-white rounded-lg border border-blue-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1"
                                                        title="Manage Multi-Server URLs (Nexi Turbo, Nexi Pulse, Nexi Spark, Nexi Vault, etc.)"
                                                    >
                                                        <span>🌐</span>
                                                        <span>Manage Servers</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Row: Action Buttons */}
                                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                                        <button
                                            onClick={() => handleToggleStreaming(movie)}
                                            disabled={savingId === movie.id}
                                            className={`px-3 py-1.5 rounded-lg border transition-all text-xs font-bold flex items-center gap-1 ${
                                                movie.streaming_url === 'disabled'
                                                ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/20'
                                                : 'bg-red-500/20 hover:bg-violet-500/30 text-red-400 border-red-500/20'
                                            }`}
                                        >
                                            {movie.streaming_url === 'disabled' ? '🟢 Enable' : '🚫 Disable'}
                                        </button>

                                        <button
                                            onClick={() => handleOpenMatchModal(movie)}
                                            className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg border border-purple-500/20 transition-all text-xs font-bold flex items-center gap-1"
                                        >
                                            🤖 Auto Match
                                        </button>

                                        <button
                                            onClick={() => setEditingScraperMovie(movie)}
                                            className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg border border-blue-500/20 transition-all text-xs font-bold flex items-center gap-1"
                                        >
                                            ⚙️ Scraper
                                        </button>

                                        <button
                                            onClick={() => handleUpdateMovie(movie.id, movie)}
                                            disabled={savingId === movie.id}
                                            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-white disabled:opacity-50 text-xs font-bold rounded-lg border border-green-500/20 transition-all flex items-center gap-1"
                                        >
                                            {savingId === movie.id ? '⏳ Saving...' : '💾 Save'}
                                        </button>

                                        <a
                                            href={`https://nexiplay.vercel.app/${movie.type}/${movie.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg border border-white/5 transition-all text-xs font-bold flex items-center gap-1"
                                        >
                                            👁️ Preview
                                        </a>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Auto-Config/Match Modal */}
            {matchingMovie && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>🤖</span> Auto-Config IDs
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Automatically find IDs for: <strong className="text-white">&ldquo;{matchingMovie.title}&rdquo;</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setMatchingMovie(null)}
                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            
                            {/* Source Selection & Search Bar */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Metadata Source</label>
                                    <select
                                        value={searchSource}
                                        onChange={(e) => setSearchSource(e.target.value as any)}
                                        className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-violet-400 font-semibold"
                                    >
                                        <option value="tmdb">TheMovieDB (TMDB)</option>
                                        {matchingMovie.type === 'anime' && (
                                            <option value="jikan">MyAnimeList (Jikan)</option>
                                        )}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search Term</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="flex-1 bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-violet-400"
                                            placeholder="Search title..."
                                        />
                                        <button
                                            onClick={handleSearchSource}
                                            disabled={searching}
                                            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            {searching ? (
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                'Search'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Search Results list */}
                            <div className="space-y-3">
                                <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider border-b border-white/5 pb-2">
                                    Search Matches ({searchResults.length})
                                </h4>

                                {searching ? (
                                    <div className="space-y-2.5">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="h-16 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden bg-dark-900/50 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {searchResults.map((result, idx) => (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors gap-4">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-12 bg-dark-800 rounded overflow-hidden shrink-0 shadow-sm">
                                                        {result.posterUrl ? (
                                                            <img
                                                                src={result.posterUrl}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-600">
                                                                🖼️
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-white font-semibold text-sm truncate">{result.title}</p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            Year: {result.year} | ID: {result.id}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleApplyMatch(result)}
                                                    className="shrink-0 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 hover:text-white text-xs font-bold rounded-lg border border-green-500/10 transition-all"
                                                >
                                                    Select
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-gray-500 text-sm bg-dark-900/30 rounded-xl border border-dashed border-white/10">
                                        {searchSource === 'tmdb' && !tmdbApiKey 
                                            ? '⚠️ Save your TMDB API Key above to search the TMDB catalog.' 
                                            : 'No results found. Modify your search query above.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Movie Multi-Server Management Modal */}
            {editingMovieServers && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>🌐</span> Movie Streaming Servers
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Configure multi-server links for: <strong className="text-white">&ldquo;{editingMovieServers.title}&rdquo;</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingMovieServers(null)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-gray-400 bg-black/30 p-3 rounded-xl border border-white/5 leading-relaxed">
                                💡 Enter the stream or embed links for the servers you want to provide for this movie. Empty servers won&apos;t appear to viewers.
                            </p>

                            {[
                                { key: 'custom', name: 'Direct / Custom Player Override', icon: '⭐', placeholder: 'https://cdn.example.com/movie.mp4 or embed URL...' },
                                { key: 'circleftp', name: 'CircleFTP / BDIX Server', icon: '🇧🇩', placeholder: 'http://circleftp.net/... or http://new.circleftp.net:5000/api/...' },
                                { key: 'moviebox', name: 'MovieBox HD Server', icon: '🎬', placeholder: 'https://movieboxhd.net/movies/... or detailPath' },
                                { key: 'miruro', name: 'Miruro Anime Server', icon: '⛩️', placeholder: 'https://www.miruro.to/watch?id=...' },
                                { key: 'aniclover', name: 'Aniclover Server', icon: '🍀', placeholder: 'https://aniclover.cc/... or https://api.aniclover.cc/api/watch?...' },
                                { key: 'animekhor', name: 'AnimeKhor Server', icon: '🎌', placeholder: 'https://animekhor.org/...' },
                                { key: 'doodstream', name: 'Nexi Turbo Server', icon: '⚡', placeholder: 'https://doodstream.com/e/... or /d/...' },
                                { key: 'streamtape', name: 'Nexi Pulse Server', icon: '📼', placeholder: 'https://streamtape.com/e/... or /v/...' },
                                { key: 'voe', name: 'Nexi Spark Server', icon: '🚀', placeholder: 'https://voe.sx/e/... or https://voe.sx/...' },
                                { key: 'vidmoly', name: 'Vidmoly Server', icon: '🎬', placeholder: 'Paste the full Vidmoly share/embed link (for example, https://vidmoly.me/...)' },
                                { key: 'abyss', name: 'Nexi Vault Server', icon: '🌌', placeholder: 'https://short.ink/... or https://dash.abyss.to/...' },
                                { key: 'rareanimes', name: 'RR Nexiplay Server', icon: '🎴', placeholder: 'https://rareanimes.mov/...' }
                            ].map((srv) => (
                                <div key={srv.key} className="p-3.5 bg-black/40 rounded-xl border border-white/5 space-y-1.5">
                                    <label className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                                        <span>{srv.icon}</span>
                                        <span>{srv.name}</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={movieServerUrls[srv.key] || ''}
                                        onChange={(e) => setMovieServerUrls(prev => ({ ...prev, [srv.key]: e.target.value }))}
                                        placeholder={srv.placeholder}
                                        className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-dark-850">
                            <button
                                onClick={() => setEditingMovieServers(null)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMovieServers}
                                disabled={savingMovieServers}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingMovieServers ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>💾</span>
                                        <span>Save Movie Servers</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Episode Management Modal */}
            {editingEpisodesMovie && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>📺</span> Episode Streaming URL Override
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Configure episode-wise streaming override URLs for: <strong className="text-white">&ldquo;{editingEpisodesMovie.title}&rdquo;</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingEpisodesMovie(null)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {loadingEpisodes ? (
                                <div className="p-20 text-center text-gray-400">
                                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    Loading seasons and episodes...
                                </div>
                            ) : seasons.length === 0 ? (
                                <div className="p-12 text-center text-gray-500 bg-dark-900/30 rounded-xl border border-dashed border-white/10">
                                    ⚠️ No seasons or episodes have been imported for this series/anime yet.
                                    <p className="text-xs text-gray-600 mt-2">Go to Edit Content and use the scraper/importer to populate seasons and episodes first.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Season Tabs */}
                                    <div className="flex flex-wrap gap-2 border-b border-white/5 pb-3">
                                        {seasons.map((season) => (
                                            <button
                                                key={season.id}
                                                onClick={() => setActiveSeasonId(season.id)}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                    activeSeasonId === season.id
                                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                                                    : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                                                }`}
                                            >
                                                S{season.season_number}: {season.season_title || `Season ${season.season_number}`} ({season.episodes?.length || 0} EPs)
                                            </button>
                                        ))}
                                    </div>

                                    {/* Server selection tabs */}
                                    <div className="flex flex-wrap items-center gap-2 bg-black/40 p-2.5 rounded-xl border border-white/5 mb-3">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase mr-1">Edit Server URL:</span>
                                        {[
                                            { key: 'custom', label: 'Custom / Direct Override', color: 'bg-white/5 border-white/10 text-white' },
                                            { key: 'circleftp', label: 'CircleFTP (BDIX)', color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' },
                                            { key: 'moviebox', label: 'MovieBox HD', color: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400' },
                                            { key: 'miruro', label: 'Miruro Anime', color: 'bg-red-500/10 border-red-500/25 text-red-400' },
                                            { key: 'aniclover', label: 'Aniclover', color: 'bg-green-500/10 border-green-500/25 text-green-400' },
                                            { key: 'animekhor', label: 'AnimeKhor', color: 'bg-amber-500/10 border-amber-500/25 text-amber-400' },
                                            { key: 'doodstream', label: 'Nexi Turbo', color: 'bg-orange-500/10 border-orange-500/25 text-orange-400' },
                                            { key: 'streamtape', label: 'Nexi Pulse', color: 'bg-blue-500/10 border-blue-500/25 text-blue-400' },
                                            { key: 'voe', label: 'Nexi Spark', color: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' },
                                            { key: 'vidmoly', label: 'Vidmoly', color: 'bg-violet-500/10 border-violet-500/25 text-violet-400' },
                                            { key: 'abyss', label: 'Nexi Vault', color: 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400' },
                                            { key: 'rareanimes', label: 'RR Nexiplay Server', color: 'bg-pink-500/10 border-pink-500/25 text-pink-400' }
                                        ].map((srv) => (
                                            <button
                                                key={srv.key}
                                                type="button"
                                                onClick={() => setEditingServerKey(srv.key)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                                    editingServerKey === srv.key
                                                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30'
                                                    : 'bg-black/30 border-white/5 text-gray-400 hover:text-white hover:border-white/10'
                                                }`}
                                            >
                                                {srv.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Episodes List under Active Season */}
                                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 space-y-3">
                                        {seasons
                                            .find(s => s.id === activeSeasonId)
                                            ?.episodes?.map((ep: any) => (
                                                <div key={ep.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-black/25 rounded-xl border border-white/5">
                                                    <div className="min-w-0">
                                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">EPISODE ${ep.episode_number}</span>
                                                        <span className="text-sm font-semibold text-white truncate block max-w-sm mt-0.5">${ep.episode_title}</span>
                                                    </div>
                                                    <div className="flex-1 sm:max-w-xl">
                                                        <input
                                                            type="text"
                                                            value={localEpisodeUrls[ep.id]?.[editingServerKey] || ''}
                                                            onChange={(e) => handleEpisodeUrlChange(ep.id, editingServerKey, e.target.value)}
                                                            placeholder={`Paste ${editingServerKey === 'custom' ? 'custom/direct player' : editingServerKey + ' server'} URL for Episode ${ep.episode_number}...`}
                                                            className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        {(!seasons.find(s => s.id === activeSeasonId)?.episodes || 
                                          seasons.find(s => s.id === activeSeasonId)?.episodes.length === 0) && (
                                            <div className="p-8 text-center text-gray-600 text-xs">
                                                No episodes found in this season.
                                            </div>
                                        )}
                                    </div>

                                                                        {/* Save Button for active season */}
                                    <div className="flex justify-end pt-4 border-t border-white/5 gap-3">
                                        <button
                                            onClick={() => setEditingEpisodesMovie(null)}
                                            className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg text-sm transition-all"
                                        >
                                            Close
                                        </button>
                                        <button
                                            onClick={handleSaveEpisodes}
                                            disabled={savingEpisodes}
                                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
                                        >
                                            {savingEpisodes ? 'Saving...' : 'Save Season Episodes'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

                        {/* Scraper Settings & Run Modal */}
            {editingScraperMovie && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <span>🤖</span> Scraper Configuration
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Configure auto scrapers for: <strong className="text-white">&ldquo;{editingScraperMovie.title}&rdquo;</strong>
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingScraperMovie(null)}
                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Body / Form */}
                        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">

                            {/* Section: RR Nexiplay (RareAnimes) Scraper */}
                            <div className="bg-black/30 p-5 rounded-xl border border-pink-500/20 space-y-4">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <span className="text-xs font-black text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🎴</span> RR Nexiplay Server (RareAnimes Scraper)
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Link Mode:</span>
                                        <select
                                            value={rareanimesLinkMode}
                                            onChange={(e) => setRareanimesLinkMode(e.target.value as any)}
                                            className="bg-dark-900 border border-white/10 rounded px-2 py-1 text-white text-[11px] focus:outline-none focus:border-pink-500"
                                        >
                                            <option value="single">One Link All Seasons</option>
                                            <option value="separate">Separate Season Links</option>
                                            <option value="episode">Separate Episode Links</option>
                                        </select>
                                    </div>
                                </div>

                                {rareanimesLinkMode === 'single' ? (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">RareAnimes URL</label>
                                        <input
                                            type="text"
                                            value={rareanimesUrl}
                                            onChange={(e) => setRareanimesUrl(e.target.value)}
                                            className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-pink-500"
                                            placeholder="https://www.rareanimes.mov/hindi/..."
                                        />
                                    </div>
                                ) : rareanimesLinkMode === 'separate' ? (
                                    <div className="space-y-3">
                                        {scraperSeasons.length === 0 ? (
                                            <p className="text-[11px] text-gray-400 italic">No seasons configured. Click &ldquo;+ Add Season Link&rdquo; below to add fields.</p>
                                        ) : (
                                            scraperSeasons.map((season) => (
                                                <div key={season.id} className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-300 w-20">Season {season.season_number}:</span>
                                                    <input
                                                        type="text"
                                                        value={rareanimesUrls[season.season_number] || ''}
                                                        onChange={(e) => setRareanimesUrls({
                                                            ...rareanimesUrls,
                                                            [season.season_number]: e.target.value
                                                        })}
                                                        className="flex-1 bg-dark-900 border border-white/10 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-pink-500"
                                                        placeholder={`RareAnimes URL for Season ${season.season_number}...`}
                                                    />
                                                    {season.id.toString().startsWith('virtual_') && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setScraperSeasons(prev => prev.filter(s => s.id !== season.id));
                                                                const updated = { ...rareanimesUrls };
                                                                delete updated[season.season_number];
                                                                setRareanimesUrls(updated);
                                                            }}
                                                            className="text-gray-400 hover:text-pink-300 text-xs font-bold px-1.5 py-1 hover:bg-white/5 rounded transition-all"
                                                            title="Remove season field"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const nextSeasonNum = scraperSeasons.length > 0
                                                    ? Math.max(...scraperSeasons.map(s => s.season_number)) + 1
                                                    : 1;
                                                setScraperSeasons(prev => [
                                                    ...prev,
                                                    {
                                                        id: `virtual_${nextSeasonNum}`,
                                                        season_number: nextSeasonNum,
                                                        season_title: `Season ${nextSeasonNum}`
                                                    }
                                                ]);
                                            }}
                                            className="text-xs font-bold text-pink-500 hover:text-pink-400 flex items-center gap-1 mt-1 hover:underline"
                                        >
                                            ➕ Add Season {scraperSeasons.length > 0 ? Math.max(...scraperSeasons.map(s => s.season_number)) + 1 : 1} Link
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {scraperEpisodes.length === 0 ? (
                                            <p className="text-[11px] text-gray-400 italic">No episodes configured. Click &ldquo;+ Add Episode Link&rdquo; below to add fields.</p>
                                        ) : (
                                            scraperEpisodes.map((episode) => {
                                                const key = `${episode.season_number}_${episode.episode_number}`;
                                                return (
                                                    <div key={episode.id || key} className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-300 w-24">
                                                            S{episode.season_number} E{episode.episode_number}:
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={rareanimesEpisodeUrls[key] || ''}
                                                            onChange={(e) => setRareanimesEpisodeUrls({
                                                                ...rareanimesEpisodeUrls,
                                                                [key]: e.target.value
                                                            })}
                                                            className="flex-1 bg-dark-900 border border-white/10 rounded-lg p-2 text-white text-xs focus:outline-none focus:border-pink-500"
                                                            placeholder={`RareAnimes URL for Episode ${episode.episode_number}...`}
                                                        />
                                                        {episode.id?.toString().startsWith('virtual_ep_') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setScraperEpisodes(prev => prev.filter(ep => ep.id !== episode.id));
                                                                    const updated = { ...rareanimesEpisodeUrls };
                                                                    delete updated[key];
                                                                    setRareanimesEpisodeUrls(updated);
                                                                }}
                                                                className="text-gray-400 hover:text-pink-300 text-xs font-bold px-1.5 py-1 hover:bg-white/5 rounded transition-all"
                                                                title="Remove episode field"
                                                            >
                                                                ✕
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const defaultSeason = scraperSeasons[0]?.season_number || 1;
                                                const seasonEpisodes = scraperEpisodes.filter(ep => ep.season_number === defaultSeason);
                                                const nextEpisodeNum = seasonEpisodes.length > 0
                                                    ? Math.max(...seasonEpisodes.map(ep => ep.episode_number)) + 1
                                                    : 1;
                                                setScraperEpisodes(prev => [
                                                    ...prev,
                                                    {
                                                        id: `virtual_ep_${defaultSeason}_${nextEpisodeNum}`,
                                                        season_number: defaultSeason,
                                                        episode_number: nextEpisodeNum,
                                                        episode_title: `Episode ${nextEpisodeNum}`
                                                    }
                                                ]);
                                            }}
                                            className="text-xs font-bold text-pink-500 hover:text-pink-400 flex items-center gap-1 mt-1 hover:underline"
                                        >
                                            ➕ Add Episode Link
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-dark-850">
                            <button
                                onClick={() => setEditingScraperMovie(null)}
                                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg text-sm transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!editingScraperMovie) return;
                                    setScrapingLoader(true);
                                    try {
                                        const otherUrlsJson = getOtherScrapersJsonToSave();

                                        const { error: updateErr } = await supabase
                                            .from('movies')
                                            .update({
                                                toonplay_url: null,
                                                toonplay_season: null,
                                                toonplay_resolution: null,
                                                scraper_url: otherUrlsJson,
                                                scraper_source: otherUrlsJson ? 'multi' : null,
                                                updated_at: new Date().toISOString()
                                            })
                                            .eq('id', editingScraperMovie.id);

                                        if (updateErr) throw updateErr;
                                        await upsertStreamingRow(supabase, editingScraperMovie.id, {
                                            toonplay_url: null,
                                            toonplay_season: undefined,
                                            toonplay_resolution: null,
                                            scraper_url: otherUrlsJson,
                                            scraper_source: otherUrlsJson ? 'multi' : undefined
                                        });

                                        // Update local state
                                        setMovies(prev => prev.map(m => m.id === editingScraperMovie.id ? {
                                            ...m,
                                            toonplay_url: undefined,
                                            toonplay_season: undefined,
                                            toonplay_resolution: undefined,
                                            scraper_url: otherUrlsJson || undefined,
                                            scraper_source: otherUrlsJson ? 'multi' : undefined
                                        } : m));

                                        showMessage('success', 'Scraper settings saved successfully!');
                                        setEditingScraperMovie(null);
                                    } catch (err: any) {
                                        showMessage('error', 'Save failed: ' + err.message);
                                    } finally {
                                        setScrapingLoader(false);
                                    }
                                }}
                                disabled={scrapingLoader}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold rounded-lg text-sm transition-all"
                            >
                                Save Only
                            </button>
                            <button
                                onClick={async () => {
                                    if (!editingScraperMovie) return;
                                    setScrapingLoader(true);
                                    try {
                                        const otherUrlsJson = getOtherScrapersJsonToSave();

                                        // 1. Save to DB
                                        const { error: updateErr } = await supabase
                                            .from('movies')
                                            .update({
                                                toonplay_url: null,
                                                toonplay_season: null,
                                                toonplay_resolution: null,
                                                scraper_url: otherUrlsJson,
                                                scraper_source: otherUrlsJson ? 'multi' : null,
                                                updated_at: new Date().toISOString()
                                            })
                                            .eq('id', editingScraperMovie.id);

                                        if (updateErr) throw updateErr;
                                        await upsertStreamingRow(supabase, editingScraperMovie.id, {
                                            toonplay_url: null,
                                            toonplay_season: undefined,
                                            toonplay_resolution: null,
                                            scraper_url: otherUrlsJson,
                                            scraper_source: otherUrlsJson ? 'multi' : undefined
                                        });

                                        // Update local state
                                        setMovies(prev => prev.map(m => m.id === editingScraperMovie.id ? {
                                            ...m,
                                            toonplay_url: undefined,
                                            toonplay_season: undefined,
                                            toonplay_resolution: undefined,
                                            scraper_url: otherUrlsJson || undefined,
                                            scraper_source: otherUrlsJson ? 'multi' : undefined
                                        } : m));

                                        // 2. Trigger check-episodes scraper
                                        showMessage('success', 'Settings saved! Triggering scraper now...');
                                        const checkRes = await fetch('/api/cron/check-episodes', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ movieId: editingScraperMovie.id, mode: 'streaming' })
                                        });

                                        if (!checkRes.ok) throw new Error('Scraper request failed');
                                        const checkData = await checkRes.json();
                                        const result = checkData.results?.[0];
                                        
                                        if (result && result.status === 'success') {
                                            showMessage('success', `🎉 Scraper completed successfully!`);
                                            fetchMovies();
                                        } else if (result && result.status === 'no_updates_found') {
                                            showMessage('success', 'No new episodes found. Stream link might already be present.');
                                        } else if (result && result.status === 'error') {
                                            showMessage('error', 'Scraper error: ' + result.error);
                                        } else {
                                            showMessage('success', 'Scraper ran in background.');
                                        }
                                        setEditingScraperMovie(null);
                                    } catch (err: any) {
                                        showMessage('error', 'Save & Scrape failed: ' + err.message);
                                    } finally {
                                        setScrapingLoader(false);
                                    }
                                }}
                                disabled={scrapingLoader}
                                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-violet-300 hover:to-orange-500 text-white font-bold rounded-lg text-sm transition-all flex items-center gap-1.5 shadow-lg shadow-red-900/30"
                            >
                                {scrapingLoader ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>🚀</span>
                                        <span>Save & Scrape</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminShell>
    );
}
