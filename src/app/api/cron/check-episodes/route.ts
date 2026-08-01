import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeSource } from '@/lib/scraper-utils';
import { mergeMoviesWithStreaming, upsertStreamingRow } from '@/lib/streaming-table';

export const dynamic = 'force-dynamic';

const RUNNING_SCRAPER_SOURCES = new Set(['fxlinks', 'rareanimes', 'movielink', 'bollyflix']);
const isRunningScraperSource = (source?: string | null) => !!source && RUNNING_SCRAPER_SOURCES.has(source);
const DISABLED_STREAMING_SCRAPER_SOURCES = new Set(['muse_india', 'anione_india']);

function getLinkField(url: string): 'mega_link' | 'gdrive_link' | 'mediafire_link' | 'terabox_link' | 'pcloud_link' | 'youtube_link' {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('mega.nz') || lowerUrl.includes('mega.co.nz')) return 'mega_link';
    if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('google.com/drive')) return 'gdrive_link';
    if (lowerUrl.includes('mediafire.com')) return 'mediafire_link';
    if (lowerUrl.includes('terabox') || lowerUrl.includes('nephobox')) return 'terabox_link';
    if (lowerUrl.includes('pcloud.com')) return 'pcloud_link';
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube_link';
    return 'gdrive_link';
}

function getOriginalDueDate(adminNote: string | undefined | null): string | null {
    if (!adminNote) return null;
    const match = adminNote.match(/\[original_due_date:\s*([^\]]+)\]/);
    return match ? match[1] : null;
}

function setOriginalDueDate(adminNote: string | undefined | null, dateStr: string): string {
    const note = adminNote || '';
    const cleanNote = note.replace(/\[original_due_date:\s*[^\]]+\]/g, '').trim();
    return `${cleanNote} [original_due_date: ${dateStr}]`.trim();
}

function clearOriginalDueDate(adminNote: string | undefined | null): string {
    if (!adminNote) return '';
    return adminNote.replace(/\[original_due_date:\s*[^\]]+\]/g, '').trim();
}

function clearPendingSubsTag(adminNote: string | undefined | null): string {
    if (!adminNote) return '';
    return adminNote.replace(/\[pending_subs:\s*[^\]]+\]/g, '').trim();
}

/**
 * Insert or update a download link for an episode.
 * Returns true if successfully inserted/updated.
 */
async function upsertDownloadLink(
    episodeId: string,
    resolution: string,
    link: string,
    languageType: 'dub' | 'sub' | null,
    approvalStatus: 'approved' | 'pending'
): Promise<boolean> {
    const linkField = getLinkField(link);

    // For language-aware links, check by episode + resolution + language_type
    let query = supabase
        .from('episode_download_links')
        .select('id')
        .eq('episode_id', episodeId)
        .eq('resolution', resolution);

    if (languageType) {
        query = query.eq('language_type', languageType);
    } else {
        query = query.is('language_type', null);
    }

    const { data: existingLink, error: linkQueryError } = await query.maybeSingle();
    if (linkQueryError) throw linkQueryError;

    if (existingLink) {
        const { error: linkUpdateError } = await supabase
            .from('episode_download_links')
            .update({
                [linkField]: link,
                approval_status: approvalStatus,
            })
            .eq('id', existingLink.id);
        if (linkUpdateError) throw linkUpdateError;
    } else {
        const { error: linkInsertError } = await supabase
            .from('episode_download_links')
            .insert({
                episode_id: episodeId,
                resolution,
                [linkField]: link,
                language_type: languageType,
                approval_status: approvalStatus,
            });
        if (linkInsertError) throw linkInsertError;
    }
    return true;
}

/**
 * Get or create an episode record within a season.
 */
async function getOrCreateEpisode(seasonId: string, epNumber: number): Promise<string> {
    const { data: episode, error: epError } = await supabase
        .from('episodes')
        .select('id')
        .eq('season_id', seasonId)
        .eq('episode_number', epNumber)
        .maybeSingle();

    if (epError) throw epError;

    if (episode) return episode.id;

    const { data: newEp, error: createEpError } = await supabase
        .from('episodes')
        .insert({
            season_id: seasonId,
            episode_number: epNumber,
            episode_title: null,
        })
        .select()
        .single();

    if (createEpError) throw createEpError;
    return newEp.id;
}

