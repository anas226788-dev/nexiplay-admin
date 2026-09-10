import { createClient } from '@supabase/supabase-js';

const supabaseNovelsUrl = (process.env.NEXT_PUBLIC_SUPABASE_NOVELS_URL || 'https://lnpkqcvqsppaiafjtzpt.supabase.co').trim();
const supabaseNovelsAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_NOVELS_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxucGtxY3Zxc3BwYWlhZmp0enB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjE0NjEsImV4cCI6MjA5MTI5NzQ2MX0.KjxXOCBnS5vQ7bt8_7tFIAC3dnbN7KCZjmF9qFI-YmE').trim();

export const supabaseNovels = createClient(supabaseNovelsUrl, supabaseNovelsAnonKey);
