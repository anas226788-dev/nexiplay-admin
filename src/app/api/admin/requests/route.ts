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

    // Collect user_ids to join profiles for requests submitted by registered users
    const userIds = Array.from(new Set((data || []).map((r: any) => {
      const meta = typeof r.scraped_data === 'object' && r.scraped_data ? r.scraped_data : null;
      return r.user_id || meta?.user_id;
    }).filter(Boolean))) as string[];

    let profileMap: Record<string, { id: string; display_name?: string | null; email?: string | null; avatar_url?: string | null }> = {};

    if (userIds.length > 0) {
      try {
        const { data: profiles } = await db
          .from('profiles')
          .select('id, display_name, email, avatar_url')
          .in('id', userIds);

        (profiles || []).forEach((p: any) => {
          profileMap[p.id] = p;
        });

        // For any user_id not found in profiles table, fallback to Supabase Auth admin
        const missingUserIds = userIds.filter(id => !profileMap[id]);
        if (missingUserIds.length > 0) {
          try {
            const { data: authData } = await db.auth.admin.listUsers();
            (authData?.users || []).forEach((u: any) => {
              if (missingUserIds.includes(u.id)) {
                profileMap[u.id] = {
                  id: u.id,
                  email: u.email,
                  display_name: u.user_metadata?.display_name || u.user_metadata?.full_name || (u.email ? u.email.split('@')[0] : 'User'),
                  avatar_url: u.user_metadata?.avatar_url || null,
                };
              }
            });
          } catch (authErr) {
            console.warn('Could not list auth users:', authErr);
          }
        }
      } catch (profileErr) {
        console.warn('Could not fetch profiles for requests:', profileErr);
      }
    }

    const enhancedRequests = (data || []).map((r: any) => {
      const meta = typeof r.scraped_data === 'object' && r.scraped_data ? r.scraped_data : null;
      const rawUserId = r.user_id || meta?.user_id || null;
      const userProfile = rawUserId ? profileMap[rawUserId] : null;

      const userName = userProfile?.display_name || meta?.user_name || r.user_name || (userProfile?.email ? userProfile.email.split('@')[0] : (meta?.user_email ? meta.user_email.split('@')[0] : null));
      const userEmail = userProfile?.email || meta?.user_email || r.user_email || null;
      const userAvatar = userProfile?.avatar_url || meta?.user_avatar || r.user_avatar || null;
      const notes = r.notes || meta?.notes || null;

      return {
        ...r,
        content_name: r.content_name || r.title || 'Untitled Request',
        notes,
        user_name: userName,
        user_email: userEmail,
        user_avatar: userAvatar,
        has_account: Boolean(rawUserId || userProfile || userEmail || userName),
      };
    });

    return NextResponse.json({ requests: enhancedRequests }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    console.error('Admin requests API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load content requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
