import { NextRequest, NextResponse } from "next/server";
import { LIFI_API_URL } from "@/lib/evm/lifi";

// `integrator` must match the string registered with LI.FI (portal.li.fi) for
// the API key; `fee` is a decimal share (0.005 = 0.5%) collected to the wallet
// LI.FI has on file for the integrator (see monetization onboarding).
const LIFI_API_KEY = process.env.LIFI_API_KEY || "";
const LIFI_INTEGRATOR = process.env.LIFI_INTEGRATOR || "";
const LIFI_FEE_SHARE = (Number(process.env.LIFI_FEE_BPS || "50") / 10000).toString();

function feeNotConfigured(data: unknown): boolean {
  const msg = (data as { message?: string })?.message ?? "";
  return /not configured for collecting fees|fee wallet/i.test(msg);
}

async function fetchQuote(params: URLSearchParams, headers: Record<string, string>) {
  const res = await fetch(`${LIFI_API_URL}/quote?${params.toString()}`, { headers });
  const data = await res.json();
  return { res, data };
}

/** GET /api/lifi/quote?fromChain=&toChain=&fromToken=&toToken=&fromAmount=&fromAddress=&slippage=&order=&fee=1 */
export async function GET(request: NextRequest) {
  const params = new URLSearchParams(new URL(request.url).searchParams);

  // Client opts into the integrator fee with ?fee=1 (mirrors the 0x route).
  const wantsFee = params.get("fee") === "1";
  params.delete("fee");

  let feeApplied = false;
  if (LIFI_INTEGRATOR) {
    // Always attach the integrator string for attribution/tracking.
    params.set("integrator", LIFI_INTEGRATOR);
    // Optimistically attempt to take the fee; if the integrator isn't onboarded
    // for fee collection yet, LI.FI rejects the quote and we retry without it
    // below. This means fees start flowing automatically the moment onboarding
    // completes — no redeploy or flag flip needed.
    if (wantsFee) {
      params.set("fee", LIFI_FEE_SHARE);
      feeApplied = true;
    }
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (LIFI_API_KEY) headers["x-lifi-api-key"] = LIFI_API_KEY;

  try {
    let { res, data } = await fetchQuote(params, headers);

    // Graceful fallback: fee not enabled yet → retry once without it.
    if (feeApplied && !res.ok && feeNotConfigured(data)) {
      params.delete("fee");
      ({ res, data } = await fetchQuote(params, headers));
    }

    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
