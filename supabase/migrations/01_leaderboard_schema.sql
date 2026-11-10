-- Migration: Leaderboard Schema, Custom Ordering & App Settings Integration (100% Real Users Only)

-- Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INT PRIMARY KEY DEFAULT 1,
    is_leaderboard_enabled BOOLEAN DEFAULT true,
    leaderboard_mode TEXT DEFAULT 'algorithm'
);

-- Ensure id = 1 row exists in app_settings
INSERT INTO public.app_settings (id, is_leaderboard_enabled, leaderboard_mode)
VALUES (1, true, 'algorithm')
ON CONFLICT (id) DO NOTHING;

-- Add columns if missing
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS is_leaderboard_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS leaderboard_mode TEXT DEFAULT 'algorithm';

-- Create leaderboard_entries table
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rank INT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    badge_type TEXT NOT NULL DEFAULT 'none',
    coins INT NOT NULL DEFAULT 0,
    watched_count INT NOT NULL DEFAULT 0,
    is_fake BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & Policies for Leaderboard
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to leaderboard_entries" ON public.leaderboard_entries;
CREATE POLICY "Allow public read access to leaderboard_entries"
    ON public.leaderboard_entries
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow full access for authenticated service role" ON public.leaderboard_entries;
CREATE POLICY "Allow full access for authenticated service role"
    ON public.leaderboard_entries
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Enable RLS Policies on coin_balances & user_events so leaderboard engine can read them
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coin_balances') THEN
        ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow read coin_balances for leaderboard" ON public.coin_balances;
        CREATE POLICY "Allow read coin_balances for leaderboard" ON public.coin_balances FOR SELECT USING (true);
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_events') THEN
        ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow read user_events for leaderboard" ON public.user_events;
        CREATE POLICY "Allow read user_events for leaderboard" ON public.user_events FOR SELECT USING (true);
    END IF;
END $$;

-- Create or Replace Leaderboard Generation Stored Procedure (100% Real Users, Zero Synthetic)
CREATE OR REPLACE FUNCTION public.generate_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    real_rec RECORD;
    curr_rank INT := 1;
BEGIN
    -- Reset mode to algorithm
    BEGIN
        UPDATE public.app_settings SET leaderboard_mode = 'algorithm' WHERE id = 1;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore
    END;

    -- Clear current leaderboard (WHERE true required by pg_safeupdate)
    DELETE FROM public.leaderboard_entries WHERE true;

    -- Query Real Users ordered by active badge tier + exact coins + watched count
    FOR real_rec IN (
        SELECT 
            p.id AS user_id,
            COALESCE(NULLIF(TRIM(p.display_name), ''), SPLIT_PART(p.email, '@', 1), 'Nexi User') AS name,
            p.avatar_url,
            CASE
                WHEN p.vip_badge_expires IS NOT NULL AND p.vip_badge_expires <= NOW() THEN 'none'
                ELSE COALESCE(p.vip_badge, 'none')
            END AS badge_type,
            COALESCE(cb.balance, 0) AS coins,
            COALESCE(ue.event_count, 0) AS watched_count,
            (
                CASE 
                    WHEN (p.vip_badge_expires IS NULL OR p.vip_badge_expires > NOW())
                         AND (LOWER(COALESCE(p.vip_badge, '')) LIKE '%elite%' OR LOWER(COALESCE(p.vip_badge, '')) = 'gold_vip') THEN 100000000::BIGINT
                    WHEN (p.vip_badge_expires IS NULL OR p.vip_badge_expires > NOW())
                         AND LOWER(COALESCE(p.vip_badge, '')) LIKE '%vip%' THEN 50000000::BIGINT
                    ELSE 0::BIGINT
                END
                + (COALESCE(cb.balance, 0)::BIGINT * 1000)
                + LEAST(999, COALESCE(ue.event_count, 0))::BIGINT
            ) AS score
        FROM public.profiles p
        LEFT JOIN public.coin_balances cb ON p.id = cb.user_id
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS event_count
            FROM public.user_events
            WHERE event_type = 'watch'
            GROUP BY user_id
        ) ue ON p.id = ue.user_id
        ORDER BY score DESC, COALESCE(cb.balance, 0) DESC, COALESCE(ue.event_count, 0) DESC
        LIMIT 15
    ) LOOP
        INSERT INTO public.leaderboard_entries (
            rank, user_id, name, avatar_url, badge_type, coins, watched_count, is_fake, updated_at
        ) VALUES (
            curr_rank,
            real_rec.user_id,
            real_rec.name,
            real_rec.avatar_url,
            real_rec.badge_type,
            real_rec.coins,
            real_rec.watched_count,
            false,
            NOW()
        );
        
        curr_rank := curr_rank + 1;
    END LOOP;
END;
$$;
