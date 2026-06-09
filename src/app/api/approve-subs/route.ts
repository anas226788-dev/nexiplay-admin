import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch pending sub counts for all movies or a specific movie.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const movieId = searchParams.get('movieId');

        // Get all pending sub links grouped by movie
        let query = supabase
            .from('episode_download_links')
            .select(`
                id,
                episode_id,
                resolution,
                mega_link,
                gdrive_link,
                language_type,
                approval_status,
                episodes!inner (
                    id,
                    episode_number,
                    season_id,
                    seasons!inner (
                        id,
                        movie_id,
                        season_number
                    )
                )
            `)
            .eq('language_type', 'sub')
            .eq('approval_status', 'pending');

        const { data: pendingLinks, error } = await query;

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Group by movie_id
        const groupedByMovie: Record<string, any[]> = {};
        for (const link of (pendingLinks || [])) {
            const ep = link.episodes as any;
            const season = ep?.seasons as any;
            const mid = season?.movie_id;
            if (!mid) continue;
            if (movieId && mid !== movieId) continue;

            if (!groupedByMovie[mid]) groupedByMovie[mid] = [];
            groupedByMovie[mid].push({
                linkId: link.id,
                episodeNumber: ep.episode_number,
                seasonNumber: season.season_number,
                resolution: link.resolution,
                megaLink: link.mega_link,
                gdriveLink: link.gdrive_link,
            });
        }

        return NextResponse.json({ success: true, pending: groupedByMovie });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST: Approve or reject pending sub links.
 * Body: { action: 'approve' | 'reject', movieId?: string, linkIds?: string[] }
 *   - If movieId is provided, approve/reject ALL pending subs for that movie
 *   - If linkIds is provided, approve/reject specific links
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, movieId, linkIds } = body;

        if (!action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Invalid action. Use "approve" or "reject".' }, { status: 400 });
        }

        let targetIds: string[] = [];

        if (linkIds && linkIds.length > 0) {
            targetIds = linkIds;
        } else if (movieId) {
            // Find all pending sub links for this movie
            const { data: pendingLinks, error } = await supabase
                .from('episode_download_links')
                .select(`
                    id,
                    episodes!inner (
                        season_id,
                        seasons!inner (
                            movie_id
                        )
                    )
                `)
                .eq('language_type', 'sub')
                .eq('approval_status', 'pending');

            if (error) throw error;

            targetIds = (pendingLinks || [])
                .filter((link: any) => {
                    const season = link.episodes?.seasons;
                    return season?.movie_id === movieId;
                })
                .map((link: any) => link.id);
        } else {
            return NextResponse.json({ success: false, error: 'Provide movieId or linkIds.' }, { status: 400 });
        }

        if (targetIds.length === 0) {
            return NextResponse.json({ success: true, message: 'No pending sub links found.', count: 0 });
        }

        if (action === 'approve') {
            const { error } = await supabase
                .from('episode_download_links')
                .update({ approval_status: 'approved' })
                .in('id', targetIds);

            if (error) throw error;

            return NextResponse.json({
                success: true,
                message: `Approved ${targetIds.length} sub link(s).`,
                count: targetIds.length,
            });
        } else {
            // Reject = delete the pending sub links
            // 1. Fetch episode IDs before deletion
            const { data: linksToDelete, error: fetchLinksError } = await supabase
                .from('episode_download_links')
                .select('episode_id')
                .in('id', targetIds);

            if (fetchLinksError) throw fetchLinksError;

            const episodeIds = Array.from(new Set((linksToDelete || []).map((l: any) => l.episode_id).filter(Boolean)));

            // 2. Delete the pending sub links
            const { error: deleteLinksError } = await supabase
                .from('episode_download_links')
                .delete()
                .in('id', targetIds);

            if (deleteLinksError) throw deleteLinksError;

            // 3. For each affected episode, check if it is now empty (0 download links)
            if (episodeIds.length > 0) {
                for (const episodeId of episodeIds) {
                    const { data: remainingLinks, error: countError } = await supabase
                        .from('episode_download_links')
                        .select('id')
                        .eq('episode_id', episodeId);

                    if (countError) throw countError;

                    if (!remainingLinks || remainingLinks.length === 0) {
                        // Delete parent episode since it has no remaining links of any language/resolution
                        const { error: deleteEpError } = await supabase
                            .from('episodes')
                            .delete()
                            .eq('id', episodeId);

                        if (deleteEpError) throw deleteEpError;
                    }
                }
            }

            return NextResponse.json({
                success: true,
                message: `Rejected and removed ${targetIds.length} sub link(s).`,
                count: targetIds.length,
            });
        }
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
