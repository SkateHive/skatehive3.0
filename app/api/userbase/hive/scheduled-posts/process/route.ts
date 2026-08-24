import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  hasGrantedPostingAuthority,
  broadcastAsUserViaAuthority,
  PostingAuthorityError,
} from "@/lib/hive/postingAuthorityBroadcast";
import { buildScheduledPostOps } from "@/lib/userbase/scheduledPostUtils";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function tokensMatch(a: string, b: string): boolean {
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Two callers, two credentials (mirrors /api/cron):
 *  - x-userbase-token: USERBASE_INTERNAL_TOKEN — the Vercel daily cron path
 *  - Authorization: Bearer CRON_SECRET — the SOPA portal's hourly external
 *    tick, and the documented MANUAL trigger for unsticking the queue:
 *      curl -X POST https://skatehive.app/api/userbase/hive/scheduled-posts/process \
 *           -H "Authorization: Bearer $CRON_SECRET" -d '{"source":"manual"}'
 */
function isAuthorized(request: NextRequest): "ok" | "unauthorized" | "not_configured" {
  const internalToken = process.env.USERBASE_INTERNAL_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  if (!internalToken && !cronSecret) return "not_configured";
  if (internalToken) {
    const token = request.headers.get("x-userbase-token") ?? "";
    if (token && tokensMatch(internalToken, token)) return "ok";
  }
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (bearer && tokensMatch(cronSecret, bearer)) return "ok";
  }
  return "unauthorized";
}

