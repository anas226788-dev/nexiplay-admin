import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = "https://codedew.com/zipper/?url=zHQc9CgXAbwSYP9i8vhlNBWYuWJccvrcb2YjjgeOugQJMlGWMpvRaVi8HxMmMl6jl70Yz%2BEf752i1se9J%2B7M0IvQkWpgadvSYYBIfaxYngjPJXgahYR3zvJ6UeH99kC5%2FfYT7mg%3D";
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    
    const results: any = {
        time: new Date().toISOString(),
        targetUrl: url,
        proxyUrl: proxyUrl,
    };

    // 1. Test CodeTabs
    try {
        const start = Date.now();
        const res = await fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(10000),
        });
        results.codeTabs = {
            status: res.status,
            ok: res.ok,
            durationMs: Date.now() - start,
        };
        if (res.ok) {
            const html = await res.text();
            results.codeTabs.htmlLength = html.length;
            results.codeTabs.containsAdStep2 = html.includes('ad_step=2') || html.includes('ad_step');
            results.codeTabs.containsMega = html.includes('mega.nz');
            results.codeTabs.htmlSnippet = html.substring(0, 500);
        } else {
            results.codeTabs.text = await res.text();
        }
    } catch (e: any) {
        results.codeTabs = {
            error: e.message,
        };
    }

    // 2. Test Direct Fetch
    try {
        const start = Date.now();
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(10000),
        });
        results.direct = {
            status: res.status,
            ok: res.ok,
            durationMs: Date.now() - start,
        };
        if (res.ok) {
            results.direct.htmlLength = (await res.text()).length;
        } else {
            results.direct.text = (await res.text()).substring(0, 500);
        }
    } catch (e: any) {
        results.direct = {
            error: e.message,
        };
    }

    return NextResponse.json(results);
}
