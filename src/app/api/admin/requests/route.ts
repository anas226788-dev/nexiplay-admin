import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server-side Supabase credentials are not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}
export async function GET(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const db = adminClient();
    if (new URL(req.url).searchParams.get('summary') === 'pending') {
      const { count, error } = await db.from('content_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'review']);
      if (error) throw error;
      return NextResponse.json({ count: count ?? 0 }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const { data, error } = await db.from('content_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ requests: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    console.error('Admin requests API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load content requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
