import { NextRequest, NextResponse } from "next/server";
import { SAFE_TX_SERVICE_SLUG, type SafeTxLookup } from "@/lib/evm/safeTx";

/**
 * GET /api/safe/tx?chainId=&safeTxHash=
 *
 * Proxies the Safe Transaction Service so the bridge tracker can turn a
 * safeTxHash (what a WalletConnect-connected Safe returns) into the on-chain
 * transaction hash once the proposal is executed. Normalised so the client
 * never has to parse Safe's payload, and every failure is logged loudly.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const chainId = Number(searchParams.get("chainId"));
  const safeTxHash = searchParams.get("safeTxHash") ?? "";
  const slug = SAFE_TX_SERVICE_SLUG[chainId];

  if (!slug || !/^0x[0-9a-fA-F]{64}$/.test(safeTxHash)) {
    console.error(`[safe] bad lookup chainId=${chainId} safeTxHash=${safeTxHash}`);
    return NextResponse.json({ found: false, message: "unsupported chain or bad hash" }, { status: 400 });
  }

  const url = `https://api.safe.global/tx-service/${slug}/api/v1/multisig-transactions/${safeTxHash}/`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    if (res.status === 404) {
      // Not (yet) known to the service: either still indexing, or not a Safe tx at all.
      const body: SafeTxLookup = { found: false, confirmations: 0, confirmationsRequired: 0, isExecuted: false, isSuccessful: null, transactionHash: null, message: "not found in Safe Transaction Service" };
      return NextResponse.json(body, { status: 200 });
    }
    if (!res.ok) {
      const text = await res.text();
      console.error(`[safe] tx-service ${slug} HTTP ${res.status} for ${safeTxHash}: ${text.slice(0, 200)}`);
      return NextResponse.json({ found: false, message: `Safe service HTTP ${res.status}` }, { status: 502 });
    }
    const d = await res.json();
    const body: SafeTxLookup = {
      found: true,
      confirmations: Array.isArray(d.confirmations) ? d.confirmations.length : 0,
      confirmationsRequired: Number(d.confirmationsRequired ?? 0),
      isExecuted: !!d.isExecuted,
      isSuccessful: d.isExecuted ? !!d.isSuccessful : null,
      transactionHash: d.transactionHash ?? null,
    };
    console.info(`[safe] ${safeTxHash} → sigs ${body.confirmations}/${body.confirmationsRequired} executed=${body.isExecuted} tx=${body.transactionHash ?? "-"}`);
    return NextResponse.json(body);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[safe] lookup failed for ${safeTxHash}: ${message}`);
    return NextResponse.json({ found: false, message }, { status: 500 });
  }
}
