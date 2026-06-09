const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/zipper_page.html', 'utf8');

// Search for any form or script or button that has an external link
const linkPattern = /href="([^"]+)"/gi;
let match;
console.log("Links:");
while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    if (href.includes('step') || href.includes('mega') || href.includes('zipper') || href.includes('codedew')) {
        console.log(href);
    }
}

// Search for script tags
const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let sMatch;
console.log("\nScripts:");
while ((sMatch = scriptPattern.exec(html)) !== null) {
    const code = sMatch[1];
    if (code.includes('location') || code.includes('href') || code.includes('CryptoJS') || code.includes('decrypt') || code.includes('url')) {
        console.log("--- SCRIPT ---");
        console.log(code.substring(0, 1500));
    }
}
