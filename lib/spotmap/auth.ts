import { NextRequest } from "next/server";
import crypto from "crypto";
import { isServerSideAdmin } from "@/lib/server/adminUtils";
import { getSpotmapSupabase } from "./supabase";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AdminCheckResult {
  ok: boolean;
  hiveUsername: string | null;
  reason?: string;
}

/**
 * Returns whether the caller is an authenticated user whose linked Hive
 * identity is in the ADMIN_USERS allow-list. Uses the existing userbase
 * session cookie (userbase_refresh) so users don't need to re-auth for
 * admin actions.
 *
 * We deliberately do NOT trust a username sent in the request body —
 * the username has to come from a verified linked identity row.
 */
export async function requireSpotmapAdmin(request: NextRequest): Promise<AdminCheckResult> {
  const supabase = getSpotmapSupabase();
  if (!supabase) {
    return { ok: false, hiveUsername: null, reason: "Supabase not configured" };
  }

  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return { ok: false, hiveUsername: null, reason: "No session" };
  }

  const { data: sessionRows, error: sessionErr } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);

  if (sessionErr) {
    return { ok: false, hiveUsername: null, reason: "Session lookup failed" };
  }

  const session = sessionRows?.[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return { ok: false, hiveUsername: null, reason: "Session expired" };
  }

  const { data: identities } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", session.user_id)
    .eq("type", "hive")
    .limit(1);

  const hiveUsername = identities?.[0]?.handle as string | undefined;
  if (!hiveUsername) {
    return { ok: false, hiveUsername: null, reason: "No linked Hive identity" };
  }

  if (!isServerSideAdmin(hiveUsername)) {
    return { ok: false, hiveUsername, reason: "Not in admin allow-list" };
  }

  return { ok: true, hiveUsername };
}
