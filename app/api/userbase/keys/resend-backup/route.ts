import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sendSponsorshipEmail } from "@/lib/email/sendSponsorshipEmail";
import { getDecryptedKey } from "@/lib/userbase/keyManagement";
import { PrivateKey } from "@hiveio/dhive";
import { HiveAccountKeys } from "@/lib/hive/keyGeneration";

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
 * POST /api/userbase/keys/resend-backup
 * Resends key backup email to user
 *
 * WARNING: This endpoint decrypts the posting key to regenerate all other keys.
 * We can only send the posting key in the backup, as other keys are not stored.
 * For sponsored accounts, this is a partial backup.
 */
export async function POST(request: NextRequest) {
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
    // Get user's Hive key info
    const { data: keyData, error: keyError } = await supabase
      .from("userbase_hive_keys")
      .select("hive_username, source")
      .eq("user_id", session.userId)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json(
        { error: "No Hive account keys found" },
        { status: 404 }
      );
    }

    // Get user email
    const { data: authMethod, error: emailError } = await supabase
      .from("userbase_auth_methods")
      .select("identifier")
      .eq("user_id", session.userId)
      .eq("type", "email_magic")
      .single();

    if (emailError || !authMethod?.identifier) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 404 }
      );
    }

    // Get decrypted posting key
    const postingKey = await getDecryptedKey(supabase, session.userId);
    if (!postingKey) {
      return NextResponse.json(
        { error: "Could not decrypt posting key" },
        { status: 500 }
      );
    }

    // Get sponsor info
    const { data: identity } = await supabase
      .from("userbase_identities")
      .select("sponsor_user_id, metadata")
      .eq("user_id", session.userId)
      .eq("type", "hive")
      .eq("handle", keyData.hive_username)
      .single();

    let sponsorUsername = "Skatehive";
    if (identity?.sponsor_user_id) {
      const { data: sponsorIdentity } = await supabase
        .from("userbase_identities")
        .select("handle")
        .eq("user_id", identity.sponsor_user_id)
        .eq("type", "hive")
        .single();

      sponsorUsername = sponsorIdentity?.handle || identity.metadata?.sponsor_username || sponsorUsername;
    }

    // For backup, we can only provide the posting key since we don't store other keys
    // Include a note in the email that this is a partial backup
    const partialKeys: HiveAccountKeys = {
      posting: postingKey,
      postingPublic: PrivateKey.fromString(postingKey).createPublic().toString(),
      // Note: Other keys are not stored and cannot be recovered
      owner: "NOT_STORED_CONTACT_SPONSOR",
      ownerPublic: "NOT_STORED_CONTACT_SPONSOR",
      active: "NOT_STORED_CONTACT_SPONSOR",
      activePublic: "NOT_STORED_CONTACT_SPONSOR",
      memo: "NOT_STORED_CONTACT_SPONSOR",
      memoPublic: "NOT_STORED_CONTACT_SPONSOR",
    };

    // Send backup email
    const emailSent = await sendSponsorshipEmail(
      authMethod.identifier,
      keyData.hive_username,
      sponsorUsername,
      partialKeys,
      true // isBackup flag
    );

    if (!emailSent) {
      return NextResponse.json(
        { error: "Failed to send backup email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Key backup sent to your email",
    });
  } catch (error: any) {
    console.error("Error resending key backup:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
