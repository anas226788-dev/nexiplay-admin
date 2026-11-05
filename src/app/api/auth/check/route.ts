import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
        const isValid = token ? await verifySessionToken(token) : false;

        return NextResponse.json({ authenticated: isValid }, { status: 200 });
    } catch {
        return NextResponse.json({ authenticated: false }, { status: 200 });
    }
}
