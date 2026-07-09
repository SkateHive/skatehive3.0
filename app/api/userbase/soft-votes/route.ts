import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getSessionUserId(request: NextRequest) {
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
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const refreshTokenHash = hashToken(refreshToken);
  const { data: sessionRows, error: sessionError } = await supabase
    .from("userbase_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", refreshTokenHash)
    .is("revoked_at", null)
    .limit(1);

  if (sessionError) {
    console.error("Userbase session lookup failed:", sessionError);
    return {
      error: NextResponse.json(
        {
          error: "Failed to validate session",
          details:
            process.env.NODE_ENV !== "production"
              ? sessionError?.message || sessionError
              : undefined,
        },
        { status: 500 }
      ),
    };
  }

  const session = sessionRows?.[0];
  if (!session) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (new Date(session.expires_at) < new Date()) {
    return {
      error: NextResponse.json({ error: "Session expired" }, { status: 401 }),
    };
  }

  const { data: userRow, error: userError } = await supabase
    .from("userbase_users")
    .select("moderation_status")
    .eq("id", session.user_id)
    .single();

  if (userError) {
    console.error("Userbase moderation lookup failed:", userError);
    return {
      error: NextResponse.json(
        { error: "Failed to validate user status" },
        { status: 500 }
      ),
    };
  }

  if (["suspicious", "blocked"].includes(userRow?.moderation_status)) {
    return {
      error: NextResponse.json(
        { error: "Account is under moderation review" },
        { status: 403 }
      ),
    };
  }

  return { userId: session.user_id };
}

type PostKey = { author: string; permlink: string };

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  const body = await request.json().catch(() => ({}));
  const posts = Array.isArray(body?.posts) ? body.posts : [];
  const cleaned: PostKey[] = posts
    .filter(
      (post: any) =>
        post &&
        typeof post.author === "string" &&
        typeof post.permlink === "string" &&
        post.author.trim() &&
        post.permlink.trim()
    )
    .map((post: any) => ({
      author: post.author.trim(),
      permlink: post.permlink.trim(),
    }))
    .slice(0, 200);

  if (cleaned.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const authorSet = Array.from(new Set(cleaned.map((p) => p.author)));
  const permlinkSet = Array.from(new Set(cleaned.map((p) => p.permlink)));
  const keySet = new Set(cleaned.map((p) => `${p.author}/${p.permlink}`));

  const { data, error } = await supabase
    .from("userbase_soft_votes")
    .select("author, permlink, weight, status, updated_at")
    .eq("user_id", session.userId)
    .in("author", authorSet)
    .in("permlink", permlinkSet);

  if (error) {
    console.error("Failed to fetch soft votes:", error);
    return NextResponse.json(
      { error: "Failed to fetch soft votes" },
      { status: 500 }
    );
  }

  const items = (data || [])
    .filter((row) => keySet.has(`${row.author}/${row.permlink}`))
    .map((row: any) => ({
      author: row.author,
      permlink: row.permlink,
      weight: row.weight,
      status: row.status,
      updated_at: row.updated_at,
    }));

  return NextResponse.json({ items });
}
