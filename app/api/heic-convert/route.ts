import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "images.hive.blog",
  "files.peakd.com",
  "ipfs.skatehive.app",
  "gateway.pinata.cloud",
  "ipfs.io",
  "cloudflare-ipfs.com",
  "cdn.steemitimages.com",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const FETCH_TIMEOUT = 15_000; // 15s

/**
 * GET /api/heic-convert?url=https://images.hive.blog/DQm.../photo.heic
 *
 * Server-side HEIC-to-JPEG conversion proxy.
 * Uses heic-convert (pure JS, no native deps — works on Vercel).
 * Caches aggressively since on-chain images are immutable.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 }
      );
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const inputBuffer = new Uint8Array(arrayBuffer);

    if (inputBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    // Pure JS conversion — works on any platform including Vercel
    const convert = (await import("heic-convert")).default;
    const jpegBuffer = await convert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.85,
    });

    return new NextResponse(jpegBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(jpegBuffer.byteLength),
      },
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return NextResponse.json({ error: "Fetch timeout" }, { status: 504 });
    }
    console.error("[heic-convert] Conversion failed:", err?.message);
    return NextResponse.json(
      { error: "Conversion failed" },
      { status: 500 }
    );
  }
}
