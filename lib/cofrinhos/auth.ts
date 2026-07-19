import { NextRequest } from "next/server";
import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PublicKey, Signature, cryptoUtils, type Authority } from "@hiveio/dhive";
import fetchAccount from "@/lib/hive/fetchAccount";

/**
 * Cofrinhos auth.
 *
 * The wallet authenticates users via Hive (aioha/Keychain), not the userbase
 * session cookie, so jar ownership is proven with a Hive signature:
 *
 *   1. client GETs a challenge message for its Hive account
 *   2. client signs it with the posting key (aioha.signMessage)
 *   3. server verifies the signature + that the key is a posting authority,
 *      consumes the challenge nonce (single-use, DB-enforced), then issues a
 *      short-lived HMAC-signed cookie scoped to that account
 *
 * Challenge issuance and the session cookie are stateless (HMAC over
 * JWT_SECRET); the only persisted state is the consumed-nonce record written
 * on successful verification, so a captured message+signature cannot be
 * replayed to mint additional sessions within the 10-min challenge window.
 * The session cookie lasts 7 days.
 */

export const COFRINHOS_COOKIE = "cofrinhos_session";
const CHALLENGE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return secret;
}

function hmac(input: string): Buffer {
  return crypto.createHmac("sha256", getSecret()).update(input).digest();
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// ---------------------------------------------------------------------------
// Challenge (stateless, account + time bound)
// ---------------------------------------------------------------------------

function buildChallengeText(account: string, ts: number, nonce: string): string {
  const stamp = hmac(`challenge:${account}:${ts}:${nonce}`).toString("hex");
  return [
    "SkateHive Cofrinhos — prove you control this Hive account.",
    "",
    `Hive: @${account}`,
    `Issued: ${ts}`,
    `Nonce: ${nonce}`,
    `Stamp: ${stamp}`,
    "",
    "Signing this only proves account ownership. It does not move any funds.",
  ].join("\n");
}

/** Build a fresh challenge message for the given account. */
export function buildChallenge(account: string): { message: string } {
  const ts = Date.now();
  const nonce = crypto.randomBytes(12).toString("hex");
  return { message: buildChallengeText(account.toLowerCase(), ts, nonce) };
}

/** Fields parsed out of a valid challenge, needed to consume its nonce. */
export interface ChallengeFields {
  ts: number;
  nonce: string;
}

/**
 * Validate that `message` is a genuine, fresh challenge this server issued for
 * `account`. Rebuilds the canonical message from the parsed fields so any
 * tampering (including the human-readable lines) is rejected. Returns the
 * parsed fields on success (for nonce consumption), or null when invalid.
 */
export function verifyChallenge(
  account: string,
  message: string
): ChallengeFields | null {
  if (typeof message !== "string") return null;
  const acct = account.toLowerCase();
  const tsMatch = message.match(/^Issued: (\d+)$/m);
  const nonceMatch = message.match(/^Nonce: ([0-9a-f]+)$/m);
  const handleMatch = message.match(/^Hive: @([a-z0-9.\-]+)$/m);
  if (!tsMatch || !nonceMatch || !handleMatch) return null;
  if (handleMatch[1] !== acct) return null;

  const ts = Number(tsMatch[1]);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > CHALLENGE_TTL_MS || ts > Date.now() + 60_000) {
    return null;
  }

  const expected = buildChallengeText(acct, ts, nonceMatch[1]);
  if (!timingSafeEqualStr(expected, message)) return null;
  return { ts, nonce: nonceMatch[1] };
}

/**
 * Mark a verified challenge as used. The nonce primary key makes the first
 * insert win, so a replayed message+signature fails here atomically — no
 * read-then-write race. Returns false when the nonce was already consumed
 * (or the write failed; auth fails closed either way).
 */
