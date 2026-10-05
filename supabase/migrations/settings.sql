-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    is_ads_enabled BOOLEAN DEFAULT FALSE,
    popunder_url TEXT,
    direct_link_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings if not exists
INSERT INTO app_settings (id, is_ads_enabled, popunder_url, direct_link_url)
VALUES (1, false, '', '')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- Public can read settings (needed for AdManager)
CREATE POLICY "Public can read settings" ON app_settings
    FOR SELECT USING (true);

-- Only authenticated users (admins) can update
CREATE POLICY "Admins can update settings" ON app_settings
    FOR UPDATE USING (auth.role() = 'authenticated');
