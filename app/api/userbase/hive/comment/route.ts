import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { PrivateKey } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";
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
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  const { data } = await supabase
    .from("userbase_identities")
    .select("id, handle, is_primary")
    .eq("user_id", userId)
    .eq("type", "hive")
    .order("is_primary", { ascending: false })
    .limit(1);

  return data?.[0] || null;
}

async function getPostingKey(userId: string) {
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }

  console.log("[getPostingKey] Looking for key - userId:", userId);

  // Check userbase_hive_keys for encrypted posting key
  const { data: hiveKeyRows } = await supabase
    .from("userbase_hive_keys")
    .select("id, encrypted_posting_key, encryption_iv, encryption_auth_tag")
    .eq("user_id", userId)
    .limit(1);

  const hiveKey = hiveKeyRows?.[0];
  console.log("[getPostingKey] userbase_hive_keys result:", hiveKey ? "FOUND" : "NOT FOUND");

  if (hiveKey && hiveKey.encrypted_posting_key) {
    // Format as encrypted secret for decryption
    const secret = JSON.stringify({
      encryptedKey: hiveKey.encrypted_posting_key,
      iv: hiveKey.encryption_iv,
      authTag: hiveKey.encryption_auth_tag,
    });
    console.log("[getPostingKey] Returning encrypted posting key");
    return { error: null, userKeyId: hiveKey.id, secret };
  }

  console.log("[getPostingKey] No posting key found");
  return { error: "Posting key not stored", userKeyId: null, secret: null };
}

// Audit function removed - userbase_key_usage_audit table dropped

function getDefaultPostingConfig() {
  const author = process.env.DEFAULT_HIVE_POSTING_ACCOUNT?.trim() || null;
  const key = process.env.DEFAULT_HIVE_POSTING_KEY?.trim() || null;
  if (!author || !key) {
    return { author: null, key: null };
  }
  return { author, key };
}

