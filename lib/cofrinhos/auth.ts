import { NextRequest } from "next/server";
import crypto from "crypto";
import { PublicKey, Signature, cryptoUtils } from "@hiveio/dhive";
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
 *      then issues a short-lived HMAC-signed cookie scoped to that account
 *
 * Both the challenge and the session cookie are stateless (HMAC over JWT_SECRET),
 * so no extra DB table is needed. The challenge is single-window (10 min); the
 * session cookie lasts 7 days. A captured-then-replayed challenge within its
 * 10-min window only ever yields a cookie for the account that already signed it.
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

/**
 * Validate that `message` is a genuine, fresh challenge this server issued for
 * `account`. Rebuilds the canonical message from the parsed fields so any
 * tampering (including the human-readable lines) is rejected.
 */
export function verifyChallenge(account: string, message: string): boolean {
  if (typeof message !== "string") return false;
  const acct = account.toLowerCase();
  const tsMatch = message.match(/^Issued: (\d+)$/m);
  const nonceMatch = message.match(/^Nonce: ([0-9a-f]+)$/m);
  const handleMatch = message.match(/^Hive: @([a-z0-9.\-]+)$/m);
  if (!tsMatch || !nonceMatch || !handleMatch) return false;
  if (handleMatch[1] !== acct) return false;

  const ts = Number(tsMatch[1]);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > CHALLENGE_TTL_MS || ts > Date.now() + 60_000) {
    return false;
  }

  const expected = buildChallengeText(acct, ts, nonceMatch[1]);
  return timingSafeEqualStr(expected, message);
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

/** Confirm `publicKey` is one of the account's posting authorities (on-chain). */
export async function isPostingAuthority(
  account: string,
  publicKey: string
): Promise<boolean> {
  try {
    const { account: acc } = await fetchAccount(account.toLowerCase());
    const postingKeys = acc.posting?.key_auths?.map((entry) => entry[0]);
    return !!postingKeys?.includes(publicKey.trim());
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
