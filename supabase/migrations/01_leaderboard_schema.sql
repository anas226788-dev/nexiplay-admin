-- Migration: Leaderboard Schema, Daily Streaks, Coin RLS & 100% Real Users Stored Procedure

-- 1. Ensure app_settings table and columns exist
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INT PRIMARY KEY DEFAULT 1,
    is_leaderboard_enabled BOOLEAN DEFAULT true,
    leaderboard_mode TEXT DEFAULT 'algorithm'
);

INSERT INTO public.app_settings (id, is_leaderboard_enabled, leaderboard_mode)
VALUES (1, true, 'algorithm')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS is_leaderboard_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS leaderboard_mode TEXT DEFAULT 'algorithm';

-- 2. Ensure profiles has all VIP / Elite / Boost / Referral columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS vip_badge TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS vip_badge_expires TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ad_free_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS double_boost_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS early_access_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 3. Create daily_streaks table (was missing in DB!)
CREATE TABLE IF NOT EXISTS public.daily_streaks (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_login_date TEXT,
    last_daily_claim TEXT,
    streak_7_claimed_at TEXT,
    streak_30_claimed_at TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create coin_balances & coin_transactions tables if not exists
CREATE TABLE IF NOT EXISTS public.coin_balances (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0,
    total_earned INT NOT NULL DEFAULT 0,
    total_spent INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create leaderboard_entries table
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

DELETE FROM public.leaderboard_entries WHERE is_fake = true;

-- 6. Enable RLS & Policies for Leaderboard, Profiles, Coins, Streaks & Events
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to leaderboard_entries" ON public.leaderboard_entries;
CREATE POLICY "Allow public read access to leaderboard_entries" ON public.leaderboard_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow full access for authenticated service role" ON public.leaderboard_entries;
CREATE POLICY "Allow full access for authenticated service role" ON public.leaderboard_entries FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read coin_balances for leaderboard" ON public.coin_balances;
CREATE POLICY "Allow read coin_balances for leaderboard" ON public.coin_balances FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own coin_balances" ON public.coin_balances;
CREATE POLICY "Users can insert own coin_balances" ON public.coin_balances FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own coin_balances" ON public.coin_balances;
CREATE POLICY "Users can update own coin_balances" ON public.coin_balances FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own coin_transactions" ON public.coin_transactions;
CREATE POLICY "Users can read own coin_transactions" ON public.coin_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own coin_transactions" ON public.coin_transactions;
CREATE POLICY "Users can insert own coin_transactions" ON public.coin_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.daily_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own daily_streaks" ON public.daily_streaks;
CREATE POLICY "Users can read own daily_streaks" ON public.daily_streaks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own daily_streaks" ON public.daily_streaks;
CREATE POLICY "Users can insert own daily_streaks" ON public.daily_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own daily_streaks" ON public.daily_streaks;
CREATE POLICY "Users can update own daily_streaks" ON public.daily_streaks FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read user_events for leaderboard" ON public.user_events;
CREATE POLICY "Allow read user_events for leaderboard" ON public.user_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own user_events" ON public.user_events;
CREATE POLICY "Users can insert own user_events" ON public.user_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Create or Replace Leaderboard Generation Stored Procedure (100% Real Users, Zero Synthetic)
CREATE OR REPLACE FUNCTION public.generate_leaderboard()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS '
    UPDATE public.app_settings SET leaderboard_mode = ''algorithm'' WHERE id = 1;

    DELETE FROM public.leaderboard_entries WHERE true;

    INSERT INTO public.leaderboard_entries (
        rank, user_id, name, avatar_url, badge_type, coins, watched_count, is_fake, updated_at
    )
    SELECT
        ROW_NUMBER() OVER (
            ORDER BY ranked.score DESC, ranked.coins DESC, ranked.watched_count DESC
        )::INT AS rank,
        ranked.user_id,
        ranked.name,
        ranked.avatar_url,
        ranked.badge_type,
        ranked.coins,
        ranked.watched_count,
        false AS is_fake,
        NOW() AS updated_at
    FROM (
        SELECT
            p.id AS user_id,
            COALESCE(NULLIF(TRIM(p.display_name), ''''), SPLIT_PART(p.email, ''@'', 1), ''Nexi User'') AS name,
            p.avatar_url,
            CASE
                WHEN p.vip_badge_expires IS NOT NULL AND p.vip_badge_expires <= NOW() THEN ''none''
                ELSE COALESCE(p.vip_badge, ''none'')
            END AS badge_type,
            COALESCE(cb.balance, 0) AS coins,
            COALESCE(ue.event_count, 0)::INT AS watched_count,
            (
                CASE
                    WHEN (p.vip_badge_expires IS NULL OR p.vip_badge_expires > NOW())
                         AND (LOWER(COALESCE(p.vip_badge, '''')) LIKE ''%elite%'' OR LOWER(COALESCE(p.vip_badge, '''')) = ''gold_vip'') THEN 100000000::BIGINT
                    WHEN (p.vip_badge_expires IS NULL OR p.vip_badge_expires > NOW())
                         AND LOWER(COALESCE(p.vip_badge, '''')) LIKE ''%vip%'' THEN 50000000::BIGINT
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
            WHERE event_type = ''watch''
            GROUP BY user_id
        ) ue ON p.id = ue.user_id
        ORDER BY score DESC, COALESCE(cb.balance, 0) DESC, COALESCE(ue.event_count, 0) DESC
        LIMIT 15
    ) AS ranked;
';
