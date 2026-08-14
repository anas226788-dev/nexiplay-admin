import type { ScrapedEpisode, ScrapedResult } from '@/lib/scraper-utils';

export type ContentType = 'movie' | 'series' | 'anime';
export type ImportType = ContentType | 'auto';
export type ScraperSource = 'rareanimes' | 'bollyflix' | 'movielink';

export interface AgentPageMetadata {
    title?: string;
    description?: string;
    posterUrl?: string;
}

export interface NormalizedScrapedData {
    title: string;
    original_title: string;
    type: ContentType;
    release_year: number;
    poster_url: string | null;
    description: string;
    source_url: string;
    scraper_source: ScraperSource;
    scraper_resolution: string;
    downloads: Array<{
        quality: string;
        fileSize: string;
        fileUrl: string;
    }>;
    seasons: Array<{
        season_number: number;
        episodes: Array<{
            episode_number: number;
            episode_title: string;
            download_links: Array<{
                resolution: string;
                file_size: string;
                mega_link?: string;
                gdrive_link?: string;
            }>;
        }>;
    }>;
    import_meta: {
        version: 2;
        imported_at: string;
        warnings: string[];
        episodes_found: number;
        links_found: number;
    };
}

const VALID_TYPES: readonly ContentType[] = ['movie', 'series', 'anime'];
const VALID_SOURCES: readonly ScraperSource[] = ['rareanimes', 'bollyflix', 'movielink'];
const FALLBACK_YEAR = new Date().getFullYear();

export function isContentType(value: unknown): value is ContentType {
    return typeof value === 'string' && VALID_TYPES.includes(value as ContentType);
}

export function isScraperSource(value: unknown): value is ScraperSource {
    return typeof value === 'string' && VALID_SOURCES.includes(value as ScraperSource);
}

export function isImportType(value: unknown): value is ImportType {
    return value === 'auto' || isContentType(value);
}

