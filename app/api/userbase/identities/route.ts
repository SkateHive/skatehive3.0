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

function normalizeHandle(handle: string | null) {
  if (!handle) return null;
  return handle.trim().toLowerCase();
}

function normalizeAddress(address: string | null) {
  if (!address) return null;
  return address.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  const { data, error } = await supabase!
    .from("userbase_identities")
    .select(
      "id, type, handle, address, external_id, is_primary, verified_at, metadata, created_at"
    )
    .eq("user_id", session.userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch identities:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch identities",
        details:
          process.env.NODE_ENV !== "production"
            ? error?.message || error
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ identities: data || [] });
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
  const type = body?.type;

  if (!type || typeof type !== "string") {
    return NextResponse.json(
      { error: "Missing identity type" },
      { status: 400 }
    );
  }

  if (type !== "farcaster") {
    return NextResponse.json(
      { error: "Unsupported identity type" },
      { status: 400 }
    );
  }

  const handle = normalizeHandle(
    typeof body?.handle === "string" ? body.handle : null
  );
  const externalId =
    body?.external_id !== undefined && body?.external_id !== null
      ? String(body.external_id)
      : null;
  const address = normalizeAddress(
    typeof body?.address === "string" ? body.address : null
  );
  const metadata =
    body?.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (type === "farcaster" && !externalId) {
    return NextResponse.json(
      { error: "Farcaster fid is required" },
      { status: 400 }
    );
  }

  const identifierField = "external_id";
  const identifierValue = externalId;

  // First check if identity already exists for current user
  const { data: existingForUser } = await supabase!
    .from("userbase_identities")
    .select("id, user_id, type, handle, address, external_id, is_primary")
    .eq("type", type)
    .eq(identifierField, identifierValue)
    .eq("user_id", session.userId)
    .limit(1);

  if (existingForUser?.[0]) {
    return NextResponse.json({ identity: existingForUser[0] });
  }

  // Check if identity exists for a DIFFERENT user (requires merge)
  const { data: existingForOther } = await supabase!
    .from("userbase_identities")
    .select("id, user_id, type, handle, address, external_id, is_primary")
    .eq("type", type)
    .eq(identifierField, identifierValue)
    .neq("user_id", session.userId)
    .limit(1);

  if (existingForOther?.[0]) {
    return NextResponse.json(
      {
        error: "Farcaster identity already linked elsewhere",
        merge_required: true,
        existing_user_id: existingForOther[0].user_id,
        existing_identity: existingForOther[0],
      },
      { status: 409 }
    );
  }

  const { data: existingType } = await supabase!
    .from("userbase_identities")
    .select("id")
    .eq("user_id", session.userId)
    .eq("type", type)
    .limit(1);

  const isPrimary =
    typeof body?.is_primary === "boolean"
      ? body.is_primary
      : !existingType || existingType.length === 0;

  const { data: inserted, error: insertError } = await supabase!
    .from("userbase_identities")
    .insert({
      user_id: session.userId,
      type,
      handle,
      address,
      external_id: externalId,
      is_primary: isPrimary,
      verified_at: new Date().toISOString(),
      metadata,
    })
    .select(
      "id, user_id, type, handle, address, external_id, is_primary, verified_at, metadata"
    )
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "Identity already exists" },
        { status: 409 }
      );
    }
    console.error("Failed to create identity:", insertError);
    return NextResponse.json(
      {
        error: "Failed to create identity",
        details:
          process.env.NODE_ENV !== "production"
            ? insertError?.message || insertError
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ identity: inserted });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) {
    return session.error;
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;

  if (!id) {
    return NextResponse.json(
      { error: "Missing identity id" },
      { status: 400 }
    );
  }

  const { data: identity, error: fetchError } = await supabase!
    .from("userbase_identities")
    .select("id, user_id, type")
    .eq("id", id)
    .limit(1)
    .single();

  if (fetchError || !identity) {
    return NextResponse.json(
      { error: "Identity not found" },
      { status: 404 }
    );
  }

  if (identity.user_id !== session.userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { error: deleteError } = await supabase!
    .from("userbase_identities")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Failed to delete identity:", deleteError);
    return NextResponse.json(
      {
        error: "Failed to delete identity",
        details:
          process.env.NODE_ENV !== "production"
            ? deleteError?.message || deleteError
            : undefined,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
