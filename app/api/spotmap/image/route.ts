import { NextRequest } from "next/server";
import { GOOGLE_IMAGE_HOSTS } from "@/lib/spotmap/proxyImageUrl";

// Same-origin proxy for Google-hosted KML images. The
// `mymaps.usercontent.google.com` endpoint sends
// `Cross-Origin-Resource-Policy: same-site`, which browsers honor by
// refusing to render the bytes inside an <img> on skatehive.app. We
// fetch them server-side and re-stream them as a first-party response
// so the spot carousel can display them.
//
// Not a generic open proxy — the host allowlist
// (`GOOGLE_IMAGE_HOSTS`) is the only thing it will fetch.

export const runtime = "edge";

// 24h on the client / CDN, 7d stale-while-revalidate. Google images for
// a given KML URL are content-addressed in practice (the URL changes
// when the image changes), so long caching is safe.
const CACHE_HEADER =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("u");
  if (!target) {
    return new Response("Missing `u` query param", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:") {
    return new Response("Only https URLs supported", { status: 400 });
  }
  if (!GOOGLE_IMAGE_HOSTS.has(parsed.hostname)) {
    return new Response("Host not in allowlist", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      headers: {
        // Plain UA — no Referer (Google's mymaps endpoint behaves better
        // when it doesn't see a third-party referer).
        "User-Agent": "Skatehive-ImageProxy/1.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
  } catch (err) {
    console.error("[/api/spotmap/image] upstream fetch threw:", err);
    return new Response("Upstream fetch failed", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response(`Upstream ${upstream.status}`, {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return new Response("Upstream is not an image", { status: 502 });
  }

  // Strip the upstream's CORP / Content-Disposition headers — we want
  // the browser to treat this as a normal same-origin image, not an
  // attachment download or a cross-site-blocked resource.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": CACHE_HEADER,
      "content-security-policy": "default-src 'none'",
      "x-content-type-options": "nosniff",
    },
  });
}
