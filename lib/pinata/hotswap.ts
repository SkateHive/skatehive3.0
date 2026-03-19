'use server';

/**
 * Pinata Hot Swap server actions.
 *
 * Hot Swaps let you redirect one CID to another on ipfs.skatehive.app
 * without changing any URLs — great for profile picture updates.
 *
 * Prerequisites:
 *  1. Install the "Hot Swaps" plugin in Pinata dashboard:
 *     Pinata Dashboard → Plugins Marketplace → Hot Swaps → select your gateway
 *
 * Usage:
 *   // When user uploads a new profile picture:
 *   const result = await swapCid({ originalCid: oldCid, newCid: newImageCid });
 *
 *   // Get swap history for a CID:
 *   const history = await getSwapHistory(cid);
 *
 *   // Remove a swap (restore original):
 *   await removeSwap(cid);
 */

const PINATA_API = 'https://api.pinata.cloud/v3/ipfs/swap';

function getJwt(): string {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) throw new Error('PINATA_JWT not configured');
    return jwt;
}

export interface SwapResult {
    success: boolean;
    originalCid: string;
    currentCid: string;
    error?: string;
}

/**
 * Register a CID swap on ipfs.skatehive.app.
 * Requests to originalCid will transparently serve newCid instead.
 *
 * Call this after a user uploads a new profile picture:
 *   - originalCid: the "canonical" CID you want to keep linking to
 *   - newCid:      the freshly uploaded image's CID
 */
export async function swapCid({
    originalCid,
    newCid,
}: {
    originalCid: string;
    newCid: string;
}): Promise<SwapResult> {
    try {
        const res = await fetch(`${PINATA_API}/${originalCid}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${getJwt()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ swap_cid: newCid }),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error('Hot swap failed:', res.status, text);
            return { success: false, originalCid, currentCid: originalCid, error: text };
        }

        console.log(`🔄 Hot swap registered: ${originalCid} → ${newCid}`);
        return { success: true, originalCid, currentCid: newCid };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, originalCid, currentCid: originalCid, error: message };
    }
}

export interface SwapHistory {
    cid: string;
    swappedTo: string;
    createdAt: string;
}

/**
 * Get the swap history for a CID on ipfs.skatehive.app.
 */
export async function getSwapHistory(cid: string): Promise<SwapHistory[]> {
    try {
        const res = await fetch(`${PINATA_API}/${cid}`, {
            headers: { Authorization: `Bearer ${getJwt()}` },
        });

        if (!res.ok) return [];

        const data = await res.json();
        return data.data ?? [];
    } catch {
        return [];
    }
}

/**
 * Remove a swap — the originalCid will serve its own content again.
 * Use this if a user deletes their profile picture or reverts to an old one.
 */
export async function removeSwap(originalCid: string): Promise<boolean> {
    try {
        const res = await fetch(`${PINATA_API}/${originalCid}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getJwt()}` },
        });

        if (!res.ok) {
            console.error('Remove swap failed:', res.status);
            return false;
        }

        console.log(`🗑️ Hot swap removed for: ${originalCid}`);
        return true;
    } catch {
        return false;
    }
}
