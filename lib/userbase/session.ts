/**
 * Resolving "who is making this request" from the userbase session cookie.
 *
 * Lives here rather than under lib/instagram because it has nothing to do with
 * Instagram — the cross-post queue, notifications and anything else that needs
 * a signed-in user all go through it.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Resolve a userbase user_id from the session refresh cookie, or null.
 *
 * Rejects revoked and expired sessions. Returning null (rather than throwing)
 * lets callers decide whether "not signed in" is an error or just a quieter
 * code path — app notifications, for example, treat it as "show nothing".
 */
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
