import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Helper function to normalize strings for comparison
function normalizeString(str: string): string {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '') // remove special characters
        .replace(/\s+/g, ' ')        // collapse multiple spaces
        .trim();
}

// Calculate title similarity score (0 to 1)
function calculateSimilarity(title1: string, title2: string): number {
    const t1 = normalizeString(title1);
    const t2 = normalizeString(title2);
    
    if (t1 === t2) return 1.0;
    if (t1.includes(t2) || t2.includes(t1)) {
        // Higher score if it starts with the other
        if (t1.startsWith(t2) || t2.startsWith(t1)) return 0.85;
        return 0.75;
    }
    
    // Word overlap ratio
    const words1 = t1.split(' ').filter(w => w.length > 2);
    const words2 = t2.split(' ').filter(w => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(w => words2.includes(w));
    return intersection.length / Math.max(words1.length, words2.length);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            movieId, 
            title, 
            type, 
            releaseYear, 
            tmdbApiKey: clientApiKey,
            tmdbId,
            malId,
            imdbId,
            streamingUrl
        } = body;

        if (!movieId || !title || !type) {
            return NextResponse.json(
                { error: 'movieId, title, and type are required' },
                { status: 400 }
            );
        }

        // 1. Resolve TMDB API key: prioritize client key, fallback to server env
        const tmdbApiKey = clientApiKey || process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;

        const updates: {
            tmdb_id: string | null;
            imdb_id: string | null;
            mal_id: string | null;
            streaming_url: string | null;
            updated_at: string;
        } = {
            tmdb_id: tmdbId !== undefined ? (tmdbId || null) : null,
            imdb_id: imdbId !== undefined ? (imdbId || null) : null,
            mal_id: malId !== undefined ? (malId || null) : null,
            streaming_url: streamingUrl !== undefined ? (streamingUrl || null) : null,
            updated_at: new Date().toISOString()
        };

        const logs: string[] = [];
        let matchedTitle = '';
        let matchedYear = '';

        // 2. Perform MAL (Jikan) search if anime and malId is not passed
        if (type === 'anime' && malId === undefined) {
            try {
                logs.push('Searching MyAnimeList (Jikan API)...');
                const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=5`;
                const jikanRes = await fetch(jikanUrl);
                if (jikanRes.ok) {
                    const jikanData = await jikanRes.json();
                    const results = jikanData.data || [];
                    
                    let bestMatch: any = null;
                    let highestScore = 0;

                    for (const item of results) {
                        const itemTitle = item.title;
                        const itemEnglishTitle = item.title_english;
                        
                        let score = calculateSimilarity(title, itemTitle);
                        if (itemEnglishTitle) {
                            const engScore = calculateSimilarity(title, itemEnglishTitle);
                            if (engScore > score) score = engScore;
                        }

                        // Boost score if release year matches
                        const itemYear = item.aired?.prop?.from?.year;
                        if (releaseYear && itemYear && parseInt(itemYear) === parseInt(releaseYear)) {
                            score += 0.15;
                        }

                        if (score > highestScore && score >= 0.5) {
                            highestScore = score;
                            bestMatch = item;
                        }
                    }

                    if (bestMatch) {
                        updates.mal_id = String(bestMatch.mal_id);
                        logs.push(`Matched MAL ID: ${bestMatch.mal_id} (${bestMatch.title}) with score ${highestScore.toFixed(2)}`);
                    } else {
                        logs.push('No suitable MAL match found above threshold (0.50)');
                    }
                } else {
                    logs.push(`Jikan API responded with status ${jikanRes.status}`);
                }
            } catch (err: any) {
                logs.push(`Error during MAL search: ${err.message}`);
            }
        }

        // 3. Perform TMDB search if API Key is available and tmdbId is not passed
        if (tmdbApiKey && tmdbId === undefined) {
            try {
                logs.push('Searching TMDB API...');
                let searchUrl = '';
                
                if (type === 'movie') {
                    searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`;
                } else if (type === 'series') {
                    searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`;
                } else {
                    // anime can be movie or tv show, use multi search
                    searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${tmdbApiKey}&query=${encodeURIComponent(title)}`;
                }

                if (releaseYear && type !== 'anime') {
                    const yearParam = type === 'movie' ? 'primary_release_year' : 'first_air_date_year';
                    searchUrl += `&${yearParam}=${releaseYear}`;
                }

                const tmdbRes = await fetch(searchUrl);
                if (tmdbRes.ok) {
                    const tmdbData = await tmdbRes.json();
                    let results = tmdbData.results || [];
                    
                    // Filter multi search results for movies/tv shows only
                    if (type === 'anime') {
                        results = results.filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
                    }

                    let bestMatch: any = null;
                    let highestScore = 0;

                    for (const item of results) {
                        const itemTitle = item.title || item.name;
                        const originalTitle = item.original_title || item.original_name;
                        
                        let score = calculateSimilarity(title, itemTitle);
                        if (originalTitle) {
                            const origScore = calculateSimilarity(title, originalTitle);
                            if (origScore > score) score = origScore;
                        }

                        // Boost score if release year matches
                        const itemDate = item.release_date || item.first_air_date || '';
                        const itemYear = itemDate.split('-')[0];
                        if (releaseYear && itemYear && parseInt(itemYear) === parseInt(releaseYear)) {
                            score += 0.15;
                        }

                        if (score > highestScore && score >= 0.5) {
                            highestScore = score;
                            bestMatch = item;
                        }
                    }

                    if (bestMatch) {
                        const tmdbIdMatch = bestMatch.id;
                        updates.tmdb_id = String(tmdbIdMatch);
                        matchedTitle = bestMatch.title || bestMatch.name;
                        matchedYear = (bestMatch.release_date || bestMatch.first_air_date || '').split('-')[0] || '';
                        logs.push(`Matched TMDB ID: ${tmdbIdMatch} (${matchedTitle}) with score ${highestScore.toFixed(2)}`);

                        // Determine media type for detail lookup
                        let mediaType = type === 'movie' ? 'movie' : 'tv';
                        if (type === 'anime') {
                            mediaType = bestMatch.media_type || 'tv';
                        }

                        // Fetch External IDs (IMDb ID)
                        logs.push(`Fetching external IDs for TMDB ID ${tmdbIdMatch}...`);
                        const extUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbIdMatch}/external_ids?api_key=${tmdbApiKey}`;
                        const extRes = await fetch(extUrl);
                        if (extRes.ok) {
                            const extData = await extRes.json();
                            if (extData.imdb_id) {
                                updates.imdb_id = extData.imdb_id;
                                logs.push(`Matched IMDb ID: ${extData.imdb_id}`);
                            } else {
                                logs.push('No IMDb ID found in external IDs.');
                            }
                        } else {
                            logs.push(`External IDs fetch responded with status ${extRes.status}`);
                        }
                    } else {
                        logs.push('No suitable TMDB match found above threshold (0.50)');
                    }
                } else {
                    logs.push(`TMDB API responded with status ${tmdbRes.status}`);
                }
            } catch (err: any) {
                logs.push(`Error during TMDB search: ${err.message}`);
            }
        }

        // If tmdbId is passed but imdbId is not, fetch the external ID from TMDB
        if (tmdbId !== undefined && tmdbId && (imdbId === undefined || !imdbId) && tmdbApiKey) {
            try {
                logs.push(`Fetching external IDs for manually provided TMDB ID ${tmdbId}...`);
                const mediaType = type === 'movie' ? 'movie' : 'tv';
                const extUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
                const extRes = await fetch(extUrl);
                if (extRes.ok) {
                    const extData = await extRes.json();
                    if (extData.imdb_id) {
                        updates.imdb_id = extData.imdb_id;
                        logs.push(`Matched IMDb ID: ${extData.imdb_id}`);
                    }
                }
            } catch (err: any) {
                logs.push(`Error fetching external IDs: ${err.message}`);
            }
        }

        const hasInputFields = tmdbId !== undefined || malId !== undefined || imdbId !== undefined || streamingUrl !== undefined;

        // 4. Update the DB only if we found any ID or received direct fields
        if (hasInputFields || updates.tmdb_id || updates.mal_id || updates.imdb_id) {
            // Retrieve current movie record to avoid overwriting existing non-null fields with null
            const { data: currentMovie, error: fetchErr } = await supabase
                .from('movies')
                .select('tmdb_id, imdb_id, mal_id, animerulz_url, animerulz_season, animerulz_resolution, toonplay_url, toonplay_season, toonplay_resolution, is_running, streaming_url')
                .eq('id', movieId)
                .single();

            if (fetchErr) {
                return NextResponse.json({ error: `Failed to fetch current content: ${fetchErr.message}` }, { status: 500 });
            }

            const cleanVal = (val: any) => (val === '' ? null : val);
            const dbPayload: any = {
                updated_at: updates.updated_at
            };

            // Only overwrite if we matched a valid value, otherwise preserve existing
            dbPayload.tmdb_id = tmdbId !== undefined ? cleanVal(tmdbId) : (updates.tmdb_id || currentMovie.tmdb_id);
            dbPayload.imdb_id = imdbId !== undefined ? cleanVal(imdbId) : (updates.imdb_id || currentMovie.imdb_id);
            dbPayload.mal_id = malId !== undefined ? cleanVal(malId) : (updates.mal_id || currentMovie.mal_id);
            dbPayload.streaming_url = streamingUrl !== undefined ? cleanVal(streamingUrl) : currentMovie.streaming_url;

            // Auto-configure Animerulz scraper for anime if mal_id is present and has changed or scraper is empty
            const finalMalId = dbPayload.mal_id;
            if (type === 'anime' && finalMalId) {
                if (!currentMovie.animerulz_url || currentMovie.mal_id !== finalMalId) {
                    try {
                        logs.push(`Querying AniList for MAL ID ${finalMalId}...`);
                        const response = await fetch('https://graphql.anilist.co', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                            },
                            body: JSON.stringify({
                                query: `
                                    query ($idMal: Int) {
                                        Media (idMal: $idMal, type: ANIME) {
                                            id
                                        }
                                    }
                                `,
                                variables: {
                                    idMal: parseInt(finalMalId)
                                }
                            })
                        });
                        if (response.ok) {
                            const data = await response.json();
                            const anilistId = data?.data?.Media?.id;
                            if (anilistId) {
                                dbPayload.animerulz_url = String(anilistId);
                                dbPayload.animerulz_season = currentMovie.animerulz_season || 1;
                                dbPayload.animerulz_resolution = currentMovie.animerulz_resolution || '720p';
                                logs.push(`Auto-configured Animerulz scraper with AniList ID: ${anilistId}`);
                            }
                        } else {
                            logs.push(`AniList API query failed: ${response.status}`);
                        }
                    } catch (anilistErr: any) {
                        logs.push(`AniList matching error: ${anilistErr.message}`);
                    }
                }
            } else if (malId !== undefined && !finalMalId) {
                // If mal_id is explicitly set to null/cleared, turn off animerulz scraper
                dbPayload.animerulz_url = null;
            }

            // Always try matching with ToonPlay (AnimeSalt) if it's an anime and not currently configured
            if (type === 'anime' && !currentMovie.toonplay_url && !dbPayload.toonplay_url) {
                try {
                    logs.push(`Searching ToonPlay (AnimeSalt) API for "${title}"...`);
                    const searchRes = await fetch(`https://animesalt.streamindia.co.in/api/search?q=${encodeURIComponent(title)}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                            'Referer': 'https://toonplay.in/',
                            'Origin': 'https://toonplay.in'
                        }
                    });
                    if (searchRes.ok) {
                        const searchData = await searchRes.json() as any;
                        const results = searchData.data || [];
                        
                        let bestMatch: any = null;
                        let highestScore = 0;

                        for (const item of results) {
                            const itemTitle = item.title;
                            const score = calculateSimilarity(title, itemTitle);
                            if (score > highestScore && score >= 0.70) {
                                highestScore = score;
                                bestMatch = item;
                            }
                        }

                        if (bestMatch) {
                            dbPayload.toonplay_url = bestMatch.id;
                            dbPayload.toonplay_season = currentMovie.toonplay_season || 1;
                            dbPayload.toonplay_resolution = currentMovie.toonplay_resolution || '720p';
                            logs.push(`Auto-configured ToonPlay scraper with ID: ${bestMatch.id} (${bestMatch.title})`);
                        } else {
                            logs.push('No suitable ToonPlay match found above threshold (0.70)');
                        }
                    } else {
                        logs.push(`ToonPlay search API failed with status ${searchRes.status}`);
                    }
                } catch (err: any) {
                    logs.push(`Error during ToonPlay search: ${err.message}`);
                }
            }

            // Determine if either scraper is active, set is_running accordingly
            const activeAnimerulz = dbPayload.animerulz_url !== undefined ? dbPayload.animerulz_url : currentMovie.animerulz_url;
            const activeToonplay = dbPayload.toonplay_url !== undefined ? dbPayload.toonplay_url : currentMovie.toonplay_url;
            dbPayload.is_running = !!(activeAnimerulz || activeToonplay);

            const { error: updateErr } = await supabase
                .from('movies')
                .update(dbPayload)
                .eq('id', movieId);

            if (updateErr) {
                return NextResponse.json(
                    { error: `Database update failed: ${updateErr.message}`, logs },
                    { status: 500 }
                );
            }

            // Trigger episode scraper immediately if any scraper is configured
            if (activeAnimerulz || activeToonplay) {
                try {
                    logs.push(`Triggering scraper immediately...`);
                    const protocol = request.url.startsWith('https') ? 'https' : 'http';
                    const host = request.headers.get('host') || 'localhost:3000';
                    const checkUrl = `${protocol}://${host}/api/cron/check-episodes`;
                    
                    logs.push(`Calling scraper API: ${checkUrl}`);
                    const scraperRes = await fetch(checkUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ movieId })
                    });
                    
                    if (scraperRes.ok) {
                        const scraperData = await scraperRes.json();
                        logs.push(`Scraper completed successfully: ${JSON.stringify(scraperData)}`);
                    } else {
                        logs.push(`Scraper API returned error status: ${scraperRes.status}`);
                    }
                } catch (scrapeErr: any) {
                    logs.push(`Failed to trigger scraper: ${scrapeErr.message}`);
                }
            }

            return NextResponse.json({
                success: true,
                message: 'Auto-matching completed and saved',
                matched: {
                    title: matchedTitle || title,
                    year: matchedYear || releaseYear,
                    tmdb_id: dbPayload.tmdb_id,
                    imdb_id: dbPayload.imdb_id,
                    mal_id: dbPayload.mal_id,
                    streaming_url: dbPayload.streaming_url,
                    animerulz_url: activeAnimerulz,
                    animerulz_season: dbPayload.animerulz_season !== undefined ? dbPayload.animerulz_season : currentMovie.animerulz_season,
                    animerulz_resolution: dbPayload.animerulz_resolution !== undefined ? dbPayload.animerulz_resolution : currentMovie.animerulz_resolution,
                    toonplay_url: activeToonplay,
                    toonplay_season: dbPayload.toonplay_season !== undefined ? dbPayload.toonplay_season : currentMovie.toonplay_season,
                    toonplay_resolution: dbPayload.toonplay_resolution !== undefined ? dbPayload.toonplay_resolution : currentMovie.toonplay_resolution,
                    is_running: dbPayload.is_running
                },
                logs
            });
        }

        return NextResponse.json({
            success: false,
            message: 'No IDs could be matched for this content',
            logs
        });

    } catch (error: any) {
        console.error('Auto-match API error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
