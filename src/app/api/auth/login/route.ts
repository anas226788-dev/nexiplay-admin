import { NextResponse } from 'next/server';
import { createSessionToken, getAdminPassword, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password, rememberMe } = body;

        if (!password || typeof password !== 'string') {
            return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }

        const expectedPassword = getAdminPassword();

        if (password !== expectedPassword) {
            return NextResponse.json({ error: 'Incorrect admin password' }, { status: 401 });
        }

        const isRemember = rememberMe !== false;
        const token = await createSessionToken({ role: 'admin' }, isRemember);

        const maxAge = isRemember ? 60 * 60 * 24 * 30 : 60 * 60 * 24; // 30 days or 1 day

        const response = NextResponse.json(
            { success: true, message: 'Authentication successful' },
            { status: 200 }
        );

        response.cookies.set({
            name: SESSION_COOKIE_NAME,
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge,
        });

        return response;
    } catch (error: any) {
        console.error('Login Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
