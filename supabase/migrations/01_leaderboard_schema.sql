-- Migration: Leaderboard Schema, Custom Ordering & App Settings Integration

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
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

-- Create or Replace Leaderboard Generation Stored Procedure
CREATE OR REPLACE FUNCTION public.generate_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    real_rec RECORD;
    real_count INT := 0;
    curr_rank INT := 1;
    fake_names TEXT[] := ARRAY[
        'Arafat_Anime', 'Tanvir_Pro', 'Siam_Vip', 'Mahir_X', 'Nibir_77', 
        'Rafi_Hero', 'Sabbir_Otaku', 'Fahim_Stream', 'Rayan_99', 'Imran_VIP', 
        'Tahmid_Ninja', 'Nabil_Elite', 'Hamza_Play', 'Zayan_Legend', 'Faris_Ultra'
    ];
    fake_avatars TEXT[] := ARRAY[
        'https://api.dicebear.com/7.x/bottts/png?seed=Tanvir',
        'https://api.dicebear.com/7.x/bottts/png?seed=Siam',
        'https://api.dicebear.com/7.x/bottts/png?seed=Mahir',
        'https://api.dicebear.com/7.x/bottts/png?seed=Nibir',
        'https://api.dicebear.com/7.x/bottts/png?seed=Rafi',
        'https://api.dicebear.com/7.x/bottts/png?seed=Sabbir',
        'https://api.dicebear.com/7.x/bottts/png?seed=Fahim',
        'https://api.dicebear.com/7.x/bottts/png?seed=Rayan',
        'https://api.dicebear.com/7.x/bottts/png?seed=Imran',
        'https://api.dicebear.com/7.x/bottts/png?seed=Tahmid',
        'https://api.dicebear.com/7.x/bottts/png?seed=Nabil',
        'https://api.dicebear.com/7.x/bottts/png?seed=Hamza',
        'https://api.dicebear.com/7.x/bottts/png?seed=Zayan',
        'https://api.dicebear.com/7.x/bottts/png?seed=Faris',
        'https://api.dicebear.com/7.x/bottts/png?seed=Arafat'
    ];
    fake_badges TEXT[] := ARRAY['elite', 'vip', 'vip', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none', 'none'];
    idx INT;
    sim_coins INT;
    sim_watched INT;
BEGIN
    -- Reset mode to algorithm
    BEGIN
        UPDATE public.app_settings SET leaderboard_mode = 'algorithm' WHERE id = 1;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore
    END;

    -- Clear current leaderboard
    DELETE FROM public.leaderboard_entries;

    -- Query Real Users ordered by badge weight + coins + watched count
    FOR real_rec IN (
        SELECT 
            p.id AS user_id,
            COALESCE(p.display_name, SPLIT_PART(p.email, '@', 1), 'Nexi User') AS name,
            p.avatar_url,
            COALESCE(p.vip_badge, 'none') AS badge_type,
            COALESCE(cb.balance, 0) AS coins,
            COALESCE(ue.event_count, 0) AS watched_count,
            (
                CASE 
                    WHEN LOWER(COALESCE(p.vip_badge, '')) LIKE '%elite%' OR LOWER(COALESCE(p.vip_badge, '')) = 'gold_vip' THEN 3000000
                    WHEN LOWER(COALESCE(p.vip_badge, '')) LIKE '%vip%' THEN 1500000
                    ELSE 0
                END
                + (COALESCE(cb.balance, 0) * 100)
                + (COALESCE(ue.event_count, 0) * 500)
            ) AS score
        FROM public.profiles p
        LEFT JOIN public.coin_balances cb ON p.id = cb.user_id
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS event_count
            FROM public.user_events
            GROUP BY user_id
        ) ue ON p.id = ue.user_id
        ORDER BY score DESC, cb.balance DESC
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
        real_count := real_count + 1;
    END LOOP;

    -- Fill remaining slots up to 15 with realistic synthetic users (modest coin counts)
    IF real_count < 15 THEN
        FOR idx IN (real_count + 1)..15 LOOP
            sim_coins := GREATEST(5, 120 - (idx * 7) + FLOOR(random() * 5)::INT);
            sim_watched := GREATEST(1, 15 - idx + FLOOR(random() * 2)::INT);

            INSERT INTO public.leaderboard_entries (
                rank, user_id, name, avatar_url, badge_type, coins, watched_count, is_fake, updated_at
            ) VALUES (
                idx,
                NULL,
                fake_names[((idx - 1) % array_length(fake_names, 1)) + 1],
                fake_avatars[((idx - 1) % array_length(fake_avatars, 1)) + 1],
                fake_badges[((idx - 1) % array_length(fake_badges, 1)) + 1],
                sim_coins,
                sim_watched,
                true,
                NOW()
            );
        END LOOP;
    END IF;
END;
$$;
