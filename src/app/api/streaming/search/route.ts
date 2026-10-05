import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'search';
    const source = searchParams.get('source') || 'tmdb';
    const query = searchParams.get('query') || '';
    const type = searchParams.get('type') || 'movie';
    const apiKey = searchParams.get('apiKey') || '';
    const id = searchParams.get('id') || '';

    try {
        if (mode === 'detail') {
            if (!id) {
                return NextResponse.json({ error: 'ID parameter is required for detail mode' }, { status: 400 });
            }
            if (!apiKey) {
                return NextResponse.json({ error: 'TMDB API Key is required' }, { status: 400 });
            }

            const detailType = type === 'movie' ? 'movie' : 'tv';
            const detailUrl = `https://api.themoviedb.org/3/${detailType}/${id}/external_ids?api_key=${apiKey}`;
            
            const res = await fetch(detailUrl);
            if (!res.ok) {
                return NextResponse.json({ error: 'Failed to fetch details from TMDB' }, { status: res.status });
            }
            const data = await res.json();
            return NextResponse.json(data);
        }

        // Search mode
        if (!query) {
            return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
        }

        if (source === 'jikan') {
            const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=6`;
            const res = await fetch(jikanUrl);
            if (!res.ok) {
                return NextResponse.json({ error: 'Jikan API request failed' }, { status: res.status });
            }
            const data = await res.json();
            return NextResponse.json(data);
        } else {
            if (!apiKey) {
                return NextResponse.json({ error: 'TMDB API Key is required' }, { status: 400 });
            }

            const searchType = type === 'movie' ? 'movie' : 'tv';
            const tmdbUrl = `https://api.themoviedb.org/3/search/${searchType}?api_key=${apiKey}&query=${encodeURIComponent(query)}`;
            
            const res = await fetch(tmdbUrl);
            if (!res.ok) {
                return NextResponse.json({ error: 'TMDB API request failed. Check API Key.' }, { status: res.status });
            }
            const data = await res.json();
            return NextResponse.json(data);
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
