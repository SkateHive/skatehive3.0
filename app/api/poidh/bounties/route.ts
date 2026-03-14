import { NextRequest, NextResponse } from 'next/server';
import type { PoidhBountiesResponse } from '@/types/poidh';
import { extractFirstImage, toUnixSeconds } from '@/lib/poidh-utils';
import { ALLOWED_CHAINS } from '@/lib/poidh-constants';

const CACHE_TTL = 15 * 60; // 15 minutes

// Strong keywords: unmistakably skateboarding
const SKATE_KEYWORDS = [
  // Identity terms
  'skate', 'skateboard', 'skateboarding', 'skating', 'skater', 'skateboarder',
  'skatehive',
  // Specific trick names only — no generic words
  'kickflip', 'heelflip', 'hardflip', 'inward heel',
  'tre flip', '360 flip', 'laser flip',
  'varial flip', 'varial heel', 'pressure flip',
  'ollie', 'nollie',
  'pop shove', 'shove-it', 'shuv-it',
  'boardslide', 'lipslide', 'tailslide', 'noseslide', 'bluntslide',
  'smith grind', 'feeble grind', 'crooked grind',
  '50-50', 'nosegrind', 'overcrooks',
  'nose manual',
  'halfpipe', 'mini ramp', 'quarter pipe',
  // Skate culture
  'skatepark', 'skate spot', 'skate trick',
];

function isSkateRelated(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase();
  return SKATE_KEYWORDS.some((kw) => text.includes(kw));
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') || 'past'; // 'open' | 'past' | 'progress'
    const filterSkate = searchParams.get('filterSkate') === 'true';

    // Fetch from Poidh TRPC API (server-side)
    const params = encodeURIComponent(
      JSON.stringify({
        json: { status, sortType: 'date', limit: 100 },
      })
    );

    const res = await fetch(
      `https://poidh.xyz/api/trpc/bounties.fetchAll?input=${params}`,
      {
        next: { revalidate: CACHE_TTL } // Next.js 15 cache
      }
    );

    if (!res.ok) {
      throw new Error(`Poidh API returned ${res.status}`);
    }

    const data = await res.json();
    let bounties = data.result.data.json.items;

    // Filter: Base + Arbitrum only
    bounties = bounties.filter((b: any) => ALLOWED_CHAINS.includes(b.chainId));

    // Filter: Skate-related only (if requested)
    if (filterSkate) {
      bounties = bounties.filter((b: any) =>
        isSkateRelated(b.title || '', b.description || '')
      );
    }

    // Pagination
    const paginatedBounties = bounties.slice(offset, offset + limit);

    // Transform to our format
    const transformedBounties = paginatedBounties.map((b: any) => ({
      id: b.id.toString(),
      onChainId: b.onChainId ?? b.id,
      issuer: b.issuer,
      name: b.title,
      description: b.description,
      amount: b.amount,
      // Use the status from the request — don't re-derive active state from claimer
      // A bounty is "active" when the list was fetched with status='open'
      claimer: b.claimer || null,
      createdAt: toUnixSeconds(b.createdAt),
      claimId: b.claimId || 0,
      isOpenBounty: b.isMultiplayer || false,
      isCanceled: b.isCanceled || false,
      claimCount: b.claimCount || (b.hasClaims ? 1 : 0),
      chainId: b.chainId,
      inProgress: b.inProgress || false,
      // status='open' from Poidh means it's truly open; pass it through so the card knows
      isActive: b.isCanceled ? false : status === 'open',
      imageUrl: extractFirstImage(b.description || ''),
    }));

    const response: PoidhBountiesResponse = {
      bounties: transformedBounties,
      total: bounties.length,
      offset,
      limit
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate`
      }
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch POIDH bounties' },
      { status: 500 }
    );
  }
}
