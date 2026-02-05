import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { PrivateKey } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { decryptSecret, decryptHivePostingKey } from "@/lib/userbase/encryption";
import { getSafeUserIdentifier } from "@/lib/userbase/safeUser";

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

async function notifyAlert(payload: Record<string, any>) {
  const webhook = process.env.USERBASE_ALERT_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to send userbase alert:", error);
  }
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

  // Check userbase_hive_keys for encrypted posting key
  const { data: hiveKeyRows } = await supabase!
    .from("userbase_hive_keys")
    .select("id, encrypted_posting_key, encryption_iv, encryption_auth_tag")
    .eq("user_id", userId)
    .limit(1);

  const hiveKey = hiveKeyRows?.[0];

  if (hiveKey && hiveKey.encrypted_posting_key) {
    // Format as encrypted secret for decryption
    const secret = JSON.stringify({
      encryptedKey: hiveKey.encrypted_posting_key,
      iv: hiveKey.encryption_iv,
      authTag: hiveKey.encryption_auth_tag,
    });
    return { error: null, userKeyId: hiveKey.id, secret };
  }

  return { error: "Posting key not stored", userKeyId: null, secret: null };
}

function getDefaultPostingConfig() {
  const author = process.env.DEFAULT_HIVE_POSTING_ACCOUNT?.trim() || null;
  const key = process.env.DEFAULT_HIVE_POSTING_KEY?.trim() || null;
  if (!author || !key) {
    return { author: null, key: null };
  }
  return { author, key };
}

async function recordSoftVote({
  userId,
  author,
  permlink,
  weight,
  metadata,
}: {
  userId: string;
  author: string;
  permlink: string;
  weight: number;
  metadata: Record<string, any>;
}) {
  try {
    const { data } = await supabase!
      .from("userbase_soft_votes")
      .upsert(
        {
          user_id: userId,
          author,
          permlink,
          weight,
          status: "queued",
          metadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,author,permlink",
        }
      )
      .select("id")
      .single();

    return data?.id || null;
  } catch (error) {
    console.error("Failed to record soft vote:", error);
    return null;
  }
}

async function updateSoftVoteStatus(
  id: string | null,
  status: "broadcasted" | "failed",
  error?: string | null
) {
  if (!id) return;
  const payload: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "broadcasted") {
    payload.broadcasted_at = new Date().toISOString();
    payload.error = null;
  } else if (status === "failed") {
    payload.error = error || "Unknown error";
  }
  await supabase!.from("userbase_soft_votes").update(payload).eq("id", id);
}

// Audit function removed - userbase_key_usage_audit table dropped

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
  const author = typeof body?.author === "string" ? body.author : "";
  const permlink = typeof body?.permlink === "string" ? body.permlink : "";
  const weightRaw = body?.weight;

  if (!author || !permlink) {
    return NextResponse.json(
      { error: "Missing author or permlink" },
      { status: 400 }
    );
  }

  const weight = Number(weightRaw);
  if (!Number.isFinite(weight) || weight < -10000 || weight > 10000) {
    return NextResponse.json(
      { error: "Invalid vote weight" },
      { status: 400 }
    );
  }

  const hiveIdentity = await getHiveIdentity(session.userId);
  let voter = hiveIdentity?.handle || null;
  let postingKey: string | null = null;
  let userKeyId: string | null = null;
  let usingDefaultAccount = false;

  if (voter && hiveIdentity) {
    const { error: keyError, userKeyId: keyId, secret } = await getPostingKey(
      session.userId
    );
    if (keyError || !secret) {
      console.error("[POST /vote] No posting key found:", keyError);
      return NextResponse.json(
        {
          error: keyError || "Posting key not available",
          code: "POSTING_KEY_NOT_STORED",
          hive_handle: voter,
        },
        { status: 400 }
      );
    }

    try {
      // Check if this is a sponsored key (JSON format)
      if (secret.startsWith('{')) {
        const encryptedData = JSON.parse(secret);
        postingKey = decryptHivePostingKey(encryptedData, session.userId);
      } else {
        // Old system decryption
        postingKey = decryptSecret(secret);
      }
      userKeyId = keyId;
    } catch (error: any) {
      console.error("[POST /vote] Decryption failed:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to decrypt posting key" },
        { status: 500 }
      );
    }
  } else {
    const defaultConfig = getDefaultPostingConfig();
    if (!defaultConfig.author || !defaultConfig.key) {
      return NextResponse.json(
        {
          error: "Hive identity not linked",
          details:
            process.env.NODE_ENV !== "production"
              ? {
                  has_default_account: Boolean(
                    process.env.DEFAULT_HIVE_POSTING_ACCOUNT?.trim()
                  ),
                  has_default_key: Boolean(
                    process.env.DEFAULT_HIVE_POSTING_KEY?.trim()
                  ),
                }
              : undefined,
        },
        { status: 400 }
      );
    }
    voter = defaultConfig.author;
    postingKey = defaultConfig.key;
    usingDefaultAccount = true;
  }

  const voteOp: any = [
    "vote",
    {
      voter,
      author,
      permlink,
      weight,
    },
  ];

  let softVoteId: string | null = null;
  try {
    if (usingDefaultAccount) {
      const safeUserIdentifier = getSafeUserIdentifier(session.userId);
      softVoteId = await recordSoftVote({
        userId: session.userId,
        author,
        permlink,
        weight,
        metadata: {
          safe_user: safeUserIdentifier,
        },
      });
    }

    const privateKey = PrivateKey.fromString(postingKey as string);
    await HiveClient.broadcast.sendOperations([voteOp], privateKey);

    // Update last used timestamp
    if (userKeyId) {
      await supabase!
        .from("userbase_hive_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", userKeyId);
    }

    if (usingDefaultAccount) {
      await updateSoftVoteStatus(softVoteId, "broadcasted");
    }

    return NextResponse.json({
      success: true,
      voter,
    });
  } catch (error: any) {
    if (usingDefaultAccount) {
      await updateSoftVoteStatus(
        softVoteId,
        "failed",
        error?.message || "Failed to broadcast"
      );
      await notifyAlert({
        type: "userbase_soft_vote_failed",
        soft_vote_id: softVoteId,
        author,
        permlink,
        error: error?.message || "Failed to broadcast",
      });
    }
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
