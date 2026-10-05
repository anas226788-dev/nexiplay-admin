-- Migration: Update movies check constraint for scraper_source to include animerulz and toonplay
ALTER TABLE public.movies DROP CONSTRAINT IF EXISTS movies_scraper_source_check;
ALTER TABLE public.movies ADD CONSTRAINT movies_scraper_source_check 
  CHECK (scraper_source IN ('fxlinks', 'rareanimes', 'movielink', 'bollyflix', 'animerulz', 'toonplay'));
