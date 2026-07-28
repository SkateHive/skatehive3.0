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
    // A user is "lite" only if they have NO Hive identity at all. ANY Hive
    // identity — created via sponsorship, linked manually, or inherited from an
    // account merge — means they already own a Hive account, so the Sponsor CTA
    // must be hidden. (The old query filtered is_sponsored=true, so a
    // manually-linked/merge-inherited identity was misread as lite.)
    const { data: identities, error: identityError } = await supabase
      .from("userbase_identities")
      .select("handle, is_sponsored, sponsor_user_id, metadata")
      .eq("user_id", userId)
      .eq("type", "hive");

    if (identityError) {
      return NextResponse.json(
        { error: "Database error", details: identityError.message },
        { status: 500 }
      );
    }

    const hiveIdentities = identities ?? [];

    if (hiveIdentities.length === 0) {
      return NextResponse.json({ has_hive_identity: false, sponsored: false });
    }

    // Prefer a sponsored identity (for the "sponsored by X" badge); else any.
    const sponsoredIdentity = hiveIdentities.find((i) => i.is_sponsored);
    const identity = sponsoredIdentity ?? hiveIdentities[0];

    let sponsorUsername = null;
    if (sponsoredIdentity?.sponsor_user_id) {
      const { data: sponsorIdentity } = await supabase
        .from("userbase_identities")
        .select("handle")
        .eq("user_id", sponsoredIdentity.sponsor_user_id)
        .eq("type", "hive")
        .single();

      sponsorUsername =
        sponsorIdentity?.handle || sponsoredIdentity.metadata?.sponsor_username;
    }

    return NextResponse.json({
      has_hive_identity: true,
      sponsored: Boolean(sponsoredIdentity),
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
