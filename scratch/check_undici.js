try {
    const { ProxyAgent } = require('undici');
    console.log("ProxyAgent is available from undici!");
} catch (e) {
    console.log("Error importing undici:", e.message);
}
