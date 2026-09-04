import { NextRequest, NextResponse } from "next/server";
import { requireSpotmapAdmin } from "@/lib/spotmap/auth";
import { logSecurityAttempt } from "@/lib/server/adminUtils";
import { validateThumbnailOverride } from "@/lib/spotmap/thumbnails";

const API_BASE = "https://api.skatehive.app";

interface SpotPatchBody {
  thumbnail_override?: string | null;
  name?: string;
  description?: string;
}

/** Only these fields are ever forwarded upstream — anything else in the
 * client's body is dropped, not passed through. */
function whitelistBody(raw: unknown): { value: SpotPatchBody } | { error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { error: "Body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;
  const value: SpotPatchBody = {};

  if ("thumbnail_override" in body) {
    const validation = validateThumbnailOverride(body.thumbnail_override);
    if (!validation.ok) return { error: validation.error };
    value.thumbnail_override = validation.value;
  }

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "name must be a non-empty string" };
    }
    value.name = body.name.trim();
  }

  if ("description" in body) {
    if (typeof body.description !== "string") {
      return { error: "description must be a string" };
    }
    value.description = body.description;
  }

  return { value };
}

/**
 * PATCH /api/admin/spotmap/spot/[id]
 *
 * Same admin gate as /api/admin/spotmap/sync (requireSpotmapAdmin, backed by
 * the userbase_refresh session cookie). The cookie isn't shared with
 * api.skatehive.app (no Domain attribute), so — same pattern as
 * lib/userbase/proxyToApi.ts — we forward it as `Authorization: Bearer` to
 * the upstream admin route, which owns the actual write to spotmap_spots.
 *
 * The client body is whitelisted + validated here (not just passed through)
 * before it ever leaves this server: only thumbnail_override/name/description
 * survive, and thumbnail_override must be an https URL on an allow-listed
 * host (see lib/spotmap/thumbnails.ts) or null to clear it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = await requireSpotmapAdmin(request);
  if (!admin.ok) {
    logSecurityAttempt(admin.hiveUsername ?? undefined, "spotmap thumbnail override", request, false);
    return NextResponse.json(
      { success: false, error: admin.reason ?? "Forbidden" },
      { status: 403 }
    );
  }
  logSecurityAttempt(admin.hiveUsername!, "spotmap thumbnail override", request, true);

  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const whitelisted = whitelistBody(rawBody);
  if ("error" in whitelisted) {
    return NextResponse.json({ success: false, error: whitelisted.error }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${API_BASE}/api/admin/spotmap/spot/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify(whitelisted.value),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[PATCH /api/admin/spotmap/spot/[id]] upstream fetch failed", err);
    return NextResponse.json({ success: false, error: "upstream unavailable" }, { status: 502 });
  }
}
