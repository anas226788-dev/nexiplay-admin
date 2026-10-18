-- Create shorts table for custom admin-curated reels and trailers
CREATE TABLE IF NOT EXISTS public.shorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youtube_id VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    channel VARCHAR(100) DEFAULT 'custom',
    channel_name VARCHAR(150) DEFAULT 'Nexiplay Featured',
    kind VARCHAR(50) DEFAULT 'short',
    thumbnail TEXT,
    movie_slug TEXT,
    movie_title TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for speedy retrieval by active status & priority
CREATE INDEX IF NOT EXISTS idx_shorts_active_priority ON public.shorts (is_active, priority DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shorts ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to active shorts"
    ON public.shorts
    FOR SELECT
    USING (is_active = true);

-- Allow authenticated/service role full access
CREATE POLICY "Allow full access for authenticated/service role"
    ON public.shorts
    FOR ALL
    USING (true)
    WITH CHECK (true);
