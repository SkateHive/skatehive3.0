import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Smart proxy (userbase unification): the profile broadcast is delegated to
// api.skatehive.app, which owns the signing. It signs an `account_update2`
// (posting_json_metadata only — posting authority) with the user's stored
// posting key, so sponsored / email users can edit their profile WITHOUT Hive
// Keychain. The userbase_refresh cookie is forwarded as `Authorization: Bearer`
// (the api hive routes are Bearer-only).
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const profile = (body as { profile?: unknown })?.profile;
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return NextResponse.json({ error: "profile object is required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      "https://api.skatehive.app/api/userbase/hive/account-update",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({ profile }),
      }
    );
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
