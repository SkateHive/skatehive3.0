import { NextRequest, NextResponse } from "next/server";
import { LIFI_API_URL, LIFI_FEE_STATUS_HEADER, type LifiFeeStatus } from "@/lib/evm/lifi";

// `integrator` must match the integration-string registered at portal.li.fi.
// Our portal integration is *named* "skatehive" but its integration-string is
// "gnars" — `integrator=skatehive` does not exist and LI.FI rejects it.
// `fee` is a decimal share (0.005 = 0.5%) paid to the fee wallet configured in
// the portal for that integrator (SkateHive split 0x1c04…5F21). LI.FI keeps a
// share of the integrator fee.
const LIFI_API_KEY = process.env.LIFI_API_KEY || "";
const LIFI_INTEGRATOR = process.env.LIFI_INTEGRATOR || "";
const LIFI_FEE_SHARE = (Number(process.env.LIFI_FEE_BPS || "50") / 10000).toString();

if (!LIFI_INTEGRATOR) {
  console.error(
    "[lifi] LIFI_INTEGRATOR is EMPTY — bridge quotes will be sent WITHOUT integrator/fee. " +
      "SkateHive collects NOTHING on bridges until this env var is set (expected: gnars)."
  );
}

function feeNotConfigured(data: unknown): boolean {
  const msg = (data as { message?: string })?.message ?? "";
  return /not configured for collecting fees|fee wallet/i.test(msg);
}

async function fetchQuote(params: URLSearchParams, headers: Record<string, string>) {
  const url = `${LIFI_API_URL}/quote?${params.toString()}`;
  // Log the exact outbound URL (no secrets in it) so "is the fee really being
  // sent?" is answerable from server logs instead of by reading code.
  console.info(`[lifi] → ${url}`);
  const res = await fetch(url, { headers });
  const data = await res.json();
  return { res, data };
}

/** GET /api/lifi/quote?fromChain=&toChain=&fromToken=&toToken=&fromAmount=&fromAddress=&slippage=&order=&fee=1 */
export async function GET(request: NextRequest) {
  const params = new URLSearchParams(new URL(request.url).searchParams);

  // Client opts into the integrator fee with ?fee=1 (mirrors the 0x route).
  const wantsFee = params.get("fee") === "1";
  params.delete("fee");

  let feeStatus: LifiFeeStatus = wantsFee ? "not-configured" : "not-requested";
  if (LIFI_INTEGRATOR) {
    // Always attach the integrator string for attribution/tracking.
    params.set("integrator", LIFI_INTEGRATOR);
    if (wantsFee) {
      params.set("fee", LIFI_FEE_SHARE);
      feeStatus = "applied";
    }
  } else if (wantsFee) {
    console.error(
      `[lifi] quote requested WITH fee but LIFI_INTEGRATOR is empty — sending without fee ` +
        `(${params.get("fromChain")}→${params.get("toChain")} amount=${params.get("fromAmount")})`
    );
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (LIFI_API_KEY) headers["x-lifi-api-key"] = LIFI_API_KEY;

  try {
    let { res, data } = await fetchQuote(params, headers);

    // Fallback: integrator not onboarded for fees → retry once without the fee.
    // This must be LOUD: it means the bridge keeps working but collects nothing.
    if (feeStatus === "applied" && !res.ok && feeNotConfigured(data)) {
      console.error(
        `[lifi] LI.FI REJECTED fee for integrator="${LIFI_INTEGRATOR}" (${(data as { message?: string })?.message}). ` +
          `Retrying WITHOUT fee — SkateHive collects NOTHING on this bridge. Check portal.li.fi fee wallet setup.`
      );
      params.delete("fee");
      ({ res, data } = await fetchQuote(params, headers));
      feeStatus = "fallback-no-fee";
    }

    return NextResponse.json(data, { status: res.status, headers: { [LIFI_FEE_STATUS_HEADER]: feeStatus } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[lifi] quote fetch failed:", message);
    return NextResponse.json({ message }, { status: 500, headers: { [LIFI_FEE_STATUS_HEADER]: feeStatus } });
  }
}
