-- =============================================
-- Migration: Create app_config table for in-app update system
-- Handles cases where app_config table already existed in DB
-- =============================================

-- Create app_config table if not exists
CREATE TABLE IF NOT EXISTS app_config (
    id TEXT PRIMARY KEY DEFAULT 'app_update',
    latest_version_code INTEGER NOT NULL DEFAULT 1,
    latest_version_name TEXT NOT NULL DEFAULT '1.0.0',
    apk_url TEXT DEFAULT '',
    release_notes TEXT DEFAULT '',
    force_update BOOLEAN DEFAULT FALSE,
    min_version_code INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all columns exist even if table was created earlier
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS latest_version_code INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS latest_version_name TEXT DEFAULT '1.0.0';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS apk_url TEXT DEFAULT '';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS release_notes TEXT DEFAULT '';
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS force_update BOOLEAN DEFAULT FALSE;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS min_version_code INTEGER DEFAULT 1;
ALTER TABLE app_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Insert default row if not present
INSERT INTO app_config (id, latest_version_code, latest_version_name, apk_url, release_notes, force_update, min_version_code)
VALUES ('app_update', 1, '1.0.0', '', '', false, 1)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid "policy already exists" error
DROP POLICY IF EXISTS "Public can read app_config" ON app_config;
DROP POLICY IF EXISTS "Admins can update app_config" ON app_config;
DROP POLICY IF EXISTS "Admins can insert app_config" ON app_config;
DROP POLICY IF EXISTS "Dev allow public update on app_config" ON app_config;
DROP POLICY IF EXISTS "Dev allow public insert on app_config" ON app_config;

-- Re-create policies safely
CREATE POLICY "Public can read app_config" ON app_config
    FOR SELECT USING (true);

CREATE POLICY "Admins can update app_config" ON app_config
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert app_config" ON app_config
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Dev allow public update on app_config" ON app_config
    FOR UPDATE USING (true);

CREATE POLICY "Dev allow public insert on app_config" ON app_config
    FOR INSERT WITH CHECK (true);
