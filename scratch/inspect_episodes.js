const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/rareanimes_sample.html', 'utf8');

// Let's find some occurrences of "Episode" and print their surrounding html
const epPattern = /Episode\s*(\d+)/gi;
let match;
while ((match = epPattern.exec(html)) !== null) {
    const start = Math.max(0, match.index - 200);
    const end = Math.min(html.length, match.index + 1000);
    console.log(`\n--- Match ${match[1]} ---`);
    console.log(html.substring(start, end).replace(/\s+/g, ' '));
}
