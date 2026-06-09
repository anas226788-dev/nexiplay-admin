const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/zipper_page.html', 'utf8');

const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
let sMatch;
let idx = 0;
while ((sMatch = scriptPattern.exec(html)) !== null) {
    idx++;
    const code = sMatch[1].trim();
    if (code.length > 0) {
        console.log(`\n--- SCRIPT ${idx} (${code.length} chars) ---`);
        if (code.includes('mega') || code.includes('step') || code.includes('redirect') || code.includes('timer') || code.includes('window.location') || code.includes('location.href') || code.includes('url')) {
            console.log(code);
        } else {
            console.log(code.substring(0, 300) + "...");
        }
    }
}
