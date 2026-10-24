import { createClient } from '@supabase/supabase-js';

const supabaseNovelsUrl = (process.env.NEXT_PUBLIC_SUPABASE_NOVELS_URL || 'https://placeholder.supabase.co').trim();
const supabaseNovelsAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_NOVELS_ANON_KEY || 'placeholder-key').trim();

export const supabaseNovels = createClient(supabaseNovelsUrl, supabaseNovelsAnonKey);
