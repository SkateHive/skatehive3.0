import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fetchAccount from "@/lib/hive/fetchAccount";

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

export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const handleRaw = body?.handle;
  if (!handleRaw || typeof handleRaw !== "string") {
    return NextResponse.json(
      { error: "Missing Hive handle" },
      { status: 400 }
    );
  }

  const handle = handleRaw.trim().toLowerCase();
  if (!handle) {
    return NextResponse.json(
      { error: "Missing Hive handle" },
      { status: 400 }
    );
  }

  try {
    await fetchAccount(handle);
  } catch (error: any) {
    const message = error?.message || String(error);
    const isNotFound =
      message === "Account not found" ||
      message.toLowerCase().includes("not found") ||
      error?.status === 404 ||
      error?.code === "NOT_FOUND";

    if (isNotFound) {
      return NextResponse.json(
        { error: "Hive account not found" },
        { status: 404 }
      );
    }

    // Network failure, timeout, or other upstream error
    console.error("Hive API error while fetching account:", {
      handle,
      message,
      code: error?.code,
      status: error?.status,
    });
    return NextResponse.json(
      {
        error: "Failed to verify Hive account",
        details:
          process.env.NODE_ENV !== "production" ? message : undefined,
      },
      { status: 502 }
    );
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  const message = buildMessage({
    userId: session.userId,
    handle,
    nonce,
    issuedAt,
  });

  const { error: insertError } = await supabase!
    .from("userbase_identity_challenges")
    .insert({
      user_id: session.userId,
      type: "hive",
      identifier: handle,
      nonce,
      created_at: issuedAt,
      expires_at: expiresAt,
      message,
    });

  if (insertError) {
    console.error("Failed to create Hive challenge:", insertError);
    return NextResponse.json(
      {
        error: "Failed to create challenge",
        details:
          process.env.NODE_ENV !== "production"
            ? insertError?.message || insertError
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message,
    expires_at: expiresAt,
  });
}
