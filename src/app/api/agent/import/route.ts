import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { extractPageMetadata, assertHttpUrl, isImportType, isScraperSource, normalizeScrapedData, type ImportType } from '@/lib/agent-import';
import { scrapeSource } from '@/lib/scraper-utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function jsonError(message: string, status = 400, details?: Record<string, unknown>) {
    return NextResponse.json({ success: false, error: message, ...details }, { status });
}

export async function POST(request: NextRequest) {
    const startedAt = Date.now();
    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return jsonError('A valid JSON request body is required');
        }

        const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
        if (!requestId) return jsonError('Request ID is required');

        let url: string;
        try {
            url = assertHttpUrl(body.url, 'URL');
        } catch (error) {
            return jsonError(error instanceof Error ? error.message : 'Invalid URL');
        }

        const source = body.source;
        if (!isScraperSource(source)) return jsonError('Invalid scraper source');

        const selectedType: ImportType = body.type === undefined || body.type === null || body.type === ''
            ? 'auto'
            : isImportType(body.type)
                ? body.type
                : (() => { throw new Error('Invalid content type. Use auto, movie, series, or anime.'); })();

        const scrapedResult = await scrapeSource(url, source);
        const metadata = await extractPageMetadata(url);
        const scrapedData = normalizeScrapedData({
            url,
            source,
            selectedType,
            result: scrapedResult,
            metadata,
        });

        const supabase = getAdminSupabase();
        const { data: updatedRequest, error: updateError } = await supabase
            .from('content_requests')
            .update({
                status: 'review',
                scraper_source: source,
                source_url: url,
                scraped_data: scrapedData,
            })
            .eq('id', requestId)
            .select('id,status,content_name,scraper_source,source_url,scraped_data')
            .maybeSingle();

        if (updateError) throw updateError;
        if (!updatedRequest) {
            return jsonError('Request was not found or could not be updated', 404);
        }

        return NextResponse.json({
            success: true,
            data: scrapedData,
            request: updatedRequest,
            meta: {
                selected_type: selectedType,
                detected_type: scrapedData.type,
                source,
                duration_ms: Date.now() - startedAt,
                warnings: scrapedData.import_meta.warnings,
            },
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Agent import error:', error);
        const message = error instanceof Error ? error.message : 'Unexpected import failure';
        return jsonError(message, 500, { code: 'AGENT_IMPORT_FAILED' });
    }
}
