import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, formatEther } from 'viem';
import { base } from 'viem/chains';
import { POIDH_ABI, POIDH_CONTRACT_ADDRESS } from '@/lib/poidh-abi';
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

const client = createPublicClient({
  chain: base,
  transport: http()
});

function isSkateRelated(name: string, description: string): boolean {
  const text = `${name} ${description}`.toLowerCase();
  return SKATE_KEYWORDS.some((keyword) => text.includes(keyword));
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get total bounties count
    const totalBounties = (await client.readContract({
      address: POIDH_CONTRACT_ADDRESS,
      abi: POIDH_ABI,
      functionName: 'bountyCounter'
    })) as bigint;

    // Get bounties batch (contract returns 10 at a time)
    const bountiesRaw = (await client.readContract({
      address: POIDH_CONTRACT_ADDRESS,
      abi: POIDH_ABI,
      functionName: 'getBounties',
      args: [BigInt(offset)]
    })) as any[];

    // Filter skate-related bounties
    const skateBounties = bountiesRaw.filter((bounty) =>
      isSkateRelated(bounty.name, bounty.description)
    );

    // Transform and enrich bounties
    const enrichedBounties = await Promise.all(
      skateBounties.slice(0, limit).map(async (bounty) => {
        // Get claims for this bounty
        let claimCount = 0;
        try {
          const claims = (await client.readContract({
            address: POIDH_CONTRACT_ADDRESS,
            abi: POIDH_ABI,
            functionName: 'getClaimsByBountyId',
            args: [bounty.id, BigInt(0)]
          })) as any[];
          claimCount = claims.length;
        } catch (err) {
          // Claims might not exist, that's ok
          console.warn(`No claims for bounty ${bounty.id}`);
        }

        return {
          id: bounty.id.toString(),
          issuer: bounty.issuer,
          name: bounty.name,
          description: bounty.description,
          amount: bounty.amount.toString(),
          claimer: bounty.claimer === '0x0000000000000000000000000000000000000000' ? null : bounty.claimer,
          createdAt: Number(bounty.createdAt),
          claimId: Number(bounty.claimId),
          isOpenBounty: false, // Will need to detect this from contract
          claimCount
        };
      })
    );

    const response: PoidhBountiesResponse = {
      bounties: enrichedBounties,
      total: skateBounties.length,
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
