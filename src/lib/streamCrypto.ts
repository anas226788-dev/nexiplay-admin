import crypto from 'crypto';

function getSecret(): string {
    const secret = process.env.STREAM_API_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('STREAM_API_SECRET environment variable is required.');
        }
        return 'dev_only_stream_secret_change_in_env';
    }
    return secret;
}

// Derive a 32-byte key from secret
function getEncryptionKey(): Buffer {
    return crypto.createHash('sha256').update(getSecret()).digest();
}

export type EncryptedStreamPayload = {
    url: string;
    server: string;
    cookies?: string;
    format?: 'hls_stream' | 'embed_stream';
    contentId?: string;
    slug?: string;
    season?: number;
    episode?: number;
    createdAt: number;
    expiresAt: number;
};

/**
 * Encrypts stream payload into an AES-256-CBC token with IV and timestamp
 */
export function encryptStream(payload: EncryptedStreamPayload): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    const serialized = JSON.stringify(payload);
    let encrypted = cipher.update(serialized, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Format: iv:encrypted_payload
    return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts stream payload and validates expiration
 */
export function decryptStream(token: string): EncryptedStreamPayload | null {
    try {
        const parts = token.split(':');
        if (parts.length !== 2) return null;

        const [ivHex, encryptedHex] = parts;
        const key = getEncryptionKey();
        const iv = Buffer.from(ivHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        const payload: EncryptedStreamPayload = JSON.parse(decrypted);

        // Check token expiration (e.g., 2 hours validity)
        if (payload.expiresAt && Date.now() > payload.expiresAt) {
            console.warn('[Stream Crypto] Token expired:', new Date(payload.expiresAt));
            return null;
        }

        return payload;
    } catch (e: any) {
        console.error('[Stream Crypto] Decryption error:', e.message);
        return null;
    }
}
