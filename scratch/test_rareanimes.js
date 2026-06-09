const fs = require('fs');

async function run() {
    const url = "https://www.rareanimes.buzz/hindi/marriage-toxin-season-1-hindi-dubbed-episodes-";
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });

        console.log("Status:", res.status);
        const html = await res.text();
        console.log("HTML length:", html.length);
        
        fs.writeFileSync('d:/nexiplay-admin-main/scratch/rareanimes_sample.html', html, 'utf8');
        
        // Find zipper URLs
        const zipPattern = /href="([^"]*codedew[^"]*)"/gi;
        let match;
        console.log("Codedew/Zipper links found:");
        while ((match = zipPattern.exec(html)) !== null) {
            console.log(match[1]);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
