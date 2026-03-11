import { NextRequest, NextResponse } from 'next/server';
import type { PoidhBountiesResponse } from '@/types/poidh';

const CACHE_TTL = 15 * 60; // 15 minutes

const SKATE_KEYWORDS = [
  'skate',
  'skateboard',
  'skating',
  'trick',
  'kickflip',
  'ollie',
  'grind',
  'rail',
  'ledge',
  'park',
  'street',
  'vert',
  'bowl',
  'ramp',
  'halfpipe'
];

const ALLOWED_CHAINS = [8453, 42161]; // Base and Arbitrum only

function isSkateRelated(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase();
  return SKATE_KEYWORDS.some((keyword) => text.includes(keyword));
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
      const beforeFilter = bounties.length;
      bounties = bounties.filter((b: any) =>
        isSkateRelated(b.title || '', b.description || '')
      );
      console.log(`[POIDH API] Skate filter: ${beforeFilter} -> ${bounties.length} bounties`);
    }

    // Pagination
    const paginatedBounties = bounties.slice(offset, offset + limit);

    // Transform to our format
    const transformedBounties = paginatedBounties.map((b: any) => ({
      id: b.id.toString(),
      issuer: b.issuer,
      name: b.title,
      description: b.description,
      amount: b.amount,
      claimer: b.inProgress ? null : (b.claimer || null),
      createdAt: b.createdAt,
      claimId: b.claimId || 0,
      isOpenBounty: b.isMultiplayer || false,
      claimCount: b.hasClaims ? 1 : 0,
      chainId: b.chainId,
      inProgress: b.inProgress
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
  } catch (error) {
    console.error('Error fetching POIDH bounties:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch POIDH bounties',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
