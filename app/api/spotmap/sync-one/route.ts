import { NextRequest, NextResponse } from "next/server";
import { syncSingleHiveSpot } from "@/lib/spotmap/syncHive";

export const maxDuration = 30;

// A Hive permlink is lowercase alphanumerics plus dashes/dots; author follows
// the same rules. Validate shape before we touch Hive so this can't be used to
// fan out arbitrary requests.
const HIVE_NAME = /^[a-z0-9.\-]{1,64}$/;

/**
 * POST /api/spotmap/sync-one
 *
 * Targeted ingestion of a single Hive skatespot, called by clients right after
 * they post a spot so it shows on the map within seconds (the bulk sync is the
 * slow reconciliation path). Public on purpose: the row's data is read from the
 * verified on-chain post, not the request body — the worst a caller can do is
 * force a re-sync of a spot that already exists.
 *
 * Body: { author: string, permlink: string }
 */
export async function POST(request: NextRequest) {
  let body: { author?: unknown; permlink?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const author = typeof body.author === "string" ? body.author.trim().toLowerCase() : "";
  const permlink = typeof body.permlink === "string" ? body.permlink.trim().toLowerCase() : "";

  if (!HIVE_NAME.test(author) || !HIVE_NAME.test(permlink)) {
    return NextResponse.json(
      { success: false, error: "author and permlink are required" },
      { status: 400 }
    );
  }

  try {
    const result = await syncSingleHiveSpot(author, permlink);

    if (result.status === "upserted") {
      return NextResponse.json({ success: true, status: result.status, spot: result.spot });
    }

    // Post exists/doesn't qualify yet (e.g. RPC node hasn't propagated the
    // write, or it's not a spot). 202 = accepted-but-not-ingested so the client
    // can fall back to its optimistic pin without treating it as a hard error.
    const status = result.status === "error" ? 502 : 202;
    return NextResponse.json(
      { success: false, status: result.status, error: result.error },
      { status }
    );
  } catch (err) {
    console.error("[POST /api/spotmap/sync-one] failed", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
