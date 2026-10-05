-- Migration: Add scraper configuration columns to movies table
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS scraper_url TEXT;
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS scraper_source TEXT CHECK (scraper_source IN ('fxlinks', 'rareanimes', 'movielink'));
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS scraper_resolution TEXT CHECK (scraper_resolution IN ('360p', '480p', '720p', '1080p'));
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS scraper_season INTEGER DEFAULT 1;
