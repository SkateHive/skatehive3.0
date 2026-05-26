import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const refreshToken = request.cookies.get("userbase_refresh")?.value;
    if (refreshToken) {
      const refreshTokenHash = hashToken(refreshToken);
      const { error: revokeError } = await supabase
        .from("userbase_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("refresh_token_hash", refreshTokenHash)
        .is("revoked_at", null);

      if (revokeError) {
        console.error("Failed to revoke session:", revokeError);
        return NextResponse.json(
          {
            error: "Failed to revoke session",
            details:
              process.env.NODE_ENV !== "production"
                ? revokeError?.message || revokeError
                : undefined,
          },
          { status: 500 }
        );
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("userbase_refresh", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    // Clear the client-visible companion flag too.
    response.cookies.set("userbase_logged_in", "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Userbase logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
