import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function sameOrigin(req: Request) {
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

export async function GET(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const key = process.env.TMDB_API_KEY?.trim() || '';
    const masked = key ? `${key.slice(0, 4)}...${key.slice(-4)}` : '';

    return NextResponse.json({
        configured: Boolean(key),
        maskedKey: masked,
        apiKey: key,
        nonCommercialConfirmed: process.env.TMDB_NONCOMMERCIAL_USE_CONFIRMED === 'true',
    });
}

export async function POST(req: Request) {
    if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { apiKey } = await req.json();
        const trimmed = typeof apiKey === 'string' ? apiKey.trim() : '';

        if (!trimmed || trimmed.length < 15) {
            return NextResponse.json({ error: 'Please provide a valid TMDB API key.' }, { status: 400 });
        }

        // Test the API key against TMDB
        const testRes = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${trimmed}`, {
            signal: AbortSignal.timeout(6000),
        });

        if (!testRes.ok) {
            return NextResponse.json({ error: 'TMDB rejected this API key. Please check the key and try again.' }, { status: 400 });
        }

        // Update process.env in memory
        process.env.TMDB_API_KEY = trimmed;
        process.env.TMDB_NONCOMMERCIAL_USE_CONFIRMED = 'true';

        // Update .env.local in admin workspace
        const envLocalAdmin = path.join(process.cwd(), '.env.local');
        let contentAdmin = fs.existsSync(envLocalAdmin) ? fs.readFileSync(envLocalAdmin, 'utf8') : '';

        if (contentAdmin.includes('TMDB_API_KEY=')) {
            contentAdmin = contentAdmin.replace(/TMDB_API_KEY=.*/g, `TMDB_API_KEY=${trimmed}`);
        } else {
            contentAdmin += `\nTMDB_API_KEY=${trimmed}\n`;
        }
        if (!contentAdmin.includes('TMDB_NONCOMMERCIAL_USE_CONFIRMED=')) {
            contentAdmin += `TMDB_NONCOMMERCIAL_USE_CONFIRMED=true\n`;
        }
        fs.writeFileSync(envLocalAdmin, contentAdmin, 'utf8');

        // Also update .env.local in web workspace (d:\nexiplay-web-main)
        const webEnvPath = path.resolve(process.cwd(), '../nexiplay-web-main/.env.local');
        if (fs.existsSync(webEnvPath)) {
            let webContent = fs.readFileSync(webEnvPath, 'utf8');
            if (webContent.includes('TMDB_API_KEY=')) {
                webContent = webContent.replace(/TMDB_API_KEY=.*/g, `TMDB_API_KEY=${trimmed}`);
            } else {
                webContent += `\nTMDB_API_KEY=${trimmed}\n`;
            }
            if (!webContent.includes('TMDB_NONCOMMERCIAL_USE_CONFIRMED=')) {
                webContent += `TMDB_NONCOMMERCIAL_USE_CONFIRMED=true\n`;
            }
            fs.writeFileSync(webEnvPath, webContent, 'utf8');
        }

        return NextResponse.json({
            success: true,
            message: 'TMDB API key verified and saved successfully across Admin and Web!',
        });
    } catch (err) {
        console.error('[TMDB Config] Error:', err);
        return NextResponse.json({ error: 'Failed to save TMDB configuration.' }, { status: 500 });
    }
}
