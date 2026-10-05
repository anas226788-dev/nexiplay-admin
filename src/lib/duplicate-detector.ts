/**
 * Duplicate detection against the existing `movies` table.
 * Checks by normalized title + type + year to prevent re-importing content.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface DuplicateResult {
    isDuplicate: boolean;
    existingId?: string;
    existingTitle?: string;
    existingSlug?: string;
    matchType?: 'exact_title' | 'slug_match' | 'fuzzy_title';
}

/** Generate a slug from a title (mirrors the admin panel's slug generation) */
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 200);
}

/** Normalize for comparison */
function normalizeForCompare(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Check if content with a similar title already exists in the movies table.
 * Checks: exact title match, slug match, and fuzzy ilike match.
 */
export async function checkDuplicate(
    supabase: SupabaseClient,
    title: string,
    type?: 'movie' | 'series' | 'anime'
): Promise<DuplicateResult> {
    const normalizedTitle = normalizeForCompare(title);
    const slug = generateSlug(title);

    try {
        // 1. Exact title match (case-insensitive)
        let query = supabase
            .from('movies')
            .select('id, title, slug')
            .ilike('title', title)
            .limit(1);
        if (type) query = query.eq('type', type);

        const { data: exactMatch } = await query;
        if (exactMatch && exactMatch.length > 0) {
            return {
                isDuplicate: true,
                existingId: exactMatch[0].id,
                existingTitle: exactMatch[0].title,
                existingSlug: exactMatch[0].slug,
                matchType: 'exact_title',
            };
        }

        // 2. Slug match
        let slugQuery = supabase
            .from('movies')
            .select('id, title, slug')
            .eq('slug', slug)
            .limit(1);
        if (type) slugQuery = slugQuery.eq('type', type);

        const { data: slugMatch } = await slugQuery;
        if (slugMatch && slugMatch.length > 0) {
            return {
                isDuplicate: true,
                existingId: slugMatch[0].id,
                existingTitle: slugMatch[0].title,
                existingSlug: slugMatch[0].slug,
                matchType: 'slug_match',
            };
        }

        // 3. Fuzzy match with ilike (first 3 words)
        const words = normalizedTitle.split(' ').filter(w => w.length >= 3).slice(0, 3);
        if (words.length >= 2) {
            const fuzzyPattern = `%${words.join('%')}%`;
            let fuzzyQuery = supabase
                .from('movies')
                .select('id, title, slug')
                .ilike('title', fuzzyPattern)
                .limit(5);
            if (type) fuzzyQuery = fuzzyQuery.eq('type', type);

            const { data: fuzzyMatches } = await fuzzyQuery;
            if (fuzzyMatches && fuzzyMatches.length > 0) {
                // Check if any fuzzy match is close enough
                for (const match of fuzzyMatches) {
                    const matchNorm = normalizeForCompare(match.title);
                    if (matchNorm === normalizedTitle || matchNorm.includes(normalizedTitle) || normalizedTitle.includes(matchNorm)) {
                        return {
                            isDuplicate: true,
                            existingId: match.id,
                            existingTitle: match.title,
                            existingSlug: match.slug,
                            matchType: 'fuzzy_title',
                        };
                    }
                }
            }
        }

        return { isDuplicate: false };
    } catch (err) {
        console.error('[DuplicateDetector] Error checking duplicates:', err);
        return { isDuplicate: false };
    }
}
