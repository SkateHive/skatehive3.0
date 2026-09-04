import { NextRequest, NextResponse } from "next/server";
import { requireSpotmapAdmin } from "@/lib/spotmap/auth";
import { logSecurityAttempt } from "@/lib/server/adminUtils";

const API_BASE = "https://api.skatehive.app";

/**
 * PATCH /api/admin/spotmap/spot/[id]
 *
 * Same admin gate as /api/admin/spotmap/sync (requireSpotmapAdmin, backed by
 * the userbase_refresh session cookie). The cookie isn't shared with
 * api.skatehive.app (no Domain attribute), so — same pattern as
 * lib/userbase/proxyToApi.ts — we forward it as `Authorization: Bearer` to
 * the upstream admin route, which owns the actual write to spotmap_spots.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const refreshToken = request.cookies.get("userbase_refresh")!.value;

  try {
    const upstream = await fetch(`${API_BASE}/api/admin/spotmap/spot/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify(body),
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
