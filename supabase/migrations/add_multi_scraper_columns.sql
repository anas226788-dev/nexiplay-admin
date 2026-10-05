-- 1. Add streaming URL columns for specific sources
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS streaming_url_animerulz text;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS streaming_url_toonplay text;

ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS streaming_url_animerulz text;
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS streaming_url_toonplay text;

-- 2. Add source-specific scraper settings to public.movies
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS animerulz_url text;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS animerulz_season integer DEFAULT 1;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS animerulz_resolution text DEFAULT '720p';

ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS toonplay_url text;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS toonplay_season integer DEFAULT 1;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS toonplay_resolution text DEFAULT '720p';

-- 3. Migrate existing legacy configurations
UPDATE public.movies 
SET 
  animerulz_url = CASE WHEN scraper_source = 'animerulz' THEN scraper_url ELSE animerulz_url END,
  animerulz_season = CASE WHEN scraper_source = 'animerulz' THEN COALESCE(scraper_season, 1) ELSE animerulz_season END,
  animerulz_resolution = CASE WHEN scraper_source = 'animerulz' THEN COALESCE(scraper_resolution, '720p') ELSE animerulz_resolution END,
  toonplay_url = CASE WHEN scraper_source = 'toonplay' THEN scraper_url ELSE toonplay_url END,
  toonplay_season = CASE WHEN scraper_source = 'toonplay' THEN COALESCE(scraper_season, 1) ELSE toonplay_season END,
  toonplay_resolution = CASE WHEN scraper_source = 'toonplay' THEN COALESCE(scraper_resolution, '720p') ELSE toonplay_resolution END;

-- 4. Update movies check constraint for scraper_source to include multi
ALTER TABLE public.movies DROP CONSTRAINT IF EXISTS movies_scraper_source_check;
ALTER TABLE public.movies ADD CONSTRAINT movies_scraper_source_check 
  CHECK (scraper_source IN ('fxlinks', 'rareanimes', 'movielink', 'bollyflix', 'animerulz', 'toonplay', 'multi'));

