import { NextRequest, NextResponse } from "next/server";
import { LIFI_API_URL } from "@/lib/evm/lifi";

// Integrator + fee are only applied when configured. `integrator` must match the
// string registered with LI.FI (portal.li.fi) for the API key; fee is a decimal
// share (0.005 = 0.5%). Fees are collected to the wallet LI.FI has on file for
// the integrator (see monetization onboarding).
const LIFI_API_KEY = process.env.LIFI_API_KEY || "";
const LIFI_INTEGRATOR = process.env.LIFI_INTEGRATOR || "";
const LIFI_FEE_SHARE = (Number(process.env.LIFI_FEE_BPS || "50") / 10000).toString();

/** GET /api/lifi/quote?fromChain=&toChain=&fromToken=&toToken=&fromAmount=&fromAddress=&slippage=&order=&fee=1 */
export async function GET(request: NextRequest) {
  const params = new URLSearchParams(new URL(request.url).searchParams);

  // Client opts into the integrator fee with ?fee=1 (mirrors the 0x route).
  const wantsFee = params.get("fee") === "1";
  params.delete("fee");

  if (LIFI_INTEGRATOR) {
    params.set("integrator", LIFI_INTEGRATOR);
    if (wantsFee) params.set("fee", LIFI_FEE_SHARE);
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (LIFI_API_KEY) headers["x-lifi-api-key"] = LIFI_API_KEY;

  try {
    const res = await fetch(`${LIFI_API_URL}/quote?${params.toString()}`, { headers });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
