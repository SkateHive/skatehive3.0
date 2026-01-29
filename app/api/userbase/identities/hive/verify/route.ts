import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { PublicKey, Signature, cryptoUtils } from "@hiveio/dhive";
import { isAddress } from "ethers";
import fetchAccount from "@/lib/hive/fetchAccount";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
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
  handle,
  nonce,
  issuedAt,
}: {
  userId: string;
  handle: string;
  nonce: string;
  issuedAt: string;
}) {
  return [
    "Skatehive wants to link your Hive account to your app account.",
    "",
    `User ID: ${userId}`,
    `Hive: @${handle}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt}`,
    "",
    "If you did not request this, you can ignore this message.",
  ].join("\n");
}

function parseSignature(signature: string) {
  let normalized = signature.trim().toLowerCase();
  if (normalized.startsWith("0x")) {
    normalized = normalized.slice(2);
  }
  if (!/^[0-9a-f]+$/.test(normalized)) {
    return null;
  }

  const buffer = Buffer.from(normalized, "hex");
  if (buffer.length === 65) {
    return Signature.fromBuffer(buffer);
  }
  if (buffer.length === 64) {
    return new Signature(buffer, 0);
  }
  return null;
}

async function upsertIdentity({
  userId,
  type,
  handle,
  address,
  externalId,
  metadata,
}: {
  userId: string;
  type: "hive" | "evm" | "farcaster";
  handle: string | null;
  address: string | null;
  externalId: string | null;
  metadata: Record<string, any>;
}) {
  const identifierField =
    type === "hive" ? "handle" : type === "evm" ? "address" : "external_id";
  const identifierValue =
    type === "hive" ? handle : type === "evm" ? address : externalId;

  if (!identifierValue) {
    return null;
  }

  const { data: existing } = await supabase!
    .from("userbase_identities")
    .select("id, user_id, type")
    .eq("type", type)
    .eq(identifierField, identifierValue)
    .limit(1);

  if (existing?.[0]) {
    if (existing[0].user_id !== userId) {
      return null;
    }
    return existing[0];
  }

  const { data: existingType } = await supabase!
    .from("userbase_identities")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .limit(1);

  const isPrimary = !existingType || existingType.length === 0;

  const { data: inserted } = await supabase!
    .from("userbase_identities")
    .insert({
      user_id: userId,
      type,
      handle,
      address,
      external_id: externalId,
      is_primary: isPrimary,
      verified_at: new Date().toISOString(),
      metadata,
    })
    .select("id, user_id, type, handle, address, external_id, is_primary")
    .single();

  return inserted || null;
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const payload = body as Record<string, any>;
  const handleRaw = payload?.handle;
  const signatureRaw = payload?.signature;
  const publicKeyRaw = payload?.public_key;

  if (!handleRaw || typeof handleRaw !== "string") {
    return NextResponse.json(
      { error: "Missing Hive handle" },
      { status: 400 }
    );
  }

  if (!signatureRaw || typeof signatureRaw !== "string") {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 400 }
    );
  }

  if (!publicKeyRaw || typeof publicKeyRaw !== "string") {
    return NextResponse.json(
      { error: "Missing public key" },
      { status: 400 }
    );
  }

  const handle = handleRaw.trim().toLowerCase();
  const publicKey = publicKeyRaw.trim();

  const { data: challengeRows, error: challengeError } = await supabase!
    .from("userbase_identity_challenges")
    .select("id, nonce, created_at, expires_at, consumed_at, message")
    .eq("user_id", session.userId)
    .eq("type", "hive")
    .eq("identifier", handle)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (challengeError) {
    console.error("Failed to fetch Hive challenge:", challengeError);
    return NextResponse.json(
      {
        error: "Failed to verify challenge",
        details:
          process.env.NODE_ENV !== "production"
            ? challengeError?.message || challengeError
            : undefined,
      },
      { status: 500 }
    );
  }

  const challenge = challengeRows?.[0];
  if (!challenge) {
    return NextResponse.json(
      { error: "No active challenge found" },
      { status: 400 }
    );
  }

  if (new Date(challenge.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Challenge expired" },
      { status: 401 }
    );
  }

  if (!challenge.message) {
    return NextResponse.json(
      { error: "Challenge must be refreshed" },
      { status: 400 }
    );
  }

  const message = challenge.message;

  const signature = parseSignature(signatureRaw);
  if (!signature) {
    return NextResponse.json(
      { error: "Invalid signature format" },
      { status: 400 }
    );
  }

  let isValid = false;
  try {
    const digest = cryptoUtils.sha256(Buffer.from(message));
    const publicKeyObj = PublicKey.fromString(publicKey);
    isValid = publicKeyObj.verify(digest, signature);
  } catch (error) {
    return NextResponse.json(
      { error: "Signature verification failed" },
      { status: 400 }
    );
  }

  if (!isValid) {
    return NextResponse.json(
      { error: "Signature does not match" },
      { status: 400 }
    );
  }

  let accountData;
  try {
    accountData = await fetchAccount(handle);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Hive account not found" },
      { status: 404 }
    );
  }

  const postingKeys = accountData.account.posting?.key_auths?.map(
    (entry) => entry[0]
  );
  if (!postingKeys?.includes(publicKey)) {
    return NextResponse.json(
      { error: "Public key not authorized for posting" },
      { status: 403 }
    );
  }

  const identity = await upsertIdentity({
    userId: session.userId,
    type: "hive",
    handle,
    address: null,
    externalId: null,
    metadata: {},
  });

  if (!identity) {
    const { data: existing } = await supabase!
      .from("userbase_identities")
      .select("id, user_id")
      .eq("type", "hive")
      .eq("handle", handle)
      .limit(1);

    return NextResponse.json(
      {
        error: "Hive identity already linked elsewhere",
        merge_required: true,
        existing_user_id: existing?.[0]?.user_id || null,
      },
      { status: 409 }
    );
  }

  const migrated = migrateLegacyMetadata(accountData.jsonMetadata);
  const extensions = migrated.extensions || {};
  const wallets = extensions.wallets || {};
  const farcaster = extensions.farcaster || {};

  const addresses = new Set<string>();

  // Add eth_address (legacy, highest priority for display)
  if (extensions.eth_address && isAddress(extensions.eth_address)) {
    addresses.add(extensions.eth_address.toLowerCase());
  }

  // Add primary_wallet (if different from eth_address)
  if (wallets.primary_wallet && isAddress(wallets.primary_wallet)) {
    addresses.add(wallets.primary_wallet.toLowerCase());
  }

  // Add additional wallets
  if (Array.isArray(wallets.additional)) {
    wallets.additional.forEach((addr: string) => {
      if (isAddress(addr)) {
        addresses.add(addr.toLowerCase());
      }
    });
  }

  if (farcaster.custody_address && isAddress(farcaster.custody_address)) {
    addresses.add(farcaster.custody_address.toLowerCase());
  }
  if (Array.isArray(farcaster.verified_wallets)) {
    farcaster.verified_wallets.forEach((addr: string) => {
      if (isAddress(addr)) {
        addresses.add(addr.toLowerCase());
      }
    });
  }

  // Save EVM identities with proper metadata
  const addressArray = Array.from(addresses);
  const ethAddress = extensions.eth_address?.toLowerCase();

  for (const address of addressArray) {
    const metadata: Record<string, any> = { source: "hive" };

    // Mark the eth_address as primary display wallet
    if (address === ethAddress) {
      metadata.is_eth_address = true;
      metadata.display_priority = 1;
    } else if (address === wallets.primary_wallet?.toLowerCase()) {
      metadata.is_primary_wallet = true;
      metadata.display_priority = 2;
    } else {
      metadata.display_priority = 3;
    }

    await upsertIdentity({
      userId: session.userId,
      type: "evm",
      handle: null,
      address,
      externalId: null,
      metadata,
    });
  }

  if (farcaster.fid) {
    // Fetch full Farcaster profile data from Neynar API to enrich metadata
    const farcasterProfile = await fetchFarcasterProfileByFid(farcaster.fid);

    const metadata: Record<string, any> = {
      source: "hive",
      verified_wallets: farcaster.verified_wallets || [],
    };

    // Add profile data if successfully fetched from Neynar
    if (farcasterProfile) {
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
    }

    await upsertIdentity({
      userId: session.userId,
      type: "farcaster",
      handle: farcasterProfile?.username || farcaster.username || null,
      address: farcasterProfile?.custodyAddress || farcaster.custody_address || null,
      externalId: String(farcaster.fid),
      metadata,
    });
  }

  const { error: consumeError } = await supabase!
    .from("userbase_identity_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);
  if (consumeError) {
    console.error("Failed to consume challenge:", consumeError);
  }

  return NextResponse.json({ identity });
}
