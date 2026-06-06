/**
 * Shared requester-authentication helpers for Instagram cross-post routes.
 *
 * Two ways to prove "who is making this request":
 *   1. userbase session cookie (email / wallet / Farcaster logins)
 *   2. a Hive posting-key signature (Keychain-only users)
 *
 * The self-serve route (/api/instagram/post) keeps its own inline copies; the
 * moderator force-post route uses these so the security-critical crypto isn't
 * re-implemented ad hoc.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { PublicKey, Signature, cryptoUtils } from "@hiveio/dhive";
import fetchAccount from "@/lib/hive/fetchAccount";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parseSignature(signature: string): Signature | null {
  let normalized = signature.trim().toLowerCase();
  if (normalized.startsWith("0x")) normalized = normalized.slice(2);
  if (!/^[0-9a-f]+$/.test(normalized)) return null;
  const buffer = Buffer.from(normalized, "hex");
  if (buffer.length === 65) return Signature.fromBuffer(buffer);
  if (buffer.length === 64) return new Signature(buffer, 0);
  return null;
}

/** Resolve a userbase user_id from the session refresh cookie, or null. */
export async function resolveSessionUserId(
  request: NextRequest,
  supabase: any
): Promise<string | null> {
  if (!supabase) return null;
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) return null;

  const { data } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);

  const session = data?.[0];
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  return session.user_id as string;
}

/**
 * Verify a posting-key signature over `message` AND confirm the public key is
 * authorized for `hiveAccount`'s posting role — which is what actually proves
 * the signer controls that Hive account.
 */
export async function verifyHivePostingSignature(args: {
  message: string;
  signature: string;
  publicKey: string;
  hiveAccount: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const sig = parseSignature(args.signature);
  if (!sig) return { ok: false, status: 400, error: "Invalid signature format." };

  try {
    const digest = cryptoUtils.sha256(Buffer.from(args.message));
    const pubkey = PublicKey.fromString(args.publicKey);
    if (!pubkey.verify(digest, sig)) {
      return { ok: false, status: 401, error: "Signature does not match message." };
    }
  } catch {
    return { ok: false, status: 400, error: "Failed to verify signature." };
  }

  let account;
  try {
    account = await fetchAccount(args.hiveAccount);
  } catch {
    return { ok: false, status: 404, error: "Hive account not found." };
  }
  const postingKeys: string[] =
    account.account.posting?.key_auths?.map((e: any) => e[0]) || [];
  if (!postingKeys.includes(args.publicKey)) {
    return {
      ok: false,
      status: 403,
      error: "Public key is not authorized to post for this Hive account.",
    };
  }
  return { ok: true };
}
