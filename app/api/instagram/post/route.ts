import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // Reels can poll up to ~3 min before publish

// Thin proxy → api.skatehive.app owns the Instagram cross-post implementation
// (single source for web + mobile). We forward the userbase session as a Cookie
// header (or the Keychain signature already in the body) so api can authenticate
// the same way it did here. Keeps the same request/response contract, so the
// SnapComposer client is unchanged.
const API_BASE = process.env.SKATEHIVE_API_URL || "https://api.skatehive.app";

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const refresh = request.cookies.get("userbase_refresh")?.value;

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/instagram/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(refresh ? { Cookie: `userbase_refresh=${refresh}` } : {}),
      },
      body: bodyText,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Instagram service unavailable", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
  });
}
