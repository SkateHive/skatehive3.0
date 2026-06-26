import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { canCancelPost } from "@/lib/userbase/scheduledPostUtils";

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

// DELETE — cancel a pending scheduled post (only by its owner)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUserId(request);
  if ("error" in session) return session.error;

  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing post id" }, { status: 400 });
  }

  const { data: post, error: fetchError } = await supabase
    .from("userbase_scheduled_posts")
    .select("id, user_id, status")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Scheduled post not found" }, { status: 404 });
  }

  const cancelCheck = canCancelPost(post, session.userId);
  if (!cancelCheck.allowed) {
    if (cancelCheck.code === "NOT_OWNER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      {
        error: `Cannot cancel a post with status '${post.status}'`,
        code: "NOT_PENDING",
      },
      { status: 409 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("userbase_scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (updateError) {
    return NextResponse.json({ error: "Failed to cancel scheduled post" }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Post is no longer pending and cannot be cancelled", code: "NOT_PENDING" },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}
