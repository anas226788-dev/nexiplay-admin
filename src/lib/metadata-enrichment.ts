/**
 * Metadata enrichment via TMDB (movies/series) and Jikan/MAL (anime).
 * Fetches poster, description, year, genres; maps genres to existing categories.
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const JIKAN_BASE = 'https://api.jikan.moe/v4';

export interface EnrichedMetadata {
    title?: string;
    description?: string;
    posterUrl?: string;
    releaseYear?: number;
    genres: string[];
    contentType?: 'movie' | 'series' | 'anime';
    externalIds?: {
        tmdb_id?: string;
        imdb_id?: string;
        mal_id?: string;
    };
}

interface CategoryRow {
    id: string;
    name: string;
    slug: string;
}

/** Try TMDB movie search first, then TV search */
export async function enrichFromTMDB(title: string, year?: number | null): Promise<EnrichedMetadata | null> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        console.warn('[Enrichment] TMDB_API_KEY not set, skipping TMDB enrichment');
        return null;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
        // Try movie first
        const movieResult = await tmdbSearch('movie', title, year, apiKey, controller.signal);
        if (movieResult) return movieResult;

        // Try TV
        const tvResult = await tmdbSearch('tv', title, year, apiKey, controller.signal);
        if (tvResult) return tvResult;

        return null;
    } catch (err) {
        console.warn('[Enrichment] TMDB error:', err instanceof Error ? err.message : err);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

async function tmdbSearch(
    mediaType: 'movie' | 'tv',
    title: string,
    year: number | null | undefined,
    apiKey: string,
    signal: AbortSignal
): Promise<EnrichedMetadata | null> {
    const params = new URLSearchParams({ api_key: apiKey, query: title, language: 'en-US', page: '1' });
    if (year) params.set(mediaType === 'movie' ? 'year' : 'first_air_date_year', String(year));

    const res = await fetch(`${TMDB_BASE}/search/${mediaType}?${params}`, { signal });
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.results;
    if (!results || results.length === 0) return null;

    const best = results[0];
    const genreIds: number[] = best.genre_ids || [];

    // Fetch genre names
    const genreRes = await fetch(`${TMDB_BASE}/genre/${mediaType}/list?api_key=${apiKey}&language=en-US`, { signal });
    const genreData = genreRes.ok ? await genreRes.json() : { genres: [] };
    const genreMap = new Map<number, string>((genreData.genres || []).map((g: any) => [g.id, g.name]));
    const genres = genreIds.map(id => genreMap.get(id)).filter(Boolean) as string[];

    const releaseYear = mediaType === 'movie'
        ? (best.release_date ? parseInt(best.release_date.split('-')[0]) : undefined)
        : (best.first_air_date ? parseInt(best.first_air_date.split('-')[0]) : undefined);

    return {
        title: mediaType === 'movie' ? best.title : best.name,
        description: best.overview || undefined,
        posterUrl: best.poster_path ? `https://image.tmdb.org/t/p/w500${best.poster_path}` : undefined,
        releaseYear,
        genres,
        contentType: mediaType === 'movie' ? 'movie' : 'series',
        externalIds: { tmdb_id: String(best.id) },
    };
}

/** Jikan/MAL enrichment for anime */
export async function enrichFromJikan(title: string): Promise<EnrichedMetadata | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    try {
        const params = new URLSearchParams({ q: title, limit: '3', order_by: 'score', sort: 'desc' });
        const res = await fetch(`${JIKAN_BASE}/anime?${params}`, { signal: controller.signal });
        if (!res.ok) return null;

        const data = await res.json();
        const results = data.data;
        if (!results || results.length === 0) return null;

        const best = results[0];
        const genres = [
            ...(best.genres || []).map((g: any) => g.name),
            ...(best.themes || []).map((g: any) => g.name),
        ];

        return {
            title: best.title_english || best.title,
            description: best.synopsis || undefined,
            posterUrl: best.images?.jpg?.large_image_url || best.images?.jpg?.image_url || undefined,
            releaseYear: best.aired?.prop?.from?.year || undefined,
            genres,
            contentType: 'anime',
            externalIds: { mal_id: String(best.mal_id) },
        };
    } catch (err) {
        console.warn('[Enrichment] Jikan error:', err instanceof Error ? err.message : err);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Attempt enrichment: anime → Jikan first, else → TMDB */
export async function enrichMetadata(
    title: string,
    detectedType?: 'movie' | 'series' | 'anime',
    year?: number | null
): Promise<EnrichedMetadata | null> {
    // For anime, try Jikan first (better anime metadata)
    if (detectedType === 'anime') {
        const jikanResult = await enrichFromJikan(title);
        if (jikanResult) return jikanResult;
    }

    // Try TMDB for everything
    const tmdbResult = await enrichFromTMDB(title, year);
    if (tmdbResult) return tmdbResult;

    // Last resort for anime: try Jikan even if not detected as anime
    if (detectedType !== 'anime') {
        const jikanResult = await enrichFromJikan(title);
        if (jikanResult) return jikanResult;
    }

    return null;
}

/**
 * Map external genre names to existing category IDs.
 * Uses fuzzy matching against the categories table.
 */
export function mapGenresToCategories(
    genres: string[],
    categories: CategoryRow[]
): string[] {
    const GENRE_ALIAS_MAP: Record<string, string[]> = {
        'action': ['action', 'martial arts', 'military'],
        'adventure': ['adventure', 'fantasy adventure'],
        'animation': ['animation', 'cartoon', 'anime'],
        'comedy': ['comedy', 'parody', 'gag humor', 'slice of life'],
        'drama': ['drama', 'psychological', 'tragedy', 'josei', 'seinen', 'shoujo', 'shounen'],
        'horror': ['horror', 'supernatural', 'demons', 'vampire', 'gore', 'thriller'],
        'romance': ['romance', 'love', 'harem', 'reverse harem', 'isekai'],
        'sci-fi': ['sci-fi', 'science fiction', 'sci fi', 'mecha', 'space', 'cyberpunk'],
        'thriller': ['thriller', 'mystery', 'suspense', 'crime', 'detective', 'police'],
    };

    const matched = new Set<string>();

    for (const genre of genres) {
        const genreLower = genre.toLowerCase().trim();
        for (const cat of categories) {
            const catSlug = cat.slug.toLowerCase();
            const aliases = GENRE_ALIAS_MAP[catSlug] || [catSlug, cat.name.toLowerCase()];
            if (aliases.some(alias => genreLower.includes(alias) || alias.includes(genreLower))) {
                matched.add(cat.id);
            }
        }
    }

    // Always include 'Animation' for anime content
    return Array.from(matched);
}
