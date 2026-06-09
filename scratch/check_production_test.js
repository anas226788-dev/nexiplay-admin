async function run() {
    const url = "https://nexiplay-admin.vercel.app/api/test-proxy?t=" + Date.now();
    try {
        const res = await fetch(url);
        console.log("Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error(e);
    }
}

run();