async function notifyAlert(payload: Record<string, any>) {
  const webhook = process.env.USERBASE_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to send userbase alert:", err);
  }
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const authResult = isAuthorized(request);
  if (authResult === "not_configured") {
    // LOUD on purpose: a missing env var on this class of endpoint has burned
    // us repeatedly (ZEROX_API_KEY 19 days, LIFI_INTEGRATOR). Name the vars.
    console.error(
      "[scheduled-posts] HALTED: neither USERBASE_INTERNAL_TOKEN nor CRON_SECRET is set in this environment — no scheduled post will ever be processed here until one of them is configured (Vercel → Settings → Environment Variables, Production)."
    );
    await notifyAlert({
      type: "scheduled_posts_config_missing",
      severity: "critical",
      message: "USERBASE_INTERNAL_TOKEN/CRON_SECRET missing — scheduled post processing is dead in this environment.",
    });
    return NextResponse.json(
      { error: "Scheduled posting is not configured on this server: set USERBASE_INTERNAL_TOKEN or CRON_SECRET" },
      { status: 503 }
    );
  }
  if (authResult === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 100);
  const tickSource =
    typeof body?.source === "string" && body.source ? body.source.slice(0, 40) : "unknown";

  // Liveness heartbeat — recorded on EVERY authorized tick, even when nothing
  // is due. The scheduling UI reads this to tell users when processing has
  // stalled (external trigger down) instead of silently sitting on posts.
  const now = new Date().toISOString();
  const { error: heartbeatError } = await supabase
    .from("userbase_cron_heartbeat")
    .upsert({ id: "scheduled-posts", last_tick_at: now, source: tickSource });
  if (heartbeatError) {
    console.error("[scheduled-posts] heartbeat upsert failed:", heartbeatError.message);
  }

  // Recover orphaned claims: a run that died mid-broadcast leaves rows in
  // "processing". After 15 minutes they go back to pending; the (author,
  // permlink) uniqueness means a re-broadcast of an already-published post
  // becomes an EDIT on Hive, not a duplicate post — worst case is wasted RC.
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await supabase
    .from("userbase_scheduled_posts")
    .update({ status: "pending", claimed_at: null, updated_at: now })
    .eq("status", "processing")
    .lt("claimed_at", staleCutoff);

  // Fetch pending posts whose scheduled time has arrived
  const { data: rows, error: fetchError } = await supabase
    .from("userbase_scheduled_posts")
    .select(
      "id, hive_author, parent_author, parent_permlink, permlink, title, body, json_metadata, beneficiaries"
    )
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (fetchError) {
    console.error("Failed to fetch due scheduled posts:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch scheduled posts" },
      { status: 500 }
    );
  }

  let broadcasted = 0;
  let cancelled = 0;
  let failed = 0;

  let skippedClaimed = 0;
  for (const row of rows ?? []) {
    // ── ATOMIC CLAIM ─────────────────────────────────────────────────────
    // PREMISE: there are TWO trigger sources (Vercel daily cron + the SOPA
    // portal's hourly tick, plus manual runs). Selecting and then broadcasting
    // without a claim would double-broadcast on overlap. The claim flips
    // pending → processing only if the row is STILL pending; losing the race
    // returns zero rows and we skip. (Double broadcast would not duplicate the
    // post on Hive — same (author, permlink) is an edit — but it wastes RC and
    // corrupts status bookkeeping.)
    const { data: claimed, error: claimError } = await supabase
      .from("userbase_scheduled_posts")
      .update({ status: "processing", claimed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id");
    if (claimError) {
      console.error(`[scheduled-posts] claim failed for ${row.id}:`, claimError.message);
      continue;
    }
    if (!claimed || claimed.length === 0) {
      skippedClaimed += 1; // another trigger got it first — working as designed
      continue;
    }

    // Safety re-check: verify the user hasn't revoked posting authority since scheduling
    let hasAuthority: boolean;
    try {
      hasAuthority = await hasGrantedPostingAuthority(row.hive_author);
    } catch (err) {
      if (err instanceof PostingAuthorityError && err.code === "CONFIG_MISSING") {
        // Server misconfiguration — stop processing; this affects all posts
        await notifyAlert({
          type: "scheduled_posts_config_missing",
          severity: "critical",
          message: "DEFAULT_HIVE_POSTING_ACCOUNT or DEFAULT_HIVE_POSTING_KEY is not configured. Scheduled post processing halted.",
        });
        return NextResponse.json(
          {
            error: "Scheduled post service is not configured",
            broadcasted,
            cancelled,
            failed,
          },
          { status: 503 }
        );
      }
      // Transient Hive node error — skip this post this run, try again next cron tick
      console.error(`Authority check failed for ${row.hive_author} (post ${row.id}):`, err);
      failed += 1;
      await supabase
        .from("userbase_scheduled_posts")
        .update({
          status: "failed",
          last_error: err instanceof Error ? err.message : "Authority check failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    if (!hasAuthority) {
      // User revoked authority on-chain — cancel gracefully
      await supabase
        .from("userbase_scheduled_posts")
        .update({
          status: "cancelled",
          last_error: "Posting authority revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      cancelled += 1;
      continue;
    }

    // Build and broadcast the ops
    const ops = buildScheduledPostOps({
      hive_author: row.hive_author,
      parent_author: row.parent_author ?? "",
      parent_permlink: row.parent_permlink,
      permlink: row.permlink,
      title: row.title ?? "",
      body: row.body,
      json_metadata: row.json_metadata ?? {},
      beneficiaries: Array.isArray(row.beneficiaries) ? row.beneficiaries : [],
    });

    try {
      await broadcastAsUserViaAuthority(row.hive_author, ops);
    } catch (err) {
      if (err instanceof PostingAuthorityError) {
        if (err.code === "CONFIG_MISSING") {
          await notifyAlert({
            type: "scheduled_posts_config_missing",
            severity: "critical",
            message: "DEFAULT_HIVE_POSTING_ACCOUNT or DEFAULT_HIVE_POSTING_KEY is not configured. Scheduled post processing halted.",
          });
          return NextResponse.json(
            {
              error: "Scheduled post service is not configured",
              broadcasted,
              cancelled,
              failed,
            },
            { status: 503 }
          );
        }
        if (err.code === "CONFIG_INVALID") {
          await notifyAlert({
            type: "scheduled_posts_config_invalid",
            severity: "critical",
            message: "DEFAULT_HIVE_POSTING_KEY is malformed. Scheduled post processing halted.",
          });
          return NextResponse.json(
            {
              error: "Scheduled post service is misconfigured",
              broadcasted,
              cancelled,
              failed,
            },
            { status: 503 }
          );
        }
        if (err.code === "NOT_GRANTED") {
          // Race: authority was revoked between the check above and the broadcast attempt
          await supabase
            .from("userbase_scheduled_posts")
            .update({
              status: "cancelled",
              last_error: "Posting authority revoked",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          cancelled += 1;
          continue;
        }
      }
      // BROADCAST_FAILED or unexpected error — mark as failed, leave for retry
      const errMsg = err instanceof Error ? err.message : "Broadcast failed";
      await supabase
        .from("userbase_scheduled_posts")
        .update({
          status: "failed",
          last_error: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed += 1;
      await notifyAlert({
        type: "scheduled_post_broadcast_failed",
        scheduled_post_id: row.id,
        hive_author: row.hive_author,
        permlink: row.permlink,
        error: errMsg,
      });
      continue;
    }

    // Broadcast succeeded — update DB with retry+backoff to prevent duplicate broadcasts on re-run
    const broadcastedAt = new Date().toISOString();
    let dbUpdateSuccess = false;
    let lastDbError: any = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { error: updateError } = await supabase
        .from("userbase_scheduled_posts")
        .update({
          status: "broadcasted",
          last_error: null,
          broadcasted_at: broadcastedAt,
          updated_at: broadcastedAt,
        })
        .eq("id", row.id);

      if (!updateError) {
        dbUpdateSuccess = true;
        break;
      }

      lastDbError = updateError;
      console.error(
        `DB update attempt ${attempt + 1}/${maxRetries} failed for scheduled post ${row.id}:`,
        updateError
      );
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 100 * Math.pow(2, attempt))
        );
      }
    }

    if (!dbUpdateSuccess) {
      // Critical: post IS on-chain but our DB doesn't reflect it
      console.error(
        `CRITICAL: Hive broadcast succeeded but DB update failed for scheduled post. ` +
          `id=${row.id}, hive_author=${row.hive_author}, permlink=${row.permlink}, ` +
          `broadcasted_at=${broadcastedAt}, error=${lastDbError?.message ?? "Unknown DB error"}`
      );
      await notifyAlert({
        type: "scheduled_post_db_update_failed",
        severity: "critical",
        scheduled_post_id: row.id,
        hive_author: row.hive_author,
        permlink: row.permlink,
        broadcasted_at: broadcastedAt,
        error: lastDbError?.message ?? "DB update failed after successful broadcast",
        message:
          "Post was broadcasted to Hive but DB status update failed. Manual intervention required to prevent duplicate broadcast.",
      });
      failed += 1;
      continue;
    }

    broadcasted += 1;
  }

  return NextResponse.json({
    attempted: (rows ?? []).length,
    broadcasted,
    cancelled,
    failed,
    skipped_already_claimed: skippedClaimed,
    source: tickSource,
  });
}
