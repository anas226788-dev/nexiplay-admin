const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/zipper_page.html', 'utf8');

const anchorPattern = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
let match;
console.log("All anchors:");
while ((match = anchorPattern.exec(html)) !== null) {
    console.log(`Href: ${match[1]} | Text: ${match[2].replace(/<[^>]*>/g, '').trim()}`);
}
