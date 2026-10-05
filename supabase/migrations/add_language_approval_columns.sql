-- Migration: Add language_type and approval_status columns to episode_download_links
ALTER TABLE public.episode_download_links ADD COLUMN IF NOT EXISTS language_type TEXT CHECK (language_type IN ('dub', 'sub'));
ALTER TABLE public.episode_download_links ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('approved', 'pending', 'rejected'));
