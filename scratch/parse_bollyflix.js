const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/bollyflix_sample.html', 'utf8');

// Find all anchor tags
const linkPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
let match;
const links = [];
while ((match = linkPattern.exec(html)) !== null) {
    links.push({
        href: match[1],
        text: match[2].replace(/<[^>]*>/g, '').trim()
    });
}

console.log("Total links found:", links.length);
console.log("Sample links with keywords (download, drive, gdrive, fast):");
links.forEach(l => {
    const textLower = l.text.toLowerCase();
    const hrefLower = l.href.toLowerCase();
    if (textLower.includes('download') || textLower.includes('drive') || textLower.includes('gdrive') || textLower.includes('fast') || hrefLower.includes('drive') || hrefLower.includes('fastdlserver') || hrefLower.includes('linksmod')) {
        console.log(`Text: "${l.text}" | Href: "${l.href}"`);
    }
});
