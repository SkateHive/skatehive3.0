import { NextRequest, NextResponse } from "next/server";
import { APP_CONFIG } from "@/config/app.config";

/**
 * Last-resort thumbnail resolver for Odysee URLs.
 *
 * The primary path is the client-side `resolve` API call against
 * `api.na-backend.odysee.com` (see components/markdown/VideoEmbed.tsx).
 * This route only gets hit when that fails — rate-limit, API downtime,
 * or a claim whose metadata has no thumbnail field set. We fetch the
 * Odysee embed page server-side (browsers can't because of CORS) and
 * parse the `og:image` meta tag, which Odysee always populates.
 *
 * Cached per URL for 24h at the edge so repeated misses don't keep
 * hammering Odysee.
 */
const OG_IMAGE_RE =
  /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i;
const FETCH_TIMEOUT_MS = 6000;

export async function GET(request: NextRequest) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  // Defence in depth: only proxy odysee.com URLs. Without this, the route
  // becomes an open SSRF vector that any client could use to fetch
  // arbitrary URLs through our infrastructure.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (parsed.hostname !== "odysee.com" && parsed.hostname !== "www.odysee.com") {
    return NextResponse.json({ error: "host not allowed" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": `Mozilla/5.0 (compatible; SkateHive/1.0; +${APP_CONFIG.BASE_URL})`,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      return NextResponse.json(
        { thumbnail: null },
        {
          headers: { "Cache-Control": "public, s-maxage=300" },
        }
      );
    }
    const html = await res.text();
    const match = html.match(OG_IMAGE_RE);
    const thumbnail = match?.[1] ?? null;
    return NextResponse.json(
      { thumbnail },
      {
        headers: {
          // 24h fresh, 7d stale-while-revalidate. og:image rarely changes.
          "Cache-Control":
            "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch {
    return NextResponse.json({ thumbnail: null });
  } finally {
    clearTimeout(timer);
  }
}
