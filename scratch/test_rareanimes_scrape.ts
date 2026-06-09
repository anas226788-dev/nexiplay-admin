import { scrapeSource } from '../src/lib/scraper-utils';

async function test() {
    const url = "https://www.rareanimes.buzz/hindi/marriage-toxin-season-1-hindi-dubbed-episodes-";
    console.log("Scraping RareAnimes URL:", url);
    try {
        const result = await scrapeSource(url, 'rareanimes');
        console.log("Scrape Success!");
        console.log("Page Title:", result.pageTitle);
        console.log("Resolution:", result.resolution);
        console.log("Total Episodes found:", result.episodes.length);
        console.log("First 3 episodes:");
        console.log(JSON.stringify(result.episodes.slice(0, 3), null, 2));
    } catch (e: any) {
        console.error("Scrape failed:", e.message);
    }
}

test();
