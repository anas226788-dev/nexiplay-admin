const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/zipper_page.html', 'utf8');

// Find all HTML blocks containing "Download" or "btn"
const bodyPattern = /<a[^>]+class="[^"]*btn[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
let match;
console.log("Buttons found in HTML body:");
while ((match = bodyPattern.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]*>/g, '').trim();
    const fullTag = match[0];
    console.log("Button:", text);
    console.log("Tag:", fullTag.substring(0, 300));
}

// Find any form
const formPattern = /<form[^>]*>([\s\S]*?)<\/form>/gi;
while ((match = formPattern.exec(html)) !== null) {
    console.log("Form:", match[0].substring(0, 500));
}
