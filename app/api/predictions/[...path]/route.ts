/**
 * HivePredict API proxy.
 *
 * Proxies GET requests to https://hivepredict.app/api/* so the browser never
 * calls hivepredict directly (avoids CORS), lets us cache/revalidate to stay
 * under the upstream rate limit (60-240 req/min) and dedupe across users, and
 * keeps the upstream base URL out of the client bundle.
 *
 * Only whitelisted read-only path prefixes are allowed (no open proxy / SSRF).
 */

import { NextRequest, NextResponse } from "next/server";
import { HIVEPREDICT_API_BASE } from "@/lib/predictions/constants";

const FETCH_TIMEOUT = 8_000; // 8s

// Allowed top-level path segments (read-only endpoints only).
const ALLOWED_PREFIXES = new Set([
  "markets",
  "activity",
  "users",
  "stats",
  "leaderboard",
  "tokens",
  "categories",
  "sports",
  "transparency",
  "health",
]);

// Per-prefix cache window (seconds). Volatile market data refreshes fast;
// reference data (categories/tokens) can be cached for minutes.
function revalidateFor(prefix: string): number {
  switch (prefix) {
    case "categories":
    case "tokens":
      return 300;
    case "stats":
    case "leaderboard":
    case "transparency":
      return 60;
    default:
      return 15; // markets, activity, users
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  if (!path || path.length === 0) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const prefix = path[0];
  if (!ALLOWED_PREFIXES.has(prefix)) {
    return NextResponse.json(
      { error: `Path '${prefix}' is not allowed` },
      { status: 403 }
    );
  }

  // Rebuild the upstream URL: base + /path/segments + original query string.
  const segments = path.map(encodeURIComponent).join("/");
  const search = request.nextUrl.search; // includes leading "?" or ""
  const upstream = `${HIVEPREDICT_API_BASE}/${segments}${search}`;

  const revalidate = revalidateFor(prefix);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(upstream, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate },
    });

    clearTimeout(timeout);

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const response = NextResponse.json(data, { status: res.status });
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`
    );
    return response;
  } catch (err: any) {
    const reason = err?.name === "AbortError" ? "timeout" : err?.message;
    console.error("[predictions proxy]", upstream, reason);
    return NextResponse.json(
      { error: "HivePredict API unavailable" },
      { status: 502 }
    );
  }
}
