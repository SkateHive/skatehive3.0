/**
 * Hive API Proxy
 *
 * Proxies requests to Hive RPC nodes to avoid CORS issues.
 * Falls back through multiple nodes if the primary is down.
 */

import { NextRequest, NextResponse } from "next/server";

const HIVE_NODES = [
  "https://api.hive.blog",
  "https://api.deathwing.me",
  "https://rpc.ecency.com",
  "https://hive-api.arcange.eu",
];

const FETCH_TIMEOUT = 8_000; // 8s per node

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = JSON.stringify(body);
  let lastError: string | null = null;

  for (const node of HIVE_NODES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(node, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Check content-type before parsing — some nodes return HTML error pages
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        lastError = `${node} returned ${response.status} (${contentType})`;
        continue;
      }

      if (!response.ok) {
        lastError = `${node} returned ${response.status}`;
        continue;
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (err: any) {
      lastError = `${node}: ${err?.name === "AbortError" ? "timeout" : err?.message}`;
      continue;
    }
  }

  console.error("[Hive proxy] All nodes failed. Last:", lastError);
  return NextResponse.json(
    { error: "All Hive nodes unavailable" },
    { status: 502 }
  );
}
