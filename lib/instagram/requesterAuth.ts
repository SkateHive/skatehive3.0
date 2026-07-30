/**
 * Hive posting-key signature verification for Keychain-only requesters.
 *
 * The other way to prove "who is making this request" — the userbase session
 * cookie — is not Instagram-specific and lives in lib/userbase/session.ts.
 *
 * The self-serve route (/api/instagram/post) keeps its own inline copies; the
 * moderator force-post route uses these so the security-critical crypto isn't
 * re-implemented ad hoc.
 */
import type { Signature as SignatureType } from "@hiveio/dhive";
import { PublicKey, Signature, cryptoUtils } from "@hiveio/dhive";
import fetchAccount from "@/lib/hive/fetchAccount";

export { hashToken, resolveSessionUserId } from "@/lib/userbase/session";

export function parseSignature(signature: string): SignatureType | null {
  let normalized = signature.trim().toLowerCase();
  if (normalized.startsWith("0x")) normalized = normalized.slice(2);
  if (!/^[0-9a-f]+$/.test(normalized)) return null;
  const buffer = Buffer.from(normalized, "hex");
  if (buffer.length === 65) return Signature.fromBuffer(buffer);
  if (buffer.length === 64) return new Signature(buffer, 0);
  return null;
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
