import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  hasGrantedPostingAuthority,
  PostingAuthorityError,
} from "@/lib/hive/postingAuthorityBroadcast";
import { validateScheduledAt } from "@/lib/userbase/scheduledPostUtils";
import { validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getSessionUserId(
  request: NextRequest
): Promise<{ userId: string } | { error: NextResponse }> {
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      ),
    };
  }
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: sessionRows, error: sessionError } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);
  if (sessionError) {
    return {
      error: NextResponse.json(
        { error: "Failed to validate session" },
        { status: 500 }
      ),
    };
  }
  const session = sessionRows?.[0];
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (new Date(session.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
  return { userId: session.user_id };
}

async function getHiveIdentity(userId: string) {
  if (!supabase) throw new Error("Supabase client not initialized");
  const { data } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "hive")
    .order("is_primary", { ascending: false })
    .limit(1);
  return data?.[0]?.handle ?? null;
}

// GET — list caller's scheduled posts (all statuses, newest first)
export async function GET(request: NextRequest) {
  const session = await getSessionUserId(request);
  if ("error" in session) return session.error;

  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("userbase_scheduled_posts")
    .select(
      "id, hive_author, parent_permlink, permlink, title, scheduled_at, status, last_error, created_at, broadcasted_at"
    )
    .eq("user_id", session.userId)
    .order("scheduled_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch scheduled posts" }, { status: 500 });
  }

  return NextResponse.json({ scheduled_posts: data ?? [] });
}

// POST — create a new scheduled post
export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if ("error" in session) return session.error;

  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate required fields
  const parentPermlink =
    typeof body.parent_permlink === "string" ? body.parent_permlink.trim() : "";
  const title = typeof body.title === "string" ? body.title : "";
  const postBody = typeof body.body === "string" ? body.body : "";
  const scheduledAt = body.scheduled_at;

  if (!parentPermlink) {
    return NextResponse.json({ error: "parent_permlink is required" }, { status: 400 });
  }
  if (!postBody) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const scheduledAtValidation = validateScheduledAt(scheduledAt);
  if (!scheduledAtValidation.valid) {
    return NextResponse.json(
      { error: scheduledAtValidation.error },
      { status: 400 }
    );
  }

  // Validate beneficiaries
  const beneficiaries: Array<{ account: string; weight: number }> = Array.isArray(
    body.beneficiaries
  )
    ? body.beneficiaries
    : [];

  if (beneficiaries.length > 0) {
    const totalWeight = beneficiaries.reduce(
      (sum, b) => sum + Number(b?.weight || 0),
      0
    );
    if (totalWeight > 10000) {
      return NextResponse.json(
        { error: "Beneficiaries exceed 100%" },
        { status: 400 }
      );
    }
    for (const b of beneficiaries) {
      if (!validateHiveUsernameFormat(b.account).isValid) {
        return NextResponse.json(
          { error: `Invalid beneficiary account: ${b.account}` },
          { status: 400 }
        );
      }
    }
  }

  // Validate json_metadata
  let jsonMetadata: Record<string, any> = {};
  if (body.json_metadata) {
    if (typeof body.json_metadata === "string") {
      try {
        jsonMetadata = JSON.parse(body.json_metadata);
      } catch {
        return NextResponse.json({ error: "Invalid json_metadata" }, { status: 400 });
      }
    } else if (typeof body.json_metadata === "object") {
      jsonMetadata = body.json_metadata;
    }
  }

  // Derive hive_author from the authenticated user's linked Hive identity
  const hiveAuthor = await getHiveIdentity(session.userId);
  if (!hiveAuthor) {
    return NextResponse.json(
      {
        error: "No Hive identity linked to your account",
        code: "HIVE_IDENTITY_NOT_LINKED",
      },
      { status: 400 }
    );
  }

  // Verify posting authority exists on-chain before storing
  try {
    const hasAuthority = await hasGrantedPostingAuthority(hiveAuthor);
    if (!hasAuthority) {
      return NextResponse.json(
        {
          error: `${hiveAuthor} has not granted posting authority to the SkateHive service account. Go to Settings → Hive to enable scheduled posting.`,
          code: "POSTING_AUTHORITY_NOT_GRANTED",
          hive_author: hiveAuthor,
        },
        { status: 403 }
      );
    }
  } catch (err) {
    if (err instanceof PostingAuthorityError && err.code === "CONFIG_MISSING") {
      return NextResponse.json(
        { error: "Scheduled posting is not configured on this server" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to verify posting authority" },
      { status: 502 }
    );
  }

  // Use provided permlink or generate a stable one
  const permlinkRaw =
    typeof body.permlink === "string" ? body.permlink.trim() : "";
  const permlink = permlinkRaw || crypto.randomUUID().replace(/-/g, "");

  const { data: inserted, error: insertError } = await supabase
    .from("userbase_scheduled_posts")
    .insert({
      user_id: session.userId,
      hive_author: hiveAuthor,
      parent_author: "",
      parent_permlink: parentPermlink,
      permlink,
      title,
      body: postBody,
      json_metadata: jsonMetadata,
      beneficiaries,
      scheduled_at: new Date(scheduledAt).toISOString(),
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id, hive_author, permlink, scheduled_at, status")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "A post with this permlink already exists for this author" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to create scheduled post" }, { status: 500 });
  }

  return NextResponse.json({ success: true, scheduled_post: inserted }, { status: 201 });
}
