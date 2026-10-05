import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { isScraperSource, normalizeSearchResults, scraperSourceLabels } from '@/lib/agent-import';
import { searchWordPressSite } from '@/lib/scraper-utils';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        const query = typeof body?.query === 'string' ? body.query.trim() : '';
        const source = body?.source;
        if (query.length < 2) return jsonError('Search query must contain at least 2 characters');
        if (query.length > 120) return jsonError('Search query is too long');
        if (!isScraperSource(source)) return jsonError('Invalid scraper source');

        const { data: settings, error: settingsError } = await getAdminSupabase()
            .from('app_settings')
            .select('rareanimes_url, bollyflix_url, movielink_url')
            .eq('id', 1)
            .single();
        if (settingsError) {
            console.error('Failed to fetch scraper domains:', settingsError);
            return jsonError('Failed to fetch scraper domains', 500);
        }

        const baseUrl = source === 'rareanimes'
            ? settings.rareanimes_url || 'https://rareanimes.ski'
            : source === 'bollyflix'
                ? settings.bollyflix_url || 'https://bollyflix.free'
                : settings.movielink_url || 'https://movielinkbd.li';
        try {
            new URL(baseUrl);
        } catch {
            return jsonError(`Invalid configuration URL for ${scraperSourceLabels[source]}`, 500);
        }

        const rawResults = await searchWordPressSite(baseUrl, query);
        const results = normalizeSearchResults(rawResults).map((result) => ({
            ...result,
            source,
            source_label: scraperSourceLabels[source],
        }));

        return NextResponse.json({
            success: true,
            results,
            meta: { source, source_label: scraperSourceLabels[source], count: results.length },
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Agent search error:', error);
        return jsonError(error instanceof Error ? error.message : 'Search failed', 500);
    }
}
