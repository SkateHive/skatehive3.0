import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy endpoint for the OG debug page.
 * Fetches a URL server-side to bypass CORS restrictions.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SkateHive-OG-Debug/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Fetch failed" },
      { status: 502 }
    );
  }
}
