import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'nexi_admin_session';

function getSessionSecret(): Uint8Array {
    const secret = process.env.ADMIN_SESSION_SECRET || 'nexi_sess_7a3d9e2b1f8c054e8921';
    return new TextEncoder().encode(secret);
}

export function getAdminPassword(): string {
    return process.env.ADMIN_PASSWORD || 'nexiplay_admin_secure_2026!';
}

export async function createSessionToken(payload: { role: string } = { role: 'admin' }, rememberMe = true): Promise<string> {
    const exp = rememberMe ? '30d' : '24h';
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(getSessionSecret());
}

export async function verifySessionToken(token: string): Promise<boolean> {
    try {
        if (!token) return false;
        const { payload } = await jwtVerify(token, getSessionSecret());
        return Boolean(payload && payload.role === 'admin');
    } catch {
        return false;
    }
}
