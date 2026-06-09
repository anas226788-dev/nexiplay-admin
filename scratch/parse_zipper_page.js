const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/rareanimes_sample.html', 'utf8');

console.log("HTML Length:", html.length);

// Find any links
const linkPattern = /href="([^"]+)"/gi;
let match;
console.log("\nLinks in zipper page:");
while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    if (href.includes('mega') || href.includes('step') || href.includes('zipper')) {
        console.log(href);
    }
}

// Find any scripts
const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let sMatch;
console.log("\nScripts containing keywords:");
while ((sMatch = scriptPattern.exec(html)) !== null) {
    const content = sMatch[1];
    if (content.includes('mega') || content.includes('ad_step') || content.includes('timer') || content.includes('window.location')) {
        console.log("--- SCRIPT BLOCK ---");
        console.log(content.substring(0, 1000));
    }
}
