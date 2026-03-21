/**
 * Neynar API helpers for Farcaster profile data, signers, reactions, and casts
 * Docs: https://docs.neynar.com/reference
 */

const NEYNAR_BASE = "https://api.neynar.com";

function getApiKey(): string | null {
  return process.env.NEYNAR_API_KEY || null;
}

function neynarHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    api_key: apiKey,
  };
}

// ─── Signer Management ─────────────────────────────────────

export interface NeynarSignerResponse {
  signer_uuid: string;
  public_key: string;
  status: "generated" | "pending_approval" | "approved" | "revoked";
  signer_approval_url?: string;
  fid?: number;
}

/** Create a new managed signer */
export async function createNeynarSigner(): Promise<NeynarSignerResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const res = await fetch(`${NEYNAR_BASE}/v2/farcaster/signer`, {
    method: "POST",
    headers: neynarHeaders(apiKey),
  });

  if (!res.ok) {
    console.error(`[Neynar] createSigner error: ${res.status} ${res.statusText}`);
    return null;
  }

  return res.json();
}

/**
 * Register a signer with the Farcaster network via Neynar.
 *
 * This signs the signer's public key using the app's Farcaster mnemonic
 * (EIP-712 SignedKeyRequest), then registers it with Neynar to get a
 * signer_approval_url the user can open in the Farcaster app.
 *
 * Requires env vars:
 *  - FARCASTER_APP_MNEMONIC — 12-word mnemonic of the app's Farcaster custody address
 *  - FARCASTER_APP_FID — FID of the app's Farcaster account (optional, looked up if missing)
 */
