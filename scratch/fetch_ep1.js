async function run() {
    const url = "https://codedew.com/zipper/?url=7ghPdfBGzUUkrfZ3LLznmGmOqdaXo9Jq8mK%2FTJotqMD5t6laKp9djiAi%2F%2F3cEtasnUt8bCxLkdAzCOJCeicZ0DLCq85dsPt8QpE%2Fe%2Few3OE%3D";
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });

        console.log("Status:", res.status);
        const html = await res.text();
        const fs = require('fs');
        fs.writeFileSync('d:/nexiplay-admin-main/scratch/zipper_page_ep1.html', html, 'utf8');
        console.log("Saved ep1 HTML, length:", html.length);
        
        // Let's print all anchors in this ep1 HTML
        const anchorPattern = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        console.log("\nAll anchors in ep1:");
        while ((match = anchorPattern.exec(html)) !== null) {
            console.log(`Href: ${match[1]} | Text: ${match[2].replace(/<[^>]*>/g, '').trim()}`);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
