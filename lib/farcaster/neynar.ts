/**
 * Neynar API helpers for fetching Farcaster profile data
 * Docs: https://docs.neynar.com/reference
 */

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
  const apiKey = process.env.NEYNAR_API_KEY;

  if (!apiKey) {
    console.warn('[Neynar] API key not configured, skipping profile fetch');
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`;

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api_key': apiKey,
      },
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

  // Neynar allows max 100 FIDs per request
  const chunks = [];
  for (let i = 0; i < fids.length; i += 100) {
    chunks.push(fids.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    try {
      const fidsParam = chunk.join(',');
      const url = `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fidsParam}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'api_key': apiKey,
        },
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
