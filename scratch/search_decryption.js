const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/rareanimes_sample.html', 'utf8');

// Find all script tags and print their src or contents
const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
    count++;
    const attrs = match[1];
    const code = match[2].trim();
    console.log(`\n=== Script ${count} attrs: ${attrs} ===`);
    if (attrs.includes('src')) {
        console.log(`External src: ${attrs}`);
    } else {
        console.log(code.substring(0, 500));
        if (code.length > 500) console.log("... [TRUNCATED]");
    }
}
