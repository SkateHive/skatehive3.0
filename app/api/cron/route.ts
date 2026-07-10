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

function tokensMatch(a: string, b: string): boolean {
  // timingSafeEqual requires equal-length buffers. Comparing the sha256
  // digests instead of the raw strings gives us both fixed length and
  // constant-time equality.
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Accept either:
 *   - x-userbase-token: <USERBASE_INTERNAL_TOKEN>       (manual / internal triggers)
 *   - Authorization: Bearer <CRON_SECRET>               (Vercel Cron — this header
 *                                                        is sent automatically when
 *                                                        CRON_SECRET is set in the
 *                                                        Vercel project env)
 *
 * Either match is enough. Before this dual-auth the Vercel nightly cron was
 * bouncing on the internal-token check and syncHiveSpots() never ran, so the
 * spotmap drifted between deploys. Keeping the internal-token path for the
 * userbase soft-post/vote retries that are also fired by this endpoint.
 */
function requireInternalToken(request: NextRequest) {
  const internalToken = process.env.USERBASE_INTERNAL_TOKEN;
  const cronSecret = process.env.CRON_SECRET;

  if (!internalToken && !cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          error:
            "Either USERBASE_INTERNAL_TOKEN or CRON_SECRET must be set in production",
        },
        { status: 500 }
      );
    }
    return null;
  }

  if (internalToken) {
    const provided = request.headers.get("x-userbase-token") || "";
    if (provided && tokensMatch(internalToken, provided)) return null;
  }

  if (cronSecret) {
    const authHeader = request.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : "";
    if (bearer && tokensMatch(cronSecret, bearer)) return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
