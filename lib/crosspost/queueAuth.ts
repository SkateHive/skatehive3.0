/**
 * Who is allowed to review the cross-post queue.
 *
 * Two accepted callers:
 *
 *   1. The SkateHive portal (separate repo, server-to-server). It sends
 *      `x-skatehive-portal-token: <CROSSPOST_PORTAL_TOKEN>`. The portal never
 *      talks to Meta / Neynar / Supabase directly — it drives this API, so the
 *      publishing credentials stay in one place. It should also send
 *      `x-skatehive-curator: <hive-handle>` so the audit trail names a person
 *      rather than "the portal".
 *
 *   2. A logged-in SkateHive admin (userbase session cookie + linked Hive
 *      handle on the ADMIN_USERS allowlist), so the queue is also operable
 *      from inside the app without the portal.
 */
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { isServerSideAdmin, logSecurityAttempt } from "@/lib/server/adminUtils";
import { resolveSessionUserId } from "@/lib/userbase/session";

export interface CuratorIdentity {
  /** Hive handle credited on the review, when we know one. */
  handle: string | null;
  /** userbase user id, when the caller was a logged-in admin. */
  userId: string | null;
  via: "portal-token" | "admin-session";
}

export type CuratorAuthResult =
  | { ok: true; curator: CuratorIdentity }
  | { ok: false; status: number; error: string };

function tokensMatch(a: string, b: string): boolean {
  // Compare sha256 digests so the buffers are equal-length (timingSafeEqual
  // throws otherwise) and the comparison stays constant-time.
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/** Strip @ and lowercase a Hive handle from an untrusted header. */
function normalizeHandle(raw: string | null): string | null {
  if (!raw) return null;
  const clean = raw.trim().replace(/^@/, "").toLowerCase();
  return /^[a-z0-9.-]{3,16}$/.test(clean) ? clean : null;
}

export async function requireCurator(
  request: NextRequest,
  supabase: any
): Promise<CuratorAuthResult> {
  // ── 1. Portal token ────────────────────────────────────────────────
  const portalToken = process.env.CROSSPOST_PORTAL_TOKEN;
  const provided = request.headers.get("x-skatehive-portal-token") || "";
  if (portalToken && provided && tokensMatch(portalToken, provided)) {
    const handle = normalizeHandle(request.headers.get("x-skatehive-curator"));
    logSecurityAttempt(handle ?? "portal", "crosspost queue", request, true);
    return { ok: true, curator: { handle, userId: null, via: "portal-token" } };
  }
  // A wrong token is a real signal — log it before falling through to the
  // cookie path (a browser session never sends this header at all).
  if (provided) {
    logSecurityAttempt(undefined, "crosspost queue (bad portal token)", request, false);
    return { ok: false, status: 401, error: "Invalid portal token." };
  }

  // ── 2. Logged-in SkateHive admin ───────────────────────────────────
  if (!supabase) {
    return { ok: false, status: 500, error: "Server is missing Supabase config." };
  }
  const userId = await resolveSessionUserId(request, supabase);
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const { data } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "hive")
    .limit(1);
  const handle = (data?.[0]?.handle as string | undefined) ?? null;

  if (!handle || !isServerSideAdmin(handle)) {
    logSecurityAttempt(handle ?? undefined, "crosspost queue", request, false);
    return {
      ok: false,
      status: 403,
      error: "Access Denied: curation privileges required.",
    };
  }
  logSecurityAttempt(handle, "crosspost queue", request, true);
  return { ok: true, curator: { handle, userId, via: "admin-session" } };
}
