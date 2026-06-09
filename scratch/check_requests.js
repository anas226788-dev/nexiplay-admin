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
    const { data, error } = await supabase
        .from('content_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error(error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));
}

run();
