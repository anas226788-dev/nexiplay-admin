import { scrapeBollyflix } from '../src/lib/scraper-utils';

async function test() {
    const url = "https://bollyflix.med/vettaiyan-2024-dual-audio-hindi-tamil-movie/";
    console.log("Scraping BollyFlix URL:", url);
    try {
        const res = await scrapeBollyflix(url);
        console.log("Success! Results:");
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("Scraping failed:", e);
    }
}

test();
