-- Migration: Move streaming configuration into its own table
-- Safe to run multiple times. Old movies/episodes streaming columns are preserved.

CREATE TABLE IF NOT EXISTS public.streaming (
    movie_id UUID PRIMARY KEY REFERENCES public.movies(id) ON DELETE CASCADE,
    tmdb_id VARCHAR(50),
    imdb_id VARCHAR(50),
    mal_id VARCHAR(50),
    streaming_url TEXT,
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    streaming_url_animerulz TEXT,
    streaming_url_toonplay TEXT,
    animerulz_url TEXT,
    animerulz_season INTEGER DEFAULT 1,
    animerulz_resolution TEXT DEFAULT '720p',
    toonplay_url TEXT,
    toonplay_season INTEGER DEFAULT 1,
    toonplay_resolution TEXT DEFAULT '720p',
    multi_scraper_config TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streaming_tmdb_id ON public.streaming(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_streaming_imdb_id ON public.streaming(imdb_id);
CREATE INDEX IF NOT EXISTS idx_streaming_mal_id ON public.streaming(mal_id);

ALTER TABLE public.streaming ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on streaming" ON public.streaming;
CREATE POLICY "Allow public read access on streaming"
    ON public.streaming FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Dev allow public insert on streaming" ON public.streaming;
CREATE POLICY "Dev allow public insert on streaming"
    ON public.streaming FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Dev allow public update on streaming" ON public.streaming;
CREATE POLICY "Dev allow public update on streaming"
    ON public.streaming FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Dev allow public delete on streaming" ON public.streaming;
CREATE POLICY "Dev allow public delete on streaming"
    ON public.streaming FOR DELETE
    USING (true);

INSERT INTO public.streaming (
    movie_id,
    tmdb_id,
    imdb_id,
    mal_id,
    streaming_url,
    is_disabled,
    streaming_url_animerulz,
    streaming_url_toonplay,
    animerulz_url,
    animerulz_season,
    animerulz_resolution,
    toonplay_url,
    toonplay_season,
    toonplay_resolution,
    multi_scraper_config,
    updated_at
)
SELECT
    id,
    tmdb_id,
    imdb_id,
    mal_id,
    NULLIF(streaming_url, 'disabled'),
    COALESCE(streaming_url = 'disabled', FALSE),
    streaming_url_animerulz,
    streaming_url_toonplay,
    animerulz_url,
    animerulz_season,
    animerulz_resolution,
    toonplay_url,
    toonplay_season,
    toonplay_resolution,
    CASE WHEN scraper_source = 'multi' THEN scraper_url ELSE NULL END,
    COALESCE(updated_at, NOW())
FROM public.movies
WHERE
    tmdb_id IS NOT NULL
    OR imdb_id IS NOT NULL
    OR mal_id IS NOT NULL
    OR streaming_url IS NOT NULL
    OR streaming_url_animerulz IS NOT NULL
    OR streaming_url_toonplay IS NOT NULL
    OR animerulz_url IS NOT NULL
    OR toonplay_url IS NOT NULL
    OR scraper_source = 'multi'
ON CONFLICT (movie_id) DO UPDATE SET
    tmdb_id = EXCLUDED.tmdb_id,
    imdb_id = EXCLUDED.imdb_id,
    mal_id = EXCLUDED.mal_id,
    streaming_url = EXCLUDED.streaming_url,
    is_disabled = EXCLUDED.is_disabled,
    streaming_url_animerulz = EXCLUDED.streaming_url_animerulz,
    streaming_url_toonplay = EXCLUDED.streaming_url_toonplay,
    animerulz_url = EXCLUDED.animerulz_url,
    animerulz_season = EXCLUDED.animerulz_season,
    animerulz_resolution = EXCLUDED.animerulz_resolution,
    toonplay_url = EXCLUDED.toonplay_url,
    toonplay_season = EXCLUDED.toonplay_season,
    toonplay_resolution = EXCLUDED.toonplay_resolution,
    multi_scraper_config = EXCLUDED.multi_scraper_config,
    updated_at = EXCLUDED.updated_at;
