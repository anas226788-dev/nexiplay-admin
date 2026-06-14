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
        const { movieId, title, type, releaseYear, tmdbApiKey: clientApiKey } = body;

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
            updated_at: string;
        } = {
            tmdb_id: null,
            imdb_id: null,
            mal_id: null,
            updated_at: new Date().toISOString()
        };

        const logs: string[] = [];
        let matchedTitle = '';
        let matchedYear = '';

        // 2. Perform MAL (Jikan) search if anime
        if (type === 'anime') {
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

        // 3. Perform TMDB search if API Key is available
        if (tmdbApiKey) {
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
                        const tmdbId = bestMatch.id;
                        updates.tmdb_id = String(tmdbId);
                        matchedTitle = bestMatch.title || bestMatch.name;
                        matchedYear = (bestMatch.release_date || bestMatch.first_air_date || '').split('-')[0] || '';
                        logs.push(`Matched TMDB ID: ${tmdbId} (${matchedTitle}) with score ${highestScore.toFixed(2)}`);

                        // Determine media type for detail lookup
                        let mediaType = type === 'movie' ? 'movie' : 'tv';
                        if (type === 'anime') {
                            mediaType = bestMatch.media_type || 'tv';
                        }

                        // Fetch External IDs (IMDb ID)
                        logs.push(`Fetching external IDs for TMDB ID ${tmdbId}...`);
                        const extUrl = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${tmdbApiKey}`;
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
        } else {
            logs.push('TMDB API Key missing (not provided by client or server environment)');
        }

        // 4. Update the DB only if we found any ID
        if (updates.tmdb_id || updates.mal_id || updates.imdb_id) {
            // Retrieve current movie record to avoid overwriting existing non-null fields with null
            const { data: currentMovie, error: fetchErr } = await supabase
                .from('movies')
                .select('tmdb_id, imdb_id, mal_id')
                .eq('id', movieId)
                .single();

            if (fetchErr) {
                return NextResponse.json({ error: `Failed to fetch current content: ${fetchErr.message}` }, { status: 500 });
            }

            const dbPayload: any = {
                updated_at: updates.updated_at
            };

            // Only overwrite if we matched a valid value, otherwise preserve existing
            dbPayload.tmdb_id = updates.tmdb_id || currentMovie.tmdb_id;
            dbPayload.imdb_id = updates.imdb_id || currentMovie.imdb_id;
            dbPayload.mal_id = updates.mal_id || currentMovie.mal_id;

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

            return NextResponse.json({
                success: true,
                message: 'Auto-matching completed and saved',
                matched: {
                    title: matchedTitle || title,
                    year: matchedYear || releaseYear,
                    tmdb_id: dbPayload.tmdb_id,
                    imdb_id: dbPayload.imdb_id,
                    mal_id: dbPayload.mal_id
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
