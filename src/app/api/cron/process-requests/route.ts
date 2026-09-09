import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { normalizeTitle, selectBestCandidate, extractYear } from '@/lib/title-matcher';
import { enrichMetadata, mapGenresToCategories } from '@/lib/metadata-enrichment';
import { checkDuplicate } from '@/lib/duplicate-detector';
import { isScraperSource, normalizeScrapedData, normalizeSearchResults, type ScraperSource } from '@/lib/agent-import';
import { scrapeSource, searchWordPressSite } from '@/lib/scraper-utils';
import { extractPageMetadata } from '@/lib/agent-import';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Maximum requests to process per cron invocation */
const BATCH_SIZE = 3;
/** Max attempts before marking as skipped */
const MAX_ATTEMPTS = 5;
/** Minimum confidence to auto-import */
const MIN_CONFIDENCE = 0.50;
/** Source priority order */
const SOURCE_PRIORITY: ScraperSource[] = ['bollyflix', 'rareanimes'];

interface AutomationLogEntry {
    timestamp: string;
    attempt: number;
    action: string;
    result: string;
    details?: Record<string, unknown>;
}

function logEntry(attempt: number, action: string, result: string, details?: Record<string, unknown>): AutomationLogEntry {
    return { timestamp: new Date().toISOString(), attempt, action, result, details };
}

/** Backoff check: should we skip this request based on attempt count and last processing time? */
function shouldSkipForBackoff(attempts: number, lastProcessingAt: string | null): boolean {
    if (!lastProcessingAt || attempts <= 1) return false;
    const elapsed = Date.now() - new Date(lastProcessingAt).getTime();
    const backoffMs = [0, 0, 30 * 60000, 60 * 60000, 120 * 60000][Math.min(attempts, 4)];
    return elapsed < backoffMs;
}

