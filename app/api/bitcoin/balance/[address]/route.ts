import { NextRequest, NextResponse } from "next/server";
import { validateBtcAddress, normalizeBtcAddress } from "@/lib/utils/validateBtcAddress";

const CACHE_DURATION = 60; // seconds

/**
 * GET /api/bitcoin/balance/[address]
 *
 * Returns the confirmed on-chain BTC balance for a self-claimed address.
 * Source: mempool.space (public, no key). Balance = funded - spent (sats).
 *
 * Response: { address, balanceSats, balanceBtc }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  const raw = params?.address ? decodeURIComponent(params.address) : "";
  if (!validateBtcAddress(raw)) {
    return NextResponse.json({ error: "Invalid Bitcoin address" }, { status: 400 });
  }
  const address = normalizeBtcAddress(raw);

  try {
    const res = await fetch(`https://mempool.space/api/address/${address}`, {
      next: { revalidate: CACHE_DURATION },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream error", balanceSats: 0, balanceBtc: 0 },
        { status: 502 }
      );
    }
    const data = await res.json();
    const funded = Number(data?.chain_stats?.funded_txo_sum || 0);
    const spent = Number(data?.chain_stats?.spent_txo_sum || 0);
    const balanceSats = Math.max(0, funded - spent);
    const balanceBtc = balanceSats / 1e8;

    return NextResponse.json(
      { address, balanceSats, balanceBtc },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_DURATION}, stale-while-revalidate=300`,
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch balance", balanceSats: 0, balanceBtc: 0 },
      { status: 502 }
    );
  }
}
