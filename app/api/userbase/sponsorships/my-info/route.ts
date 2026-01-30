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
 * GET /api/userbase/sponsorships/my-info
 * Returns sponsorship information for the current user
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
    // Check if user has a sponsored Hive identity
    const { data: identity, error: identityError } = await supabase
      .from("userbase_identities")
      .select("handle, is_sponsored, sponsor_user_id, verified_at, metadata")
      .eq("user_id", session.userId)
      .eq("type", "hive")
      .eq("is_sponsored", true)
      .maybeSingle();

    if (identityError) {
      console.error("Error querying sponsored identity:", identityError);
      return NextResponse.json(
        { error: "Failed to fetch sponsorship info" },
        { status: 500 }
      );
    }

    if (!identity) {
      return NextResponse.json({
        sponsored: false,
      });
    }

    // Get sponsor username
    let sponsorUsername = null;
    if (identity.sponsor_user_id) {
      const { data: sponsorIdentity } = await supabase
        .from("userbase_identities")
        .select("handle")
        .eq("user_id", identity.sponsor_user_id)
        .eq("type", "hive")
        .single();

      sponsorUsername = sponsorIdentity?.handle || identity.metadata?.sponsor_username;
    }

    return NextResponse.json({
      sponsored: true,
      hive_username: identity.handle,
      sponsor_username: sponsorUsername,
      sponsored_at: identity.verified_at,
    });
  } catch (error: any) {
    console.error("Error fetching sponsorship info:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
