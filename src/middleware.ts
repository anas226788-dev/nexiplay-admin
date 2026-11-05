import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

// Public endpoints and static assets that never require admin authentication
const PUBLIC_PREFIXES = [
    '/login',
    '/api/auth',
    '/_next',
    '/favicon.ico',
    '/embed',              // embed players
    '/api/v1',             // app playback / streaming APIs
    '/api/novel-cover',    // public image proxy
    '/api/cron',           // cron endpoints
    '/api/streaming/search',
];

const STATIC_EXTENSIONS = /\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|txt|xml|woff|woff2|ttf)$/i;

export async function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    // 1. Skip static assets
    if (STATIC_EXTENSIONS.test(pathname)) {
        return NextResponse.next();
    }

    // 2. Check public path exemptions
    for (const prefix of PUBLIC_PREFIXES) {
        if (pathname === prefix || pathname.startsWith(prefix + '/')) {
            // If already authenticated and accessing /login, redirect to dashboard
            if (pathname === '/login') {
                const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
                if (token && (await verifySessionToken(token))) {
                    return NextResponse.redirect(new URL('/', request.url));
                }
            }
            return NextResponse.next();
        }
    }

    // 3. Verify session token for all protected admin routes
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const isAuthenticated = token ? await verifySessionToken(token) : false;

    if (!isAuthenticated) {
        // If it's an API request, return 401 Unauthorized
        if (pathname.startsWith('/api/')) {
            return NextResponse.json(
                { error: 'Unauthorized: Admin authentication required.' },
                { status: 401 }
            );
        }

        // For page requests, redirect to login page with redirect URL
        const redirectTarget = pathname + (search || '');
        const loginUrl = new URL('/login', request.url);
        if (pathname !== '/') {
            loginUrl.searchParams.set('redirect', redirectTarget);
        }
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
