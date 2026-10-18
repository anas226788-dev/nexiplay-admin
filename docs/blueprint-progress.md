# Blueprint implementation progress

## Implemented

- **TMDB Catalog admin page** (`/tmdb-catalog`): search movie/TV metadata, select NexiPlay type, import metadata and genre links into the shared Supabase catalog, or refresh an existing record by TMDB ID. Search/import keys stay server-side. No stream links are imported.
- Website footer includes TMDB attribution and the official logo.
- **Vibe Check** (`/mood`): distinctive one-screen vibe cards and format filters. Uses local catalog matches plus TMDB discovery; TMDB-only titles link to TMDB and are explicitly marked as not playable on NexiPlay. Admin profile/genre controls live at `/mood-picks`.

## Setup needed

Copy `.env.example` to `.env.local`, then set `TMDB_API_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY`. Restart the admin app after editing environment values. The TMDB page will report a configuration error until these keys are set. Apply `supabase/migrations/add_mood_profiles.sql` to the shared Supabase database before using Vibe Check profile controls.

Live TMDB discovery stays disabled until either `TMDB_NONCOMMERCIAL_USE_CONFIRMED=true` (only for qualifying non-commercial use) or `TMDB_COMMERCIAL_LICENSE_CONFIRMED=true` (only after written permission). The current Nexiplay site displays ads, so do not enable live TMDB discovery under the free non-commercial terms. TMDB-only Vibe Check results are discovery links, not playable streams.

## Planned next pages

Kids Mode, Live TV/Radio, Games, Shorts, Wrapped, Release Calendar, and licensed playback-source operations will be added in separate steps. Third-party stream resolvers and file-download integrations must only be connected where NexiPlay has distribution rights and provider authorization; this blueprint does not make those rights available.
