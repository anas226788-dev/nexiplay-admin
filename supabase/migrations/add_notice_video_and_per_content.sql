-- Migration: Add video_url and movie_id to notices, allow_global_notices to movies

-- 1. Add video_url and movie_id to notices table
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS movie_id UUID REFERENCES public.movies(id) ON DELETE CASCADE;

-- 2. Modify check constraint on pages to allow 'specific'
ALTER TABLE public.notices DROP CONSTRAINT IF EXISTS notices_pages_check;
ALTER TABLE public.notices ADD CONSTRAINT notices_pages_check CHECK (pages IN ('all', 'home', 'movie', 'specific'));

-- 3. Add allow_global_notices column to movies table
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS allow_global_notices BOOLEAN DEFAULT FALSE;
