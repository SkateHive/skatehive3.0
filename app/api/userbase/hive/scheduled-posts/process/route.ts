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

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.USERBASE_INTERNAL_TOKEN;
  if (!expected) return true;
  const token = request.headers.get("x-userbase-token") ?? "";
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  const providedHash = crypto.createHash("sha256").update(token).digest();
  return crypto.timingSafeEqual(expectedHash, providedHash);
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

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 50, 1), 100);

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

  for (const row of rows ?? []) {
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
  });
}
