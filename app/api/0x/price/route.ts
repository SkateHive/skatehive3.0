import { NextRequest, NextResponse } from "next/server";

const ZEROX_HEADERS = {
  "0x-api-key": process.env.ZEROX_API_KEY || "",
  "0x-version": "v2",
  "Content-Type": "application/json",
};

// Optional affiliate fee — set SKATEHIVE_FEE_RECIPIENT in env to enable.
// Default: 50 bps (0.5%). Configurable via SKATEHIVE_FEE_BPS.
const FEE_RECIPIENT = process.env.SKATEHIVE_FEE_RECIPIENT || "";
const FEE_BPS = process.env.SKATEHIVE_FEE_BPS || "50";

/** GET /api/0x/price?chainId=8453&sellToken=...&buyToken=...&sellAmount=...&taker=... */
export async function GET(request: NextRequest) {
  const params = new URLSearchParams(new URL(request.url).searchParams);

  // Only inject affiliate fee when the client explicitly opts in (?fee=1)
  const wantsFee = params.get("fee") === "1";
  params.delete("fee");

  if (FEE_RECIPIENT && wantsFee) {
    const buyToken = params.get("buyToken") || "";
    params.set("swapFeeRecipient", FEE_RECIPIENT);
    params.set("swapFeeBps", FEE_BPS);
    params.set("swapFeeToken", buyToken);
  }

  const upstream = `https://api.0x.org/swap/allowance-holder/price?${params.toString()}`;

  try {
    const res = await fetch(upstream, { headers: ZEROX_HEADERS });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
