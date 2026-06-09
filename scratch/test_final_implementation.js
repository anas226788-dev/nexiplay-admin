const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchHtmlWithProxy(url, referer, cookies) {
    const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;
    
    // Try CodeTabs first
    try {
        const headers = { ...HEADERS };
        if (referer) headers['Referer'] = referer;
        if (cookies && cookies.length > 0) headers['Cookie'] = cookies.join('; ');
        
        console.log(`Fetching via CodeTabs proxy: ${url}`);
        const res = await fetch(proxyUrl, {
            headers,
            signal: AbortSignal.timeout(12000),
        });
        
        if (res.ok) {
            const html = await res.text();
            return {
                html,
                status: res.status,
                ok: true,
                setCookieHeader: res.headers.get('set-cookie')
            };
        }
        console.warn(`CodeTabs returned non-ok status: ${res.status}`);
    } catch (err) {
        console.warn(`CodeTabs proxy fetch failed: ${err.message}`);
    }
    
    // Fallback to direct fetch
    console.log(`Falling back to direct fetch: ${url}`);
    const headers = { ...HEADERS };
    if (referer) headers['Referer'] = referer;
    if (cookies && cookies.length > 0) headers['Cookie'] = cookies.join('; ');
    
    const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(12000),
    });
    
    const html = await res.text();
    return {
        html,
        status: res.status,
        ok: res.ok,
        setCookieHeader: res.headers.get('set-cookie')
    };
}

async function resolveZipperToMega(zipperUrl) {
    try {
        const step1 = await fetchHtmlWithProxy(zipperUrl);
        if (!step1.ok) {
            console.warn(`Zipper step1 failed (status ${step1.status}), using zipper URL directly`);
            return zipperUrl;
        }

        const cookies = [];
        if (step1.setCookieHeader) {
            const parts = step1.setCookieHeader.split(/,\s*(?=\w+=)/);
            for (const part of parts) {
                const name = part.split(';')[0]?.trim();
                if (name) cookies.push(name);
            }
        }

        const step2Match = step1.html.match(/href="([^"]*ad_step=2[^"]*)"/i);
        if (!step2Match) {
            const directMega = step1.html.match(/href="(https:\/\/mega\.nz\/[^"]+)"/i);
            if (directMega) return directMega[1];
            return zipperUrl;
        }

        const step2Path = step2Match[1].replace(/&amp;/g, '&');
        const zipperOrigin = new URL(zipperUrl).origin;
        const step2Url = step2Path.startsWith('http') ? step2Path : `${zipperOrigin}${step2Path}`;

        const step2 = await fetchHtmlWithProxy(step2Url, zipperUrl, cookies);
        if (!step2.ok) {
            console.warn(`Zipper step2 failed (status ${step2.status}), using zipper URL directly`);
            return zipperUrl;
        }

        const megaMatch = step2.html.match(/href="(https:\/\/mega\.nz\/[^"]+)"/i);
        if (!megaMatch) {
            const anyExternal = step2.html.match(/href="(https?:\/\/(?!codedew\.com)[^"]+)"/i);
            if (anyExternal) return anyExternal[1];
            return zipperUrl;
        }

        return megaMatch[1];
    } catch (e) {
        console.warn(`Failed to resolve zipper URL (${e.message}), falling back to zipper URL`);
        return zipperUrl;
    }
}

async function run() {
    const url = "https://codedew.com/zipper/?url=zHQc9CgXAbwSYP9i8vhlNBWYuWJccvrcb2YjjgeOugQJMlGWMpvRaVi8HxMmMl6jl70Yz%2BEf752i1se9J%2B7M0IvQkWpgadvSYYBIfaxYngjPJXgahYR3zvJ6UeH99kC5%2FfYT7mg%3D";
    const mega = await resolveZipperToMega(url);
    console.log("FINAL RESULT:", mega);
}

run();