export async function registerNeynarSigner(
  signerUuid: string,
  publicKey: string
): Promise<NeynarSignerResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const mnemonic = process.env.FARCASTER_APP_MNEMONIC;
  if (!mnemonic) {
    console.error("[Neynar] FARCASTER_APP_MNEMONIC not set — cannot register signer");
    return null;
  }

  try {
    // Dynamic import to keep viem/accounts out of the client bundle
    const { mnemonicToAccount } = await import("viem/accounts");
    const { bytesToHex, hexToBytes } = await import("viem");

    const account = mnemonicToAccount(mnemonic);

    // Look up the app's FID from env or by custody address
    let appFid = process.env.FARCASTER_APP_FID
      ? Number(process.env.FARCASTER_APP_FID)
      : null;

    if (!appFid) {
      // Look up FID by custody address via Neynar
      const lookupRes = await fetch(
        `${NEYNAR_BASE}/v2/farcaster/user/by_verification?address=${account.address}`,
        { headers: neynarHeaders(apiKey) }
      );
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json();
        appFid = lookupData?.result?.user?.fid || null;
      }
      if (!appFid) {
        // Try custody address lookup
        const custodyRes = await fetch(
          `${NEYNAR_BASE}/v2/farcaster/user/custody-address?custody_address=${account.address}`,
          { headers: neynarHeaders(apiKey) }
        );
        if (custodyRes.ok) {
          const custodyData = await custodyRes.json();
          appFid = custodyData?.user?.fid || null;
        }
      }
      if (!appFid) {
        console.error("[Neynar] Could not determine app FID from mnemonic");
        return null;
      }
    }

    // Sign the key request with EIP-712
    // Domain: Farcaster SignedKeyRequestValidator on OP Mainnet
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours

    const signature = await account.signTypedData({
      domain: {
        name: "Farcaster SignedKeyRequestValidator",
        version: "1",
        chainId: 10,
        verifyingContract: "0x00000000FC700472606ED4fA22623Acf62c60553",
      },
      types: {
        SignedKeyRequest: [
          { name: "requestFid", type: "uint256" },
          { name: "key", type: "bytes" },
          { name: "deadline", type: "uint256" },
        ],
      },
      primaryType: "SignedKeyRequest",
      message: {
        requestFid: BigInt(appFid),
        key: publicKey as `0x${string}`,
        deadline: BigInt(deadline),
      },
    });

    // Register with Neynar
    const res = await fetch(`${NEYNAR_BASE}/v2/farcaster/signer/signed_key`, {
      method: "POST",
      headers: neynarHeaders(apiKey),
      body: JSON.stringify({
        signer_uuid: signerUuid,
        app_fid: appFid,
        deadline,
        signature,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[Neynar] registerSigner error: ${res.status}`, errText);
      return null;
    }

    return res.json();
  } catch (err: any) {
    console.error("[Neynar] registerSigner failed:", err?.message || err);
    return null;
  }
}

/** Get signer status */
export async function getSignerStatus(signerUuid: string): Promise<NeynarSignerResponse | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const res = await fetch(`${NEYNAR_BASE}/v2/farcaster/signer?signer_uuid=${signerUuid}`, {
    method: "GET",
    headers: neynarHeaders(apiKey),
  });

  if (!res.ok) {
    console.error(`[Neynar] getSignerStatus error: ${res.status} ${res.statusText}`);
    return null;
  }

  return res.json();
}

// ─── Reactions ──────────────────────────────────────────────

export async function publishReaction(
  signerUuid: string,
  reactionType: "like" | "recast",
  targetHash: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, error: "API key not configured" };

  const res = await fetch(`${NEYNAR_BASE}/v2/farcaster/reaction`, {
    method: "POST",
    headers: neynarHeaders(apiKey),
    body: JSON.stringify({
      signer_uuid: signerUuid,
      reaction_type: reactionType,
      target: targetHash,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Neynar] publishReaction error: ${res.status}`, text);
    return { success: false, error: `Neynar error ${res.status}` };
  }

  return { success: true };
}

export async function deleteReaction(
  signerUuid: string,
  reactionType: "like" | "recast",
  targetHash: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, error: "API key not configured" };

  const res = await fetch(`${NEYNAR_BASE}/v2/farcaster/reaction`, {
    method: "DELETE",
    headers: neynarHeaders(apiKey),
    body: JSON.stringify({
      signer_uuid: signerUuid,
      reaction_type: reactionType,
      target: targetHash,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[Neynar] deleteReaction error: ${res.status}`, text);
    return { success: false, error: `Neynar error ${res.status}` };
  }

  return { success: true };
}

// ─── Casts (replies) ────────────────────────────────────────

export async function publishCast(
  signerUuid: string,
  text: string,
  parentHash?: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  const apiKey = getApiKey();
  if (!apiKey) return { success: false, error: "API key not configured" };

  const body: Record<string, string> = { signer_uuid: signerUuid, text };
  if (parentHash) body.parent = parentHash;

  const res = await fetch(`${NEYNAR_BASE}/v2/farcaster/cast`, {
    method: "POST",
    headers: neynarHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`[Neynar] publishCast error: ${res.status}`, errText);
    return { success: false, error: `Neynar error ${res.status}` };
  }

  const data = await res.json();
  return { success: true, hash: data?.cast?.hash };
}

// ─── Profile fetching (existing) ───────────────────────────

interface NeynarUser {
  fid: number;
  username: string;
  display_name?: string;
  pfp_url?: string;
  profile?: {
    bio?: {
      text?: string;
    };
  };
  custody_address?: string;
  verifications?: string[];
  verified_addresses?: {
    eth_addresses?: string[];
    sol_addresses?: string[];
  };
}

interface NeynarBulkUsersResponse {
  users: NeynarUser[];
}

export interface FarcasterProfileData {
  fid: number;
  username: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  custodyAddress?: string;
  verifications?: string[];
}

/**
 * Fetch Farcaster user profile data by FID using Neynar API
 * @param fid - Farcaster ID
 * @returns Profile data or null if not found
 */
export async function fetchFarcasterProfileByFid(
  fid: number | string
): Promise<FarcasterProfileData | null> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.warn('[Neynar] API key not configured, skipping profile fetch');
    return null;
  }

  try {
    const url = `${NEYNAR_BASE}/v2/farcaster/user/bulk?fids=${fid}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'GET',
      headers: neynarHeaders(apiKey),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Neynar] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: NeynarBulkUsersResponse = await response.json();

    if (!data.users || data.users.length === 0) {
      console.warn(`[Neynar] No user found for FID: ${fid}`);
      return null;
    }

    const user = data.users[0];

    // Extract all verified Ethereum addresses
    const verifications: string[] = [];
    if (user.verifications) {
      verifications.push(...user.verifications);
    }
    if (user.verified_addresses?.eth_addresses) {
      verifications.push(...user.verified_addresses.eth_addresses);
    }

    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      pfpUrl: user.pfp_url,
      bio: user.profile?.bio?.text,
      custodyAddress: user.custody_address,
      verifications: [...new Set(verifications)], // Deduplicate
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.warn('[Neynar] Request timed out after 5s');
    } else {
      console.error('[Neynar] Failed to fetch profile:', error);
    }
    return null;
  }
}

/**
 * Fetch multiple Farcaster profiles by FIDs (bulk)
 * @param fids - Array of Farcaster IDs (max 100 per request)
 * @returns Map of FID to profile data
 */
export async function fetchFarcasterProfilesBulk(
  fids: (number | string)[]
): Promise<Map<number, FarcasterProfileData>> {
  const apiKey = process.env.NEYNAR_API_KEY;
  const results = new Map<number, FarcasterProfileData>();

  if (!apiKey) {
    console.warn('[Neynar] API key not configured, skipping bulk profile fetch');
    return results;
  }

  if (fids.length === 0) {
    return results;
  }

  const chunks = [];
  for (let i = 0; i < fids.length; i += 100) {
    chunks.push(fids.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const fidsParam = chunk.join(',');
      const url = `${NEYNAR_BASE}/v2/farcaster/user/bulk?fids=${fidsParam}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        headers: neynarHeaders(apiKey),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[Neynar] Bulk API error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data: NeynarBulkUsersResponse = await response.json();

      for (const user of data.users || []) {
        const verifications: string[] = [];
        if (user.verifications) {
          verifications.push(...user.verifications);
        }
        if (user.verified_addresses?.eth_addresses) {
          verifications.push(...user.verified_addresses.eth_addresses);
        }

        results.set(user.fid, {
          fid: user.fid,
          username: user.username,
          displayName: user.display_name,
          pfpUrl: user.pfp_url,
          bio: user.profile?.bio?.text,
          custodyAddress: user.custody_address,
          verifications: [...new Set(verifications)],
        });
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('[Neynar] Bulk request timed out after 5s');
      } else {
        console.error('[Neynar] Failed to fetch bulk profiles:', error);
      }
    }
  }

  return results;
}
