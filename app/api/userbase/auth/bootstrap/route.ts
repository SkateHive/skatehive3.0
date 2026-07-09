import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { isAddress } from "ethers";
import { checkHiveAccountExists, validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";

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

const SESSION_TTL_DAYS = 30;
type IdentityType = "hive" | "evm" | "farcaster";
type ResolvedFarcasterProfile = {
  fid: string;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
  bio: string | null;
  custodyAddress: string | null;
  verifications: string[];
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function toHiveSafeBaseHandle(value: string) {
  const sanitized = slugify(value) || "skater";
  return sanitized.slice(0, 16).replace(/(^-|-$)+/g, "") || "skater";
}

function isPlaceholderDisplayName(value: string | null | undefined) {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "Skater" || /^Wallet 0x/i.test(trimmed);
}

function isPlaceholderAvatarUrl(value: string | null | undefined) {
  if (!value) return true;
  return value.startsWith("https://api.dicebear.com/");
}

function getMetadataString(
  metadata: Record<string, unknown>,
  key: string
): string | null {
  const value = metadata[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeAddressList(addresses: unknown): string[] {
  if (!Array.isArray(addresses)) return [];

  const normalized = addresses
    .map((value) =>
      typeof value === "string" && isAddress(value) ? value.toLowerCase() : null
    )
    .filter((value): value is string => Boolean(value));

  return [...new Set(normalized)];
}

async function fetchNeynarProfileByAddress(
  address: string
): Promise<ResolvedFarcasterProfile | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address/?addresses=${encodeURIComponent(
      address
    )}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        api_key: apiKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("Neynar lookup failed:", response.status, address);
      return null;
    }

    const data = (await response.json()) as Record<
      string,
      Array<{
        fid?: number;
        username?: string;
        display_name?: string;
        pfp_url?: string;
        custody_address?: string;
        profile?: { bio?: { text?: string } };
        verifications?: unknown;
        verified_addresses?: { eth_addresses?: unknown };
      }>
    >;

    const matches = Array.isArray(data[address]) ? data[address] : [];
    if (matches.length === 0) {
      return null;
    }

    const user = matches[0];
    if (!user?.fid) {
      return null;
    }

    const verifications = normalizeAddressList([
      ...(Array.isArray(user.verifications) ? user.verifications : []),
      ...(Array.isArray(user.verified_addresses?.eth_addresses)
        ? user.verified_addresses.eth_addresses
        : []),
    ]);

    return {
      fid: String(user.fid),
      username: typeof user.username === "string" ? user.username : null,
      displayName:
        typeof user.display_name === "string" ? user.display_name : null,
      pfpUrl: typeof user.pfp_url === "string" ? user.pfp_url : null,
      bio:
        typeof user.profile?.bio?.text === "string"
          ? user.profile.bio.text
          : null,
      custodyAddress:
        typeof user.custody_address === "string" &&
        isAddress(user.custody_address)
          ? user.custody_address.toLowerCase()
          : null,
      verifications,
    };
  } catch (error) {
    console.warn("Neynar lookup error:", address, error);
    return null;
  }
}

function mergeEvmMetadataWithFarcaster(
  metadata: Record<string, unknown>,
  profile: ResolvedFarcasterProfile
) {
  return {
    ...metadata,
    farcaster_fid: profile.fid,
    farcaster_username: profile.username,
    farcaster_display_name: profile.displayName,
    farcaster_pfp_url: profile.pfpUrl,
    farcaster_bio: profile.bio,
    farcaster_custody_address: profile.custodyAddress,
    farcaster_verifications: profile.verifications,
    resolved_via: "neynar",
  };
}

function getBootstrapProfile(params: {
  type: IdentityType;
  identifier: string;
  handleRaw: string | null;
  displayNameRaw: string | null;
  avatarRaw: string | null;
  metadata: Record<string, unknown>;
}) {
  const { type, identifier, handleRaw, displayNameRaw, avatarRaw, metadata } = params;
  const metadataDisplayName = getMetadataString(metadata, "display_name");
  const metadataAvatarUrl = getMetadataString(metadata, "pfp_url");
  const metadataEnsName = getMetadataString(metadata, "ens_name");
  const metadataEnsAvatar = getMetadataString(metadata, "ens_avatar");
  const metadataFarcasterDisplayName = getMetadataString(
    metadata,
    "farcaster_display_name"
  );
  const metadataFarcasterUsername = getMetadataString(
    metadata,
    "farcaster_username"
  );
  const metadataFarcasterAvatar = getMetadataString(
    metadata,
    "farcaster_pfp_url"
  );

  if (type === "hive") {
    return {
      displayName: displayNameRaw || identifier,
      avatarUrl:
        avatarRaw || `https://images.hive.blog/u/${identifier}/avatar`,
    };
  }

  if (type === "farcaster") {
    return {
      displayName: displayNameRaw || metadataDisplayName || handleRaw || "Skater",
      avatarUrl: avatarRaw || metadataAvatarUrl,
    };
  }

  return {
    displayName:
      displayNameRaw ||
      metadataFarcasterDisplayName ||
      metadataFarcasterUsername ||
      metadataEnsName ||
      "Skater",
    avatarUrl: avatarRaw || metadataFarcasterAvatar || metadataEnsAvatar,
  };
}

async function isHandleAvailable(handle: string) {
  if (!validateHiveUsernameFormat(handle).isValid || await checkHiveAccountExists(handle)) {
    return false;
  }

  const { data } = await supabase!
    .from("userbase_users")
    .select("id")
    .eq("handle", handle)
    .limit(1);
  return !data || data.length === 0;
}

async function findAvailableHandle(base: string) {
  const sanitized = toHiveSafeBaseHandle(base);
  if (await isHandleAvailable(sanitized)) {
    return sanitized;
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = crypto.randomBytes(2).toString("hex");
    const candidate = `${sanitized.slice(0, 11).replace(/-$/g, "")}-${suffix}`;
    if (await isHandleAvailable(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function createSession(userId: string, userAgent: string | null) {
  const refreshToken = crypto.randomUUID();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: sessionError } = await supabase!
    .from("userbase_sessions")
    .insert({
      user_id: userId,
      refresh_token_hash: refreshTokenHash,
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      user_agent: userAgent,
    });

  if (sessionError) {
    console.error("Userbase bootstrap session failed:", sessionError);
    return NextResponse.json(
      {
        error: "Failed to create session",
        details:
          process.env.NODE_ENV !== "production"
            ? sessionError?.message || sessionError
            : undefined,
      },
      { status: 500 }
    );
  }

  return { expiresAt, refreshToken };
}

export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const type = typeof body?.type === "string" ? body.type : null;
  const rawIdentifier = body?.identifier;
  let handleRaw = typeof body?.handle === "string" ? body.handle : null;
  let displayNameRaw =
    typeof body?.display_name === "string" ? body.display_name : null;
  let avatarRaw =
    typeof body?.avatar_url === "string" ? body.avatar_url : null;
  let metadata =
    body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!type || !["hive", "evm", "farcaster"].includes(type)) {
    return NextResponse.json(
      { error: "Unsupported identity type" },
      { status: 400 }
    );
  }

  if (!rawIdentifier || typeof rawIdentifier !== "string") {
    return NextResponse.json(
      { error: "Missing identifier" },
      { status: 400 }
    );
  }

  let identifier = rawIdentifier.trim();
  if (type === "hive") {
    identifier = identifier.toLowerCase();
    const validation = validateHiveUsernameFormat(identifier);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: "Invalid Hive handle" },
        { status: 400 }
      );
    }
  }

  if (type === "evm") {
    if (!isAddress(identifier)) {
      return NextResponse.json(
        { error: "Invalid address" },
        { status: 400 }
      );
    }
    identifier = identifier.toLowerCase();

    const farcasterProfile = await fetchNeynarProfileByAddress(identifier);
    if (farcasterProfile) {
      metadata = mergeEvmMetadataWithFarcaster(metadata, farcasterProfile);
      handleRaw = handleRaw || farcasterProfile.username;
      displayNameRaw =
        displayNameRaw ||
        farcasterProfile.displayName ||
        farcasterProfile.username ||
        null;
      avatarRaw = avatarRaw || farcasterProfile.pfpUrl;
    }
  }

  if (type === "farcaster") {
    const normalized = identifier.trim();
    if (!/^\d+$/.test(normalized)) {
      return NextResponse.json(
        { error: "Invalid Farcaster fid" },
        { status: 400 }
      );
    }
    identifier = normalized;
  }

  const userAgent = request.headers.get("user-agent") || null;

  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    const { data: session } = await supabase
      .from("userbase_sessions")
      .select("user_id, expires_at")
      .eq("refresh_token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    if (session) {
      return NextResponse.json({ success: true, user_id: session.user_id });
    }
    // Token invalid/expired/revoked - continue with bootstrap flow
  }

  const identifierField =
    type === "hive" ? "handle" : type === "evm" ? "address" : "external_id";

  // Always look up existing identity for all types.
  // Without this check, EVM/Farcaster users get a brand-new account on every
  // session (after cookie expiry or new browser), creating duplicate users.
  const { data: existingIdentityRows } = await supabase!
    .from("userbase_identities")
    .select("id, user_id")
    .eq("type", type)
    .eq(identifierField, identifier)
    .limit(1);

  const existingIdentity = existingIdentityRows ?? null;

  let userId = existingIdentity?.[0]?.user_id || null;
  let identityId = existingIdentity?.[0]?.id || null;
  let createdUser = false;

  if (!userId) {
    const handleBase =
      handleRaw ||
      (type === "hive" ? identifier : type === "farcaster" ? handleRaw : null) ||
      (type === "evm" ? `wallet-${identifier.slice(2, 8)}` : "");
    const candidateHandle =
      handleBase ? await findAvailableHandle(handleBase) : null;

    if (!candidateHandle) {
      return NextResponse.json(
        { error: "Unable to generate unique handle, please try again" },
        { status: 503 }
      );
    }


    const bootstrapProfile = getBootstrapProfile({
      type,
      identifier,
      handleRaw,
      displayNameRaw,
      avatarRaw,
      metadata,
    });

    const { data: created, error: userError } = await supabase!
      .from("userbase_users")
      .insert({
        handle: candidateHandle,
        display_name: bootstrapProfile.displayName,
        avatar_url: bootstrapProfile.avatarUrl,
        status: "active",
        onboarding_step: 0,
      })
      .select("id")
      .single();

    if (userError || !created) {
      console.error("Failed to bootstrap user:", userError);
      return NextResponse.json(
        {
          error: "Failed to create user",
          details:
            process.env.NODE_ENV !== "production"
              ? userError?.message || userError
              : undefined,
        },
        { status: 500 }
      );
    }

    userId = created.id;
    createdUser = true;

    const { data: existingType } = await supabase!
      .from("userbase_identities")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .limit(1);

    const isPrimary = !existingType || existingType.length === 0;

    const { data: inserted, error: identityError } = await supabase!
      .from("userbase_identities")
      .insert({
        user_id: userId,
        type,
        handle: type === "hive" ? identifier : handleRaw,
        address: type === "evm" ? identifier : null,
        external_id: type === "farcaster" ? identifier : null,
        is_primary: isPrimary,
        verified_at: new Date().toISOString(),
        metadata,
      })
      .select("id")
      .single();

    if (identityError || !inserted) {
      console.error("Failed to create identity:", identityError);
      if (createdUser) {
        const { error: deleteError } = await supabase!
          .from("userbase_users")
          .delete()
          .eq("id", userId);
        if (deleteError) {
          console.error("Failed to cleanup orphaned user after identity creation failure:", {
            userId,
            error: deleteError.message || deleteError,
          });
        }
      }
      return NextResponse.json(
        {
          error: "Failed to create identity",
          details:
            process.env.NODE_ENV !== "production"
              ? identityError?.message || identityError
              : undefined,
        },
        { status: 500 }
      );
    }

    identityId = inserted.id;
  } else {
    const { data: existingUser } = await supabase!
      .from("userbase_users")
      .select("id, display_name, avatar_url, handle")
      .eq("id", userId)
      .single();

    if (existingUser) {
      const updates: Record<string, string> = {};
      const bootstrapProfile = getBootstrapProfile({
        type,
        identifier,
        handleRaw,
        displayNameRaw,
        avatarRaw,
        metadata,
      });
      if (
        isPlaceholderDisplayName(existingUser.display_name) &&
        bootstrapProfile.displayName
      ) {
        updates.display_name = bootstrapProfile.displayName;
      }
      if (
        isPlaceholderAvatarUrl(existingUser.avatar_url) &&
        bootstrapProfile.avatarUrl
      ) {
        updates.avatar_url = bootstrapProfile.avatarUrl;
      }
      if (!existingUser.handle && handleRaw) {
        const candidate = toHiveSafeBaseHandle(handleRaw);
        if (candidate && (await isHandleAvailable(candidate))) {
          updates.handle = candidate;
        }
      }
      if (Object.keys(updates).length > 0) {
        await supabase!.from("userbase_users").update(updates).eq("id", userId);
      }
    }

    if (!identityId) {
      const { data: existingPrimary } = await supabase!
        .from("userbase_identities")
        .select("id")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .limit(1);

      const isPrimary = !existingPrimary || existingPrimary.length === 0;

      const { data: inserted, error: identityError } = await supabase!
        .from("userbase_identities")
        .insert({
          user_id: userId,
          type,
          handle: type === "hive" ? identifier : handleRaw,
          address: type === "evm" ? identifier : null,
          external_id: type === "farcaster" ? identifier : null,
          is_primary: isPrimary,
          verified_at: new Date().toISOString(),
          metadata,
        })
        .select("id")
        .single();
      if (identityError || !inserted) {
        console.error("Failed to create identity:", identityError);
        return NextResponse.json(
          {
            error: "Failed to create identity",
            details:
              process.env.NODE_ENV !== "production"
                ? identityError?.message || identityError
                : undefined,
          },
          { status: 500 }
        );
      }
      identityId = inserted.id;
    }
  }

  const sessionResult = await createSession(userId, userAgent);
  if (sessionResult instanceof NextResponse) {
    return sessionResult;
  }

  const response = NextResponse.json({
    success: true,
    user_id: userId,
    identity_id: identityId,
    created_user: createdUser,
    expires_at: sessionResult.expiresAt,
  });

  response.cookies.set("userbase_refresh", sessionResult.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
  // Companion non-httpOnly flag so the client can detect "logged in"
  // without calling /auth/session. Holds no sensitive data — just "1".
  response.cookies.set("userbase_logged_in", "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });

  return response;
}
