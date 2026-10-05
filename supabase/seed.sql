-- =============================================
-- SAMPLE DATA SEED FILE
-- Run this in your Supabase SQL Editor to populate the database
-- =============================================

-- 1. Clean up existing data (optional, be careful!)
-- TRUNCATE TABLE movies, categories, downloads CASCADE;

-- 2. Insert Categories
INSERT INTO categories (name, slug) VALUES
('Action', 'action'),
('Adventure', 'adventure'),
('Sci-Fi', 'sci-fi'),
('Drama', 'drama'),
('Comedy', 'comedy'),
('Thriller', 'thriller'),
('Animation', 'animation'),
('Horror', 'horror'),
('Romance', 'romance')
ON CONFLICT (slug) DO NOTHING;

-- 3. Insert Movies/Series/Anime

-- Movie: Dune: Part Two
WITH new_movie AS (
  INSERT INTO movies (title, slug, poster_url, description, type, release_year)
  VALUES (
    'Dune: Part Two',
    'dune-part-two',
    'https://image.tmdb.org/t/p/original/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
    'movie',
    2024
  ) RETURNING id
),
-- Categories for Dune
movie_cats AS (
  INSERT INTO movie_categories (movie_id, category_id)
  SELECT new_movie.id, categories.id FROM new_movie, categories WHERE categories.slug IN ('action', 'adventure', 'sci-fi')
),
-- Downloads for Dune
movie_downloads AS (
  INSERT INTO downloads (movie_id, quality, file_size, file_url)
  SELECT new_movie.id, '480p', '600MB', 'https://example.com/dune-480p' FROM new_movie
  UNION ALL
  SELECT new_movie.id, '720p', '1.2GB', 'https://example.com/dune-720p' FROM new_movie
  UNION ALL
  SELECT new_movie.id, '1080p', '2.5GB', 'https://example.com/dune-1080p' FROM new_movie
)
SELECT * FROM new_movie;

-- Movie: Oppenheimer
WITH new_movie AS (
  INSERT INTO movies (title, slug, poster_url, description, type, release_year)
  VALUES (
    'Oppenheimer',
    'oppenheimer',
    'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR9n38E.jpg',
    'The story of J. Robert Oppenheimer''s role in the development of the atomic bomb during World War II.',
    'movie',
    2023
  ) RETURNING id
),
movie_cats AS (
  INSERT INTO movie_categories (movie_id, category_id)
  SELECT new_movie.id, categories.id FROM new_movie, categories WHERE categories.slug IN ('drama', 'history', 'thriller')
),
movie_downloads AS (
  INSERT INTO downloads (movie_id, quality, file_size, file_url)
  SELECT new_movie.id, '720p', '1.4GB', 'https://example.com/oppenheimer-720p' FROM new_movie
  UNION ALL
  SELECT new_movie.id, '1080p', '3.0GB', 'https://example.com/oppenheimer-1080p' FROM new_movie
)
SELECT * FROM new_movie;

-- Series: Fallout
WITH new_series AS (
  INSERT INTO movies (title, slug, poster_url, description, type, release_year)
  VALUES (
    'Fallout',
    'fallout',
    'https://image.tmdb.org/t/p/original/AnsSKR9LuK0mT9bLf97HBnNbKGj.jpg',
    'In a future, post-apocalyptic Los Angeles brought about by nuclear decimation, citizens must live in underground bunkers to protect themselves from radiation, mutants and bandits.',
    'series',
    2024
  ) RETURNING id
),
series_cats AS (
  INSERT INTO movie_categories (movie_id, category_id)
  SELECT new_series.id, categories.id FROM new_series, categories WHERE categories.slug IN ('action', 'sci-fi', 'adventure')
),
series_downloads AS (
  INSERT INTO downloads (movie_id, quality, file_size, file_url)
  SELECT new_series.id, '720p', '400MB', 'https://example.com/fallout-s1-720p' FROM new_series
)
SELECT * FROM new_series;

-- Series: Shogun
WITH new_series AS (
  INSERT INTO movies (title, slug, poster_url, description, type, release_year)
  VALUES (
    'Shōgun',
    'shogun',
    'https://image.tmdb.org/t/p/original/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg',
    'In Japan in the year 1600, at the dawn of a century-defining civil war, Lord Yoshii Toranaga is fighting for his life as his enemies on the Council of Regents unite against him.',
    'series',
    2024
  ) RETURNING id
),
series_cats AS (
  INSERT INTO movie_categories (movie_id, category_id)
  SELECT new_series.id, categories.id FROM new_series, categories WHERE categories.slug IN ('drama', 'adventure')
),
series_downloads AS (
  INSERT INTO downloads (movie_id, quality, file_size, file_url)
  SELECT new_series.id, '1080p', '1.1GB', 'https://example.com/shogun-s1-1080p' FROM new_series
)
SELECT * FROM new_series;

-- Anime: Solo Leveling
WITH new_anime AS (
  INSERT INTO movies (title, slug, poster_url, description, type, release_year)
  VALUES (
    'Solo Leveling',
    'solo-leveling',
    'https://image.tmdb.org/t/p/original/geCRueV3ElhRTr0xc32MDPIzn00.jpg',
    'A decade after the appearance of the "Gates", connecting the world to a different dimension, Jinwoo Sung, the weakest Hunter, awakens a unique ability to level up.',
    'anime',
    2024
  ) RETURNING id
),
anime_cats AS (
  INSERT INTO movie_categories (movie_id, category_id)
  SELECT new_anime.id, categories.id FROM new_anime, categories WHERE categories.slug IN ('action', 'adventure', 'animation')
),
anime_downloads AS (
  INSERT INTO downloads (movie_id, quality, file_size, file_url)
  SELECT new_anime.id, '1080p', '450MB', 'https://example.com/solo-leveling-1080p' FROM new_anime
)
SELECT * FROM new_anime;

-- Anime: Frieren
WITH new_anime AS (
  INSERT INTO movies (title, slug, poster_url, description, type, release_year)
  VALUES (
    'Frieren: Beyond Journey''s End',
    'frieren',
    'https://image.tmdb.org/t/p/original/dqZM57d5y270Kq0dZ6v4N2x5B4F.jpg',
    'After defeating the Demon King, the elf mage Frieren sets out on a journey to understand humans and the passage of time.',
    'anime',
    2023
  ) RETURNING id
),
anime_cats AS (
  INSERT INTO movie_categories (movie_id, category_id)
  SELECT new_anime.id, categories.id FROM new_anime, categories WHERE categories.slug IN ('adventure', 'drama', 'animation')
),
anime_downloads AS (
  INSERT INTO downloads (movie_id, quality, file_size, file_url)
  SELECT new_anime.id, '720p', '300MB', 'https://example.com/frieren-720p' FROM new_anime
  UNION ALL
  SELECT new_anime.id, '1080p', '550MB', 'https://example.com/frieren-1080p' FROM new_anime
)
SELECT * FROM new_anime;
