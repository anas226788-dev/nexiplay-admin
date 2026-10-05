-- =================================================================
-- DEVELOPMENT MODE: Allow public write access for Admin testing
-- Run this to fix "violates row-level security policy" errors
-- =================================================================

-- 1. Movies Policies
DROP POLICY IF EXISTS "Allow admin insert on movies" ON movies;
DROP POLICY IF EXISTS "Allow admin update on movies" ON movies;
DROP POLICY IF EXISTS "Allow admin delete on movies" ON movies;

CREATE POLICY "Dev allow public insert on movies" ON movies FOR INSERT WITH CHECK (true);
CREATE POLICY "Dev allow public update on movies" ON movies FOR UPDATE USING (true);
CREATE POLICY "Dev allow public delete on movies" ON movies FOR DELETE USING (true);

-- 2. Downloads Policies
DROP POLICY IF EXISTS "Allow admin insert on downloads" ON downloads;
DROP POLICY IF EXISTS "Allow admin update on downloads" ON downloads;
DROP POLICY IF EXISTS "Allow admin delete on downloads" ON downloads;

CREATE POLICY "Dev allow public insert on downloads" ON downloads FOR INSERT WITH CHECK (true);
CREATE POLICY "Dev allow public update on downloads" ON downloads FOR UPDATE USING (true);
CREATE POLICY "Dev allow public delete on downloads" ON downloads FOR DELETE USING (true);

-- 3. Categories Policies
DROP POLICY IF EXISTS "Allow admin insert on categories" ON categories;
DROP POLICY IF EXISTS "Allow admin update on categories" ON categories;
DROP POLICY IF EXISTS "Allow admin delete on categories" ON categories;

CREATE POLICY "Dev allow public insert on categories" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Dev allow public update on categories" ON categories FOR UPDATE USING (true);
CREATE POLICY "Dev allow public delete on categories" ON categories FOR DELETE USING (true);

-- 4. Movie Categories Policies
DROP POLICY IF EXISTS "Allow admin insert on movie_categories" ON movie_categories;
DROP POLICY IF EXISTS "Allow admin delete on movie_categories" ON movie_categories;

CREATE POLICY "Dev allow public insert on movie_categories" ON movie_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Dev allow public delete on movie_categories" ON movie_categories FOR DELETE USING (true);

-- 5. App Settings Policies
DROP POLICY IF EXISTS "Admins can update settings" ON app_settings;
CREATE POLICY "Dev allow public update on app_settings" ON app_settings FOR UPDATE USING (true);
