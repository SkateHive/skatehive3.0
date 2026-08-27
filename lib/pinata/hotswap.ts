'use server';

/**
 * Pinata Hot Swap server actions.
 *
 * Hot Swaps let you redirect one CID to another on the SkateHive gateway
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
 *   const outcome = await removeSwap(cid);
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A SWAP IS NOT REVERSIBLE TODAY. Do not build on the assumption that it is.
 *
 * `DELETE /v3/ipfs/swap/{cid}` answers 500 on this account, in every shape
 * tried (with and without `?domain=`, with and without a body). A malformed
 * request answers 400 here, so the 500 is Pinata's side, not our call. Audited
 * 2026-08-27 against the live API.
 *
 * The consequence is operational, not cosmetic: once a CID is swapped, the
 * only thing still protecting the original content is that the original is
 * STILL PINNED. Unpinning it after a swap is irreversible in practice. An
 * earlier plan to unpin originals "because the swap can be undone" was wrong
 * and has been retracted.
 *
 * Left behind by that audit, and safe to delete once Pinata fixes DELETE —
 * disposable text files, referenced by nothing, two of them carrying a swap
 * that could not be removed:
 *   QmUjz1Vqi4wShcVLdbYWbdyMpJgWvCjFM4eiMss7s6StrS  (swapped, stuck)
 *   QmTeubrFhJSp9cppY6ymi7WZuYtcs9d4oKcVoT6EDFRWkA
 *   QmQJtqoCZNLdE8ornkGJ7NZLxcEARMa3kCD9X5SnsFg9gT  (swapped, stuck)
 *   Qma9LzuD9UnCfCL2eJqiS3zaz7A5vmk9i4MBk2CSvMZwAW
 * ─────────────────────────────────────────────────────────────────────────
 */

import { APP_CONFIG } from '@/config/app.config';

const PINATA_API = 'https://api.pinata.cloud/v3/ipfs/swap';

function getJwt(): string {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) throw new Error('PINATA_JWT not configured');
    return jwt;
}

/**
 * Swaps are scoped to ONE gateway, and the read endpoint will not infer it.
 * Same host the rest of the app serves IPFS from, so a swap registered here
 * is a swap the app actually sees.
 */
function swapUrl(cid: string): string {
    return `${PINATA_API}/${cid}?domain=${encodeURIComponent(APP_CONFIG.IPFS_GATEWAY)}`;
}

export interface SwapResult {
    success: boolean;
    originalCid: string;
    currentCid: string;
    error?: string;
}

/**
 * Register a CID swap on the SkateHive gateway.
 * Requests to originalCid will transparently serve newCid instead.
 *
 * Call this after a user uploads a new profile picture:
 *   - originalCid: the "canonical" CID you want to keep linking to
 *   - newCid:      the freshly uploaded image's CID
 *
 * Remember this is effectively one-way — see the file header.
 */
export async function swapCid({
    originalCid,
    newCid,
}: {
    originalCid: string;
    newCid: string;
}): Promise<SwapResult> {
    try {
        const res = await fetch(swapUrl(originalCid), {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${getJwt()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ swapCid: newCid }),
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
    /** The CID this swap points AT — what the gateway serves instead. */
    mapped_cid: string;
    created_at: string;
}

/**
 * Get the swap history for a CID on the SkateHive gateway.
 *
 * The `?domain=` is REQUIRED. Without it the endpoint answers 400, this
 * function swallowed it, and the caller read back an empty list — which is
 * indistinguishable from a legitimate "this CID has no swap". That is the
 * worst shape a bug can take: it does not look like a failure. An audit of
 * 159 swapped CIDs read "no swap" on every single one while all 159 were in
 * fact registered.
 *
 * An empty array here still means "no swap OR we could not tell". Callers
 * that need certainty should treat a swap as unknown rather than absent.
 */
export async function getSwapHistory(cid: string): Promise<SwapHistory[]> {
    try {
        const res = await fetch(swapUrl(cid), {
            headers: { Authorization: `Bearer ${getJwt()}` },
        });

        if (!res.ok) {
            console.error('Swap history lookup failed:', res.status, await res.text());
            return [];
        }

        const data = await res.json();
        // A CID with no swap answers 200 with `data: null`, not an empty array.
        return data?.data ?? [];
    } catch (error) {
        console.error('Swap history lookup threw:', error);
        return [];
    }
}

/**
 * Outcome of a swap removal.
 *
 * Deliberately NOT a boolean. The three states below are operationally
 * different and `false` collapsed all of them into one: a caller could not
 * tell "Pinata refused" from "the request never left the building", and so
 * could not tell a swap that is still live from one whose status is unknown.
 */
export type RemoveSwapOutcome =
    | { removed: true }
    /** Pinata answered, and refused. `status` 500 is the known-broken case. */
    | { removed: false; reason: 'rejected'; status: number; error: string }
    /** We never got an answer — network, or PINATA_JWT missing. */
    | { removed: false; reason: 'unreachable'; error: string };

/**
 * Remove a swap — the originalCid would serve its own content again.
 *
 * EXPECT THIS TO FAIL. Pinata answers 500 for this account (see the file
 * header); it is their bug, not ours, and there is nothing to work around on
 * our side. This function exists to report that honestly rather than to
 * promise a rollback we cannot deliver.
 *
 * Never treat a non-`removed` outcome as "the swap is gone". Read the reason
 * and surface it; the swap is still live.
 */
export async function removeSwap(originalCid: string): Promise<RemoveSwapOutcome> {
    let res: Response;
    try {
        res = await fetch(swapUrl(originalCid), {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${getJwt()}` },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Remove swap could not reach Pinata for ${originalCid}:`, message);
        return { removed: false, reason: 'unreachable', error: message };
    }

    if (!res.ok) {
        const error = await res.text().catch(() => '');
        console.error(
            `Remove swap REFUSED for ${originalCid}: ${res.status}. ` +
            `The swap is still live. ${error}`
        );
        return { removed: false, reason: 'rejected', status: res.status, error };
    }

    console.log(`🗑️ Hot swap removed for: ${originalCid}`);
    return { removed: true };
}
