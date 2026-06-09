const fs = require('fs');

// We need to simulate the scraper-utils environment or just import it.
// Let's import scrapeBollyflix from scraper-utils.ts
// Wait, we can run it through ts-node or just copy-paste the function.
// Let's copy-paste the current scrapeBollyflix implementation from scraper-utils.ts to test it.

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

function detectResolution(html) {
    const text = html.toLowerCase();
    if (text.includes('2160p') || text.includes('4k')) return '2160p';
    if (text.includes('1080p')) return '1080p';
    if (text.includes('720p')) return '720p';
    if (text.includes('480p')) return '480p';
    return '720p';
}

function scrapeBollyflixLocal(html) {
    // Extract page title
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
        pageTitle = titleMatch[1]
            .replace(/&#8211;/g, '-')
            .replace(/&amp;/g, '&')
            .replace(/&#038;/g, '&')
            .trim();
    }
    const schemaMatch = html.match(/"headline"\s*:\s*"([^"]+)"/);
    if (schemaMatch) {
        pageTitle = schemaMatch[1].replace(/\\"/g, '"').replace(/\\\//g, '/').trim();
    }

    // Narrow to post content area only
    let contentHtml = html;
    const contentMatch =
        html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|single-content)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<!--/i) ||
        html.match(/<div[^>]*class="[^"]*(?:entry-content|post-content|single-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (contentMatch) {
        contentHtml = contentMatch[1];
    }

    const resolution = detectResolution(html);
    const episodes = [];
    const warnings = [];
    let idx = 1;

    const sections = [];

    // Match headings, paragraphs, strong tags that contain resolution info
    const headingPattern = /<(?:p|h[2-6]|strong|span)[^>]*>([\s\S]*?)<\/(?:p|h[2-6]|strong|span)>/gi;
    let hMatch;

    while ((hMatch = headingPattern.exec(contentHtml)) !== null) {
        const rawText = hMatch[1].replace(/<[^>]*>/g, '').trim();
        // Must contain a resolution keyword
        const resMatch = rawText.match(/\b(480p|720p|1080p|2160p|4[Kk])\b/i);
        if (!resMatch) continue;

        const res = resMatch[1].toLowerCase() === '4k' ? '2160p' : resMatch[1].toLowerCase();
        const sizeMatch = rawText.match(/\[?\s*(\d+(?:\.\d+)?\s*(?:MB|GB))\s*\]?/i);
        const size = sizeMatch ? sizeMatch[1].trim() : '';

        sections.push({
            resolution: res,
            heading: rawText,
            size,
            headingEnd: hMatch.index + hMatch[0].length,
        });
    }

    console.log("Sections found:", sections.map(s => `${s.resolution} (${s.size}) -> heading: "${s.heading}"`));

    const drivePattern = /href="(https?:\/\/drive\.google\.com\/[^"]+)"/i;
    const gdProxyPattern = /href="(https?:\/\/(?:gdflix|gdbot|gdtot|new\.gdtot|driveseed|drivebot)[^"]+)"/i;

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const endIndex =
            i + 1 < sections.length
                ? sections[i + 1].headingEnd
                : Math.min(section.headingEnd + 3000, contentHtml.length);

        const slice = contentHtml.substring(section.headingEnd, endIndex);
        
        const driveMatch = drivePattern.exec(slice) || gdProxyPattern.exec(slice);

        if (driveMatch) {
            const label = section.size
                ? `${section.resolution} [${section.size}]`
                : section.resolution;
            episodes.push({
                number: idx++,
                title: label,
                link: driveMatch[1],
            });
        } else {
            warnings.push(`No Google Drive link found for ${section.resolution}${section.size ? ' [' + section.size + ']' : ''}`);
        }
    }

    if (episodes.length === 0) {
        const allDrivePattern = /href="(https?:\/\/(?:drive\.google\.com|gdflix|gdbot|gdtot|driveseed|drivebot)[^"]+)"/gi;
        let m;
        while ((m = allDrivePattern.exec(contentHtml)) !== null) {
            episodes.push({
                number: idx++,
                title: `Google Drive Link ${idx - 1} (${resolution})`,
                link: m[1],
            });
        }

        if (episodes.length === 0) {
            console.log("Episodes length is 0, warning/error would occur.");
        }
    }

    return {
        pageTitle,
        resolution,
        episodes,
        warnings,
    };
}

const html = fs.readFileSync('d:/nexiplay-admin-main/scratch/bollyflix_sample.html', 'utf8');
const res = scrapeBollyflixLocal(html);
console.log("Result:", JSON.stringify(res, null, 2));
