import { createClient } from '@supabase/supabase-js';

// Environment credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function getAdminClient() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        throw new Error('Supabase credentials not configured');
    }
    return createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

function cleanTitle(t: string): string {
    let clean = t.replace(/\(.*?\)/g, '');
    clean = clean.replace(/Season\s*\d+/gi, '');
    clean = clean.replace(/[^a-zA-Z0-9\s]/g, '');
    return clean.trim().toLowerCase();
}

function extractSeasonNumber(title: string, defaultSeason: number = 1): number {
    const sMatch = title.match(/Season\s*0?(\d+)/i) || title.match(/S0?(\d+)/i);
    if (sMatch) {
        return parseInt(sMatch[1], 10);
    }
    return defaultSeason;
}

export interface SyncToonplayResult {
    success: boolean;
    totalTitlesProcessed: number;
    matchedTitles: string[];
    createdTitles: string[];
    episodesSynced: number;
    errors: string[];
}

export async function syncToonplayDownloads(options: { forceSyncAll?: boolean } = {}): Promise<SyncToonplayResult> {
    const db = getAdminClient();
    const result: SyncToonplayResult = {
        success: true,
        totalTitlesProcessed: 0,
        matchedTitles: [],
        createdTitles: [],
        episodesSynced: 0,
        errors: []
    };

    try {
        console.log('[ToonPlay Sync] Fetching downloads/index.json manifest...');
        const manifestRes = await fetch('https://toonplay.in/downloads/index.json', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            cache: 'no-store'
        });

        if (!manifestRes.ok) {
            throw new Error(`Failed to fetch ToonPlay manifest (Status ${manifestRes.status})`);
        }

        const manifest = await manifestRes.json();
        const seriesList: any[] = Array.isArray(manifest.series) ? manifest.series : [];
        console.log(`[ToonPlay Sync] Found ${seriesList.length} titles in manifest.`);

        for (const seriesItem of seriesList) {
            const slug = seriesItem.slug;
            const meta = seriesItem.meta || {};
            const rawTitle = meta.title || slug;
            const targetSeason = extractSeasonNumber(rawTitle, 1);
            const cleanedSearchTitle = cleanTitle(rawTitle);

            result.totalTitlesProcessed++;

            try {
                // 1. Search for existing movie in database
                let movie: any = null;
                const { data: matchedMovies } = await db
                    .from('movies')
                    .select('id, title, slug, type, poster_url, last_episode')
                    .or(`title.ilike.%${cleanedSearchTitle.split(' ')[0]}%,slug.ilike.%${slug}%`)
                    .limit(10);

                if (matchedMovies && matchedMovies.length > 0) {
                    // Find the best title match
                    movie = matchedMovies.find((m: any) => {
                        const mClean = cleanTitle(m.title);
                        return mClean.includes(cleanedSearchTitle) || cleanedSearchTitle.includes(mClean);
                    }) || matchedMovies[0];
                }

                // If not found, automatically create the anime entry
                if (!movie) {
                    console.log(`[ToonPlay Sync] Anime "${rawTitle}" not in DB. Creating new anime...`);
                    const baseSlug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    const { data: newMovie, error: createMovieErr } = await db
                        .from('movies')
                        .insert({
                            title: rawTitle.replace(/\(Multi Audio\)|\(Dual Audio\)/gi, '').trim(),
                            slug: `${baseSlug}-${new Date().getFullYear()}`,
                            type: 'anime',
                            poster_url: meta.image || null,
                            last_episode: meta.episodeCount || 1,
                            next_episode: (meta.episodeCount || 1) + 1,
                            status: 'ongoing',
                            updated_at: new Date().toISOString()
                        })
                        .select('id, title, slug, type, poster_url, last_episode')
                        .single();

                    if (createMovieErr) {
                        result.errors.push(`Create movie error for ${rawTitle}: ${createMovieErr.message}`);
                        continue;
                    }
                    movie = newMovie;
                    result.createdTitles.push(movie.title);
                } else {
                    result.matchedTitles.push(movie.title);
                }

                // 2. Fetch specific download json for this series
                const seriesJsonUrl = `https://toonplay.in/downloads/${encodeURIComponent(slug)}.json`;
                const seriesRes = await fetch(seriesJsonUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    cache: 'no-store'
                });

                if (!seriesRes.ok) {
                    console.warn(`[ToonPlay Sync] Could not fetch ${seriesJsonUrl} (${seriesRes.status})`);
                    continue;
                }

                const seriesData = await seriesRes.json();
                const epList: any[] = seriesData.page?.episodes || [];

                if (epList.length === 0) continue;

                // 3. Find or create Season
                let seasonId = '';
                const { data: existingSeason } = await db
                    .from('seasons')
                    .select('id')
                    .eq('movie_id', movie.id)
                    .eq('season_number', targetSeason)
                    .maybeSingle();

                if (existingSeason) {
                    seasonId = existingSeason.id;
                } else {
                    const { data: newSeason, error: sErr } = await db
                        .from('seasons')
                        .insert({
                            movie_id: movie.id,
                            season_number: targetSeason,
                            season_title: `Season ${targetSeason}`
                        })
                        .select('id')
                        .single();

                    if (sErr || !newSeason) {
                        result.errors.push(`Create season error for ${movie.title}: ${sErr?.message}`);
                        continue;
                    }
                    seasonId = newSeason.id;
                }

                // 4. Fetch existing episodes for this season
                const { data: existingEpisodes } = await db
                    .from('episodes')
                    .select('id, episode_number')
                    .eq('season_id', seasonId);

                const epMap = new Map<number, string>();
                (existingEpisodes || []).forEach((e: any) => epMap.set(e.episode_number, e.id));

                let maxEp = movie.last_episode || 0;

                // 5. Upsert episodes and their download links
                for (const epItem of epList) {
                    const epNum = epItem.episode;
                    if (!epNum) continue;

                    if (epNum > maxEp) maxEp = epNum;

                    let epId = epMap.get(epNum);
                    if (!epId) {
                        const { data: newEp, error: epErr } = await db
                            .from('episodes')
                            .insert({
                                season_id: seasonId,
                                episode_number: epNum,
                                episode_title: `Episode ${epNum}`
                            })
                            .select('id')
                            .single();

                        if (epErr || !newEp || !(newEp as any).id) {
                            continue;
                        }
                        epId = (newEp as any).id as string;
                        epMap.set(epNum, epId);
                    }

                    if (!epId) continue;

                    // Process qualities: 480p, 720p, 1080p
                    const qualities: any[] = epItem.qualities || [];
                    for (const q of qualities) {
                        const qName = (q.quality || '').toLowerCase();
                        let resolution: '480p' | '720p' | '1080p' = '720p';
                        if (qName.includes('480')) resolution = '480p';
                        else if (qName.includes('1080')) resolution = '1080p';
                        else if (qName.includes('720')) resolution = '720p';

                        const links = q.links || {};
                        const megaLink = links.MEGA || null;
                        const hcloudLink = links.Hcloud || null;
                        const gdfLink = links.GDF || null;
                        const fprsLink = links.Fprs || null;

                        if (!megaLink && !hcloudLink && !gdfLink && !fprsLink) continue;

                        // Upsert into episode_download_links
                        // Check if link exists for this episode & resolution
                        const { data: existingLink } = await db
                            .from('episode_download_links')
                            .select('id')
                            .eq('episode_id', epId)
                            .eq('resolution', resolution)
                            .maybeSingle();

                        const linkPayload = {
                            episode_id: epId,
                            resolution,
                            file_size: q.size || null,
                            mega_link: megaLink,
                            mediafire_link: hcloudLink, // HubCloud mapped to high-speed mirror
                            gdrive_link: gdfLink,
                            terabox_link: fprsLink,
                            language_type: 'dub',
                            approval_status: 'approved'
                        };

                        if (existingLink) {
                            await db
                                .from('episode_download_links')
                                .update(linkPayload)
                                .eq('id', existingLink.id);
                        } else {
                            await db
                                .from('episode_download_links')
                                .insert(linkPayload);
                        }

                        result.episodesSynced++;
                    }
                }

                // 6. Update movie last_episode and updates table if increased
                if (maxEp > (movie.last_episode || 0)) {
                    await db.from('movies').update({
                        last_episode: maxEp,
                        next_episode: maxEp + 1,
                        updated_at: new Date().toISOString()
                    }).eq('id', movie.id);

                    const targetSlug = movie.slug ? `/${movie.type}/${movie.slug}` : `/${movie.type}/${movie.id}`;
                    await db.from('updates').upsert({
                        content_id: movie.id,
                        title: movie.title.trim(),
                        poster_url: movie.poster_url,
                        slug: targetSlug,
                        content_type: movie.type || 'anime',
                        update_type: 'episode',
                        season_number: targetSeason,
                        episode_number: maxEp,
                        is_active: true,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'content_id' });
                }

            } catch (seriesErr: any) {
                result.errors.push(`Error syncing ${rawTitle}: ${seriesErr.message}`);
            }
        }

        console.log(`[ToonPlay Sync] Finished. Synced ${result.episodesSynced} download links across ${result.matchedTitles.length} matched and ${result.createdTitles.length} created anime.`);
        return result;
    } catch (err: any) {
        console.error('[ToonPlay Sync] Fatal error:', err);
        result.success = false;
        result.errors.push(err.message);
        return result;
    }
}
