-- =================================================================
-- Migration: Stream API Keys & Global Access Control
-- Run this in Supabase SQL Editor to enable database-backed key management
-- =================================================================

-- 1. Stream API Global Settings Table
CREATE TABLE IF NOT EXISTS public.stream_api_settings (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT true,
    access_mode TEXT DEFAULT 'demo_allowed', -- 'strict', 'demo_allowed', 'open'
    default_ttl_seconds INTEGER DEFAULT 7200,
    require_origin_match BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings row if not exists
INSERT INTO public.stream_api_settings (id, is_enabled, access_mode, default_ttl_seconds, require_origin_match)
VALUES (1, true, 'demo_allowed', 7200, false)
ON CONFLICT (id) DO NOTHING;

-- 2. Stream API Keys Table
CREATE TABLE IF NOT EXISTS public.stream_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'production', -- 'test', 'production'
    is_active BOOLEAN NOT NULL DEFAULT true,
    allowed_origins TEXT[] DEFAULT ARRAY['*'],
    rate_limit_per_day INTEGER DEFAULT 0,
    total_requests BIGINT DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    last_used_ip TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and permissive policies for admin management
ALTER TABLE public.stream_api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read stream_api_settings" ON public.stream_api_settings;
DROP POLICY IF EXISTS "Allow write stream_api_settings" ON public.stream_api_settings;
CREATE POLICY "Allow read stream_api_settings" ON public.stream_api_settings FOR SELECT USING (true);
CREATE POLICY "Allow write stream_api_settings" ON public.stream_api_settings FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow read stream_api_keys" ON public.stream_api_keys;
DROP POLICY IF EXISTS "Allow write stream_api_keys" ON public.stream_api_keys;
CREATE POLICY "Allow read stream_api_keys" ON public.stream_api_keys FOR SELECT USING (true);
CREATE POLICY "Allow write stream_api_keys" ON public.stream_api_keys FOR ALL USING (true);
