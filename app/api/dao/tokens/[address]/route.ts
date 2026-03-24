import { NextRequest, NextResponse } from "next/server";
import { DAO_ADDRESSES, EXTERNAL_SERVICES } from "@/config/app.config";

const TOKENS_QUERY = `
  query TokensByOwner($owner: String!, $tokenContract: String!) {
    tokens(
      where: { owner: $owner, tokenContract: $tokenContract }
      orderBy: tokenId
      orderDirection: asc
      first: 100
    ) {
      tokenId
      owner
      image
      name
      tokenContract
    }
  }
`;

/**
 * GET /api/dao/tokens/[address]
 * Returns Skatehive DAO NFTs owned by the given address,
 * fetched from the Nouns Builder / Goldsky subgraph.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  try {
    const res = await fetch(EXTERNAL_SERVICES.DAO_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: TOKENS_QUERY,
        variables: {
          owner: address.toLowerCase(),
          tokenContract: DAO_ADDRESSES.token.toLowerCase(),
        },
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Subgraph error: ${res.status}` },
        { status: res.status }
      );
    }

    const { data, errors } = await res.json();

    if (errors?.length) {
      console.error("[dao/tokens] subgraph errors:", errors);
    }

    const tokens: Array<{
      tokenId: string;
      owner: string;
      image: string;
      name: string;
      tokenContract: string;
    }> = data?.tokens ?? [];

    // Reshape into the same format used by the portfolio NFT array
    const nfts = tokens.map((t) => ({
      tokenId: t.tokenId,
      rarityRank: null,
      token: {
        name: t.name,
        medias: t.image ? [{ url: t.image }] : [],
        estimatedValueEth: "0",
        collection: {
          name: "Skatehive DAO",
          address: DAO_ADDRESSES.token.toLowerCase(),
          network: "base",
          floorPriceEth: "0",
        },
      },
    }));

    return NextResponse.json({ nfts });
  } catch (error: any) {
    console.error("[dao/tokens] fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch DAO tokens" },
      { status: 500 }
    );
  }
}
