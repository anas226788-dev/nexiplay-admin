const fs = require('fs');

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/rareanimes_sample.html', 'utf8');

const linkPattern = /href="([^"]+)"/gi;
let match;
const links = [];
while ((match = linkPattern.exec(html)) !== null) {
    links.push(match[1]);
}

console.log("Total links:", links.length);
console.log("Distinct links containing 'step':", [...new Set(links.filter(l => l.includes('step') || l.includes('ad')))].slice(0, 50));
console.log("Distinct links containing 'mega':", [...new Set(links.filter(l => l.includes('mega')))].slice(0, 50));
console.log("Distinct links containing 'codedew':", [...new Set(links.filter(l => l.includes('codedew')))].slice(0, 50));
console.log("Any other external links?", [...new Set(links.filter(l => !l.includes('codedew') && !l.includes('rareanimes') && l.startsWith('http')))].slice(0, 50));
