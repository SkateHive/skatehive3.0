import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

/**
 * GET /api/userbase/sponsorships/info/[user_id]
 * Public endpoint to get sponsorship status for a user
 * Used to display badges on profiles
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const { user_id: userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  try {
    // Fetch the best Hive identity we have for this user.
    // Any Hive identity means the account is no longer "lite", even if it
    // was linked manually instead of being created through sponsorship.
    const { data: identityRows, error: identityError } = await supabase
      .from("userbase_identities")
      .select("handle, is_primary, is_sponsored, sponsor_user_id, metadata")
      .eq("user_id", userId)
      .eq("type", "hive")
      .order("is_sponsored", { ascending: false })
      .order("is_primary", { ascending: false })
      .limit(1);

    // PGRST116 = "no rows found" - expected when user has no Hive identity
    if (identityError && identityError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Database error", details: identityError.message },
        { status: 500 }
      );
    }

    const identity = identityRows?.[0] || null;

    if (!identity) {
      return NextResponse.json({
        sponsored: false,
        has_hive_identity: false,
        is_lite: true,
      });
    }

    // Get sponsor username
    let sponsorUsername = null;
    if (identity.is_sponsored && identity.sponsor_user_id) {
      const { data: sponsorIdentity } = await supabase
        .from("userbase_identities")
        .select("handle")
        .eq("user_id", identity.sponsor_user_id)
        .eq("type", "hive")
        .single();

      sponsorUsername =
        sponsorIdentity?.handle || identity.metadata?.sponsor_username;
    }

    return NextResponse.json({
      sponsored: Boolean(identity.is_sponsored),
      has_hive_identity: true,
      is_lite: false,
      hive_username: identity.handle,
      sponsor_username: sponsorUsername,
    });
  } catch (error: any) {
    console.error("Error fetching sponsorship info:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
