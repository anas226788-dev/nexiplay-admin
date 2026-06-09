const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/bollyflix_sample.html', 'utf8');

// Let's find some occurrences of "Google Drive" and see their surrounding HTML
let pos = 0;
while (true) {
    pos = html.indexOf("Google Drive", pos);
    if (pos === -1) break;
    
    const start = Math.max(0, pos - 150);
    const end = Math.min(html.length, pos + 150);
    console.log(`--- Match at pos ${pos} ---`);
    console.log(html.substring(start, end));
    
    pos += 12;
}
