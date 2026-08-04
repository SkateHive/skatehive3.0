import { NextRequest, NextResponse } from "next/server";
import { buildChallenge } from "@/lib/cofrinhos/auth";

const HANDLE_RE = /^[a-z0-9.\-]{3,20}$/;

/**
 * POST /api/cofrinhos/auth/challenge
 * Body: { account: string }
 * Returns a message the client signs with its Hive posting key to prove
 * ownership of the account (see app/api/cofrinhos/auth/verify).
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
