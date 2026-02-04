// Client-side admin utility - FOR DISPLAY PURPOSES ONLY
// ⚠️  SECURITY WARNING: This is NOT used for security enforcement
// All real security happens server-side in /lib/server/adminUtils.ts

/**
 * Check if user should see admin UI elements (cosmetic only)
 * Note: This can be bypassed by attackers - never use for security
 */
const adminStatusCache = new Map<string, boolean>();
const inflightChecks = new Map<string, Promise<boolean>>();

export const isAdminUser = async (username: string): Promise<boolean> => {
    const normalizedUsername = username?.trim().toLowerCase();
    if (!normalizedUsername) {
        return false;
    }

    if (adminStatusCache.has(normalizedUsername)) {
        return adminStatusCache.get(normalizedUsername) || false;
    }

    const existingRequest = inflightChecks.get(normalizedUsername);
    if (existingRequest) {
        return existingRequest;
    }

    const checkPromise = (async () => {
        try {
            const response = await fetch('/api/admin/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: normalizedUsername })
            });
            const result = await response.json();
            const isAdmin = result.isAdmin || false;
            adminStatusCache.set(normalizedUsername, isAdmin);
            return isAdmin;
        } catch {
            return false;
        } finally {
            inflightChecks.delete(normalizedUsername);
        }
    })();

    inflightChecks.set(normalizedUsername, checkPromise);

    try {
        return await checkPromise;
    } catch {
        return false;
    }
};
