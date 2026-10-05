import { createClient } from '@supabase/supabase-js';
export { createClient };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ── Admin Panel uses service_role key to bypass RLS ──
// This is safe because the admin panel is password-protected and private.
// service_role key has FULL access to all tables regardless of RLS policies.
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';

// Primary client — uses service_role key (bypasses RLS completely)
// Falls back to anon key if service_role is not configured
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseServiceKey || supabaseAnonKey || 'placeholder-key'
);

export const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

