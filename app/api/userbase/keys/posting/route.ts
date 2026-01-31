import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { PrivateKey } from "@hiveio/dhive";
import fetchAccount from "@/lib/hive/fetchAccount";
import { encryptSecret } from "@/lib/userbase/encryption";

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

async function getHiveIdentity(userId: string, handle?: string | null) {
  const query = supabase!
    .from("userbase_identities")
    .select("id, handle, is_primary")
    .eq("user_id", userId)
    .eq("type", "hive");

  if (handle) {
    query.eq("handle", handle);
  }

  const { data } = await query.limit(10);
  if (!data || data.length === 0) {
    return null;
  }

  const primary = data.find((row) => row.is_primary);
  return primary || data[0];
}

export async function GET(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  console.log("[GET /keys/posting] Checking key storage for userId:", session.userId);

  const hiveIdentity = await getHiveIdentity(session.userId, null);
  if (!hiveIdentity) {
    console.log("[GET /keys/posting] No Hive identity found");
    return NextResponse.json({ stored: false, custody: "none" });
  }

  console.log("[GET /keys/posting] Found Hive identity:", hiveIdentity.handle);

  // Check userbase_hive_keys for encrypted posting key
  const { data: hiveKeyRow } = await supabase!
    .from("userbase_hive_keys")
    .select("id, created_at, last_used_at, key_type")
    .eq("user_id", session.userId)
    .limit(1);

  const hiveKey = hiveKeyRow?.[0];
  console.log("[GET /keys/posting] userbase_hive_keys:", hiveKey ? "FOUND" : "NOT FOUND");

  if (hiveKey) {
    return NextResponse.json({
      stored: true,
      custody: "stored",
      status: "enabled",
      created_at: hiveKey.created_at,
      last_used_at: hiveKey.last_used_at || null,
      rotation_count: 0,
      key_type: hiveKey.key_type,
    });
  }

  console.log("[GET /keys/posting] No key found in either system");
  return NextResponse.json({ stored: false, custody: "none" });
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
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const postingKeyRaw = body?.posting_key;
  const handleRaw = body?.handle ? String(body.handle).trim().toLowerCase() : null;

  if (!postingKeyRaw || typeof postingKeyRaw !== "string") {
    return NextResponse.json(
      { error: "Missing posting key" },
      { status: 400 }
    );
  }

  const postingKey = postingKeyRaw.trim();
  if (!postingKey) {
    return NextResponse.json(
      { error: "Missing posting key" },
      { status: 400 }
    );
  }

  const hiveIdentity = await getHiveIdentity(session.userId, handleRaw);
  if (!hiveIdentity) {
    return NextResponse.json(
      { error: "Hive identity not linked" },
      { status: 400 }
    );
  }

  if (!hiveIdentity.handle) {
    return NextResponse.json(
      { error: "Hive identity missing handle" },
      { status: 400 }
    );
  }

  let publicKey: string;
  try {
    publicKey = PrivateKey.fromString(postingKey).createPublic().toString();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid posting key" },
      { status: 400 }
    );
  }

  let accountData;
  try {
    accountData = await fetchAccount(hiveIdentity.handle);
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
      { error: "Posting key does not match account" },
      { status: 403 }
    );
  }

  let encrypted: string;
  let encryptedData: { v: number; iv: string; tag: string; data: string };
  try {
    encrypted = encryptSecret(postingKey);
    encryptedData = JSON.parse(encrypted);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Encryption failed" },
      { status: 500 }
    );
  }

  // Check if key already exists
  const { data: existingKey } = await supabase!
    .from("userbase_hive_keys")
    .select("id")
    .eq("user_id", session.userId)
    .limit(1);

  const now = new Date().toISOString();

  if (existingKey?.[0]) {
    // Update existing key
    const { error: updateError } = await supabase!
      .from("userbase_hive_keys")
      .update({
        encrypted_posting_key: encryptedData.data,
        encryption_iv: encryptedData.iv,
        encryption_auth_tag: encryptedData.tag,
        key_type: "user_provided",
        updated_at: now,
      })
      .eq("id", existingKey[0].id);

    if (updateError) {
      console.error("Failed to update posting key:", updateError);
      return NextResponse.json(
        {
          error: "Failed to store posting key",
          details:
            process.env.NODE_ENV !== "production"
              ? updateError?.message || updateError
              : undefined,
        },
        { status: 500 }
      );
    }
  } else {
    // Insert new key
    const { error: insertError } = await supabase!
      .from("userbase_hive_keys")
      .insert({
        user_id: session.userId,
        hive_username: hiveIdentity.handle,
        encrypted_posting_key: encryptedData.data,
        encryption_iv: encryptedData.iv,
        encryption_auth_tag: encryptedData.tag,
        key_type: "user_provided",
        created_at: now,
        updated_at: now,
      });

    if (insertError) {
      console.error("Failed to insert posting key:", insertError);
      return NextResponse.json(
        {
          error: "Failed to store posting key",
          details:
            process.env.NODE_ENV !== "production"
              ? insertError?.message || insertError
              : undefined,
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  const hiveIdentity = await getHiveIdentity(session.userId, null);
  if (!hiveIdentity) {
    return NextResponse.json(
      { error: "Hive identity not linked" },
      { status: 400 }
    );
  }

  // Delete posting key from userbase_hive_keys
  const { error: deleteError } = await supabase!
    .from("userbase_hive_keys")
    .delete()
    .eq("user_id", session.userId);

  if (deleteError) {
    console.error("Failed to delete posting key:", deleteError);
    return NextResponse.json(
      {
        error: "Failed to remove posting key",
        details:
          process.env.NODE_ENV !== "production"
            ? deleteError.message || deleteError
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
