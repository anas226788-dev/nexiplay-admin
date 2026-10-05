import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 1. Fetch old unchecked links (Batch of 10)
        // We prioritize links not checked in last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: links, error } = await supabase
            .from('download_links')
            .select('*')
            .or(`last_checked_at.is.null,last_checked_at.lt.${twentyFourHoursAgo}`)
            .limit(10);

        if (error) throw error;
        if (!links || links.length === 0) {
            return NextResponse.json({ message: 'No links to check' });
        }

        const results = [];

        for (const link of links) {
            const status: Record<string, string> = link.link_status || {};
            const providers = ['mega_link', 'gdrive_link', 'mediafire_link', 'terabox_link', 'pcloud_link'];
            let hasChanges = false;

            for (const provider of providers) {
                const url = link[provider];
                if (url) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

                        const res = await fetch(url, {
                            method: 'HEAD',
                            signal: controller.signal,
                            headers: { 'User-Agent': 'NexiplayBot/1.0' }
                        });
                        clearTimeout(timeoutId);

                        if (res.status >= 400 && res.status !== 403 && res.status !== 429) {
                            // 403/429 are often anti-bot, assume active for now to avoid false positives
                            status[provider] = 'EXPIRED';
                        } else {
                            status[provider] = 'ACTIVE';
                        }
                    } catch (e) {
                        // Timeout or network error - marked as potentially expired or skip
                        console.error(`Check failed for ${url}:`, e);
                        // Don't mark expired on connection error to avoid false positives
                    }
                }
            }

            // Update DB
            const { error: updateError } = await supabase
                .from('download_links')
                .update({
                    link_status: status,
                    last_checked_at: new Date().toISOString()
                })
                .eq('id', link.id);

            if (!updateError) {
                results.push({ id: link.id, status });
            }
        }

        return NextResponse.json({
            checked: results.length,
            results
        });

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
