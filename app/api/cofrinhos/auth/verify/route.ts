import { NextRequest, NextResponse } from "next/server";
import {
  COFRINHOS_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  createSessionToken,
  isPostingAuthority,
  verifyChallenge,
  verifyHiveSignature,
} from "@/lib/cofrinhos/auth";

/**
 * POST /api/cofrinhos/auth/verify
 * Body: { account, message, signature, public_key }
 * Verifies the signed challenge and, on success, sets the cofrinhos session
 * cookie scoped to the Hive account.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const account = String(body?.account || "").trim().toLowerCase();
  const message = body?.message;
  const signature = body?.signature;
  const publicKey = body?.public_key;

  if (!account || typeof message !== "string" || typeof signature !== "string" || typeof publicKey !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  if (!verifyChallenge(account, message)) {
    return NextResponse.json(
      { error: "Invalid or expired challenge" },
      { status: 400 }
    );
  }

  if (!verifyHiveSignature(message, signature, publicKey)) {
    return NextResponse.json({ error: "Signature does not match" }, { status: 400 });
  }

  const authorized = await isPostingAuthority(account, publicKey);
  if (!authorized) {
    return NextResponse.json(
      { error: "Key is not a posting authority for this account" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ account });
  response.cookies.set(COFRINHOS_COOKIE, createSessionToken(account), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });
  return response;
}
