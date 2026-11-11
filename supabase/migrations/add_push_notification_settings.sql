-- =================================================================
-- Push Notification Settings (Server-Only OneSignal Config)
-- Keeps ONESIGNAL_REST_API_KEY isolated from public anon/client access.
-- =================================================================

CREATE TABLE IF NOT EXISTS public.push_notification_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    provider TEXT NOT NULL DEFAULT 'onesignal',
    onesignal_app_id TEXT NOT NULL DEFAULT '69822dc3-4533-4b09-b105-d0ddaeb22c1f',
    onesignal_rest_api_key TEXT DEFAULT '',
    auto_push_episodes BOOLEAN NOT NULL DEFAULT true,
    auto_push_movies BOOLEAN NOT NULL DEFAULT true,
    auto_push_notices BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.push_notification_settings (
    id,
    provider,
    onesignal_app_id,
    onesignal_rest_api_key,
    auto_push_episodes,
    auto_push_movies,
    auto_push_notices
)
VALUES (
    1,
    'onesignal',
    '69822dc3-4533-4b09-b105-d0ddaeb22c1f',
    '',
    true,
    true,
    true
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.push_notification_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.push_notification_settings FROM anon;
REVOKE ALL ON public.push_notification_settings FROM authenticated;