async function recordSoftPost({
  userId,
  author,
  permlink,
  title,
  type,
  metadata,
  safeUser,
}: {
  userId: string;
  author: string;
  permlink: string;
  title: string;
  type: string;
  metadata: Record<string, any>;
  safeUser: string | null;
}) {
  if (!supabase) {
    console.error("Supabase client not initialized");
    return null;
  }
  try {
    const { data } = await supabase
      .from("userbase_soft_posts")
      .insert({
        user_id: userId,
        author,
        permlink,
        title,
        type,
        status: "queued",
        safe_user: safeUser,
        metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    return data?.id ?? null;
  } catch (error) {
    console.error("Failed to record soft post:", error);
    return null;
  }
}

async function updateSoftPostStatus(
  id: string | null,
  status: "queued" | "broadcasted" | "failed",
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
  if (!supabase) {
    throw new Error("Supabase client not initialized");
  }
  await supabase.from("userbase_soft_posts").update(payload).eq("id", id);
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  const body = await request.json();
  const parentAuthor =
    typeof body?.parent_author === "string" ? body.parent_author : "";
  const parentPermlink =
    typeof body?.parent_permlink === "string" ? body.parent_permlink : "";
  const permlinkRaw =
    typeof body?.permlink === "string" ? body.permlink.trim() : "";
  const title = typeof body?.title === "string" ? body.title : "";
  const content = typeof body?.body === "string" ? body.body : "";
  const explicitType = typeof body?.type === "string" ? body.type : null;

  if (!parentPermlink) {
    return NextResponse.json(
      { error: "Missing parent permlink" },
      { status: 400 }
    );
  }

  if (!content) {
    return NextResponse.json(
      { error: "Missing body" },
      { status: 400 }
    );
  }

  const hiveIdentity = await getHiveIdentity(session.userId);
  let author = hiveIdentity?.handle || null;
  let postingKey: string | null = null;
  let userKeyId: string | null = null;
  let usingDefaultAccount = false;

  if (author && hiveIdentity) {
    console.log("[POST /comment] Found Hive identity for user:", session.userId, "handle:", author);
    const { error: keyError, userKeyId: keyId, secret } = await getPostingKey(
      session.userId
    );
    if (keyError || !secret) {
      console.error("[POST /comment] No posting key found:", keyError);
      return NextResponse.json(
        {
          error: keyError || "Posting key not available",
          code: "POSTING_KEY_NOT_STORED",
          hive_handle: author,
        },
        { status: 400 }
      );
    }
    console.log("[POST /comment] Found posting key, proceeding with broadcast");

    try {
      console.log("[POST /comment] Attempting to decrypt posting key");
      // Check if this is a sponsored key (JSON format)
      if (secret.startsWith('{')) {
        const encryptedData = JSON.parse(secret);
        console.log("[POST /comment] Decrypting sponsored key with data:", Object.keys(encryptedData));
        postingKey = decryptHivePostingKey(encryptedData, session.userId);
        console.log("[POST /comment] Decrypted sponsored key successfully");
      } else {
        // Old system decryption
        postingKey = decryptSecret(secret);
        console.log("[POST /comment] Decrypted old system key successfully");
      }
      userKeyId = keyId;
    } catch (error: any) {
      console.error("[POST /comment] Decryption failed:", error);
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
    author = defaultConfig.author;
    postingKey = defaultConfig.key;
    usingDefaultAccount = true;
  }

  const permlink =
    permlinkRaw || crypto.randomUUID().replace(/-/g, "");

  let metadata: Record<string, any> = {};
  if (body?.json_metadata) {
    if (typeof body.json_metadata === "string") {
      try {
        metadata = JSON.parse(body.json_metadata);
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid json_metadata" },
          { status: 400 }
        );
      }
    } else if (typeof body.json_metadata === "object") {
      metadata = body.json_metadata;
    }
  }

  const safeUserIdentifier = getSafeUserIdentifier(session.userId);
  if (safeUserIdentifier) {
    metadata.skatehive_user = safeUserIdentifier;
  }

  const commentOp: any = [
    "comment",
    {
      parent_author: parentAuthor || "",
      parent_permlink: parentPermlink,
      author,
      permlink,
      title,
      body: content,
      json_metadata: JSON.stringify(metadata),
    },
  ];

  const ops: any[] = [commentOp];
  const beneficiaries: Array<{ account: string; weight: number }> = Array.isArray(
    body?.beneficiaries
  )
    ? body.beneficiaries
    : [];
  let validBeneficiaries: Array<{ account: string; weight: number }> = [];

  if (beneficiaries.length > 0) {
    const totalWeight = beneficiaries.reduce(
      (sum, b) => sum + Number(b?.weight || 0),
      0
    );
    if (totalWeight > 10000) {
      return NextResponse.json(
        { error: "Beneficiaries exceed 100%" },
        { status: 400 }
      );
    }

    validBeneficiaries = beneficiaries.filter((b) => {
      if (!b?.account || typeof b.account !== "string") return false;
      if (!b?.weight || Number(b.weight) <= 0) return false;
      const validation = validateHiveUsernameFormat(b.account);
      return validation.isValid;
    });

    if (validBeneficiaries.length > 0) {
      ops.push([
        "comment_options",
        {
          author,
          permlink,
          max_accepted_payout: "1000000.000 HBD",
          percent_hbd: 10000,
          allow_votes: true,
          allow_curation_rewards: true,
          extensions: [
            [
              0,
              {
                beneficiaries: validBeneficiaries.map((b) => ({
                  account: b.account,
                  weight: b.weight,
                })),
              },
            ],
          ],
        },
      ]);
    }
  }

  let softPostId: string | null = null;
  try {
    if (usingDefaultAccount) {
      const inferredType =
        explicitType && ["post", "comment", "snap"].includes(explicitType)
          ? explicitType
          : parentAuthor
          ? "comment"
          : "post";
      const softMetadata = {
        onchain: metadata,
        parent_author: parentAuthor || "",
        parent_permlink: parentPermlink,
        title,
        body: content,
        safe_user: safeUserIdentifier,
        beneficiaries:
          validBeneficiaries.length > 0 ? validBeneficiaries : undefined,
      };
      softPostId = await recordSoftPost({
        userId: session.userId,
        author: author!,
        permlink,
        title,
        type: inferredType,
        metadata: softMetadata,
        safeUser: safeUserIdentifier,
      });
    }

    const privateKey = PrivateKey.fromString(postingKey as string);
    await HiveClient.broadcast.sendOperations(ops, privateKey);

    // Update last used timestamp
    if (userKeyId) {
      await supabase!
        .from("userbase_hive_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", userKeyId);
    }

    if (usingDefaultAccount) {
      await updateSoftPostStatus(softPostId, "broadcasted");
    }

    return NextResponse.json({
      success: true,
      author,
      permlink,
    });
  } catch (error: any) {
    if (usingDefaultAccount) {
      await updateSoftPostStatus(
        softPostId,
        "failed",
        error?.message || "Failed to broadcast"
      );
      await notifyAlert({
        type: "userbase_soft_post_broadcast_failed",
        soft_post_id: softPostId,
        author,
        permlink,
        error: error?.message || "Failed to broadcast",
        safe_user: safeUserIdentifier,
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