export async function GET(request: NextRequest) {
    // Verify cron secret (Vercel injects this for cron jobs)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startedAt = Date.now();
    const supabase = getAdminSupabase();
    const results: { id: string; name: string; outcome: string }[] = [];

    try {
        // 1. Fetch pending requests that need processing
        const { data: pendingRequests, error: fetchError } = await supabase
            .from('content_requests')
            .select('*')
            .eq('status', 'pending')
            .in('processing_status', ['idle', 'failed'])
            .lt('processing_attempts', MAX_ATTEMPTS)
            .order('created_at', { ascending: true })
            .limit(BATCH_SIZE * 2); // Fetch extra to account for backoff skips

        if (fetchError) throw fetchError;
        if (!pendingRequests || pendingRequests.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No pending requests to process',
                processed: 0,
                duration_ms: Date.now() - startedAt,
            });
        }

        // Filter out requests in backoff period
        const eligible = pendingRequests
            .filter(r => !shouldSkipForBackoff(r.processing_attempts || 0, r.last_processing_at))
            .slice(0, BATCH_SIZE);

        if (eligible.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All pending requests are in backoff period',
                processed: 0,
                duration_ms: Date.now() - startedAt,
            });
        }

        // 2. Fetch scraper domain settings
        const { data: settings } = await supabase
            .from('app_settings')
            .select('rareanimes_url, bollyflix_url, movielink_url')
            .eq('id', 1)
            .single();

        const sourceUrls: Record<ScraperSource, string> = {
            bollyflix: settings?.bollyflix_url || 'https://bollyflix.free',
            rareanimes: settings?.rareanimes_url || 'https://rareanimes.mov',
            movielink: settings?.movielink_url || 'https://movielinkbd.li',
        };

        // 3. Fetch categories for genre mapping
        const { data: categories } = await supabase
            .from('categories')
            .select('id, name, slug');

        // 4. Process each request
        for (const req of eligible) {
            const logs: AutomationLogEntry[] = [...(req.automation_log || [])];
            const attempt = (req.processing_attempts || 0) + 1;
            const contentName = req.content_name || 'Unknown';

            try {
                // Lock the request
                await supabase
                    .from('content_requests')
                    .update({
                        processing_status: 'processing',
                        processing_attempts: attempt,
                        last_processing_at: new Date().toISOString(),
                        automation_error: null,
                    })
                    .eq('id', req.id);

                logs.push(logEntry(attempt, 'start', `Processing "${contentName}"`, { batch_position: eligible.indexOf(req) + 1 }));

                // A. Duplicate check first
                const dupResult = await checkDuplicate(supabase, contentName);
                if (dupResult.isDuplicate) {
                    logs.push(logEntry(attempt, 'duplicate_check', 'duplicate_found', {
                        existing_id: dupResult.existingId,
                        existing_title: dupResult.existingTitle,
                        match_type: dupResult.matchType,
                    }));

                    await supabase
                        .from('content_requests')
                        .update({
                            processing_status: 'duplicate',
                            automation_error: `Duplicate: "${dupResult.existingTitle}" already exists (${dupResult.matchType})`,
                            matched_source_url: dupResult.existingSlug ? `/movie/${dupResult.existingSlug}` : null,
                            automation_log: logs,
                        })
                        .eq('id', req.id);

                    results.push({ id: req.id, name: contentName, outcome: 'duplicate' });
                    continue;
                }
                logs.push(logEntry(attempt, 'duplicate_check', 'no_duplicate'));

                // B. Search across sources in priority order
                let bestMatch: { source: ScraperSource; url: string; confidence: number; title: string; reasons: string[] } | null = null;

                for (const source of SOURCE_PRIORITY) {
                    const baseUrl = sourceUrls[source];
                    if (!baseUrl) continue;

                    try {
                        logs.push(logEntry(attempt, `search_${source}`, 'searching', { base_url: baseUrl, query: contentName }));

                        const rawResults = await searchWordPressSite(baseUrl, contentName);
                        const normalized = normalizeSearchResults(rawResults);

                        logs.push(logEntry(attempt, `search_${source}`, `found_${normalized.length}_results`));

                        if (normalized.length === 0) continue;

                        const matchResult = selectBestCandidate(
                            contentName,
                            normalized.map(r => ({ title: r.title, url: r.url, source })),
                            MIN_CONFIDENCE
                        );

                        if (matchResult) {
                            logs.push(logEntry(attempt, `match_${source}`, 'candidate_found', {
                                title: matchResult.candidate.title,
                                confidence: matchResult.confidence,
                                reasons: matchResult.reasons,
                            }));

                            if (!bestMatch || matchResult.confidence > bestMatch.confidence) {
                                bestMatch = {
                                    source,
                                    url: matchResult.candidate.url,
                                    confidence: matchResult.confidence,
                                    title: matchResult.candidate.title,
                                    reasons: matchResult.reasons,
                                };
                            }

                            // If very high confidence, skip other sources
                            if (matchResult.confidence >= 0.85) break;
                        } else {
                            logs.push(logEntry(attempt, `match_${source}`, 'no_match_above_threshold'));
                        }
                    } catch (searchErr) {
                        const errMsg = searchErr instanceof Error ? searchErr.message : String(searchErr);
                        logs.push(logEntry(attempt, `search_${source}`, 'error', { error: errMsg }));
                        console.warn(`[ProcessRequests] Search error for "${contentName}" on ${source}:`, errMsg);
                    }
                }

                // C. No match found
                if (!bestMatch) {
                    logs.push(logEntry(attempt, 'final', 'no_match_found'));
                    await supabase
                        .from('content_requests')
                        .update({
                            processing_status: attempt >= MAX_ATTEMPTS ? 'skipped' : 'no_match',
                            automation_error: 'No matching content found on any source',
                            automation_log: logs,
                        })
                        .eq('id', req.id);

                    results.push({ id: req.id, name: contentName, outcome: 'no_match' });
                    continue;
                }

                // D. Import the best match using existing scrapeSource + normalizeScrapedData
                logs.push(logEntry(attempt, 'import', 'starting', {
                    source: bestMatch.source,
                    url: bestMatch.url,
                    confidence: bestMatch.confidence,
                }));

                let scrapedData;
                try {
                    const scrapedResult = await scrapeSource(bestMatch.url, bestMatch.source);
                    const metadata = await extractPageMetadata(bestMatch.url);
                    scrapedData = normalizeScrapedData({
                        url: bestMatch.url,
                        source: bestMatch.source,
                        selectedType: 'auto',
                        result: scrapedResult,
                        metadata,
                    });
                    logs.push(logEntry(attempt, 'import', 'success', {
                        type: scrapedData.type,
                        downloads: scrapedData.downloads?.length || 0,
                        episodes: scrapedData.import_meta.episodes_found,
                        links: scrapedData.import_meta.links_found,
                    }));
                } catch (importErr) {
                    const errMsg = importErr instanceof Error ? importErr.message : String(importErr);
                    logs.push(logEntry(attempt, 'import', 'error', { error: errMsg }));

                    await supabase
                        .from('content_requests')
                        .update({
                            processing_status: 'failed',
                            automation_error: `Import failed: ${errMsg}`,
                            matched_source: bestMatch.source,
                            matched_source_url: bestMatch.url,
                            confidence_score: bestMatch.confidence,
                            automation_log: logs,
                        })
                        .eq('id', req.id);

                    results.push({ id: req.id, name: contentName, outcome: 'import_failed' });
                    continue;
                }

                // E. Metadata enrichment (TMDB/Jikan)
                let suggestedCategoryIds: string[] = [];
                try {
                    const enriched = await enrichMetadata(
                        scrapedData.title,
                        scrapedData.type,
                        scrapedData.release_year
                    );

                    if (enriched) {
                        logs.push(logEntry(attempt, 'enrichment', 'success', {
                            source: enriched.externalIds?.tmdb_id ? 'tmdb' : 'jikan',
                            genres: enriched.genres,
                            posterFound: !!enriched.posterUrl,
                        }));

                        // Apply enrichment to scraped data
                        if (enriched.description && !scrapedData.description) {
                            scrapedData.description = enriched.description;
                        }
                        if (enriched.posterUrl && !scrapedData.poster_url) {
                            scrapedData.poster_url = enriched.posterUrl;
                        }
                        if (enriched.releaseYear && scrapedData.release_year === new Date().getFullYear()) {
                            scrapedData.release_year = enriched.releaseYear;
                        }

                        // Map genres to categories
                        if (enriched.genres.length > 0 && categories) {
                            suggestedCategoryIds = mapGenresToCategories(enriched.genres, categories);
                            logs.push(logEntry(attempt, 'category_mapping', 'mapped', {
                                genres: enriched.genres,
                                category_ids: suggestedCategoryIds,
                            }));
                        }
                    } else {
                        logs.push(logEntry(attempt, 'enrichment', 'no_results'));
                    }
                } catch (enrichErr) {
                    logs.push(logEntry(attempt, 'enrichment', 'error', {
                        error: enrichErr instanceof Error ? enrichErr.message : String(enrichErr),
                    }));
                    // Non-fatal — continue without enrichment
                }

                // F. Update the request to 'review' status with all data
                await supabase
                    .from('content_requests')
                    .update({
                        status: 'review',
                        processing_status: 'completed',
                        scraper_source: bestMatch.source,
                        source_url: bestMatch.url,
                        scraped_data: scrapedData,
                        matched_source: bestMatch.source,
                        matched_source_url: bestMatch.url,
                        confidence_score: bestMatch.confidence,
                        suggested_categories: suggestedCategoryIds.length > 0 ? suggestedCategoryIds : null,
                        automation_error: null,
                        automation_log: logs,
                    })
                    .eq('id', req.id);

                results.push({ id: req.id, name: contentName, outcome: 'review_ready' });

            } catch (reqErr) {
                const errMsg = reqErr instanceof Error ? reqErr.message : String(reqErr);
                logs.push(logEntry(attempt, 'fatal', 'unexpected_error', { error: errMsg }));

                await supabase
                    .from('content_requests')
                    .update({
                        processing_status: 'failed',
                        automation_error: errMsg,
                        automation_log: logs,
                    })
                    .eq('id', req.id)
                    .then(() => {});

                results.push({ id: req.id, name: contentName, outcome: 'error' });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results,
            duration_ms: Date.now() - startedAt,
        }, { headers: { 'Cache-Control': 'no-store' } });

    } catch (error) {
        console.error('[ProcessRequests] Fatal error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unexpected error',
            duration_ms: Date.now() - startedAt,
        }, { status: 500 });
    }
}
