-- =============================================
-- Nexiplay OTT Platform - Supabase PostgreSQL Schema
-- =============================================

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- MOVIES TABLE
-- Stores all content: movies, series, anime
-- =============================================
CREATE TABLE movies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    poster_url TEXT,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('movie', 'series', 'anime')),
    release_year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster slug lookups
CREATE INDEX idx_movies_slug ON movies(slug);

-- Index for filtering by type
CREATE INDEX idx_movies_type ON movies(type);

-- Index for sorting by release year
CREATE INDEX idx_movies_release_year ON movies(release_year DESC);

-- =============================================
-- DOWNLOADS TABLE
-- Stores download links for different qualities
-- =============================================
CREATE TABLE downloads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    quality TEXT NOT NULL CHECK (quality IN ('480p', '720p', '1080p')),
    file_size TEXT,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching downloads by movie
CREATE INDEX idx_downloads_movie_id ON downloads(movie_id);

-- =============================================
-- CATEGORIES TABLE
-- Stores genres/categories for content
-- =============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster slug lookups
CREATE INDEX idx_categories_slug ON categories(slug);

-- =============================================
-- MOVIE_CATEGORIES TABLE (Junction Table)
-- Many-to-many relationship between movies and categories
-- =============================================
CREATE TABLE movie_categories (
    movie_id UUID NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (movie_id, category_id)
);

-- Index for fetching categories by movie
CREATE INDEX idx_movie_categories_movie_id ON movie_categories(movie_id);

-- Index for fetching movies by category
CREATE INDEX idx_movie_categories_category_id ON movie_categories(category_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS for all tables
-- =============================================

-- Enable RLS
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_categories ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables (for the public website)
CREATE POLICY "Allow public read access on movies"
    ON movies FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on downloads"
    ON downloads FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on categories"
    ON categories FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access on movie_categories"
    ON movie_categories FOR SELECT
    USING (true);

-- Admin write access (requires authenticated user with admin role)
-- Note: You may need to adjust these based on your auth setup

CREATE POLICY "Allow admin insert on movies"
    ON movies FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin update on movies"
    ON movies FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin delete on movies"
    ON movies FOR DELETE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin insert on downloads"
    ON downloads FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin update on downloads"
    ON downloads FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin delete on downloads"
    ON downloads FOR DELETE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin insert on categories"
    ON categories FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin update on categories"
    ON categories FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin delete on categories"
    ON categories FOR DELETE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin insert on movie_categories"
    ON movie_categories FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow admin delete on movie_categories"
    ON movie_categories FOR DELETE
    USING (auth.role() = 'authenticated');
