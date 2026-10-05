-- Migration: Add 2-step verification popup settings to app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS is_verification_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS verification_ad_url_1 TEXT DEFAULT '';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS verification_ad_url_2 TEXT DEFAULT '';
