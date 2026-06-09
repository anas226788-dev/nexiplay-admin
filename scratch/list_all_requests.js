const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('d:/nexiplay-admin-main/.env.local', 'utf8');
const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase
        .from('content_requests')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    console.log("Total requests:", data.length);
    console.log(data.map(d => ({ id: d.id, name: d.content_name, status: d.status, source: d.scraper_source, url: d.source_url })));
}

run();
