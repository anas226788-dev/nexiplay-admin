import { getAdminSupabase } from './supabase-admin';

export const DEFAULT_NEXIPLAY_ONESIGNAL_APP_ID = '69822dc3-4533-4b09-b105-d0ddaeb22c1f';

export const ANDROID_CHANNELS = {
    EPISODES: 'nexiplay_episodes_channel',
    RELEASES: 'nexiplay_releases_channel',
    ALERTS: 'nexiplay_alerts_channel',
} as const;

export interface PushSettingsRecord {
    provider: 'onesignal';
    onesignalAppId: string;
    onesignalRestApiKey: string;
    autoPushEpisodes: boolean;
    autoPushMovies: boolean;
    autoPushNotices: boolean;
    keySource: 'database' | 'env' | 'none';
    hasTableSupport: boolean;
}

export interface SendPushOptions {
    title: string;
    message: string;
    channelId?: string;
    posterUrl?: string | null;
    deepLink?: string | null;
    screen?: string | null;
    contentType?: string | null;
    slug?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    movieId?: string | null;
    noticeId?: string | null;
    notificationId?: string | null;
    trackingKey?: string | null;
    updateType?: 'episode' | 'season' | 'movie' | 'notice' | 'direct';
    targetUserIds?: string[];
    overrideAppId?: string;
    overrideRestApiKey?: string;
}

export interface SendPushResult {
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    notificationId?: string;
    recipients?: number;
    error?: string;
}

