import { NextRequest, NextResponse } from "next/server";
import {
  COFRINHOS_COOKIE,
  COFRINHOS_EVM_COOKIE,
  SESSION_COOKIE_MAX_AGE,
  consumeChallenge,
  createEvmSessionToken,
  createSessionToken,
  isPostingAuthority,
  verifyChallenge,
  verifyEvmChallenge,
  verifyHiveSignature,
} from "@/lib/cofrinhos/auth";
import { verifyEvmSignature } from "@/lib/cofrinhos/evm";
import { evmOwner, hiveOwner, normalizeEvmAddress } from "@/lib/cofrinhos/owner";
import { getCofrinhosSupabase } from "@/lib/cofrinhos/supabase";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_COOKIE_MAX_AGE,
};

/**
 * POST /api/cofrinhos/auth/verify
 * Body: { account, message, signature, public_key }   (Hive, HBD jars)
 *    or { evm_address, message, signature }            (wallet, USDC jars)
 * Verifies the signed challenge, consumes it (each challenge mints exactly one
 * session) and, on success, sets the session cookie for that owner. The Hive
 * and wallet sessions use separate cookies and can coexist.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body?.evm_address !== undefined) {
    return verifyWallet(body);
  }

  const account = String(body?.account || "").trim().toLowerCase();
  const message = body?.message;
  const signature = body?.signature;
  const publicKey = body?.public_key;

  if (!account || typeof message !== "string" || typeof signature !== "string" || typeof publicKey !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const challenge = verifyChallenge(account, message);
  if (!challenge) {
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

  const supabase = getCofrinhosSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  // Consume last, once every other check has passed: a transient RPC failure
  // above shouldn't burn the challenge, but a fully valid replay must die here.
  if (!(await consumeChallenge(supabase, hiveOwner(account), challenge))) {
    return NextResponse.json(
      { error: "Challenge already used" },
      { status: 409 }
    );
  }

  const response = NextResponse.json({ account });
  response.cookies.set(COFRINHOS_COOKIE, createSessionToken(account), COOKIE_OPTIONS);
  return response;
}

/** Wallet branch: same order of checks, challenge consumed last. */
async function verifyWallet(body: any) {
  const address = normalizeEvmAddress(body?.evm_address);
  const message = body?.message;
  const signature = body?.signature;
  if (!address || typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const challenge = verifyEvmChallenge(address, message);
  if (!challenge) {
    return NextResponse.json(
      { error: "Invalid or expired challenge" },
      { status: 400 }
    );
  }

  if (!(await verifyEvmSignature(address, message, signature))) {
    return NextResponse.json({ error: "Signature does not match" }, { status: 400 });
  }

  const supabase = getCofrinhosSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  if (!(await consumeChallenge(supabase, evmOwner(address), challenge))) {
    return NextResponse.json(
      { error: "Challenge already used" },
      { status: 409 }
    );
  }

  const response = NextResponse.json({ evm_address: address });
  response.cookies.set(COFRINHOS_EVM_COOKIE, createEvmSessionToken(address), COOKIE_OPTIONS);
  return response;
}
