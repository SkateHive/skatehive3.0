import { NextRequest, NextResponse } from "next/server";
import { LIFI_API_URL } from "@/lib/evm/lifi";

const LIFI_API_KEY = process.env.LIFI_API_KEY || "";

/** GET /api/lifi/status?txHash=&fromChain=&toChain=&bridge= — cross-chain tracking. */
export async function GET(request: NextRequest) {
  const params = new URLSearchParams(new URL(request.url).searchParams);

  const headers: Record<string, string> = { accept: "application/json" };
  if (LIFI_API_KEY) headers["x-lifi-api-key"] = LIFI_API_KEY;

  try {
    const res = await fetch(`${LIFI_API_URL}/status?${params.toString()}`, { headers });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
