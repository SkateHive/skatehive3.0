import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

function normalize(value: string | null) {
  return value ? value.trim().toLowerCase() : null;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getUserByHandle(handle: string) {
  const { data, error } = await supabase!
    .from("userbase_users")
    .select(
      "id, handle, display_name, avatar_url, cover_url, bio, location, status, onboarding_step"
    )
    .eq("handle", handle)
    .limit(1);
  if (error) {
    throw error;
  }
  return data?.[0] || null;
}

async function getUserByDisplayName(displayName: string) {
  const { data, error } = await supabase!
    .from("userbase_users")
    .select(
      "id, handle, display_name, avatar_url, cover_url, bio, location, status, onboarding_step"
    )
    .ilike("display_name", displayName)
    .limit(2);
  if (error) {
    throw error;
  }
  if (!data || data.length === 0) {
    return null;
  }
  if (data.length > 1) {
    return { ambiguous: true } as const;
  }
  return data[0];
}

async function getUserByIdentity(params: {
  type: "hive" | "evm" | "farcaster";
  handle?: string | null;
  address?: string | null;
  external_id?: string | null;
}) {
  let query = supabase!
    .from("userbase_identities")
    .select("user_id")
    .eq("type", params.type)
    .limit(1);

  if (params.handle) {
    query = query.eq("handle", params.handle);
  }
  if (params.address) {
    query = query.eq("address", params.address);
  }
  if (params.external_id) {
    query = query.eq("external_id", params.external_id);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data?.[0]?.user_id || null;
}

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const handle = normalize(searchParams.get("handle"));
    const hiveHandle = normalize(searchParams.get("hive_handle"));
    const address = normalize(searchParams.get("address"));

    if (!handle && !hiveHandle && !address) {
      return NextResponse.json(
        { error: "Missing profile identifier" },
        { status: 400 }
      );
    }

    let userId: string | null = null;
    let user = null;
    let matchedBy: "hive" | "handle" | "evm" | null = null;

    console.log("[userbase/profile] Lookup params:", { handle, hiveHandle, address });

    if (hiveHandle) {
      userId = await getUserByIdentity({ type: "hive", handle: hiveHandle });
      if (userId) {
        matchedBy = "hive";
        console.log("[userbase/profile] Found by hive identity:", { hiveHandle, userId });
      }
    }

    if (!userId && handle) {
      user = await getUserByHandle(handle);
      userId = user?.id || null;
      if (userId) {
        matchedBy = "handle";
        console.log("[userbase/profile] Found by handle:", { handle, userId, userHandle: user?.handle });
      }
    }

    if (!userId && handle) {
      const byDisplay = await getUserByDisplayName(handle);
      console.log("[userbase/profile] Display name search result:", { handle, byDisplay: byDisplay ? (("ambiguous" in byDisplay) ? "ambiguous" : byDisplay) : null });
      if (byDisplay && "ambiguous" in byDisplay) {
        return NextResponse.json(
          { error: "Profile lookup ambiguous" },
          { status: 409 }
        );
      }
      if (byDisplay) {
        user = byDisplay as typeof user;
        userId = user?.id || null;
        matchedBy = "handle";
      }
    }

    if (!userId && address) {
      userId = await getUserByIdentity({ type: "evm", address });
      if (userId) {
        matchedBy = "evm";
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!user) {
      const { data, error: userError } = await supabase!
        .from("userbase_users")
        .select(
          "id, handle, display_name, avatar_url, cover_url, bio, location, status, onboarding_step"
        )
        .eq("id", userId)
        .single();
      if (userError) {
        console.error("Failed to fetch user by id:", {
          userId,
          error: userError.message || userError,
        });
        return NextResponse.json(
          { error: "Failed to fetch user profile" },
          { status: 500 }
        );
      }
      user = data || null;
    }

    const { data: identities, error: identitiesError } = await supabase!
      .from("userbase_identities")
      .select(
        "id, type, handle, address, external_id, is_primary, verified_at, metadata"
      )
      .eq("user_id", userId)
      .order("is_primary", { ascending: false });

    if (identitiesError) {
      console.error("Failed to fetch user identities:", {
        userId,
        error: identitiesError.message || identitiesError,
      });
      return NextResponse.json(
        { error: "Failed to fetch user identities" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user,
      identities: identities || [],
      match: matchedBy,
    });
  } catch (error) {
    console.error("Userbase profile lookup failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Update userbase profile (authenticated users only)
export async function PATCH(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    // Get session from cookie
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("userbase_refresh")?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("userbase_sessions")
      .select("user_id, expires_at")
      .eq("refresh_token_hash", hashToken(refreshToken))
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const userId = session.user_id;

    // Parse request body
    const body = await request.json();
    const { display_name, avatar_url, cover_url, bio, location, handle } = body;

    // Build update object with only provided fields
    const updateData: Record<string, string | null> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (cover_url !== undefined) updateData.cover_url = cover_url;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;

    // Handle uniqueness is enforced by database, attempt update
    if (handle !== undefined) {
      // Normalize handle
      const normalizedHandle = handle ? handle.trim().toLowerCase() : null;
      updateData.handle = normalizedHandle;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Update user profile
    const { data: updatedUser, error: updateError } = await supabase
      .from("userbase_users")
      .update(updateData)
      .eq("id", userId)
      .select(
        "id, handle, display_name, avatar_url, cover_url, bio, location, status, onboarding_step"
      )
      .single();

    if (updateError) {
      // Check for unique constraint violation on handle
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "Handle is already taken" },
          { status: 409 }
        );
      }
      console.error("Failed to update user profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Userbase profile update failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
