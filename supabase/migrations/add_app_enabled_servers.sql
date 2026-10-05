-- Migration: Add app_enabled_servers column to app_settings table
-- Run this in your Supabase SQL Editor if not already applied

ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS app_enabled_servers TEXT DEFAULT NULL;
