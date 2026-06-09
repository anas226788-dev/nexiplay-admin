async function testProxy(name, proxyUrl, targetUrl) {
    console.log(`\nTesting proxy: ${name}`);
    const fullUrl = proxyUrl + encodeURIComponent(targetUrl);
    try {
        const res = await fetch(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout(10000)
        });
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const html = await res.text();
            console.log(`HTML Length: ${html.length}`);
            const matches = html.includes('ad_step=2') || html.includes('mega.nz') || html.includes('S1 E1');
            console.log(`Contains expected content? ${matches}`);
        } else {
            console.log("Response text:", await res.text());
        }
    } catch (e) {
        console.log(`Error: ${e.message}`);
    }
}

async function run() {
    const targetUrl = "https://codedew.com/zipper/?url=zHQc9CgXAbwSYP9i8vhlNBWYuWJccvrcb2YjjgeOugQJMlGWMpvRaVi8HxMmMl6jl70Yz%2BEf752i1se9J%2B7M0IvQkWpgadvSYYBIfaxYngjPJXgahYR3zvJ6UeH99kC5%2FfYT7mg%3D";
    await testProxy("ThingProxy", "https://thingproxy.freeboard.io/fetch/", targetUrl);
}

run();
