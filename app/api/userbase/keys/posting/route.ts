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

  // Check old system (userbase_user_keys)
  const { data: keyRow } = await supabase!
    .from("userbase_user_keys")
    .select("id, custody, status, created_at, last_used_at, rotation_count")
    .eq("identity_id", hiveIdentity.id)
    .eq("key_type", "posting")
    .limit(1);

  const key = keyRow?.[0];
  console.log("[GET /keys/posting] Old system (userbase_user_keys):", key ? "FOUND" : "NOT FOUND");

  if (key && key.custody === "stored") {
    console.log("[GET /keys/posting] Returning old system key");
    return NextResponse.json({
      stored: true,
      custody: key.custody,
      status: key.status,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      rotation_count: key.rotation_count,
    });
  }

  // Check new system (userbase_hive_keys - sponsorship)
  const { data: hiveKeyRow } = await supabase!
    .from("userbase_hive_keys")
    .select("id, created_at, last_used_at, key_type")
    .eq("user_id", session.userId)
    .limit(1);

  const hiveKey = hiveKeyRow?.[0];
  console.log("[GET /keys/posting] New system (userbase_hive_keys):", hiveKey ? "FOUND (sponsored)" : "NOT FOUND");

  if (hiveKey) {
    console.log("[GET /keys/posting] Returning sponsored key");
    return NextResponse.json({
      stored: true,
      custody: "stored",
      status: "enabled",
      created_at: hiveKey.created_at,
      last_used_at: hiveKey.last_used_at || null,
      rotation_count: 0,
      source: "sponsored", // Indicate this is from sponsorship system
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
  try {
    encrypted = encryptSecret(postingKey);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Encryption failed" },
      { status: 500 }
    );
  }

  const { data: existingKey } = await supabase!
    .from("userbase_user_keys")
    .select("id, rotation_count")
    .eq("identity_id", hiveIdentity.id)
    .eq("key_type", "posting")
    .limit(1);

  const now = new Date().toISOString();
  let userKeyId = existingKey?.[0]?.id;
  let rotationCount = existingKey?.[0]?.rotation_count || 0;

  if (!userKeyId) {
    const { data: createdKey, error: createError } = await supabase!
      .from("userbase_user_keys")
      .insert({
        user_id: session.userId,
        identity_id: hiveIdentity.id,
        chain: "hive",
        key_type: "posting",
        custody: "stored",
        status: "enabled",
        created_at: now,
        rotation_count: 0,
      })
      .select("id")
      .single();

    if (createError || !createdKey) {
      console.error("Failed to create user key:", createError);
      return NextResponse.json(
        {
          error: "Failed to store posting key",
          details:
            process.env.NODE_ENV !== "production"
              ? createError?.message || createError
              : undefined,
        },
        { status: 500 }
      );
    }

    userKeyId = createdKey.id;
  } else {
    rotationCount += 1;
    const { error: updateKeyError } = await supabase!
      .from("userbase_user_keys")
      .update({
        custody: "stored",
        status: "enabled",
        rotation_count: rotationCount,
      })
      .eq("id", userKeyId);

    if (updateKeyError) {
      console.error("Failed to update user key:", updateKeyError);
      return NextResponse.json(
        {
          error: "Failed to store posting key",
          details:
            process.env.NODE_ENV !== "production"
              ? updateKeyError?.message || updateKeyError
              : undefined,
        },
        { status: 500 }
      );
    }
  }

  const { data: secretRow } = await supabase!
    .from("userbase_secrets")
    .select("id")
    .eq("user_key_id", userKeyId)
    .limit(1);

  if (secretRow?.[0]) {
    const { error: secretError } = await supabase!
      .from("userbase_secrets")
      .update({
        ciphertext: encrypted,
        rotated_at: now,
      })
      .eq("user_key_id", userKeyId);
    if (secretError) {
      console.error("Failed to update secret:", secretError);
      return NextResponse.json(
        {
          error: "Failed to store posting key",
          details:
            process.env.NODE_ENV !== "production"
              ? secretError?.message || secretError
              : undefined,
        },
        { status: 500 }
      );
    }
  } else {
    const { error: insertSecretError } = await supabase!
      .from("userbase_secrets")
      .insert({
        user_key_id: userKeyId,
        ciphertext: encrypted,
        key_version: 1,
        created_at: now,
      });
    if (insertSecretError) {
      console.error("Failed to store secret:", insertSecretError);
      return NextResponse.json(
        {
          error: "Failed to store posting key",
          details:
            process.env.NODE_ENV !== "production"
              ? insertSecretError?.message || insertSecretError
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

  const { data: keyRows } = await supabase!
    .from("userbase_user_keys")
    .select("id")
    .eq("identity_id", hiveIdentity.id)
    .eq("key_type", "posting")
    .limit(1);

  const key = keyRows?.[0];
  if (!key) {
    return NextResponse.json({ success: true });
  }

  // Fetch the existing secret before deletion for potential rollback
  const { data: existingSecrets } = await supabase!
    .from("userbase_secrets")
    .select("ciphertext, dek_wrapped, key_version")
    .eq("user_key_id", key.id)
    .limit(1);

  const existingSecret = existingSecrets?.[0] || null;

  // Delete the secret
  const { error: deleteError } = await supabase!
    .from("userbase_secrets")
    .delete()
    .eq("user_key_id", key.id);

  if (deleteError) {
    console.error("Failed to delete secret:", {
      keyId: key.id,
      error: deleteError.message || deleteError,
    });
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

  // Update the key status
  const { error: updateError } = await supabase!
    .from("userbase_user_keys")
    .update({ custody: "none", status: "disabled" })
    .eq("id", key.id);

  if (updateError) {
    console.error("Failed to update key status after secret deletion:", {
      keyId: key.id,
      error: updateError.message || updateError,
    });

    // Attempt to restore the secret for atomicity
    if (existingSecret) {
      const { error: restoreError } = await supabase!
        .from("userbase_secrets")
        .insert({
          user_key_id: key.id,
          ciphertext: existingSecret.ciphertext,
          dek_wrapped: existingSecret.dek_wrapped,
          key_version: existingSecret.key_version,
        });

      if (restoreError) {
        console.error("CRITICAL: Failed to restore secret after update failure:", {
          keyId: key.id,
          restoreError: restoreError.message || restoreError,
        });
        // Secret deleted but update failed and restore failed - inconsistent state
        return NextResponse.json(
          {
            error: "Failed to remove posting key - inconsistent state, please contact support",
            details:
              process.env.NODE_ENV !== "production"
                ? `Update failed: ${updateError.message}; Restore failed: ${restoreError.message}`
                : undefined,
          },
          { status: 500 }
        );
      }

      // Restore succeeded - return error to caller so they can retry
      return NextResponse.json(
        {
          error: "Failed to remove posting key, please try again",
          details:
            process.env.NODE_ENV !== "production"
              ? updateError.message || updateError
              : undefined,
        },
        { status: 500 }
      );
    }

    // No secret to restore but update still failed
    return NextResponse.json(
      {
        error: "Failed to update key status",
        details:
          process.env.NODE_ENV !== "production"
            ? updateError.message || updateError
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
