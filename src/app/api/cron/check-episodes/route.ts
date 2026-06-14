import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeSource } from '@/lib/scraper-utils';

export const dynamic = 'force-dynamic';

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
        
        console.log(`[Cron Auto-Match] Successfully updated streaming IDs for: ${title}`);
    }
}

async function handleCheckEpisodes(movieId?: string) {
    const results: any[] = [];
    
    // 1. Fetch Target Movies
    let query = supabase.from('movies').select('*');
    
    if (movieId) {
        query = query.eq('id', movieId);
    } else {
        query = query
            .eq('is_running', true)
            .eq('running_status', 'Ongoing')
            .not('scraper_url', 'is', null);
    }

    const { data: movies, error: fetchError } = await query;

    if (fetchError) {
        throw new Error(`Failed to fetch target movies: ${fetchError.message}`);
    }

    if (!movies || movies.length === 0) {
        return { message: 'No active running series with scraper configuration found.' };
    }

    // 2. Loop Through Movies and Process
    for (const movie of movies) {
        const movieTitle = movie.title;
        const movieId = movie.id;
        
        // Auto-match streaming IDs if missing during cron run
        if (!movie.tmdb_id && (movie.type !== 'anime' || !movie.mal_id)) {
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
                    Object.assign(movie, updatedMovie);
                }
            } catch (matchErr) {
                console.error(`[Cron Auto-Match] Failed for "${movie.title}":`, matchErr);
            }
        }
        
        try {
            const scraperUrl = movie.scraper_url;
            const scraperSource = movie.scraper_source;
            const scraperResolution = movie.scraper_resolution || '720p';
            const scraperSeason = movie.scraper_season || 1;

            if (!scraperUrl || !scraperSource) {
                results.push({
                    id: movie.id,
                    title: movie.title,
                    status: 'skipped',
                    reason: 'Scraper configuration incomplete (URL or Source missing)',
                });
                continue;
            }

            const now = new Date();
            const nextDueDate = movie.next_episode_date ? new Date(movie.next_episode_date) : null;
            const isDue = nextDueDate ? nextDueDate.getTime() <= now.getTime() : true;

            // If a specific movie is targeted, bypass date check. Otherwise, enforce scheduling.
            if (!movieId && !isDue) {
                results.push({
                    id: movie.id,
                    title: movie.title,
                    status: 'skipped',
                    reason: `Not due yet (Scheduled: ${movie.next_episode_date})`,
                });
                continue;
            }

            // 3. Scrape the Source Page
            const scrapeResult = await scrapeSource(scraperUrl, scraperSource);
            const scrapedEpisodes = scrapeResult.episodes;
            const pendingSubEpisodes = scrapeResult.pendingSubEpisodes || [];

            // 4. Find Season
            let { data: season, error: seasonError } = await supabase
                .from('seasons')
                .select('id')
                .eq('movie_id', movie.id)
                .eq('season_number', scraperSeason)
                .maybeSingle();

            if (seasonError) throw seasonError;

            // Fetch existing episode numbers and their links for this season/resolution
            // to check what is already present in the database.
            let existingLinks: any[] = [];
            if (season) {
                const { data: eps, error: epsError } = await supabase
                    .from('episodes')
                    .select(`
                        episode_number,
                        episode_download_links (
                            resolution,
                            language_type,
                            mega_link,
                            gdrive_link,
                            mediafire_link,
                            terabox_link,
                            pcloud_link,
                            youtube_link
                        )
                    `)
                    .eq('season_id', season.id);
                
                if (epsError) throw epsError;
                if (eps) {
                    existingLinks = eps;
                }
            }

            // Helper to check if a download link is already imported
            const isLinkAlreadyImported = (epNumber: number, langType: 'dub' | 'sub' | null, res: string): boolean => {
                const ep = existingLinks.find(e => e.episode_number === epNumber);
                if (!ep || !ep.episode_download_links) return false;
                
                const link = ep.episode_download_links.find((l: any) => {
                    const matchRes = l.resolution === res;
                    const matchLang = langType ? l.language_type === langType : l.language_type === null;
                    return matchRes && matchLang;
                });
                
                if (!link) return false;
                
                return !!(
                    link.mega_link ||
                    link.gdrive_link ||
                    link.mediafire_link ||
                    link.terabox_link ||
                    link.pcloud_link ||
                    link.youtube_link
                );
            };

            // Filter for new episodes
            const newDubEpisodes = scrapedEpisodes.filter(ep => {
                const isRareanimes = scraperSource === 'rareanimes';
                const langType = isRareanimes ? 'dub' : null;
                return !isLinkAlreadyImported(ep.number, langType, scraperResolution);
            });

            if (newDubEpisodes.length > 0) {
                // Find or Create Season ID
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

                let importedDubCount = 0;
                let importedSubCount = 0; // Remains 0 since SUB import is disabled

                // 5. Insert DUB Episodes (auto-approved)
                for (const ep of newDubEpisodes) {
                    const episodeId = await getOrCreateEpisode(seasonId, ep.number);
                    const isRareanimes = scraperSource === 'rareanimes';
                    await upsertDownloadLink(
                        episodeId,
                        scraperResolution,
                        ep.link,
                        isRareanimes ? 'dub' : null,
                        'approved'
                    );

                    // Save custom streaming URL override if scraped (e.g. WatchMultiQuality/StreamBeta)
                    if (ep.streamingUrl) {
                        const { error: updateEpError } = await supabase
                            .from('episodes')
                            .update({ streaming_url: ep.streamingUrl })
                            .eq('id', episodeId);
                        if (updateEpError) {
                            console.warn(`[Cron Auto-Match] Failed to save streaming_url for episode ${ep.number}:`, updateEpError);
                        }
                    }

                    importedDubCount++;
                }

                // 7. Update Movie schedule and metadata (only DUB episodes affect count & schedule)
                const currentLastEpisode = movie.last_episode || 0;
                let finalLastEpisode = currentLastEpisode;
                let finalNextEpisode = movie.next_episode || (currentLastEpisode + 1);
                let nextEpisodeDateStr = movie.next_episode_date;

                if (newDubEpisodes.length > 0) {
                    const newMaxEpNum = Math.max(...newDubEpisodes.map(e => e.number));
                    finalLastEpisode = Math.max(currentLastEpisode, newMaxEpNum);
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

                // 8. Upsert to updates table (only for DUB releases)
                if (newDubEpisodes.length > 0) {
                    try {
                        await supabase.from('updates').upsert({
                            content_id: movie.id,
                            title: movie.title,
                            poster_url: movie.poster_url,
                            slug: '/' + movie.type + '/' + movie.slug,
                            content_type: movie.type,
                            update_type: 'episode',
                            season_number: scraperSeason,
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
                    importedCount: importedDubCount,
                    pendingSubCount: importedSubCount,
                    lastEpisode: finalLastEpisode,
                    nextEpisodeDate: nextEpisodeDateStr,
                });

            } else {
                // No new episodes found. If due/overdue, reschedule daily (tomorrow)
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
                    });
                } else {
                    results.push({
                        id: movie.id,
                        title: movie.title,
                        status: 'no_updates_found',
                        message: 'No new episodes found, but show is not due yet.',
                    });
                }
            }

        } catch (movieErr: any) {
            console.error(`Error processing auto-checker for "${movieTitle}":`, movieErr);
            results.push({
                id: movieId,
                title: movieTitle,
                status: 'error',
                error: movieErr.message || JSON.stringify(movieErr),
            });
        }
    }

    return results;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const movieId = searchParams.get('movieId') || undefined;
        
        const results = await handleCheckEpisodes(movieId);
        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        let movieId: string | undefined;
        
        try {
            const body = await request.json();
            movieId = body.movieId || undefined;
        } catch {
            // No body or invalid JSON is fine, runs all
        }

        const results = await handleCheckEpisodes(movieId);
        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        console.error('Cron job failed:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
