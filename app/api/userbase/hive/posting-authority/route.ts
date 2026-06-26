import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  hasGrantedPostingAuthority,
  PostingAuthorityError,
} from "@/lib/hive/postingAuthorityBroadcast";

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

async function getSessionUserId(
  request: NextRequest
): Promise<{ userId: string } | { error: NextResponse }> {
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
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: sessionRows, error: sessionError } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
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
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (new Date(session.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
  return { userId: session.user_id };
}

// GET /api/userbase/hive/posting-authority
//
// Session-authenticated. Derives the Hive account from the caller's linked
// identity — does not accept a username param to prevent arbitrary account
// enumeration. Returns { service_account, has_authority, hive_author }.
export async function GET(request: NextRequest) {
  const session = await getSessionUserId(request);
  if ("error" in session) return session.error;

  const serviceAccount = process.env.DEFAULT_HIVE_POSTING_ACCOUNT?.trim();
  if (!serviceAccount) {
    return NextResponse.json(
      { error: "Scheduled posting is not configured on this server" },
      { status: 503 }
    );
  }

  if (!supabase) {
    return NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 });
  }

  // Derive the Hive identity from the authenticated session.
  const { data: identityRows, error: identityError } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", session.userId)
    .eq("type", "hive")
    .order("is_primary", { ascending: false })
    .limit(1);

  if (identityError) {
    console.error("Failed to look up Hive identity:", identityError);
    return NextResponse.json(
      { error: "Failed to look up Hive identity" },
      { status: 500 }
    );
  }

  const hiveAuthor = identityRows?.[0]?.handle ?? null;
  if (!hiveAuthor) {
    // No Hive identity linked yet — return service account so UI can display it.
    return NextResponse.json({
      service_account: serviceAccount,
      has_authority: null,
      hive_author: null,
    });
  }

  try {
    const hasAuthority = await hasGrantedPostingAuthority(hiveAuthor);
    return NextResponse.json({
      service_account: serviceAccount,
      has_authority: hasAuthority,
      hive_author: hiveAuthor,
    });
  } catch (err) {
    if (err instanceof PostingAuthorityError && err.code === "CONFIG_MISSING") {
      return NextResponse.json(
        { error: "Scheduled posting is not configured on this server" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to check posting authority" },
      { status: 502 }
    );
  }
}
