import { NextRequest, NextResponse } from "next/server";
import { getCoin } from "@zoralabs/coins-sdk";

/**
 * GET /api/zora/coin?address=0x...&chainId=7777777
 *
 * Returns logo URL, market cap, and 24h change for a Zora coin.
 * Server-side so the Zora API key (if needed) never reaches the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const chainId = parseInt(searchParams.get("chainId") ?? "7777777", 10);

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  try {
    const response = await getCoin({
      address: address as `0x${string}`,
      chain: chainId,
    });

    const coin = response?.data?.zora20Token;
    if (!coin) {
      return NextResponse.json({ error: "coin not found" }, { status: 404 });
    }

    const image =
      coin.mediaContent?.previewImage?.medium ??
      coin.mediaContent?.previewImage?.small ??
      null;

    const marketCap = coin.marketCap ?? null;
    const marketCapDelta24h = coin.marketCapDelta24h ?? null;

    return NextResponse.json({
      image,
      name: coin.name,
      symbol: coin.symbol,
      marketCap,
      marketCapDelta24h,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch Zora coin" },
      { status: 500 }
    );
  }
}
