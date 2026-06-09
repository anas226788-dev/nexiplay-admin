-- Migration: Update unique constraint on episode_download_links to support separate DUB/SUB links
-- 1. Drop the old unique constraint that restricted (episode_id, resolution)
ALTER TABLE public.episode_download_links 
DROP CONSTRAINT IF EXISTS episode_download_links_episode_id_resolution_key;

-- 2. Create a new unique index that includes language_type (handling null values as 'default')
CREATE UNIQUE INDEX IF NOT EXISTS episode_download_links_ep_res_lang_idx 
ON public.episode_download_links (episode_id, resolution, COALESCE(language_type, 'default'));
