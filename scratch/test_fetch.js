const fs = require('fs');

async function run() {
    const url = "https://bollyflix.med/vettaiyan-2024-dual-audio-hindi-tamil-movie/";
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!res.ok) {
        console.error(`Fetch failed: HTTP ${res.status}`);
        return;
    }

    const html = await res.text();
    fs.writeFileSync('d:/nexiplay-admin-main/scratch/bollyflix_sample.html', html, 'utf8');
    console.log("Saved HTML! Size:", html.length);
}

run();