export function cleanContentSlug(rawSlug?: string | null): string {
    if (!rawSlug) return '';
    return rawSlug
        .trim()
        .split('?')[0]
        .replace(/^\/?(watch|content|anime|series|movie)\//i, '')
        .replace(/^\/+/, '')
        .split('/')
        .pop()
        ?.trim() || '';
}

export function stripHtmlTags(raw?: string | null): string {
    if (!raw) return '';
    return raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function getPushSettings(): Promise<PushSettingsRecord> {
    const envAppId =
        process.env.ONESIGNAL_APP_ID?.trim() ||
        process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() ||
        DEFAULT_NEXIPLAY_ONESIGNAL_APP_ID;
    const envRestKey = process.env.ONESIGNAL_REST_API_KEY?.trim() || '';

    try {
        const db = getAdminSupabase();
        const { data, error } = await db
            .from('push_notification_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (!error && data) {
            const dbKey = typeof data.onesignal_rest_api_key === 'string' ? data.onesignal_rest_api_key.trim() : '';
            const resolvedKey = dbKey || envRestKey;
            const keySource: 'database' | 'env' | 'none' = dbKey ? 'database' : envRestKey ? 'env' : 'none';

            return {
                provider: 'onesignal',
                onesignalAppId: data.onesignal_app_id?.trim() || envAppId,
                onesignalRestApiKey: resolvedKey,
                autoPushEpisodes: data.auto_push_episodes !== false,
                autoPushMovies: data.auto_push_movies !== false,
                autoPushNotices: data.auto_push_notices !== false,
                keySource,
                hasTableSupport: true,
            };
        }
    } catch {
        // Table not migrated yet; fall back cleanly to env vars
    }

    return {
        provider: 'onesignal',
        onesignalAppId: envAppId,
        onesignalRestApiKey: envRestKey,
        autoPushEpisodes: true,
        autoPushMovies: true,
        autoPushNotices: true,
        keySource: envRestKey ? 'env' : 'none',
        hasTableSupport: false,
    };
}

function maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 10) return '••••••••';
    return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

export async function getMaskedPushSettings() {
    const settings = await getPushSettings();
    return {
        provider: settings.provider,
        onesignalAppId: settings.onesignalAppId,
        hasRestApiKey: Boolean(settings.onesignalRestApiKey),
        maskedRestApiKey: maskKey(settings.onesignalRestApiKey),
        autoPushEpisodes: settings.autoPushEpisodes,
        autoPushMovies: settings.autoPushMovies,
        autoPushNotices: settings.autoPushNotices,
        keySource: settings.keySource,
        hasTableSupport: settings.hasTableSupport,
    };
}

function buildOneSignalAuthHeader(restApiKey: string): string {
    const trimmed = restApiKey.trim();
    if (trimmed.startsWith('os_v2_')) {
        return `Key ${trimmed}`;
    }
    return `Basic ${trimmed}`;
}

export async function sendOneSignalPush(options: SendPushOptions): Promise<SendPushResult> {
    try {
        const settings = await getPushSettings();
        const appId = options.overrideAppId?.trim() || settings.onesignalAppId || DEFAULT_NEXIPLAY_ONESIGNAL_APP_ID;
        const restApiKey = options.overrideRestApiKey?.trim() || settings.onesignalRestApiKey;

        if (!appId || !restApiKey) {
            return {
                ok: false,
                skipped: true,
                reason: 'OneSignal REST API Key is not configured yet.',
            };
        }

        const cleanType = options.contentType?.trim().toLowerCase() || undefined;
        const cleanSlug = cleanContentSlug(options.slug) || undefined;
        const seasonNumber = typeof options.seasonNumber === 'number' && options.seasonNumber > 0 ? options.seasonNumber : undefined;
        const episodeNumber = typeof options.episodeNumber === 'number' && options.episodeNumber > 0 ? options.episodeNumber : undefined;

        const queryParts: string[] = [];
        if (seasonNumber !== undefined) queryParts.push(`season=${seasonNumber}`);
        if (episodeNumber !== undefined) queryParts.push(`episode=${episodeNumber}`);
        const querySuffix = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

        const resolvedDeepLink =
            options.deepLink?.trim() ||
            (cleanType && cleanSlug ? `nexiplay://content/${cleanType}/${cleanSlug}${querySuffix}` : 'nexiplay://notifications');

        const trackingKey =
            options.trackingKey?.trim() ||
            (cleanSlug
                ? `${cleanSlug.toLowerCase()}_${options.updateType || (episodeNumber ? 'episode' : 'movie')}_s${seasonNumber ?? 0}_e${episodeNumber ?? 0}`
                : undefined);

        const dataPayload: Record<string, any> = {
            deep_link: resolvedDeepLink,
            url: resolvedDeepLink,
        };
        if (options.screen) dataPayload.screen = options.screen;
        if (cleanType) dataPayload.content_type = cleanType;
        if (cleanSlug) dataPayload.slug = cleanSlug;
        if (seasonNumber !== undefined) dataPayload.season_number = seasonNumber;
        if (episodeNumber !== undefined) dataPayload.episode_number = episodeNumber;
        if (options.movieId) dataPayload.movie_id = options.movieId;
        if (options.noticeId) dataPayload.notice_id = options.noticeId;
        if (options.notificationId) dataPayload.notification_id = options.notificationId;
        if (trackingKey) dataPayload.tracking_key = trackingKey;
        if (options.updateType) dataPayload.update_type = options.updateType;

        const payload: Record<string, any> = {
            app_id: appId,
            headings: { en: options.title },
            contents: { en: options.message },
            app_url: resolvedDeepLink,
            data: dataPayload,
            existing_android_channel_id: options.channelId || ANDROID_CHANNELS.EPISODES,
            small_icon: 'ic_stat_onesignal_default',
            large_icon: options.posterUrl?.trim() || 'ic_onesignal_large_icon_default',
            android_accent_color: 'FF9273F5',
            priority: 10,
            ttl: 259200,
            android_visibility: 1,
        };

        if (options.posterUrl?.trim()) {
            payload.big_picture = options.posterUrl.trim();
        }

        const uniqueUserIds = (options.targetUserIds || []).map((id) => id.trim()).filter(Boolean);
        if (uniqueUserIds.length > 0) {
            payload.include_aliases = { external_id: uniqueUserIds };
            payload.target_channel = 'push';
        } else {
            payload.included_segments = ['Total Subscriptions'];
        }

        const response = await fetch('https://api.onesignal.com/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: buildOneSignalAuthHeader(restApiKey),
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || (Array.isArray(result.errors) && result.errors.length > 0)) {
            const errText = Array.isArray(result.errors)
                ? result.errors.join(', ')
                : result.errors
                ? JSON.stringify(result.errors)
                : `HTTP ${response.status}`;
            console.warn('[OneSignal] Push error:', errText);
            return { ok: false, error: errText };
        }

        return {
            ok: true,
            notificationId: result.id,
            recipients: typeof result.recipients === 'number' ? result.recipients : 0,
        };
    } catch (err: any) {
        console.warn('[OneSignal] Push request failed:', err?.message || err);
        return { ok: false, error: err?.message || 'Push request failed' };
    }
}

export async function pushNewEpisodeNotification(params: {
    movieId?: string | null;
    title: string;
    slug: string;
    contentType?: string | null;
    posterUrl?: string | null;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    extraCount?: number;
}): Promise<SendPushResult> {
    const settings = await getPushSettings();
    if (!settings.autoPushEpisodes) {
        return { ok: false, skipped: true, reason: 'Auto-push for episodes is disabled.' };
    }

    const sNum = params.seasonNumber && params.seasonNumber > 0 ? params.seasonNumber : 1;
    const eNum = params.episodeNumber && params.episodeNumber > 0 ? params.episodeNumber : 1;
    const cleanType = params.contentType?.trim().toLowerCase() || 'anime';
    const batchSuffix = params.extraCount && params.extraCount > 1 ? ` (+${params.extraCount - 1} more)` : '';

    return sendOneSignalPush({
        title: `🔥 ${params.title} — S${sNum} · EP ${eNum}${batchSuffix}`,
        message: `Season ${sNum} · Episode ${eNum} is now streaming in Full HD! Tap to watch now.`,
        channelId: ANDROID_CHANNELS.EPISODES,
        posterUrl: params.posterUrl,
        contentType: cleanType,
        slug: params.slug,
        seasonNumber: sNum,
        episodeNumber: eNum,
        movieId: params.movieId,
        updateType: 'episode',
    });
}

export async function pushNewSeasonNotification(params: {
    movieId?: string | null;
    title: string;
    slug: string;
    contentType?: string | null;
    posterUrl?: string | null;
    seasonNumber?: number | null;
}): Promise<SendPushResult> {
    const settings = await getPushSettings();
    if (!settings.autoPushEpisodes) {
        return { ok: false, skipped: true, reason: 'Auto-push for episodes/seasons is disabled.' };
    }

    const sNum = params.seasonNumber && params.seasonNumber > 0 ? params.seasonNumber : 1;
    const cleanType = params.contentType?.trim().toLowerCase() || 'anime';

    return sendOneSignalPush({
        title: `✨ ${params.title} — Season ${sNum} Added`,
        message: `Full Season ${sNum} is now available in Full HD on Nexiplay. Tap to explore episodes.`,
        channelId: ANDROID_CHANNELS.RELEASES,
        posterUrl: params.posterUrl,
        contentType: cleanType,
        slug: params.slug,
        seasonNumber: sNum,
        movieId: params.movieId,
        updateType: 'season',
    });
}

export async function pushNewContentNotification(params: {
    movieId?: string | null;
    title: string;
    slug: string;
    contentType?: string | null;
    posterUrl?: string | null;
    releaseYear?: number | null;
    language?: string | null;
}): Promise<SendPushResult> {
    const settings = await getPushSettings();
    if (!settings.autoPushMovies) {
        return { ok: false, skipped: true, reason: 'Auto-push for new releases is disabled.' };
    }

    const cleanType = params.contentType?.trim().toLowerCase() || 'movie';
    const meta = [params.releaseYear ? String(params.releaseYear) : null, params.language?.trim() || null, 'Full HD']
        .filter(Boolean)
        .join(' • ');

    return sendOneSignalPush({
        title: `🎬 ${params.title} is Now on Nexiplay!`,
        message: `${meta} — Tap to view details, stream or download now.`,
        channelId: ANDROID_CHANNELS.RELEASES,
        posterUrl: params.posterUrl,
        contentType: cleanType,
        slug: params.slug,
        movieId: params.movieId,
        updateType: 'movie',
    });
}

export async function pushNoticeNotification(params: {
    noticeId?: string | null;
    content: string;
    imageUrl?: string | null;
    platform?: string | null;
}): Promise<SendPushResult> {
    const settings = await getPushSettings();
    if (!settings.autoPushNotices) {
        return { ok: false, skipped: true, reason: 'Auto-push for notices is disabled.' };
    }

    const platform = (params.platform || 'both').toLowerCase();
    if (!['all', 'app', 'both'].includes(platform)) {
        return { ok: false, skipped: true, reason: 'Notice targets web-only platform.' };
    }

    const cleanText = stripHtmlTags(params.content);
    if (!cleanText) {
        return { ok: false, skipped: true, reason: 'Empty notice text after stripping HTML.' };
    }

    return sendOneSignalPush({
        title: '📢 Nexiplay Official Update',
        message: cleanText.slice(0, 220),
        channelId: ANDROID_CHANNELS.ALERTS,
        posterUrl: params.imageUrl,
        deepLink: 'nexiplay://notifications',
        screen: 'notifications',
        noticeId: params.noticeId,
        updateType: 'notice',
    });
}

export async function pushDirectUserNotification(params: {
    userId: string;
    title?: string;
    message: string;
    notificationId?: string | null;
    deepLink?: string | null;
    contentType?: string | null;
    slug?: string | null;
}): Promise<SendPushResult> {
    return sendOneSignalPush({
        title: params.title?.trim() || '📩 Nexiplay Message',
        message: stripHtmlTags(params.message).slice(0, 240),
        channelId: ANDROID_CHANNELS.ALERTS,
        deepLink: params.deepLink || 'nexiplay://notifications',
        screen: params.slug ? 'content' : 'notifications',
        contentType: params.contentType,
        slug: params.slug,
        notificationId: params.notificationId,
        targetUserIds: [params.userId],
        updateType: 'direct',
    });
}
