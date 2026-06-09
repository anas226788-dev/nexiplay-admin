import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = "https://codedew.com/zipper/?url=zHQc9CgXAbwSYP9i8vhlNBWYuWJccvrcb2YjjgeOugQJMlGWMpvRaVi8HxMmMl6jl70Yz%2BEf752i1se9J%2B7M0IvQkWpgadvSYYBIfaxYngjPJXgahYR3zvJ6UeH99kC5%2FfYT7mg%3D";
    const results: any = {};

    // Variation 1: CodeTabs with absolutely NO headers (completely clean fetch)
    try {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
        const start = Date.now();
        const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(10000),
            // Explicitly do not pass headers, or pass empty headers
        });
        results.codeTabsNoHeaders = {
            status: res.status,
            ok: res.ok,
            durationMs: Date.now() - start,
        };
        if (res.ok) {
            results.codeTabsNoHeaders.htmlLength = (await res.text()).length;
        } else {
            results.codeTabsNoHeaders.text = await res.text();
        }
    } catch (e: any) {
        results.codeTabsNoHeaders = { error: e.message };
    }

    // Variation 2: AllOrigins JSON API
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const start = Date.now();
        const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(10000),
        });
        results.allOriginsJson = {
            status: res.status,
            ok: res.ok,
            durationMs: Date.now() - start,
        };
        if (res.ok) {
            const data = await res.json();
            results.allOriginsJson.contentsLength = data.contents?.length || 0;
            results.allOriginsJson.containsAdStep2 = data.contents?.includes('ad_step=2') || false;
        } else {
            results.allOriginsJson.text = await res.text();
        }
    } catch (e: any) {
        results.allOriginsJson = { error: e.message };
    }

    // Variation 3: AllOrigins Raw API
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const start = Date.now();
        const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(10000),
        });
        results.allOriginsRaw = {
            status: res.status,
            ok: res.ok,
            durationMs: Date.now() - start,
        };
        if (res.ok) {
            results.allOriginsRaw.htmlLength = (await res.text()).length;
        } else {
            results.allOriginsRaw.text = await res.text();
        }
    } catch (e: any) {
        results.allOriginsRaw = { error: e.message };
    }

    return NextResponse.json(results);
}
