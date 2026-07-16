import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { newsletterPortalRequest } from "@/lib/newsletter/portal";

// Newsletter subscription preference for the signed-in userbase account.
// Status truth lives in the SkateHive marketing portal (Paragraph publication
// + opt-out records); this route resolves the session → email server-side and
// proxies to the portal with a shared secret, so neither the secret nor other
// people's emails ever reach the browser.
//
// GET  → { subscribed: boolean }
// POST { subscribed: boolean } → { subscribed: boolean }

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

async function getSessionEmail(
  request: NextRequest
): Promise<{ email: string } | { error: NextResponse }> {
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

  const { data: sessionRows } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);

  const session = sessionRows?.[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: emailRows } = await supabase
    .from("userbase_auth_methods")
    .select("identifier")
    .eq("user_id", session.user_id)
    .eq("type", "email_magic")
    .order("created_at", { ascending: false })
    .limit(1);

  const email = emailRows?.[0]?.identifier as string | undefined;
  if (!email) {
    return {
      error: NextResponse.json(
        { error: "No email linked to this account" },
        { status: 400 }
      ),
    };
  }
  return { email: email.trim().toLowerCase() };
}

async function callPortal(
  email: string,
  subscribed?: boolean
): Promise<NextResponse> {
  const result = await newsletterPortalRequest(email, subscribed);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ subscribed: result.subscribed });
}

export async function GET(request: NextRequest) {
  const auth = await getSessionEmail(request);
  if ("error" in auth) return auth.error;
  return callPortal(auth.email);
}

export async function POST(request: NextRequest) {
  const auth = await getSessionEmail(request);
  if ("error" in auth) return auth.error;
  const body = (await request.json().catch(() => null)) as {
    subscribed?: boolean;
  } | null;
  if (typeof body?.subscribed !== "boolean") {
    return NextResponse.json(
      { error: "subscribed boolean required" },
      { status: 400 }
    );
  }
  return callPortal(auth.email, body.subscribed);
}