export function assertHttpUrl(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${label} is required`);
    }
    let parsed: URL;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error(`${label} must be a valid URL`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`${label} must use http or https`);
    }
    return parsed.toString();
}

function cleanText(value: string): string {
    return value
        .replace(/\s+/g, ' ')
        .replace(/[|•·]+/g, ' ')
        .trim();
}

function extractYear(text: string): number {
    const match = text.match(/\b(19[89]\d|20[0-2]\d|2030)\b/);
    return match ? Number(match[1]) : FALLBACK_YEAR;
}

function stripTitleNoise(title: string): string {
    const cleaned = cleanText(title)
        .replace(/\b(19[89]\d|20[0-2]\d|2030)\b/g, ' ')
        .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, ' ')
        .replace(/\b(download|watch|online|dual|audio|hindi|english|multi|subs?|dubbed?)\b/gi, ' ')
        .replace(/\b(480p|720p|1080p|2160p|4k)\b/gi, ' ');
    return cleanText(cleaned) || cleanText(title) || 'Unknown Title';
}

function detectQuality(text: string, fallback: string): string {
    const match = text.match(/\b(360p|480p|720p|1080p|2160p|4k)\b/i);
    if (!match) return fallback || '720p';
    return match[1].toLowerCase() === '4k' ? '2160p' : match[1].toLowerCase();
}

function extractFileSize(text: string): string {
    return text.match(/\b\d+(?:\.\d+)?\s*(?:MB|GB|TB)\b/i)?.[0] || '';
}

function parseEpisodeIdentity(episode: ScrapedEpisode, fallbackIndex: number) {
    const text = episode.title || '';
    const seasonEpisode = text.match(/\bS(?:eason\s*)?(\d{1,2})\s*[-_. ]*E(?:pisode\s*)?(\d{1,4})\b/i);
    const seasonWord = text.match(/\bSeason\s*(\d{1,2})\b/i);
    const episodeWord = text.match(/\b(?:Episode|Ep\.?|EP)\s*[-_. ]*(\d{1,4})\b/i);
    const season = episode.season ?? (seasonEpisode ? Number(seasonEpisode[1]) : seasonWord ? Number(seasonWord[1]) : 1);
    const number = Number.isFinite(episode.number) && episode.number > 0
        ? episode.number
        : seasonEpisode
            ? Number(seasonEpisode[2])
            : episodeWord
                ? Number(episodeWord[1])
                : fallbackIndex + 1;
    const title = cleanText(
        text
            .replace(/\bS(?:eason\s*)?\d{1,2}\s*[-_. ]*E(?:pisode\s*)?\d{1,4}\b/i, '')
            .replace(/\bSeason\s*\d{1,2}\b/i, '')
            .replace(/\b(?:Episode|Ep\.?|EP)\s*[-_. ]*\d{1,4}\b/i, '')
            .replace(/\b(360p|480p|720p|1080p|2160p|4k)\b/gi, '')
    );
    return { season: Math.max(1, season || 1), number: Math.max(1, number || fallbackIndex + 1), title };
}

function hostLinks(url: string) {
    const lower = url.toLowerCase();
    return {
        mega_link: lower.includes('mega.nz') ? url : undefined,
        gdrive_link: lower.includes('drive.google.com') || lower.includes('gdrive') ? url : undefined,
    };
}

function inferType(source: ScraperSource, selectedType: ImportType, pageTitle: string, episodes: ScrapedEpisode[]): ContentType {
    if (selectedType !== 'auto') return selectedType;
    if (source === 'rareanimes') return 'anime';
    if (/\b(movie|film)\b/i.test(pageTitle) && episodes.length <= 1) return 'movie';
    if (/\b(season|series|episode|episode\s*\d+|s\d+e?\d*)\b/i.test(pageTitle) || episodes.length > 1) return 'series';
    return 'movie';
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        const identity = key(item);
        if (!identity || seen.has(identity)) return false;
        seen.add(identity);
        return true;
    });
}

function getImportEpisodes(result: ScrapedResult): ScrapedEpisode[] {
    return result.episodes.length > 0
        ? result.episodes
        : (result.pendingSubEpisodes || []);
}
function buildMovieDownloads(result: ScrapedResult): NormalizedScrapedData['downloads'] {
    const fallbackQuality = result.resolution || '720p';
    const candidates = getImportEpisodes(result)
        .filter((episode) => typeof episode.link === 'string' && episode.link.trim())
        .map((episode) => ({
            quality: detectQuality(episode.title, fallbackQuality),
            fileSize: extractFileSize(episode.title),
            fileUrl: episode.link.trim(),
        }));
    if (result.seasonZipLink) {
        candidates.push({
            quality: fallbackQuality,
            fileSize: '',
            fileUrl: result.seasonZipLink,
        });
    }
    return uniqueBy(candidates, (item) => `${item.quality}|${item.fileUrl}`);
}

function buildSeasons(result: ScrapedResult): NormalizedScrapedData['seasons'] {
    const seasons = new Map<number, Map<number, NormalizedScrapedData['seasons'][number]['episodes'][number]>>();
    getImportEpisodes(result).forEach((episode, index) => {
        if (!episode.link?.trim()) return;
        const identity = parseEpisodeIdentity(episode, index);
        const season = seasons.get(identity.season) || new Map();
        const existing = season.get(identity.number);
        const resolution = detectQuality(episode.title, result.resolution || '720p');
        const link = hostLinks(episode.link.trim());
        const download = {
            resolution,
            file_size: extractFileSize(episode.title),
            ...(link.mega_link ? { mega_link: link.mega_link } : {}),
            ...(link.gdrive_link ? { gdrive_link: link.gdrive_link } : {}),
            ...(!link.mega_link && !link.gdrive_link ? { mega_link: episode.link.trim() } : {}),
        };
        if (existing) {
            existing.download_links = uniqueBy(
                [...existing.download_links, download],
                (item) => `${item.resolution}|${item.mega_link || ''}|${item.gdrive_link || ''}`
            );
        } else {
            season.set(identity.number, {
                episode_number: identity.number,
                episode_title: identity.title || `Episode ${identity.number}`,
                download_links: [download],
            });
        }
        seasons.set(identity.season, season);
    });
    return Array.from(seasons.entries())
        .sort(([a], [b]) => a - b)
        .map(([seasonNumber, episodes]) => ({
            season_number: seasonNumber,
            episodes: Array.from(episodes.values()).sort((a, b) => a.episode_number - b.episode_number),
        }));
}

export function normalizeScrapedData(params: {
    url: string;
    source: ScraperSource;
    selectedType: ImportType;
    result: ScrapedResult;
    metadata?: AgentPageMetadata;
}): NormalizedScrapedData {
    const pageTitle = cleanText(params.metadata?.title || params.result.pageTitle || 'Unknown Title');
    const importEpisodes = getImportEpisodes(params.result);
    const type = inferType(params.source, params.selectedType, pageTitle, importEpisodes);
    const downloads = type === 'movie' ? buildMovieDownloads(params.result) : [];
    const seasons = type === 'movie' ? [] : buildSeasons(params.result);
    const warnings = [
        ...(params.result.warnings || []),
        ...(type === 'movie' && downloads.length === 0 ? ['No movie download links were detected.'] : []),
        ...(type !== 'movie' && seasons.length === 0 ? ['No episodes were detected.'] : []),
    ];
    const linksFound = downloads.length + seasons.reduce((total, season) => total + season.episodes.reduce((count, episode) => count + episode.download_links.length, 0), 0);
    return {
        title: stripTitleNoise(pageTitle),
        original_title: pageTitle,
        type,
        release_year: extractYear(pageTitle),
        poster_url: params.metadata?.posterUrl || null,
        description: params.metadata?.description || '',
        source_url: params.url,
        scraper_source: params.source,
        scraper_resolution: params.result.resolution || '720p',
        downloads,
        seasons,
        import_meta: {
            version: 2,
            imported_at: new Date().toISOString(),
            warnings,
            episodes_found: importEpisodes.length,
            links_found: linksFound,
        },
    };
}

export async function extractPageMetadata(url: string): Promise<AgentPageMetadata> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'NexiPlay-Agent/2.0 (+admin importer)' },
            cache: 'no-store',
        });
        if (!response.ok) return {};
        const html = await response.text();
        const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
            ?.replace(/<[^>]+>/g, '')
            .replace(/&amp;/gi, '&')
            .trim();
        const description = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]
            || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1];
        const posterUrl = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
            || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1];
        return { title, description, posterUrl };
    } catch {
        return {};
    } finally {
        clearTimeout(timer);
    }
}

export function normalizeSearchResults(results: Array<{ title?: string; url?: string }>) {
    return uniqueBy(
        results
            .filter((result) => typeof result.url === 'string' && /^https?:\/\//i.test(result.url))
            .map((result) => ({ title: cleanText(result.title || 'Untitled result'), url: result.url!.trim() })),
        (result) => result.url.toLowerCase()
    ).slice(0, 30);
}

export const scraperSourceLabels: Record<ScraperSource, string> = {
    rareanimes: 'RareAnimes',
    bollyflix: 'BollyFlix',
    movielink: 'MovieLinkBD',
};
