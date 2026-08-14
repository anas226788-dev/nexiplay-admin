import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function getAdminSupabase() {
    if (adminClient) return adminClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceRoleKey) {
        throw new Error('Server Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
    adminClient = createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { 'x-client-info': 'nexiplay-admin-agent/2.0' } },
    });
    return adminClient;
}
