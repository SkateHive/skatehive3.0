import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { PrivateKey } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { decryptSecret, decryptHivePostingKey } from "@/lib/userbase/encryption";

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

async function getHiveIdentity(userId: string) {
  const { data } = await supabase!
    .from("userbase_identities")
    .select("id, handle, is_primary")
    .eq("user_id", userId)
    .eq("type", "hive")
    .order("is_primary", { ascending: false })
    .limit(1);

  return data?.[0] || null;
}

async function getPostingKey(userId: string) {
  const { data: hiveKeyRows } = await supabase!
    .from("userbase_hive_keys")
    .select("id, encrypted_posting_key, encryption_iv, encryption_auth_tag")
    .eq("user_id", userId)
    .limit(1);

  const hiveKey = hiveKeyRows?.[0];
  if (!hiveKey?.encrypted_posting_key) {
    return { error: "Posting key not stored", userKeyId: null, postingKey: null };
  }

  const secret = JSON.stringify({
    iv: hiveKey.encryption_iv,
    tag: hiveKey.encryption_auth_tag,
    data: hiveKey.encrypted_posting_key,
  });

  try {
    const encryptedData = JSON.parse(secret);
    try {
      return {
        error: null,
        userKeyId: hiveKey.id,
        postingKey: decryptHivePostingKey(encryptedData, userId),
      };
    } catch {
      return {
        error: null,
        userKeyId: hiveKey.id,
        postingKey: decryptSecret(secret),
      };
    }
  } catch (error: any) {
    return {
      error: error?.message || "Failed to decrypt posting key",
      userKeyId: null,
      postingKey: null,
    };
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const following = typeof body?.following === "string" ? body.following.trim() : "";
  if (!following || !/^[a-z0-9.-]{3,16}$/.test(following)) {
    return NextResponse.json({ error: "Invalid account to follow" }, { status: 400 });
  }

  const hiveIdentity = await getHiveIdentity(session.userId);
  const follower = hiveIdentity?.handle || null;
  if (!follower) {
    return NextResponse.json(
      { error: "Hive identity not linked", code: "HIVE_IDENTITY_NOT_LINKED" },
      { status: 400 }
    );
  }

  if (follower === following) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const { error: keyError, userKeyId, postingKey } = await getPostingKey(session.userId);
  if (keyError || !postingKey) {
    return NextResponse.json(
      {
        error: keyError || "Posting key not available",
        code: "POSTING_KEY_NOT_STORED",
        hive_handle: follower,
      },
      { status: 400 }
    );
  }

  let alreadyFollowing = false;
  try {
    const relationship = await HiveClient.call(
      "bridge",
      "get_relationship_between_accounts",
      {
        account1: follower,
        account2: following,
      }
    );
    alreadyFollowing = Boolean(relationship?.follows);
  } catch {
    alreadyFollowing = false;
  }
  const next = !alreadyFollowing;
  const followOp: any = [
    "custom_json",
    {
      required_auths: [],
      required_posting_auths: [follower],
      id: "follow",
      json: JSON.stringify([
        "follow",
        {
          follower,
          following,
          what: next ? ["blog"] : [],
        },
      ]),
    },
  ];

  try {
    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([followOp], privateKey);

    if (userKeyId) {
      await supabase!
        .from("userbase_hive_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", userKeyId);
    }

    return NextResponse.json({ success: true, follower, following, isFollowing: next });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to broadcast",
        details:
          process.env.NODE_ENV !== "production"
            ? error?.message || error
            : undefined,
      },
      { status: 500 }
    );
  }
}
