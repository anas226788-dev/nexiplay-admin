# Streaming Table Migration Plan

Goal: move streaming configuration out of `movies` while keeping the public website behavior unchanged during the migration.

## Current State

- `movies` stores both running-series tracking and streaming scraper settings.
- `episodes` stores playable stream URLs.
- Running-series cleanup already separated streaming-only content by setting `movies.is_running = false` for rows that had streaming config but no valid running scraper.

## Target Tables

### `streaming`

One row per content item.

Fields:

- `movie_id uuid primary key references movies(id) on delete cascade`
- `tmdb_id text null`
- `imdb_id text null`
- `mal_id text null`
- `streaming_url text null`
- `is_disabled boolean not null default false`
- `streaming_url_animerulz text null`
- `streaming_url_toonplay text null`
- `animerulz_url text null`
- `animerulz_season int null`
- `animerulz_resolution text null`
- `toonplay_url text null`
- `toonplay_season int null`
- `toonplay_resolution text null`
- `multi_scraper_config text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `episode_streaming_links`

One row per episode/server link.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `episode_id uuid not null references episodes(id) on delete cascade`
- `server_key text not null`
- `server_label text null`
- `stream_url text not null`
- `source text null`
- `priority int not null default 100`
- `is_active boolean not null default true`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `unique (episode_id, server_key)`

## Migration Phases

### Phase 1: Add Tables Only

- Add the new tables with indexes and RLS/policies matching current admin usage.
- Do not remove or rename old columns.
- Public web remains fully unchanged.

### Phase 2: Backfill

- Copy existing `movies.tmdb_id`, `imdb_id`, `mal_id`, `streaming_url`, `animerulz_url`, `toonplay_url`, and multi-scraper JSON into `streaming`.
- Copy existing `episodes.streaming_url`, `streaming_url_animerulz`, and `streaming_url_toonplay` into `episode_streaming_links`.
- Keep old columns untouched for rollback.

### Phase 3: Dual Read

- Update admin and public web reads to prefer the new tables.
- If a new-table row is missing, fall back to old columns.
- This keeps old data working while rollout is tested.

### Phase 4: Dual Write

- Update Streaming admin saves and scrapers to write both:
  - new tables
  - old columns
- Continue public web fallback during this period.

### Phase 5: Switch Primary Source

- Public watch pages and admin Streaming page read from new tables as primary.
- Old columns become compatibility-only.
- Verify:
  - movie direct streams
  - episode server buttons
  - Toonplay/Nexiplay T Server
  - Animerulz
  - custom/multi JSON servers

### Phase 6: Retire Old Columns Later

- Only after production confidence, stop writing old streaming columns.
- Do not drop columns immediately.
- Drop/cleanup old columns in a later maintenance migration if desired.

## Safety Rules

- Never delete stream URLs during migration.
- Never change `episodes` identity or `movies` identity.
- Keep rollback simple: old columns remain intact until final retirement.
- All migrations should be backfilled with idempotent `insert ... on conflict do update`.
- Every phase should be build-tested before deployment.

## Rollback

- During Phases 1-5, rollback is code-only: switch reads back to old columns.
- Since old columns are preserved, no data restore should be needed.
- If a bad dual-write occurs, disable new-table reads and inspect new rows without touching old production fields.
