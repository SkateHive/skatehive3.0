import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkHiveAccountExists } from "@/lib/utils/hiveAccountUtils";
import { newsletterPortalRequest } from "@/lib/newsletter/portal";

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

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function normalizeHandle(handle: string | null) {
  if (!handle) return null;
  return handle.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
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
    const rawIdentifier = payload?.identifier;
    const rawHandle = payload?.handle ?? null;

    if (!rawIdentifier || typeof rawIdentifier !== "string") {
      return NextResponse.json(
        { error: "Missing required field: identifier" },
        { status: 400 }
      );
    }

    const identifier = normalizeIdentifier(rawIdentifier);
    const handle = normalizeHandle(
      typeof rawHandle === "string" ? rawHandle : null
    );

    const { data: authRows, error: authError } = await supabase
      .from("userbase_auth_methods")
      .select("id, user_id")
      .eq("type", "email_magic")
      .eq("identifier", identifier)
      .limit(1);

    if (authError) {
      console.error("Userbase lookup failed:", {
        error: authError,
        code: authError.code,
        message: authError.message,
        details: authError.details,
        hint: authError.hint,
        identifier: identifier.substring(0, 3) + "***", // Partial for privacy
      });
      return NextResponse.json(
        {
          error: "Failed to lookup account",
          code: authError.code,
          message: authError.message,
          hint: authError.hint,
        },
        { status: 500 }
      );
    }

    let handleAvailable: boolean | null = null;
    let handleLookupFailed = false;
    if (handle) {
      const [userbaseResult, hiveExists] = await Promise.all([
        supabase
          .from("userbase_users")
          .select("id")
          .eq("handle", handle)
          .limit(1),
        checkHiveAccountExists(handle).catch((err) => {
          console.error("Hive account check failed:", err);
          return null; // Indicate failure with null
        }),
      ]);

      if (userbaseResult.error || hiveExists === null) {
        if (userbaseResult.error) {
          console.error("Handle lookup failed:", userbaseResult.error);
        }
        handleLookupFailed = true;
      } else {
        const userbaseAvailable =
          !userbaseResult.data || userbaseResult.data.length === 0;
        handleAvailable = userbaseAvailable && !hiveExists;
      }
    }

    const exists = Boolean(authRows?.[0]?.user_id);

    // Newsletter status drives whether the login form shows the opt-in checkbox.
    // Only queried for existing accounts (a new email is definitionally not a
    // returning subscriber), and fail-open: null means "unknown", so the form
    // errs toward showing the checkbox rather than hiding a real opt-in chance.
    let subscribed: boolean | null = null;
    if (exists && !handle) {
      const portal = await newsletterPortalRequest(identifier);
      subscribed = portal.ok ? portal.subscribed : null;
    }

    return NextResponse.json({
      exists,
      subscribed,
      handle_available: handleAvailable,
      handle_lookup_failed: handleLookupFailed || undefined,
    });
  } catch (error) {
    console.error("Userbase lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
