-- Migration: Add agentic pipeline automation fields to content_requests
-- Safe: all columns are nullable with defaults, fully backwards-compatible

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'idle';

-- Add check constraint for processing_status
DO $$ BEGIN
  ALTER TABLE public.content_requests 
    ADD CONSTRAINT content_requests_processing_status_check 
    CHECK (processing_status IN ('idle','processing','completed','failed','no_match','duplicate','skipped'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS last_processing_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS automation_error TEXT DEFAULT NULL;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS matched_source TEXT DEFAULT NULL;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS matched_source_url TEXT DEFAULT NULL;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS confidence_score REAL DEFAULT NULL;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS suggested_categories JSONB DEFAULT NULL;

ALTER TABLE public.content_requests 
  ADD COLUMN IF NOT EXISTS automation_log JSONB DEFAULT '[]'::jsonb;

-- Index for efficient pending request pickup by the cron worker
CREATE INDEX IF NOT EXISTS idx_content_requests_pending_processing 
  ON public.content_requests (status, processing_status) 
  WHERE status = 'pending' AND processing_status IN ('idle', 'failed');
