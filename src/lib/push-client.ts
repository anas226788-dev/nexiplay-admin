/**
 * Dispatches an admin auto-push trigger without blocking caller UI flows,
 * logging server errors or skipped states (e.g., missing OneSignal REST API key).
 */
export async function triggerAdminPush(payload: Record<string, unknown>): Promise<void> {
    try {
        const res = await fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || data?.ok === false) {
            const detail = data?.error || data?.reason || `HTTP ${res.status}`;
            console.warn('[NexiPlay Push] Dispatch skipped/failed:', detail, payload);
        }
    } catch (err) {
        console.warn('[NexiPlay Push] Request error:', err);
    }
}
