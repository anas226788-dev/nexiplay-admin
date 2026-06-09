async function run() {
    const url = "https://fastdlserver.site/?id=Q09zQTc5Q2ZHcjd5Mks1VG41MDBWQ3hZTTdzYXZSTXcxaWxOeWpnc2xsajdDbURaYkZhMWYyWENtUEpORnJZeg==&type=file";
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });
        console.log("Status:", res.status);
        console.log("Headers:", [...res.headers.entries()]);
        const html = await res.text();
        console.log("HTML length:", html.length);
        console.log("Contains drive.google.com?", html.includes('drive.google.com'));
        console.log("Contains google?", html.includes('google'));
        
        // Find links
        const linkPattern = /href="([^"]+)"/gi;
        let match;
        console.log("Links inside fastdlserver:");
        while ((match = linkPattern.exec(html)) !== null) {
            console.log(match[1]);
        }
        
        // Let's print the HTML just in case
        console.log("\n\nHTML source:\n", html.substring(0, 2000));
    } catch (e) {
        console.error(e);
    }
}

run();
