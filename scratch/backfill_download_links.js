const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('d:/nexiplay-admin-main/.env.local', 'utf8');
const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials!");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Fetching downloads and existing download_links...");
    
    // Fetch all downloads
    const { data: downloads, error: dlError } = await supabase
        .from('downloads')
        .select('*');
        
    if (dlError) {
        console.error("Error fetching downloads:", dlError);
        return;
    }

    // Fetch all existing download_links to avoid duplicate insertions
    const { data: existingLinks, error: linkError } = await supabase
        .from('download_links')
        .select('*');

    if (linkError) {
        console.error("Error fetching download_links:", linkError);
        return;
    }

    console.log(`Found ${downloads.length} downloads and ${existingLinks.length} existing download_links.`);

    // Group downloads by movie_id
    const movieDownloads = {};
    for (const d of downloads) {
        if (!movieDownloads[d.movie_id]) {
            movieDownloads[d.movie_id] = [];
        }
        movieDownloads[d.movie_id].push(d);
    }

    const inserts = [];

    for (const movieId of Object.keys(movieDownloads)) {
        const movieDls = movieDownloads[movieId];
        
        // Group by resolution for this movie
        const resolutionLinks = {};
        
        for (const d of movieDls) {
            const rawRes = d.quality || '720p';
            let res = '720p';
            if (/\b360p\b/i.test(rawRes)) res = '360p';
            else if (/\b480p\b/i.test(rawRes)) res = '480p';
            else if (/\b720p\b/i.test(rawRes)) res = '720p';
            else if (/\b1080p\b/i.test(rawRes)) res = '1080p';

            // Check if this resolution already exists in the DB for this movie
            const alreadyExists = existingLinks.some(el => el.movie_id === movieId && el.resolution === res);
            if (alreadyExists) continue;

            const isMega = d.file_url?.includes('mega.nz');

            if (!resolutionLinks[res]) {
                resolutionLinks[res] = {
                    movie_id: movieId,
                    resolution: res,
                    file_size: d.file_size || null,
                    mega_link: isMega ? d.file_url : null,
                    gdrive_link: !isMega ? d.file_url : null,
                };
            } else {
                if (isMega) {
                    resolutionLinks[res].mega_link = d.file_url;
                } else {
                    resolutionLinks[res].gdrive_link = d.file_url;
                }
                if (d.file_size) {
                    resolutionLinks[res].file_size = d.file_size;
                }
            }
        }

        inserts.push(...Object.values(resolutionLinks));
    }

    if (inserts.length === 0) {
        console.log("No new download_links to backfill!");
        return;
    }

    console.log(`Backfilling ${inserts.length} resolution-based download links...`);
    const { error: insertError } = await supabase
        .from('download_links')
        .insert(inserts);

    if (insertError) {
        console.error("Backfill failed:", insertError);
    } else {
        console.log("Successfully backfilled download links!");
    }
}

run();
