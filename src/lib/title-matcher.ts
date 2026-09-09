/**
 * Title normalization and fuzzy matching for the agentic pipeline.
 * Scores search results against a requested title to find the best match.
 */

/** Normalize a title for comparison: lowercase, strip noise, collapse whitespace */
export function normalizeTitle(raw: string): string {
    return raw
        .toLowerCase()
        .replace(/[''`]/g, "'")
        .replace(/[""]/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#\d+;/g, ' ')
        .replace(/\b(download|watch|online|free|hd|dual\s*audio|hindi|english|multi|subs?|dubbed?|x264|x265|hevc|aac|esubs?|bluray|webrip|web-?dl|hdrip|dvdrip|brrip)\b/gi, ' ')
        .replace(/\b(480p|720p|1080p|2160p|4k)\b/gi, ' ')
        .replace(/\(?\d{4}\)?/g, ' ') // strip years like (2024)
        .replace(/[[\](){}<>|•·–—:;,!?@#$%^&*+=~`\\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Extract year from a title string */
export function extractYear(text: string): number | null {
    const match = text.match(/\b(19[89]\d|20[0-2]\d|2030)\b/);
    return match ? Number(match[1]) : null;
}

/** Tokenize a normalized title into significant words */
function tokenize(text: string): string[] {
    return text
        .split(/\s+/)
        .filter(w => w.length >= 2)
        .filter(w => !['the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'is', 'it', 'my', 'for', 'with', 'as', 'by', 'no', 'do', 'wa', 'ga', 'ni'].includes(w));
}

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

/** Similarity ratio 0–1 based on Levenshtein */
function stringSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshtein(a, b) / maxLen;
}

export interface MatchCandidate {
    title: string;
    url: string;
    source?: string;
}

export interface MatchResult {
    candidate: MatchCandidate;
    confidence: number;
    reasons: string[];
}

/**
 * Score a single search result against the requested title.
 * Returns 0–1 confidence score and reasons.
 */
export function scoreTitleMatch(requestedTitle: string, candidate: MatchCandidate): MatchResult {
    const normReq = normalizeTitle(requestedTitle);
    const normCand = normalizeTitle(candidate.title);
    const reasons: string[] = [];

    // 1. Full normalized string similarity (weight: 0.40)
    const fullSim = stringSimilarity(normReq, normCand);
    reasons.push(`full_similarity=${fullSim.toFixed(3)}`);

    // 2. Token overlap (Jaccard similarity) (weight: 0.35)
    const reqTokens = new Set(tokenize(normReq));
    const candTokens = new Set(tokenize(normCand));
    const intersection = new Set([...reqTokens].filter(t => candTokens.has(t)));
    const union = new Set([...reqTokens, ...candTokens]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;
    reasons.push(`token_jaccard=${jaccard.toFixed(3)} (${intersection.size}/${union.size})`);

    // 3. Exact containment bonus (weight: 0.15)
    const containment = normCand.includes(normReq) || normReq.includes(normCand) ? 1 : 0;
    if (containment) reasons.push('exact_containment=true');

    // 4. Year match bonus (weight: 0.10)
    const reqYear = extractYear(requestedTitle);
    const candYear = extractYear(candidate.title);
    const yearBonus = reqYear && candYear && reqYear === candYear ? 1 : (!reqYear ? 0.5 : 0);
    if (reqYear && candYear) reasons.push(`year_match=${reqYear === candYear}`);

    const confidence = Math.min(1, (fullSim * 0.40) + (jaccard * 0.35) + (containment * 0.15) + (yearBonus * 0.10));
    reasons.push(`final_confidence=${confidence.toFixed(3)}`);

    return { candidate, confidence, reasons };
}

/**
 * Given a list of search results, score all and return the best match.
 * Returns null if no candidate reaches the minimum threshold.
 */
export function selectBestCandidate(
    requestedTitle: string,
    candidates: MatchCandidate[],
    minThreshold = 0.50
): MatchResult | null {
    if (candidates.length === 0) return null;

    const scored = candidates
        .map(c => scoreTitleMatch(requestedTitle, c))
        .sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];
    if (best.confidence < minThreshold) return null;
    return best;
}
