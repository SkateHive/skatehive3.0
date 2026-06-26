import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.skatehive.app";

/**
 * Forward a userbase hive write to api.skatehive.app, carrying the caller's
 * userbase_refresh cookie. Returns the upstream response verbatim. The web no
 * longer signs/broadcasts these actions — api owns them (Phase 2 unification).
 *
 * Only the userbase_refresh cookie is forwarded; api resolves it the same way it
 * resolves a mobile Bearer token (same userbase_sessions row).
 */
export async function proxyUserbaseHive(
  request: NextRequest,
  path: string,
  transformBody?: (body: any) => any
): Promise<NextResponse> {
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (transformBody) body = transformBody(body);
  try {
    const upstream = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `userbase_refresh=${refreshToken}`,
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
