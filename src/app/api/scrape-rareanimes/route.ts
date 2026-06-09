import { NextRequest, NextResponse } from 'next/server';
import { scrapeSource } from '@/lib/scraper-utils';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json(
                { error: 'URL is required' },
                { status: 400 }
            );
        }

        try {
            new URL(url);
        } catch {
            return NextResponse.json(
                { error: 'Invalid URL format' },
                { status: 400 }
            );
        }

        const result = await scrapeSource(url, 'rareanimes');

        return NextResponse.json({
            ...result,
            resolvedCount: result.resolvedCount ?? result.episodes.length,
            totalFound: result.totalFound ?? result.episodes.length,
        });

    } catch (error: any) {
        console.error('RareAnimes scrape error:', error);
        return NextResponse.json(
            { error: `Scraping failed: ${error.message}` },
            { status: 500 }
        );
    }
}
