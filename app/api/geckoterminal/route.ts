import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geckoterminal?network=ethereum&address=0x...
 * Server-side proxy for GeckoTerminal API to avoid CORS issues in the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network");
  const address = searchParams.get("address");

  if (!network || !address) {
    return NextResponse.json(
      { error: "Missing network or address" },
      { status: 400 }
    );
  }

  try {
    const apiUrl = `https://api.geckoterminal.com/api/v2/networks/${encodeURIComponent(network)}/tokens/${encodeURIComponent(address)}?include=top_pools`;
    const response = await fetch(apiUrl, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `GeckoTerminal API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch token data" },
      { status: 500 }
    );
  }
}