export async function consumeChallenge(
  supabase: SupabaseClient,
  account: string,
  fields: ChallengeFields
): Promise<boolean> {
  const nowIso = new Date().toISOString();
  // Opportunistic cleanup: consumed nonces only matter while their challenge
  // could still be replayed, so expired rows are dead weight. Synchronous on
  // purpose — this project runs without cron jobs.
  await supabase
    .from("userbase_cofrinhos_used_challenges")
    .delete()
    .lt("expires_at", nowIso);

  const { error } = await supabase
    .from("userbase_cofrinhos_used_challenges")
    .insert({
      nonce: fields.nonce,
      hive_account: account.toLowerCase(),
      expires_at: new Date(fields.ts + CHALLENGE_TTL_MS).toISOString(),
    });
  if (error) {
    // Unique violation = replay; anything else = infra failure. Both must
    // deny the session, but only the latter is worth logging loudly.
    if (error.code !== "23505") {
      console.error("Failed to consume cofrinhos challenge:", error.message);
    }
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Hive signature verification (mirrors identities/hive/verify)
// ---------------------------------------------------------------------------

function parseSignature(signature: string): Signature | null {
  let normalized = signature.trim().toLowerCase();
  if (normalized.startsWith("0x")) normalized = normalized.slice(2);
  if (!/^[0-9a-f]+$/.test(normalized)) return null;
  const buffer = Buffer.from(normalized, "hex");
  if (buffer.length === 65) return Signature.fromBuffer(buffer);
  if (buffer.length === 64) return new Signature(buffer, 0);
  return null;
}

/** Verify that `signature` over `message` was made by `publicKey`. */
export function verifyHiveSignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  const parsed = parseSignature(signature);
  if (!parsed) return false;
  try {
    const digest = cryptoUtils.sha256(Buffer.from(message));
    return PublicKey.fromString(publicKey.trim()).verify(digest, parsed);
  } catch {
    return false;
  }
}

/**
 * Pure rule behind isPostingAuthority: can `publicKey`, on its own, satisfy
 * this posting authority? Checking key membership alone is not enough: in a
 * multisig posting setup a low-weight key can't act alone, so its weight must
 * meet `weight_threshold`. Delegated `account_auths` are deliberately not
 * resolved — unlocking cofrinhos requires the account's own posting key.
 * Exported separately so the rule is unit-testable without hitting a Hive
 * node (see lib/cofrinhos/__tests__/auth.test.ts).
 */
export function keySatisfiesPostingAuthority(
  posting: Authority | undefined,
  publicKey: string
): boolean {
  const threshold = posting?.weight_threshold;
  if (!posting?.key_auths || typeof threshold !== "number" || threshold <= 0) {
    return false;
  }
  const key = publicKey.trim();
  const entry = posting.key_auths.find(([k]) => String(k) === key);
  if (!entry) return false;
  return Number(entry[1]) >= threshold;
}

/** Confirm `publicKey` satisfies the account's on-chain posting authority. */
export async function isPostingAuthority(
  account: string,
  publicKey: string
): Promise<boolean> {
  try {
    const { account: acc } = await fetchAccount(account.toLowerCase());
    return keySatisfiesPostingAuthority(acc.posting, publicKey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Session cookie (stateless HMAC token)
// ---------------------------------------------------------------------------

interface SessionPayload {
  account: string;
  exp: number;
}

/** Create a signed session token for the account (valid 7 days). */
export function createSessionToken(account: string): string {
  const payload: SessionPayload = {
    account: account.toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(hmac(`session:${body}`));
  return `${body}.${sig}`;
}

/** Verify a session token and return its account, or null when invalid. */
export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(hmac(`session:${body}`));
  if (!timingSafeEqualStr(expected, sig)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as SessionPayload;
    if (!payload.account || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload.account;
  } catch {
    return null;
  }
}

/** Read the authenticated Hive account from the request cookie, or null. */
export function getAuthedAccount(request: NextRequest): string | null {
  return verifySessionToken(request.cookies.get(COFRINHOS_COOKIE)?.value);
}

export const SESSION_COOKIE_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);
