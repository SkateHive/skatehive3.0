import { NextRequest, NextResponse } from "next/server";
import { buildChallenge, buildEvmChallenge } from "@/lib/cofrinhos/auth";
import { normalizeEvmAddress } from "@/lib/cofrinhos/owner";

const HANDLE_RE = /^[a-z0-9.\-]{3,20}$/;

/**
 * POST /api/cofrinhos/auth/challenge
 * Body: { account: string }      -> sign with the Hive posting key (HBD jars)
 *    or { evm_address: string }  -> sign with the wallet (USDC jars)
 * Returns a message the client signs to prove ownership
 * (see app/api/cofrinhos/auth/verify).
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body?.evm_address !== undefined) {
    const address = normalizeEvmAddress(body.evm_address);
    if (!address) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    try {
      return NextResponse.json(buildEvmChallenge(address));
    } catch (err: any) {
      console.error("Cofrinhos challenge failed:", err?.message || err);
      return NextResponse.json(
        { error: "Failed to create challenge" },
        { status: 500 }
      );
    }
  }

  const account = String(body?.account || "").trim().toLowerCase();
  if (!HANDLE_RE.test(account)) {
    return NextResponse.json({ error: "Invalid Hive account" }, { status: 400 });
  }

  try {
    return NextResponse.json(buildChallenge(account));
  } catch (err: any) {
    console.error("Cofrinhos challenge failed:", err?.message || err);
    return NextResponse.json(
      { error: "Failed to create challenge" },
      { status: 500 }
    );
  }
}