// Auto-match function for the cron job
async function autoMatchStreaming(
    movieId: string,
    title: string,
    type: 'movie' | 'series' | 'anime',
    releaseYear: number | null,
    tmdbApiKey?: string
) {
    const updates: any = {};

    const isCloseMatch = (t1: string, t2: string) => {
        const n1 = t1.toLowerCase().replace(/[^a-z0-9]/g, '');
        const n2 = t2.toLowerCase().replace(/[^a-z0-9]/g, '');
        return n1 === n2 || n1.includes(n2) || n2.includes(n1);
    };

    if (type === 'anime') {
        try {
            const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=5`;
            const jikanRes = await fetch(jikanUrl);
            if (jikanRes.ok) {
                const jikanData = await jikanRes.json();
                const results = jikanData.data || [];
                const matched = results.find((r: any) => 
                    isCloseMatch(title, r.title) || 
                    (r.title_english && isCloseMatch(title, r.title_english))
                );
                if (matched) {
                    updates.mal_id = String(matched.mal_id);
                }
            }
        } catch (err) {
            console.error('Cron MAL search error:', err);
        }
    }

    if (tmdbApiKey) {
        try {
            let searchUrl = '';
            if (type === 'movie') {
                searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`;
            } else if (type === 'series') {
                searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`;
            } else {
                searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`;
            }

            const tmdbRes = await fetch(searchUrl);
            if (tmdbRes.ok) {
                const tmdbData = await tmdbRes.json();
                let results = tmdbData.results || [];
                if (type === 'anime') {
                    results = results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
                }

                const matched = results.find((r: any) => {
                    const itemTitle = r.title || r.name || '';
                    const origTitle = r.original_title || r.original_name || '';
                    return isCloseMatch(title, itemTitle) || isCloseMatch(title, origTitle);
                });

                if (matched) {
                    updates.tmdb_id = String(matched.id);
                    
                    // Fetch IMDb ID
                    const mediaType = type === 'movie' ? 'movie' : (matched.media_type || 'tv');
                    const extUrl = `https://api.themoviedb.org/3/${mediaType}/${matched.id}/external_ids?api_key=${tmdbApiKey}`;
                    const extRes = await fetch(extUrl);
                    if (extRes.ok) {
                        const extData = await extRes.json();
                        if (extData.imdb_id) {
                            updates.imdb_id = extData.imdb_id;
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Cron TMDB search error:', err);
        }
    }

    if (Object.keys(updates).length > 0) {
        // Fetch current movie to preserve existing fields
        const { data: currentMovie } = await supabase
            .from('movies')
            .select('tmdb_id, imdb_id, mal_id')
            .eq('id', movieId)
            .single();

        const finalUpdates: any = {
            updated_at: new Date().toISOString()
        };
        if (currentMovie) {
            finalUpdates.tmdb_id = updates.tmdb_id || currentMovie.tmdb_id;
            finalUpdates.imdb_id = updates.imdb_id || currentMovie.imdb_id;
            finalUpdates.mal_id = updates.mal_id || currentMovie.mal_id;
        } else {
            Object.assign(finalUpdates, updates);
        }

        await supabase
            .from('movies')
            .update(finalUpdates)
            .eq('id', movieId);
        await upsertStreamingRow(supabase, movieId, finalUpdates);
        
        console.log(`[Cron Auto-Match] Successfully updated streaming IDs for: ${title}`);
    }
}

type CheckMode = 'running' | 'streaming';

async function handleCheckEpisodes(targetMovieId?: string, mode: CheckMode = 'running') {
    const results: any[] = [];
    const isStreamingMode = mode === 'streaming';
    
    // 1. Fetch Target Movies
    let query = supabase.from('movies').select('*');
    
    if (targetMovieId) {
        query = query.eq('id', targetMovieId);
    } else if (!isStreamingMode) {
        query = query
            .eq('is_running', true)
            .eq('running_status', 'Ongoing');
    }

    const { data: movies, error: fetchError } = await query;

    if (fetchError) {
        throw new Error(`Failed to fetch target movies: ${fetchError.message}`);
    }

    if (!movies || movies.length === 0) {
        return { message: isStreamingMode ? 'No content found for streaming scrape.' : 'No active running series with scraper configuration found.' };
    }
    const targetMovies = isStreamingMode
        ? await mergeMoviesWithStreaming(supabase, movies as any[])
        : movies;

    // 2. Loop Through Movies and Process
    for (const movie of targetMovies) {
        const movieTitle = movie.title;
        const movieId = movie.id;
        
        // Streaming-only runs may refresh external IDs. Running checks stay focused on release tracking.
        if (isStreamingMode && !movie.tmdb_id && (movie.type !== 'anime' || !movie.mal_id)) {
            try {
                const tmdbApiKey = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
                await autoMatchStreaming(movie.id, movie.title, movie.type as any, movie.release_year, tmdbApiKey);
                // Refresh local loop variable reference with updated fields if matched
                const { data: updatedMovie } = await supabase
                    .from('movies')
                    .select('*')
                    .eq('id', movie.id)
                    .single();
                if (updatedMovie) {
                    const [mergedMovie] = await mergeMoviesWithStreaming(supabase, [updatedMovie as any]);
                    Object.assign(movie, mergedMovie || updatedMovie);
                }
            } catch (matchErr) {
                console.error(`[Cron Auto-Match] Failed for "${movie.title}":`, matchErr);
            }
        }
        
        try {
            const hasRunningScraper = !!(movie.scraper_url && isRunningScraperSource(movie.scraper_source));
            const hasStreamingScraper = !!(movie.animerulz_url || movie.toonplay_url || (movie.scraper_url && movie.scraper_source === 'multi'));

            // Check if movie has scraper settings configured for the selected workflow.
            if ((isStreamingMode && !hasStreamingScraper) || (!isStreamingMode && !hasRunningScraper)) {
                results.push({
                    id: movie.id,
                    title: movie.title,
                    status: 'skipped',
                    reason: isStreamingMode
                        ? 'Streaming scraper configuration incomplete.'
                        : 'Running scraper configuration incomplete.',
                });
                continue;
            }

            const now = new Date();
            const nextDueDate = movie.next_episode_date ? new Date(movie.next_episode_date) : null;
            const isDue = nextDueDate ? nextDueDate.getTime() <= now.getTime() : true;

            // If a specific movie is targeted, bypass date check. Streaming-only runs never affect scheduling.
            if (!isStreamingMode && !targetMovieId && !isDue) {
                results.push({
                    id: movie.id,
                    title: movie.title,
                    status: 'skipped',
                    reason: `Not due yet (Scheduled: ${movie.next_episode_date})`,
                });
                continue;
            }

            // Running mode uses only the running scraper source.
            // Streaming mode uses only streaming server scrapers.
            let maxScrapedEpNum = 0;
            let importedAnimerulzCount = 0;
            let importedToonplayCount = 0;
            let importedLegacyCount = 0;
            const warnings: string[] = [];

            // Fetch all seasons for this movie to map episodes correctly across seasons
            const { data: seasonsList, error: seasonsFetchError } = await supabase
                .from('seasons')
                .select('id, season_number')
                .eq('movie_id', movie.id);

            if (seasonsFetchError) throw seasonsFetchError;

            const seasonIds = (seasonsList || []).map(s => s.id);
            const dbSeasonMap = new Map<number, string>((seasonsList || []).map(s => [s.season_number, s.id]));
            const seasonIdToNumberMap = new Map<string, number>((seasonsList || []).map(s => [s.id, s.season_number]));

            // Fetch all episodes across all seasons
            const { data: dbEpisodesList, error: epsFetchError } = await supabase
                .from('episodes')
                .select('id, season_id, episode_number')
                .in('season_id', seasonIds);

            if (epsFetchError) throw epsFetchError;

            // Map of `${season_number}_${episode_number}` -> season_id
            const epSeasonMap = new Map<string, string>();
            if (dbEpisodesList) {
                for (const ep of dbEpisodesList) {
                    const seasonNum = seasonIdToNumberMap.get(ep.season_id) || 1;
                    epSeasonMap.set(`${seasonNum}_${ep.episode_number}`, ep.season_id);
                }
            }

            // Fallback season ID: the highest season number, or the first season
            const sortedSeasons = [...(seasonsList || [])].sort((a, b) => b.season_number - a.season_number);
            const fallbackSeasonId = sortedSeasons[0]?.id;

            const getEpisodeSeasonId = (epNum: number, targetSeasonNum: number): string => {
                const key = `${targetSeasonNum}_${epNum}`;
                const mappedSeasonId = epSeasonMap.get(key);
                if (mappedSeasonId) return mappedSeasonId;

                const targetSeasonId = dbSeasonMap.get(targetSeasonNum);
                if (targetSeasonId) return targetSeasonId;

                return fallbackSeasonId || '';
            };

            const saveEpisodeServerStream = async (episodeId: string, serverKey: string, streamUrl: string, epNum: number): Promise<boolean> => {
                const { data: currentEp } = await supabase
                    .from('episodes')
                    .select('streaming_url')
                    .eq('id', episodeId)
                    .single();

                let streamingUrlObj: Record<string, string> = {};
                if (currentEp?.streaming_url && currentEp.streaming_url.trim().startsWith('{')) {
                    try {
                        streamingUrlObj = JSON.parse(currentEp.streaming_url);
                    } catch {}
                } else if (currentEp?.streaming_url) {
                    streamingUrlObj.legacy = currentEp.streaming_url;
                }

                streamingUrlObj[serverKey] = streamUrl;

                const { error: updateEpError } = await supabase
                    .from('episodes')
                    .update({ streaming_url: JSON.stringify(streamingUrlObj) })
                    .eq('id', episodeId);

                if (updateEpError) {
                    console.warn(`[Cron Multi-Scraper] Failed to save streaming_url for Ep ${epNum} on "${serverKey}":`, updateEpError);
                    return false;
                }

                return true;
            };

            // 1. Run Running/Manual Scraper (fxlinks, rareanimes, movielink, bollyflix etc).
            if (movie.scraper_url && isRunningScraperSource(movie.scraper_source) && !isStreamingMode) {
                const scraperUrl = movie.scraper_url;
                const scraperSource = movie.scraper_source;
                const scraperResolution = movie.scraper_resolution || '720p';
                const scraperSeason = movie.scraper_season || 1;

                // Scrape legacy source
                const scrapeResult = await scrapeSource(scraperUrl, scraperSource);
                const scrapedEpisodes = scrapeResult.episodes;
                if (scrapeResult.warnings) {
                    warnings.push(...scrapeResult.warnings.map(w => `Legacy Scraper: ${w}`));
                }

                // Find or Create Season ID
                let { data: season, error: seasonError } = await supabase
                    .from('seasons')
                    .select('id')
                    .eq('movie_id', movie.id)
                    .eq('season_number', scraperSeason)
                    .maybeSingle();

                if (seasonError) throw seasonError;

                let seasonId = season?.id;
                if (!seasonId) {
                    const { data: newSeason, error: createSeasonError } = await supabase
                        .from('seasons')
                        .insert({
                            movie_id: movie.id,
                            season_number: scraperSeason,
                            season_title: `Season ${scraperSeason}`,
                        })
                        .select()
                        .single();
                    if (createSeasonError) throw createSeasonError;
                    seasonId = newSeason.id;
                }

                // Process scraped episodes
                for (const ep of scrapedEpisodes) {
                    const episodeId = await getOrCreateEpisode(seasonId, ep.number);
                    const isRareanimes = scraperSource === 'rareanimes';
                    
                    if (scraperSource !== 'animerulz' && scraperSource !== 'toonplay') {
                        await upsertDownloadLink(
                            episodeId,
                            scraperResolution,
                            ep.link,
                            isRareanimes ? 'dub' : null,
                            'approved'
                        );
                    }

                    if (ep.streamingUrl) {
                        const { error: updateEpError } = await supabase
                            .from('episodes')
                            .update({ streaming_url: ep.streamingUrl })
                            .eq('id', episodeId);
                        if (updateEpError) {
                            console.warn(`[Cron Legacy] Failed to save streaming_url for episode ${ep.number}:`, updateEpError);
                        }
                    }

                    importedLegacyCount++;
                    if (ep.number > maxScrapedEpNum) {
                        maxScrapedEpNum = ep.number;
                    }
                }
            }

            // 1b. Run Multi-Scraper if configured for streaming.
            if (isStreamingMode && movie.scraper_url && movie.scraper_source === 'multi') {
                console.log(`[Cron Multi-Scraper] Processing movie: "${movie.title}"`);
                try {
                    const scraperConfig = JSON.parse(movie.scraper_url);
                    
                    for (const [serverKey, config] of Object.entries(scraperConfig)) {
                        if (DISABLED_STREAMING_SCRAPER_SOURCES.has(serverKey)) {
                            console.log(`[Cron Multi-Scraper] Skipping disabled server: "${serverKey}"`);
                            continue;
                        }

                        const srvConfig = config as { mode: 'single' | 'separate' | 'episode'; url: string; urls: Record<number, string>; episodeUrls?: Record<string, string> };
                        if (
                            !srvConfig.url &&
                            (!srvConfig.urls || Object.keys(srvConfig.urls).length === 0) &&
                            (!srvConfig.episodeUrls || Object.keys(srvConfig.episodeUrls).length === 0)
                        ) {
                            continue;
                        }

                        console.log(`[Cron Multi-Scraper] Running scraper for server: "${serverKey}"`);

                        if (srvConfig.mode === 'episode') {
                            for (const [episodeKey, targetUrl] of Object.entries(srvConfig.episodeUrls || {})) {
                                if (!targetUrl) continue;

                                const [seasonPart, episodePart] = episodeKey.split('_');
                                const sNum = parseInt(seasonPart, 10);
                                const epNum = parseInt(episodePart, 10);
                                if (Number.isNaN(sNum) || Number.isNaN(epNum)) {
                                    warnings.push(`Multi-Scraper (${serverKey}): Invalid episode key "${episodeKey}"`);
                                    continue;
                                }

                                console.log(`[Cron Multi-Scraper] Scraping "${serverKey}" S${sNum} E${epNum} using URL: ${targetUrl}`);

                                try {
                                    const scrapeResult = await scrapeSource(
                                        targetUrl,
                                        serverKey as any,
                                        [],
                                        { targetSeason: sNum, movieTitle: movie.title, isStreamingOnly: true }
                                    );

                                    if (scrapeResult.warnings) {
                                        warnings.push(...scrapeResult.warnings.map(w => `Multi-Scraper (${serverKey} S${sNum} E${epNum}): ${w}`));
                                    }

                                    const scrapedEp = scrapeResult.episodes.find(ep => ep.streamingUrl) || scrapeResult.episodes[0];
                                    if (!scrapedEp?.streamingUrl) {
                                        warnings.push(`Multi-Scraper (${serverKey} S${sNum} E${epNum}): No streaming URL found`);
                                        continue;
                                    }

                                    if (!dbSeasonMap.has(sNum)) {
                                        const { data: newSeason, error: createSeasonError } = await supabase
                                            .from('seasons')
                                            .insert({
                                                movie_id: movie.id,
                                                season_number: sNum,
                                                season_title: `Season ${sNum}`,
                                            })
                                            .select()
                                            .single();
                                        if (createSeasonError) throw createSeasonError;
                                        dbSeasonMap.set(sNum, newSeason.id);
                                        seasonIdToNumberMap.set(newSeason.id, sNum);
                                    }

                                    const seasonId = getEpisodeSeasonId(epNum, sNum);
                                    const episodeId = await getOrCreateEpisode(seasonId, epNum);
                                    if (await saveEpisodeServerStream(episodeId, serverKey, scrapedEp.streamingUrl, epNum)) {
                                        importedLegacyCount++;
                                    }
                                    if (epNum > maxScrapedEpNum) {
                                        maxScrapedEpNum = epNum;
                                    }
                                } catch (err: any) {
                                    console.error(`[Cron Multi-Scraper] Episode scraper "${serverKey}" failed for S${sNum} E${epNum}:`, err.message);
                                    warnings.push(`Multi-Scraper (${serverKey} S${sNum} E${epNum}): ${err.message}`);
                                }
                            }
                            continue;
                        }

                        for (const season of (seasonsList || [])) {
                            const sNum = season.season_number;
                            let targetUrl = '';
                            
                            if (srvConfig.mode === 'single') {
                                targetUrl = srvConfig.url;
                            } else if (srvConfig.mode === 'separate' && srvConfig.urls) {
                                targetUrl = srvConfig.urls[sNum];
                            }

                            if (!targetUrl) continue;

                            console.log(`[Cron Multi-Scraper] Scraping "${serverKey}" Season ${sNum} using URL: ${targetUrl}`);
                            
                            try {
                                const scrapeResult = await scrapeSource(
                                    targetUrl,
                                    serverKey as any,
                                    [],
                                    { targetSeason: sNum, movieTitle: movie.title, isStreamingOnly: true }
                                );

                                if (scrapeResult.warnings) {
                                    warnings.push(...scrapeResult.warnings.map(w => `Multi-Scraper (${serverKey} S${sNum}): ${w}`));
                                }

                                for (const ep of scrapeResult.episodes) {
                                    if (!ep.streamingUrl) continue;

                                    const episodeId = await getOrCreateEpisode(season.id, ep.number);
                                    
                                    if (await saveEpisodeServerStream(episodeId, serverKey, ep.streamingUrl, ep.number)) {
                                        importedLegacyCount++;
                                    }

                                    if (ep.number > maxScrapedEpNum) {
                                        maxScrapedEpNum = ep.number;
                                    }
                                }
                            } catch (err: any) {
                                console.error(`[Cron Multi-Scraper] Scraper "${serverKey}" failed for Season ${sNum}:`, err.message);
                                warnings.push(`Multi-Scraper (${serverKey} S${sNum}): ${err.message}`);
                            }
                        }
                    }
                } catch (parseErr: any) {
                    console.error('[Cron Multi-Scraper] Failed to parse scraper_url config:', parseErr.message);
                    warnings.push(`Multi-Scraper Config Parse: ${parseErr.message}`);
                }
            }

            // 2. Run Animerulz streaming scraper if configured.
            if (isStreamingMode && movie.animerulz_url) {
                const animerulzUrl = movie.animerulz_url;
                const animerulzSeason = movie.animerulz_season || 1;
                const animerulzResolution = movie.animerulz_resolution || '720p';

                // Find existing episodes that already have animerulz stream URL populated to skip them
                let skipEpisodes: string[] = [];
                try {
                    const { data: eps } = await supabase
                        .from('episodes')
                        .select('episode_number, season_id')
                        .in('season_id', Array.from(dbSeasonMap.values()))
                        .not('streaming_url_animerulz', 'is', null);
                    
                    if (eps && eps.length > 0) {
                        skipEpisodes = eps.map(e => {
                            const seasonNum = seasonIdToNumberMap.get(e.season_id) || 1;
                            return `${seasonNum}_${e.episode_number}`;
                        });
                        console.log(`[Cron Animerulz] Skipping ${skipEpisodes.length} episodes already resolved in DB.`);
                    }
                } catch (dbErr) {
                    console.warn('[Cron Animerulz] Failed to query existing resolved episodes:', dbErr);
                }

                let isJson = false;
                let urlMap: Record<number, string> = {};
                try {
                    if (animerulzUrl.trim().startsWith('{')) {
                        const parsed = JSON.parse(animerulzUrl);
                        for (const [k, v] of Object.entries(parsed)) {
                            urlMap[parseInt(k)] = v as string;
                        }
                        isJson = true;
                    }
                } catch (e) {
                    isJson = false;
                }

                const scrapedEpisodes: any[] = [];
                if (isJson) {
                    for (const [sNumStr, sUrl] of Object.entries(urlMap)) {
                        const sNum = parseInt(sNumStr);
                        console.log(`[Cron Animerulz] Scraping Season ${sNum} from URL: ${sUrl}`);
                        const scrapeResult = await scrapeSource(sUrl, 'animerulz', skipEpisodes, { disableSequels: true, targetSeason: sNum });
                        for (const ep of scrapeResult.episodes) {
                            ep.season = sNum;
                        }
                        scrapedEpisodes.push(...scrapeResult.episodes);
                        if (scrapeResult.warnings) {
                            warnings.push(...scrapeResult.warnings.map(w => `Animerulz S${sNum}: ${w}`));
                        }
                    }
                } else {
                    const scrapeResult = await scrapeSource(animerulzUrl, 'animerulz', skipEpisodes);
                    scrapedEpisodes.push(...scrapeResult.episodes);
                    if (scrapeResult.warnings) {
                        warnings.push(...scrapeResult.warnings.map(w => `Animerulz: ${w}`));
                    }
                }

                // Ensure all seasons found in scraped episodes exist in the database
                const requiredSeasons = Array.from(new Set(scrapedEpisodes.map(ep => ep.season || animerulzSeason)));
                for (const sNum of requiredSeasons) {
                    if (!dbSeasonMap.has(sNum)) {
                        console.log(`[Cron Animerulz] Season ${sNum} not found in DB. Creating it...`);
                        const { data: newSeason, error: createSeasonError } = await supabase
                            .from('seasons')
                            .insert({
                                movie_id: movie.id,
                                season_number: sNum,
                                season_title: `Season ${sNum}`,
                            })
                            .select()
                            .single();
                        if (createSeasonError) {
                            console.error(`[Cron Animerulz] Failed to create Season ${sNum}:`, createSeasonError);
                        } else {
                            dbSeasonMap.set(sNum, newSeason.id);
                            seasonIdToNumberMap.set(newSeason.id, sNum);
                        }
                    }
                }

                // Process scraped episodes safely — only update streaming_url, never replace episode rows
                const streamingEpisodes = scrapedEpisodes.filter(ep => ep.streamingUrl);

                if (streamingEpisodes.length > 0) {
                    console.log(`[Cron Animerulz] Safely updating streaming URLs for ${streamingEpisodes.length} episodes...`);
                    
                    for (const ep of streamingEpisodes) {
                        try {
                            const targetSeason = ep.season || animerulzSeason;
                            const seasonId = getEpisodeSeasonId(ep.number, targetSeason);
                            const episodeId = await getOrCreateEpisode(seasonId, ep.number);
                            
                            const { error: updateError } = await supabase
                                .from('episodes')
                                .update({ streaming_url_animerulz: ep.streamingUrl })
                                .eq('id', episodeId);
                            
                            if (updateError) {
                                console.warn(`[Cron Animerulz] Failed to update streaming URL for Ep ${ep.number}:`, updateError);
                            } else {
                                importedAnimerulzCount++;
                            }
                        } catch (err: any) {
                            console.warn(`[Cron Animerulz] Error processing Ep ${ep.number}:`, err.message);
                        }
                    }
                }

                for (const ep of scrapedEpisodes) {
                    if (ep.number > maxScrapedEpNum) {
                        maxScrapedEpNum = ep.number;
                    }
                }
            }

            // 3. Run Toonplay streaming scraper if configured.
            if (isStreamingMode && movie.toonplay_url) {
                const toonplayUrl = movie.toonplay_url;
                const toonplaySeason = movie.toonplay_season || 1;
                const toonplayResolution = movie.toonplay_resolution || '720p';

                // Find existing episodes that already have toonplay stream URL populated to skip them
                let skipEpisodes: string[] = [];
                try {
                    const { data: eps } = await supabase
                        .from('episodes')
                        .select('episode_number, season_id')
                        .in('season_id', Array.from(dbSeasonMap.values()))
                        .not('streaming_url_toonplay', 'is', null);
                    
                    if (eps && eps.length > 0) {
                        skipEpisodes = eps.map(e => {
                            const seasonNum = seasonIdToNumberMap.get(e.season_id) || 1;
                            return `${seasonNum}_${e.episode_number}`;
                        });
                        console.log(`[Cron Toonplay] Skipping ${skipEpisodes.length} episodes already resolved in DB.`);
                    }
                } catch (dbErr) {
                    console.warn('[Cron Toonplay] Failed to query existing resolved episodes:', dbErr);
                }

                let isJson = false;
                let urlMap: Record<number, string> = {};
                try {
                    if (toonplayUrl.trim().startsWith('{')) {
                        const parsed = JSON.parse(toonplayUrl);
                        for (const [k, v] of Object.entries(parsed)) {
                            urlMap[parseInt(k)] = v as string;
                        }
                        isJson = true;
                    }
                } catch (e) {
                    isJson = false;
                }

                const scrapedEpisodes: any[] = [];
                if (isJson) {
                    for (const [sNumStr, sUrl] of Object.entries(urlMap)) {
                        const sNum = parseInt(sNumStr);
                        console.log(`[Cron Toonplay] Scraping Season ${sNum} from URL: ${sUrl}`);
                        const scrapeResult = await scrapeSource(sUrl, 'toonplay', skipEpisodes, { targetSeason: sNum });
                        for (const ep of scrapeResult.episodes) {
                            ep.season = sNum;
                        }
                        scrapedEpisodes.push(...scrapeResult.episodes);
                        if (scrapeResult.warnings) {
                            warnings.push(...scrapeResult.warnings.map(w => `Toonplay S${sNum}: ${w}`));
                        }
                    }
                } else {
                    const scrapeResult = await scrapeSource(toonplayUrl, 'toonplay', skipEpisodes);
                    scrapedEpisodes.push(...scrapeResult.episodes);
                    if (scrapeResult.warnings) {
                        warnings.push(...scrapeResult.warnings.map(w => `Toonplay: ${w}`));
                    }
                }

                // Ensure all seasons found in scraped episodes exist in the database
                const requiredSeasons = Array.from(new Set(scrapedEpisodes.map(ep => ep.season || toonplaySeason)));
                for (const sNum of requiredSeasons) {
                    if (!dbSeasonMap.has(sNum)) {
                        console.log(`[Cron Toonplay] Season ${sNum} not found in DB. Creating it...`);
                        const { data: newSeason, error: createSeasonError } = await supabase
                            .from('seasons')
                            .insert({
                                movie_id: movie.id,
                                season_number: sNum,
                                season_title: `Season ${sNum}`,
                            })
                            .select()
                            .single();
                        if (createSeasonError) {
                            console.error(`[Cron Toonplay] Failed to create Season ${sNum}:`, createSeasonError);
                        } else {
                            dbSeasonMap.set(sNum, newSeason.id);
                            seasonIdToNumberMap.set(newSeason.id, sNum);
                        }
                    }
                }

                // Process scraped episodes safely — only update streaming_url, never replace episode rows
                const toonplayStreamingEps = scrapedEpisodes.filter(ep => ep.streamingUrl);

                if (toonplayStreamingEps.length > 0) {
                    console.log(`[Cron Toonplay] Safely updating streaming URLs for ${toonplayStreamingEps.length} episodes...`);
                    
                    for (const ep of toonplayStreamingEps) {
                        try {
                            const targetSeason = ep.season || toonplaySeason;
                            const seasonId = getEpisodeSeasonId(ep.number, targetSeason);
                            const episodeId = await getOrCreateEpisode(seasonId, ep.number);
                            
                            const { error: updateError } = await supabase
                                .from('episodes')
                                .update({ streaming_url_toonplay: ep.streamingUrl })
                                .eq('id', episodeId);
                            
                            if (updateError) {
                                console.warn(`[Cron Toonplay] Failed to update streaming URL for Ep ${ep.number}:`, updateError);
                            } else {
                                importedToonplayCount++;
                            }
                        } catch (err: any) {
                            console.warn(`[Cron Toonplay] Error processing Ep ${ep.number}:`, err.message);
                        }
                    }
                }

                for (const ep of scrapedEpisodes) {
                    if (ep.number > maxScrapedEpNum) {
                        maxScrapedEpNum = ep.number;
                    }
                }
            }

            // Check if any episode links were processed
            const totalImported = importedLegacyCount + importedAnimerulzCount + importedToonplayCount;

            if (totalImported > 0) {
                if (isStreamingMode) {
                    results.push({
                        id: movie.id,
                        title: movie.title,
                        status: 'success',
                        importedLegacy: importedLegacyCount,
                        importedAnimerulz: importedAnimerulzCount,
                        importedToonplay: importedToonplayCount,
                        lastEpisode: movie.last_episode || 0,
                        nextEpisodeDate: movie.next_episode_date,
                        message: 'Streaming URLs updated without changing running schedule.',
                        warnings: warnings.length > 0 ? warnings : undefined
                    });
                    continue;
                }

                // Update Movie schedule and metadata if a new episode was found
                const currentLastEpisode = movie.last_episode || 0;
                let finalLastEpisode = currentLastEpisode;
                let finalNextEpisode = movie.next_episode || (currentLastEpisode + 1);
                let nextEpisodeDateStr = movie.next_episode_date;

                const hasNewEpisodeNum = maxScrapedEpNum > currentLastEpisode;

                if (!hasNewEpisodeNum) {
                    if (isDue) {
                        const originalDate = movie.next_episode_date || new Date().toISOString();
                        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        const tomorrowStr = tomorrow.toISOString();

                        let updatedAdminNote = movie.admin_note;
                        if (!getOriginalDueDate(movie.admin_note)) {
                            updatedAdminNote = setOriginalDueDate(movie.admin_note, originalDate);
                        }

                        const { error: rescheduleError } = await supabase
                            .from('movies')
                            .update({
                                next_episode_date: tomorrowStr,
                                admin_note: updatedAdminNote,
                                notify_admin: false,
                            })
                            .eq('id', movie.id);

                        if (rescheduleError) throw rescheduleError;

                        results.push({
                            id: movie.id,
                            title: movie.title,
                            status: 'no_updates_found',
                            message: `No new episode found. Latest scraped episode is still ${maxScrapedEpNum || 'unknown'}. Retry scheduled for tomorrow.`,
                            importedLegacy: importedLegacyCount,
                            importedCount: importedLegacyCount,
                            lastEpisode: currentLastEpisode,
                            nextEpisodeDate: tomorrowStr,
                            warnings: warnings.length > 0 ? warnings : undefined
                        });
                    } else {
                        results.push({
                            id: movie.id,
                            title: movie.title,
                            status: 'no_updates_found',
                            message: `No new episode found. Latest scraped episode is still ${maxScrapedEpNum || 'unknown'}.`,
                            importedLegacy: importedLegacyCount,
                            importedCount: importedLegacyCount,
                            lastEpisode: currentLastEpisode,
                            nextEpisodeDate: movie.next_episode_date,
                            warnings: warnings.length > 0 ? warnings : undefined
                        });
                    }
                    continue;
                }

                if (hasNewEpisodeNum) {
                    finalLastEpisode = maxScrapedEpNum;
                    finalNextEpisode = finalLastEpisode + 1;

                    // Calculate next check date: 7 days from original release date, or now if in the past
                    const originalDueDateStr = getOriginalDueDate(movie.admin_note);
                    let baseDate = originalDueDateStr ? new Date(originalDueDateStr) : null;
                    
                    if (!baseDate && movie.next_episode_date) {
                        baseDate = new Date(movie.next_episode_date);
                    }
                    if (!baseDate) {
                        baseDate = new Date();
                    }

                    let nextDate = new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000);
                    if (nextDate.getTime() <= Date.now()) {
                        nextDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                    }
                    nextEpisodeDateStr = nextDate.toISOString();
                }

                let cleanAdminNote = clearOriginalDueDate(movie.admin_note);
                cleanAdminNote = clearPendingSubsTag(cleanAdminNote);
                const finalAdminNote = cleanAdminNote;

                const { error: movieUpdateError } = await supabase
                    .from('movies')
                    .update({
                        last_episode: finalLastEpisode,
                        next_episode: finalNextEpisode,
                        next_episode_date: nextEpisodeDateStr,
                        notify_admin: true,
                        admin_note: finalAdminNote || null,
                    })
                    .eq('id', movie.id);

                if (movieUpdateError) throw movieUpdateError;

                // Upsert to updates table if a new episode was added
                if (hasNewEpisodeNum) {
                    try {
                        const targetSeason = movie.toonplay_season || movie.animerulz_season || movie.scraper_season || 1;
                        await supabase.from('updates').upsert({
                            content_id: movie.id,
                            title: movie.title,
                            poster_url: movie.poster_url,
                            slug: '/' + movie.type + '/' + movie.slug,
                            content_type: movie.type,
                            update_type: 'episode',
                            season_number: targetSeason,
                            episode_number: finalLastEpisode,
                            is_active: true,
                            updated_at: new Date().toISOString(),
                        }, { onConflict: 'content_id' });
                    } catch (updateErr) {
                        console.error('Failed to upsert updates table:', updateErr);
                    }
                }

                results.push({
                    id: movie.id,
                    title: movie.title,
                    status: 'success',
                    importedLegacy: importedLegacyCount,
                    importedCount: importedLegacyCount,
                    importedAnimerulz: importedAnimerulzCount,
                    importedToonplay: importedToonplayCount,
                    lastEpisode: finalLastEpisode,
                    nextEpisodeDate: nextEpisodeDateStr,
                    warnings: warnings.length > 0 ? warnings : undefined
                });

            } else {
                if (isStreamingMode) {
                    results.push({
                        id: movie.id,
                        title: movie.title,
                        status: 'no_updates_found',
                        message: 'No streaming URLs were updated.',
                        warnings: warnings.length > 0 ? warnings : undefined
                    });
                    continue;
                }

                // No episodes were successfully parsed/imported. If due/overdue, reschedule daily (tomorrow)
                if (isDue) {
                    const originalDate = movie.next_episode_date || new Date().toISOString();
                    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    const tomorrowStr = tomorrow.toISOString();

                    let updatedAdminNote = movie.admin_note;
                    if (!getOriginalDueDate(movie.admin_note)) {
                        updatedAdminNote = setOriginalDueDate(movie.admin_note, originalDate);
                    }

                    const { error: rescheduleError } = await supabase
                        .from('movies')
                        .update({
                            next_episode_date: tomorrowStr,
                            admin_note: updatedAdminNote,
                            notify_admin: false, // Don't alert for silent retries
                        })
                        .eq('id', movie.id);

                    if (rescheduleError) throw rescheduleError;

                    results.push({
                        id: movie.id,
                        title: movie.title,
                        status: 'no_updates_found',
                        message: 'Rescheduled for daily check tomorrow (episode delay retry)',
                        nextEpisodeDate: tomorrowStr,
                        warnings: warnings.length > 0 ? warnings : undefined
                    });
                } else {
                    results.push({
                        id: movie.id,
                        title: movie.title,
                        status: 'no_updates_found',
                        message: 'No new episodes found, but show is not due yet.',
                        warnings: warnings.length > 0 ? warnings : undefined
                    });
                }
            }

        } catch (movieErr: any) {
            console.error(`Error processing auto-checker for "${movieTitle}":`, movieErr);
            const errMsg = movieErr.message || JSON.stringify(movieErr);
            const isTimeout = errMsg.includes('timeout') || errMsg.includes('aborted');
            const isCfBlock = errMsg.includes('Cloudflare') || errMsg.includes('block');
            const isConnectionErr = errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND') || errMsg.includes('fetch failed');
            
            let userFriendlyError = errMsg;
            if (isTimeout || isConnectionErr) {
                userFriendlyError = `Source site is not responding (timeout). The site may be down or blocking requests. Try again later.`;
            } else if (isCfBlock) {
                userFriendlyError = `Source site is protected by Cloudflare and blocked the request. Try again later.`;
            }
            
            results.push({
                id: movieId,
                title: movieTitle,
                status: 'error',
                error: userFriendlyError,
            });
        }
    }

    return results;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const movieId = searchParams.get('movieId') || undefined;
        const mode = searchParams.get('mode') === 'streaming' ? 'streaming' : 'running';
        
        const results = await handleCheckEpisodes(movieId, mode);
        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        let movieId: string | undefined;
        let mode: CheckMode = 'running';
        
        try {
            const body = await request.json();
            movieId = body.movieId || undefined;
            mode = body.mode === 'streaming' ? 'streaming' : 'running';
        } catch {
            // No body or invalid JSON is fine, runs all
        }

        if (movieId) {
            console.log(`[Cron Scraper] Starting ${mode} scraper for movieId: ${movieId}`);
            const results = await handleCheckEpisodes(movieId, mode);
            return NextResponse.json({ success: true, results });
        }

        const results = await handleCheckEpisodes(movieId, mode);
        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
