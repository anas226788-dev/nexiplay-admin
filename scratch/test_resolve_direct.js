const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
};

async function resolveZipperToMega(zipperUrl) {
    const step1Res = await fetch(zipperUrl, {
        headers: HEADERS,
    });
    if (!step1Res.ok) {
        throw new Error(`Zipper step1 HTTP ${step1Res.status}`);
    }
    const step1Html = await step1Res.text();

    const cookies = [];
    const rawSetCookie = step1Res.headers.get('set-cookie');
    if (rawSetCookie) {
        const parts = rawSetCookie.split(/,\s*(?=\w+=)/);
        for (const part of parts) {
            const name = part.split(';')[0]?.trim();
            if (name) cookies.push(name);
        }
    }

    const step2Match = step1Html.match(/href="([^"]*ad_step=2[^"]*)"/i);
    if (!step2Match) {
        const directMega = step1Html.match(/href="(https:\/\/mega\.nz\/[^"]+)"/i);
        if (directMega) return directMega[1];
        throw new Error('Could not find ad_step=2 link in zipper page');
    }

    const step2Path = step2Match[1].replace(/&amp;/g, '&');
    const zipperOrigin = new URL(zipperUrl).origin;
    const step2Url = step2Path.startsWith('http') ? step2Path : `${zipperOrigin}${step2Path}`;

    const step2Res = await fetch(step2Url, {
        headers: {
            ...HEADERS,
            'Referer': zipperUrl,
            ...(cookies.length > 0 ? { 'Cookie': cookies.join('; ') } : {}),
        },
    });

    if (!step2Res.ok) {
        throw new Error(`Zipper step2 HTTP ${step2Res.status}`);
    }
    const step2Html = await step2Res.text();

    const megaMatch = step2Html.match(/href="(https:\/\/mega\.nz\/[^"]+)"/i);
    if (!megaMatch) {
        const anyExternal = step2Html.match(/href="(https?:\/\/(?!codedew\.com)[^"]+)"/i);
        if (anyExternal) return anyExternal[1];
        throw new Error('Could not find Mega.nz link in step2 page');
    }

    return megaMatch[1];
}

async function run() {
    const url = "https://codedew.com/zipper/?url=zHQc9CgXAbwSYP9i8vhlNBWYuWJccvrcb2YjjgeOugQJMlGWMpvRaVi8HxMmMl6jl70Yz%2BEf752i1se9J%2B7M0IvQkWpgadvSYYBIfaxYngjPJXgahYR3zvJ6UeH99kC5%2FfYT7mg%3D";
    try {
        const mega = await resolveZipperToMega(url);
        console.log("Resolved Mega URL:", mega);
    } catch (e) {
        console.error("Resolution failed:", e.message);
    }
}

run();
