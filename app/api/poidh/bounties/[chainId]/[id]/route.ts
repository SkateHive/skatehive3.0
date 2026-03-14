import { NextRequest, NextResponse } from 'next/server';
import type { PoidhBounty, PoidhClaim } from '@/types/poidh';
import { extractFirstImage, toUnixSeconds } from '@/lib/poidh-utils';

const CACHE_TTL = 5 * 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chainId: string; id: string }> }
) {
  try {
    const { chainId, id } = await params;

    const bountyId = parseInt(id, 10);
    const numericChainId = parseInt(chainId, 10);

    if (isNaN(bountyId) || isNaN(numericChainId)) {
      return NextResponse.json(
        { error: 'Invalid chainId or bounty id' },
        { status: 400 }
      );
    }

    // 1. Fetch Bounty Details (using batched TRPC format)
    const bountyInput = JSON.stringify({
      "0": { json: { id: bountyId, chainId: numericChainId } }
    });
    
    const bountyRes = await fetch(
      `https://poidh.xyz/api/trpc/bounties.fetch?batch=1&input=${encodeURIComponent(bountyInput)}`,
      {
        next: { revalidate: CACHE_TTL }
      }
    );

    if (!bountyRes.ok) {
      throw new Error(`Poidh API (bounty) returned ${bountyRes.status}`);
    }

    const bountyData = await bountyRes.json();
    // In batch mode, response is an array
    const b = bountyData[0]?.result?.data?.json;

    if (!b) {
      return NextResponse.json({ error: 'Bounty not found or API changed' }, { status: 404 });
    }

    // 2. Fetch Claims for this bounty (also using batched format)
    const claimsInput = JSON.stringify({
      "0": { json: { bountyId, chainId: numericChainId, limit: 50, direction: 'desc' } }
    });

    const claimsRes = await fetch(
      `https://poidh.xyz/api/trpc/claims.fetchBountyClaims?batch=1&input=${encodeURIComponent(claimsInput)}`,
      {
        next: { revalidate: CACHE_TTL }
      }
    );

    let claims: PoidhClaim[] = [];
    if (claimsRes.ok) {
      const claimsData = await claimsRes.json();
      const rawJson = claimsData[0]?.result?.data?.json;
      const rawClaims: any[] = Array.isArray(rawJson)
        ? rawJson
        : Array.isArray(rawJson?.claims)
          ? rawJson.claims
          : Array.isArray(rawJson?.items)
            ? rawJson.items
            : Array.isArray(rawJson?.data)
              ? rawJson.data
              : [];
      claims = rawClaims.map((c: any) => ({
        id: c.id.toString(),
        bountyId: c.bountyId.toString(),
        issuer: c.owner, // Correct field from browser inspection
        bountyIssuer: b.issuer,
        name: c.title || '',
        description: c.description || '',
        createdAt: toUnixSeconds(c.createdAt),
        accepted: c.accepted || (b.claimId && b.claimId.toString() === c.id.toString()) || false,
      }));
    }

    const transformedBounty: PoidhBounty = {
      id: b.id.toString(),
      onChainId: b.onChainId ?? b.id,
      issuer: b.issuer,
      name: b.title || b.name || '',
      description: b.description || '',
      amount: b.amount || '0',
      claimer: b.claimer || null,
      createdAt: toUnixSeconds(b.createdAt),
      claimId: b.claimId || 0,
      isOpenBounty: b.isMultiplayer || false,
      isCanceled: b.isCanceled || false,
      claimCount: claims.length,
      chainId: numericChainId,
      claims,
      // On the detail page, determine active from claimer being null
      isActive: b.isCanceled ? false : !b.claimer,
      imageUrl: extractFirstImage(b.description || ''),
    };

    return NextResponse.json(transformedBounty, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate`
      }
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch POIDH bounty detail' },
      { status: 500 }
    );
  }
}
