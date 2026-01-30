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
        { error: "Failed to validate session" },
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

  return { userId: session.user_id };
}

/**
 * GET /api/userbase/keys/hive-info
 * Returns info about stored Hive posting key (from sponsorship system)
 */
export async function GET(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  try {
    // Check userbase_hive_keys table (sponsorship system)
    const { data: keyData, error: keyError } = await supabase
      .from("userbase_hive_keys")
      .select("hive_username, created_at, last_used_at, source")
      .eq("user_id", session.userId)
      .maybeSingle();

    if (keyError) {
      console.error("Error querying Hive key:", keyError);
      return NextResponse.json(
        { error: "Failed to fetch Hive key info" },
        { status: 500 }
      );
    }

    if (!keyData) {
      return NextResponse.json({
        has_key: false,
      });
    }

    return NextResponse.json({
      has_key: true,
      hive_username: keyData.hive_username,
      created_at: keyData.created_at,
      last_used_at: keyData.last_used_at,
      source: keyData.source,
    });
  } catch (error: any) {
    console.error("Error fetching Hive key info:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
