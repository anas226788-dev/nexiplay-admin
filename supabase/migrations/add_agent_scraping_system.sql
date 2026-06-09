-- Migration: Add dynamic scraper domains and request staging fields

-- 1. Add scraper base URLs to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS rareanimes_url TEXT DEFAULT 'https://rareanimes.ski';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bollyflix_url TEXT DEFAULT 'https://bollyflix.ski';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS movielink_url TEXT DEFAULT 'https://movielinkbd.li';

-- Update defaults for existing rows
UPDATE public.app_settings 
SET 
  rareanimes_url = COALESCE(rareanimes_url, 'https://rareanimes.ski'),
  bollyflix_url = COALESCE(bollyflix_url, 'https://bollyflix.ski'),
  movielink_url = COALESCE(movielink_url, 'https://movielinkbd.li')
WHERE id = 1;

-- 2. Add scraped data and source fields to content_requests for review staging
ALTER TABLE public.content_requests ADD COLUMN IF NOT EXISTS scraped_data JSONB DEFAULT NULL;
ALTER TABLE public.content_requests ADD COLUMN IF NOT EXISTS scraper_source TEXT DEFAULT NULL;
ALTER TABLE public.content_requests ADD COLUMN IF NOT EXISTS source_url TEXT DEFAULT NULL;

-- Allow review status value
ALTER TABLE public.content_requests DROP CONSTRAINT IF EXISTS content_requests_status_check;
ALTER TABLE public.content_requests ADD CONSTRAINT content_requests_status_check 
  CHECK (status IN ('pending', 'added', 'rejected', 'review'));

-- 3. Update movies check constraint for scraper_source to include bollyflix
ALTER TABLE public.movies DROP CONSTRAINT IF EXISTS movies_scraper_source_check;
ALTER TABLE public.movies ADD CONSTRAINT movies_scraper_source_check 
  CHECK (scraper_source IN ('fxlinks', 'rareanimes', 'movielink', 'bollyflix'));

