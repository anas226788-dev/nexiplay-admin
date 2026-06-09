const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/rareanimes_sample.html', 'utf8');

// Find all anchor tags
const anchorPattern = /<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
let match;
let count = 0;
while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text.toLowerCase().includes('mega')) {
        count++;
        console.log(`Mega Link ${count}: Text: "${text}", Href: "${href}"`);
    }
}

console.log("Total Mega links found:", count);
