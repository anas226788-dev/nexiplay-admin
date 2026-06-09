async function run() {
    const url = "https://codedew.com/zipper/?url=LRho5Esbsm69ly0aUNNKtVA%2Bgk5k1TLgndo2HD0m%2BZsAAXJ7PWPFPlMfgHlDzJe9ruwKRih8v%2BtpTaPqgw0VIfqF2kskX4iiXM1SGCwfEzP88gk%3D";
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });

        console.log("Status:", res.status);
        const html = await res.text();
        const fs = require('fs');
        fs.writeFileSync('d:/nexiplay-admin-main/scratch/zipper_page.html', html, 'utf8');
        console.log("Saved zipper page HTML, length:", html.length);
    } catch (e) {
        console.error(e);
    }
}

run();
