import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export interface StreamApiSettings {
    isEnabled: boolean;
    accessMode: 'strict' | 'demo_allowed' | 'open';
    defaultTtlSeconds: number;
    requireOriginMatch: boolean;
    updatedAt: string;
}

export interface StreamApiKey {
    id: string;
    name: string;
    key: string;
    type: 'test' | 'production';
    isActive: boolean;
    allowedOrigins: string[];
    rateLimitPerDay: number;
    totalRequests: number;
    lastUsedAt?: string | null;
    lastUsedIp?: string | null;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface LocalStorageData {
    settings: StreamApiSettings;
    keys: StreamApiKey[];
}

const DEFAULT_SETTINGS: StreamApiSettings = {
    isEnabled: true,
    accessMode: 'demo_allowed',
    defaultTtlSeconds: 7200, // 2 Hours
    requireOriginMatch: false,
    updatedAt: new Date().toISOString()
};

// Fallback JSON storage path across both apps
const FALLBACK_DIR = path.join(process.cwd(), 'data');
const FALLBACK_FILE = path.join(FALLBACK_DIR, 'stream_api_control.json');

function ensureLocalFile(): LocalStorageData {
    try {
        if (!fs.existsSync(FALLBACK_DIR)) {
            fs.mkdirSync(FALLBACK_DIR, { recursive: true });
        }
        if (!fs.existsSync(FALLBACK_FILE)) {
            const initial: LocalStorageData = {
                settings: DEFAULT_SETTINGS,
                keys: [
                    {
                        id: 'demo-production-key-1',
                        name: 'NexiPlay Web & Official Apps',
                        key: 'nxp_live_nexiplay_official_core_prod',
                        type: 'production',
                        isActive: true,
                        allowedOrigins: ['*'],
                        rateLimitPerDay: 0,
                        totalRequests: 0,
                        lastUsedAt: null,
                        lastUsedIp: null,
                        expiresAt: null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                ]
            };
            fs.writeFileSync(FALLBACK_FILE, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
        }
        const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return { settings: DEFAULT_SETTINGS, keys: [] };
    }
}

function saveLocalFile(data: LocalStorageData): void {
    try {
        if (!fs.existsSync(FALLBACK_DIR)) {
            fs.mkdirSync(FALLBACK_DIR, { recursive: true });
        }
        fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e: any) {
        console.warn('[StreamApiKeyService] Fallback file save failed:', e.message);
    }
}

/**
 * 1. Get Stream API Settings
 */
export async function getStreamApiSettings(): Promise<StreamApiSettings> {
    try {
        const { data, error } = await supabase
            .from('stream_api_settings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (!error && data) {
            return {
                isEnabled: data.is_enabled ?? true,
                accessMode: data.access_mode ?? 'demo_allowed',
                defaultTtlSeconds: data.default_ttl_seconds ?? 7200,
                requireOriginMatch: data.require_origin_match ?? false,
                updatedAt: data.updated_at || new Date().toISOString()
            };
        }
    } catch {
        // Fallback below
    }

    const local = ensureLocalFile();
    return local.settings || DEFAULT_SETTINGS;
}

/**
 * 2. Update Stream API Settings
 */
export async function updateStreamApiSettings(updates: Partial<StreamApiSettings>): Promise<StreamApiSettings> {
    const current = await getStreamApiSettings();
    const updated: StreamApiSettings = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString()
    };

    // Try Supabase update
    try {
        await supabase
            .from('stream_api_settings')
            .upsert({
                id: 1,
                is_enabled: updated.isEnabled,
                access_mode: updated.accessMode,
                default_ttl_seconds: updated.defaultTtlSeconds,
                require_origin_match: updated.requireOriginMatch,
                updated_at: updated.updatedAt
            });
    } catch {
        // Ignore, fallback saved below
    }

    const local = ensureLocalFile();
    local.settings = updated;
    saveLocalFile(local);
    return updated;
}

/**
 * 3. Get all API Keys
 */
export async function getStreamApiKeys(): Promise<StreamApiKey[]> {
    try {
        const { data, error } = await supabase
            .from('stream_api_keys')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
            return data.map((row: any) => ({
                id: row.id,
                name: row.name,
                key: row.key,
                type: row.type || 'production',
                isActive: row.is_active ?? true,
                allowedOrigins: row.allowed_origins || ['*'],
                rateLimitPerDay: row.rate_limit_per_day || 0,
                totalRequests: Number(row.total_requests || 0),
                lastUsedAt: row.last_used_at,
                lastUsedIp: row.last_used_ip,
                expiresAt: row.expires_at,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        }
    } catch {
        // Fallback below
    }

    const local = ensureLocalFile();
    return local.keys || [];
}

/**
 * 4. Create / Issue a new API Key
 */
export async function createStreamApiKey(params: {
    name: string;
    type?: 'test' | 'production';
    allowedOrigins?: string[];
    rateLimitPerDay?: number;
    expiresAt?: string | null;
}): Promise<StreamApiKey> {
    const prefix = params.type === 'test' ? 'nxp_test_' : 'nxp_live_';
    const randomHex = crypto.randomBytes(18).toString('hex');
    const fullKey = `${prefix}${randomHex}`;
    const now = new Date().toISOString();

    const newKey: StreamApiKey = {
        id: crypto.randomUUID(),
        name: params.name.trim(),
        key: fullKey,
        type: params.type || 'production',
        isActive: true,
        allowedOrigins: (params.allowedOrigins && params.allowedOrigins.length > 0) ? params.allowedOrigins : ['*'],
        rateLimitPerDay: params.rateLimitPerDay || 0,
        totalRequests: 0,
        lastUsedAt: null,
        lastUsedIp: null,
        expiresAt: params.expiresAt || null,
        createdAt: now,
        updatedAt: now
    };

    // Try Supabase insert
    try {
        await supabase.from('stream_api_keys').insert({
            id: newKey.id,
            name: newKey.name,
            key: newKey.key,
            type: newKey.type,
            is_active: newKey.isActive,
            allowed_origins: newKey.allowedOrigins,
            rate_limit_per_day: newKey.rateLimitPerDay,
            total_requests: 0,
            expires_at: newKey.expiresAt,
            created_at: newKey.createdAt,
            updated_at: newKey.updatedAt
        });
    } catch {
        // Ignore, fallback saved below
    }

    const local = ensureLocalFile();
    local.keys.unshift(newKey);
    saveLocalFile(local);
    return newKey;
}

/**
 * 5. 1-Click Toggle Active / Disabled state of a key
 */
export async function toggleStreamApiKey(id: string, isActive: boolean): Promise<StreamApiKey | null> {
    const now = new Date().toISOString();

    // Try Supabase
    try {
        await supabase
            .from('stream_api_keys')
            .update({ is_active: isActive, updated_at: now })
            .eq('id', id);
    } catch {
        // Fallback
    }

    const local = ensureLocalFile();
    const idx = local.keys.findIndex(k => k.id === id);
    if (idx !== -1) {
        local.keys[idx].isActive = isActive;
        local.keys[idx].updatedAt = now;
        saveLocalFile(local);
        return local.keys[idx];
    }
    return null;
}

/**
 * 6. Delete a key
 */
export async function deleteStreamApiKey(id: string): Promise<boolean> {
    try {
        await supabase.from('stream_api_keys').delete().eq('id', id);
    } catch {
        // Fallback
    }

    const local = ensureLocalFile();
    const beforeLen = local.keys.length;
    local.keys = local.keys.filter(k => k.id !== id);
    if (local.keys.length !== beforeLen) {
        saveLocalFile(local);
        return true;
    }
    return false;
}

/**
 * 7. Validate Client Access on the API Endpoint
 */
export async function validateApiKeyAccess(
    providedKey?: string | null,
    originHeader?: string | null,
    refererHeader?: string | null
): Promise<{ allowed: boolean; reason?: string; statusCode?: number; keyRecord?: StreamApiKey }> {
    const settings = await getStreamApiSettings();

    // 1. Global Master Switch check
    if (!settings.isEnabled) {
        return {
            allowed: false,
            statusCode: 503,
            reason: 'Stream API is temporarily disabled by administrator.'
        };
    }

    // 2. Open Access Mode
    if (settings.accessMode === 'open') {
        return { allowed: true };
    }

    // 3. Demo Allowed Mode: Internal local demo requests can proceed
    let clientOrigin = originHeader || '';
    if (!clientOrigin && refererHeader) {
        try {
            clientOrigin = new URL(refererHeader).origin;
        } catch {
            clientOrigin = refererHeader;
        }
    }
    const isLocalOrInternal = clientOrigin.includes('localhost') || clientOrigin.includes('127.0.0.1') || clientOrigin.includes('nexiplay');

    if (settings.accessMode === 'demo_allowed' && !providedKey && isLocalOrInternal) {
        return { allowed: true };
    }

    // 4. If key is missing
    if (!providedKey || !providedKey.trim()) {
        return {
            allowed: false,
            statusCode: 401,
            reason: 'Authentication required: Missing API key. Pass ?apiKey=YOUR_KEY or Header x-api-key.'
        };
    }

    // 5. Look up key
    const allKeys = await getStreamApiKeys();
    const keyRecord = allKeys.find(k => k.key === providedKey.trim());

    if (!keyRecord) {
        return {
            allowed: false,
            statusCode: 403,
            reason: 'Access denied: Invalid API key.'
        };
    }

    // 6. Check Active state
    if (!keyRecord.isActive) {
        return {
            allowed: false,
            statusCode: 403,
            reason: 'Access denied: This API key has been disabled or suspended by administrator.'
        };
    }

    // 7. Check expiration date
    if (keyRecord.expiresAt && new Date(keyRecord.expiresAt).getTime() < Date.now()) {
        return {
            allowed: false,
            statusCode: 403,
            reason: 'Access denied: This API key has expired.'
        };
    }

    // 8. Check Allowed Origins / Domains
    if (settings.requireOriginMatch && keyRecord.allowedOrigins && !keyRecord.allowedOrigins.includes('*')) {
        const originMatched = keyRecord.allowedOrigins.some(pattern => {
            if (!clientOrigin) return false;
            return clientOrigin.includes(pattern.replace(/^https?:\/\//, '').replace(/\/$/, ''));
        });
        if (!originMatched) {
            return {
                allowed: false,
                statusCode: 403,
                reason: `Access denied: Domain "${clientOrigin || 'Unknown'}" is not authorized for this API key.`
            };
        }
    }

    return { allowed: true, keyRecord };
}

/**
 * 8. Increment request counter
 */
export async function recordApiKeyUsage(keyStr: string, clientIp?: string): Promise<void> {
    const now = new Date().toISOString();
    try {
        const { data } = await supabase
            .from('stream_api_keys')
            .select('total_requests')
            .eq('key', keyStr)
            .maybeSingle();

        const currentRequests = Number(data?.total_requests || 0) + 1;

        await supabase
            .from('stream_api_keys')
            .update({
                total_requests: currentRequests,
                last_used_at: now,
                last_used_ip: clientIp || null
            })
            .eq('key', keyStr);
    } catch {
        // Fallback below
    }

    const local = ensureLocalFile();
    const k = local.keys.find(x => x.key === keyStr);
    if (k) {
        k.totalRequests = (k.totalRequests || 0) + 1;
        k.lastUsedAt = now;
        if (clientIp) k.lastUsedIp = clientIp;
        saveLocalFile(local);
    }
}
