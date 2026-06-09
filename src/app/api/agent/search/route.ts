import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { searchWordPressSite } from '@/lib/scraper-utils';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, source } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }

        if (!source || !['rareanimes', 'bollyflix', 'movielink'].includes(source)) {
            return NextResponse.json({ error: 'Invalid scraper source' }, { status: 400 });
        }

        // Fetch scraper domains from database
        const { data: settings, error: settingsError } = await supabase
            .from('app_settings')
            .select('rareanimes_url, bollyflix_url, movielink_url')
            .eq('id', 1)
            .single();

        if (settingsError) {
            console.error('Failed to fetch scraper domains:', settingsError);
            return NextResponse.json({ error: 'Failed to fetch scraper domains' }, { status: 500 });
        }

        let baseUrl = '';
        if (source === 'rareanimes') {
            baseUrl = settings.rareanimes_url || 'https://rareanimes.ski';
        } else if (source === 'bollyflix') {
            baseUrl = settings.bollyflix_url || 'https://bollyflix.ski';
        } else if (source === 'movielink') {
            baseUrl = settings.movielink_url || 'https://movielinkbd.li';
        }

        try {
            new URL(baseUrl);
        } catch {
            return NextResponse.json({ error: `Invalid configuration URL for source ${source}: ${baseUrl}` }, { status: 500 });
        }

        const results = await searchWordPressSite(baseUrl, query);

        return NextResponse.json({ results });

    } catch (error: any) {
        console.error('Agent search error:', error);
        return NextResponse.json(
            { error: `Search failed: ${error.message}` },
            { status: 500 }
        );
    }
}
