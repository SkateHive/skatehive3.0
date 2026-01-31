import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getAddress, verifyMessage } from "ethers";
import { fetchFarcasterProfileByFid } from "@/lib/farcaster/neynar";

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

  return { userId: session.user_id };
}

function buildMessage({
  userId,
  fid,
  username,
  nonce,
  issuedAt,
}: {
  userId: string;
  fid: string;
  username: string;
  nonce: string;
  issuedAt: string;
}) {
  return [
    "Skatehive wants to link your Farcaster account to your app account.",
    "",
    `User ID: ${userId}`,
    `Farcaster: @${username} (FID: ${fid})`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
    "",
    "If you did not request this, you can ignore this message.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const fidRaw = body?.fid;
  const signature = body?.signature;
  const message = body?.message;

  if (!fidRaw) {
    return NextResponse.json(
      { error: "Missing Farcaster FID" },
      { status: 400 }
    );
  }

  const fid = String(fidRaw).trim();
  if (!/^\d+$/.test(fid)) {
    return NextResponse.json(
      { error: "Invalid Farcaster FID format" },
      { status: 400 }
    );
  }

  if (!signature || typeof signature !== "string") {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Missing message" },
      { status: 400 }
    );
  }

  // Fetch Farcaster profile from Neynar to get custody address
  const farcasterProfile = await fetchFarcasterProfileByFid(fid);

  if (!farcasterProfile) {
    return NextResponse.json(
      { error: "Farcaster account not found" },
      { status: 404 }
    );
  }

  if (!farcasterProfile.custodyAddress) {
    return NextResponse.json(
      { error: "Farcaster account has no custody address" },
      { status: 400 }
    );
  }

  const custodyAddress = farcasterProfile.custodyAddress.toLowerCase();

  // Verify the message format matches expected structure
  if (!message.includes(`FID: ${fid}`) || !message.includes("Skatehive wants to link your Farcaster account")) {
    return NextResponse.json(
      { error: "Invalid message format" },
      { status: 400 }
    );
  }

  // Verify the signature using the custody address
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  if (getAddress(recovered).toLowerCase() !== custodyAddress) {
    return NextResponse.json(
      { error: "Signature does not match custody address" },
      { status: 400 }
    );
  }

  // Check if identity already exists for this user
  const { data: existing, error: existingError } = await supabase!
    .from("userbase_identities")
    .select("id, user_id, type, handle, address, external_id, is_primary")
    .eq("type", "farcaster")
    .eq("external_id", fid)
    .limit(1);

  if (existingError) {
    console.error("Failed to check existing identity:", existingError);
    return NextResponse.json(
      { error: "Failed to verify identity" },
      { status: 500 }
    );
  }

  if (existing?.[0]) {
    if (existing[0].user_id === session.userId) {
      // Already linked to this user
      return NextResponse.json({ identity: existing[0] });
    }
    // Linked to another user - requires merge
    return NextResponse.json(
      {
        error: "Farcaster identity already linked elsewhere",
        merge_required: true,
        existing_user_id: existing[0].user_id,
      },
      { status: 409 }
    );
  }

  // Check if user already has a Farcaster identity (for is_primary)
  const { data: existingType } = await supabase!
    .from("userbase_identities")
    .select("id")
    .eq("user_id", session.userId)
    .eq("type", "farcaster")
    .limit(1);

  const isPrimary = !existingType || existingType.length === 0;

  // Build metadata from Farcaster profile
  const metadata: Record<string, any> = {};
  if (farcasterProfile.pfpUrl) {
    metadata.pfp_url = farcasterProfile.pfpUrl;
  }
  if (farcasterProfile.displayName) {
    metadata.display_name = farcasterProfile.displayName;
  }
  if (farcasterProfile.bio) {
    metadata.bio = farcasterProfile.bio;
  }
  if (farcasterProfile.verifications && farcasterProfile.verifications.length > 0) {
    metadata.verifications = farcasterProfile.verifications;
  }

  // Create the Farcaster identity
  const { data: inserted, error: insertError } = await supabase!
    .from("userbase_identities")
    .insert({
      user_id: session.userId,
      type: "farcaster",
      handle: farcasterProfile.username,
      address: custodyAddress,
      external_id: fid,
      is_primary: isPrimary,
      verified_at: new Date().toISOString(),
      metadata,
    })
    .select(
      "id, user_id, type, handle, address, external_id, is_primary, verified_at, metadata"
    )
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "Farcaster account already linked" },
        { status: 409 }
      );
    }
    console.error("Failed to create Farcaster identity:", insertError);
    return NextResponse.json(
      {
        error: "Failed to create identity",
        details:
          process.env.NODE_ENV !== "production"
            ? insertError?.message || insertError
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ identity: inserted });
}
