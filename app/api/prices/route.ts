import { NextResponse } from "next/server";

const CACHE_DURATION = 60; // 60 seconds
let cachedData: { prices: Record<string, { usd: number }>; ts: number } | null = null;

export async function GET() {
  // Return cached data if fresh
  if (cachedData && Date.now() - cachedData.ts < CACHE_DURATION * 1000) {
    return NextResponse.json(cachedData.prices, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=300` },
    });
  }

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar,ethereum&vs_currencies=usd",
      { next: { revalidate: CACHE_DURATION } }
    );

    if (!response.ok) {
      // Return fallback prices on CoinGecko failure
      return NextResponse.json(
        { hive: { usd: 0.21 }, hive_dollar: { usd: 1.0 }, ethereum: { usd: 2500 } },
        { status: 200, headers: { "Cache-Control": "public, s-maxage=30" } }
      );
    }

    const data = await response.json();
    cachedData = { prices: data, ts: Date.now() };

    return NextResponse.json(data, {
      headers: { "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=300` },
    });
  } catch {
    return NextResponse.json(
      { hive: { usd: 0.21 }, hive_dollar: { usd: 1.0 }, ethereum: { usd: 2500 } },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=30" } }
    );
  }
}
