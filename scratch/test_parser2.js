const fs = require('fs');

function detectResolution(html) {
    const text = html.toLowerCase();
    if (text.includes('2160p') || text.includes('4k')) return '2160p';
    if (text.includes('1080p')) return '1080p';
    if (text.includes('720p')) return '720p';
    if (text.includes('480p')) return '480p';
    return '720p';
}

function scrapeBollyflixStrategy(html) {
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
    const headingPattern = /<(?:p|h[2-6]|strong|span)[^>]*>([\s\S]*?)<\/(?:p|h[2-6]|strong|span)>/gi;
    let hMatch;

    while ((hMatch = headingPattern.exec(contentHtml)) !== null) {
        const rawText = hMatch[1].replace(/<[^>]*>/g, '').trim();
        const resMatch = rawText.match(/\b(480p|720p|1080p|2160p|4[Kk])\b/i);
        if (!resMatch) continue;

        // Skip headings that are just intro descriptions of the page, e.g. "available in 1080p, 720p & 480p Qualities"
        if (rawText.toLowerCase().includes('qualities') || rawText.toLowerCase().includes('super quality') || rawText.toLowerCase().includes('available in')) {
            continue;
        }

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

    // Anchor pattern: href and link text/html
    const anchorPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const endIndex =
            i + 1 < sections.length
                ? sections[i + 1].headingEnd
                : Math.min(section.headingEnd + 3000, contentHtml.length);

        const slice = contentHtml.substring(section.headingEnd, endIndex);
        
        anchorPattern.lastIndex = 0; // reset
        let aMatch;
        let foundForSection = [];

        while ((aMatch = anchorPattern.exec(slice)) !== null) {
            const href = aMatch[1];
            const text = aMatch[2].replace(/<[^>]*>/g, '').trim();
            const textLower = text.toLowerCase();
            const hrefLower = href.toLowerCase();

            // Criteria:
            // 1. Text contains "google drive", "g-drive", "gdrive", or "drive"
            // 2. OR href contains google drive / proxy domains
            const isGoogleDriveLink = 
                textLower.includes('google drive') || 
                textLower.includes('g-drive') || 
                textLower.includes('gdrive') ||
                textLower.includes('drive') ||
                hrefLower.includes('drive.google.com') ||
                hrefLower.includes('gdflix') ||
                hrefLower.includes('gdtot') ||
                hrefLower.includes('gdbot') ||
                hrefLower.includes('driveseed') ||
                hrefLower.includes('drivebot');

            // Exclude common ad-redirect texts if they don't explicitly say Google Drive
            // For example, if it says "Download Links", exclude it.
            const isExcluded = 
                textLower.includes('download links') || 
                textLower.includes('direct links') ||
                textLower.includes('how to download') ||
                textLower.includes('join us') ||
                textLower.includes('telegram');

            if (isGoogleDriveLink && !isExcluded) {
                foundForSection.push({ href, text });
            }
        }

        if (foundForSection.length > 0) {
            // Add all matching drive links for this section
            foundForSection.forEach((item, fIdx) => {
                const label = section.size
                    ? `${section.resolution} [${section.size}]` + (foundForSection.length > 1 ? ` - Link ${fIdx + 1}` : '')
                    : section.resolution + (foundForSection.length > 1 ? ` - Link ${fIdx + 1}` : '');
                
                episodes.push({
                    number: idx++,
                    title: label,
                    link: item.href,
                });
            });
        } else {
            warnings.push(`No Google Drive link found for ${section.resolution}${section.size ? ' [' + section.size + ']' : ''}`);
        }
    }

    // Fallback directly from content HTML if no sections matched
    if (episodes.length === 0) {
        anchorPattern.lastIndex = 0;
        let aMatch;
        while ((aMatch = anchorPattern.exec(contentHtml)) !== null) {
            const href = aMatch[1];
            const text = aMatch[2].replace(/<[^>]*>/g, '').trim();
            const textLower = text.toLowerCase();
            const hrefLower = href.toLowerCase();

            const isGoogleDriveLink = 
                textLower.includes('google drive') || 
                textLower.includes('g-drive') || 
                textLower.includes('gdrive') ||
                textLower.includes('drive') ||
                hrefLower.includes('drive.google.com') ||
                hrefLower.includes('gdflix') ||
                hrefLower.includes('gdtot') ||
                hrefLower.includes('gdbot') ||
                hrefLower.includes('driveseed') ||
                hrefLower.includes('drivebot');

            const isExcluded = 
                textLower.includes('download links') || 
                textLower.includes('direct links') ||
                textLower.includes('how to download') ||
                textLower.includes('join us') ||
                textLower.includes('telegram');

            if (isGoogleDriveLink && !isExcluded) {
                episodes.push({
                    number: idx++,
                    title: `Google Drive Link ${idx - 1} (${resolution})`,
                    link: href,
                });
            }
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
const res = scrapeBollyflixStrategy(html);
console.log("Result:", JSON.stringify(res, null, 2));
