import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  createNeynarSigner,
  registerNeynarSigner,
  getSignerStatus,
} from "@/lib/farcaster/neynar";

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
    return {
      error: NextResponse.json(
        { error: "Failed to validate session" },
        { status: 500 }
      ),
    };
  }

  const session = sessionRows?.[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { userId: session.user_id };
}

/**
 * POST /api/farcaster/signer
 * Creates or retrieves a Neynar managed signer for the authenticated user.
 * Stores signer_uuid in the user's farcaster identity metadata.
 */
export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) return session.error;

  // Find user's farcaster identity
  const { data: identities, error: idError } = await supabase!
    .from("userbase_identities")
    .select("id, external_id, metadata")
    .eq("user_id", session.userId)
    .eq("type", "farcaster")
    .limit(1);

  if (idError || !identities?.length) {
    return NextResponse.json(
      { error: "No Farcaster identity linked" },
      { status: 400 }
    );
  }

  const identity = identities[0];
  const metadata = (identity.metadata || {}) as Record<string, unknown>;

  // If signer already exists, check its status
  if (metadata.signer_uuid) {
    const signerUuid = metadata.signer_uuid as string;

    if (metadata.signer_status === "approved") {
      return NextResponse.json({
        signerUuid,
        status: "approved",
      });
    }

    // Check if pending signer got approved
    const status = await getSignerStatus(signerUuid);

    if (status?.status === "approved") {
      await supabase!
        .from("userbase_identities")
        .update({ metadata: { ...metadata, signer_status: "approved" } })
        .eq("id", identity.id);
      return NextResponse.json({ signerUuid, status: "approved" });
    }

    if (status?.status === "pending_approval" && status.signer_approval_url) {
      return NextResponse.json({
        signerUuid,
        status: "pending_approval",
        approvalUrl: status.signer_approval_url,
      });
    }

    // Signer exists but was never properly registered (no approval URL).
    // Clear it so we can create a fresh one below.
    await supabase!
      .from("userbase_identities")
      .update({
        metadata: {
          ...metadata,
          signer_uuid: null,
          signer_status: null,
        },
      })
      .eq("id", identity.id);
    // Fall through to create new signer
  }

  // Create new signer
  const signer = await createNeynarSigner();
  if (!signer) {
    return NextResponse.json(
      { error: "Failed to create signer" },
      { status: 500 }
    );
  }

  // Sign the public key with the app's mnemonic and register with Neynar
  const registered = await registerNeynarSigner(signer.signer_uuid, signer.public_key);

  if (!registered || !registered.signer_approval_url) {
    console.error("[Signer] Registration failed:", {
      hasMnemonic: !!process.env.FARCASTER_APP_MNEMONIC,
      registeredResult: registered ? "returned but no approval URL" : "returned null",
    });
    return NextResponse.json(
      {
        error: !process.env.FARCASTER_APP_MNEMONIC
          ? "FARCASTER_APP_MNEMONIC not configured"
          : "Failed to register signer — check server logs",
      },
      { status: 500 }
    );
  }

  // Store signer_uuid in identity metadata
  await supabase!
    .from("userbase_identities")
    .update({
      metadata: {
        ...metadata,
        signer_uuid: signer.signer_uuid,
        signer_status: registered.status,
      },
    })
    .eq("id", identity.id);

  return NextResponse.json({
    signerUuid: signer.signer_uuid,
    status: registered.status,
    approvalUrl: registered.signer_approval_url,
  });
}
