-- Migration: Add Streaming Service Embed Integration Columns
-- Description: Adds TMDB, IMDb, MAL IDs and custom streaming URL fields to movies and episodes tables.

-- 1. Update movies table to include external IDs and manual streaming URL
ALTER TABLE public.movies 
ADD COLUMN IF NOT EXISTS tmdb_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS imdb_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS mal_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS streaming_url TEXT;

-- 2. Update episodes table to include manual streaming URL per episode
ALTER TABLE public.episodes 
ADD COLUMN IF NOT EXISTS streaming_url TEXT;
