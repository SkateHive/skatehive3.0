import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { APP_CONFIG } from "@/config/app.config";
import { syncHiveSpots } from "@/lib/spotmap/syncHive";

function getBaseUrl(request: NextRequest) {
  const origin = APP_CONFIG.ORIGIN;
  if (origin) return origin;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function requireInternalToken(request: NextRequest) {
  const requiredToken = process.env.USERBASE_INTERNAL_TOKEN;
  if (!requiredToken) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "USERBASE_INTERNAL_TOKEN is required in production" },
        { status: 500 }
      );
    }
    return null;
  }

  const providedToken = request.headers.get("x-userbase-token") || "";
  const requiredHash = crypto.createHash("sha256").update(requiredToken).digest();
  const providedHash = crypto.createHash("sha256").update(providedToken).digest();

  if (!crypto.timingSafeEqual(requiredHash, providedHash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authError = requireInternalToken(request);
    if (authError) {
      return authError;
    }

    const baseUrl = getBaseUrl(request);
    const token = process.env.USERBASE_INTERNAL_TOKEN;

    const postRetryResponse = await fetch(
      new URL("/api/userbase/soft-posts/retry", baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-userbase-token": token } : {}),
        },
        body: JSON.stringify({ limit: 50, cleanup_days: 30 }),
      }
    );

    const postData = await postRetryResponse.json().catch(() => null);
    if (!postRetryResponse.ok) {
      return NextResponse.json(
        { error: "Failed to run cron", details: postData },
        { status: 500 }
      );
    }

    const voteRetryResponse = await fetch(
      new URL("/api/userbase/soft-votes/retry", baseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-userbase-token": token } : {}),
        },
        body: JSON.stringify({ limit: 50, cleanup_days: 30 }),
      }
    );

    const voteData = await voteRetryResponse.json().catch(() => null);
    if (!voteRetryResponse.ok) {
      return NextResponse.json(
        { error: "Failed to run cron", details: voteData },
        { status: 500 }
      );
    }

    // Spot map reconciliation backstop. New spots appear in real time via
    // POST /api/spotmap/sync-one; this daily pass catches anything that missed
    // it (edits, spots posted by clients that don't call sync-one). Non-fatal:
    // a spot-sync failure must not fail the soft-post/vote retries above.
    let spotmap: unknown = null;
    try {
      spotmap = await syncHiveSpots();
    } catch (err) {
      console.error("Cron spotmap sync failed:", err);
      spotmap = { error: err instanceof Error ? err.message : "spotmap sync failed" };
    }

    return NextResponse.json({
      success: true,
      soft_posts: postData,
      soft_votes: voteData,
      spotmap,
    });
  } catch (error: any) {
    console.error("Cron execution failed:", error);
    return NextResponse.json(
      { error: "Cron execution failed", details: error?.message || error },
      { status: 500 }
    );
  }
}
