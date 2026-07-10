import { createClient } from '@supabase/supabase-js';

const supabaseNovelsUrl = (process.env.NEXT_PUBLIC_SUPABASE_NOVELS_URL || '').trim();
const supabaseNovelsAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_NOVELS_ANON_KEY || '').trim();

export const supabaseNovels = createClient(supabaseNovelsUrl, supabaseNovelsAnonKey);
