import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

const SESSION_TTL_DAYS = 30;

function requireInternalToken(request: NextRequest) {
  const requiredToken = process.env.USERBASE_INTERNAL_TOKEN;

  if (!requiredToken) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'USERBASE_INTERNAL_TOKEN is required in production' },
        { status: 500 }
      );
    }
    return null;
  }

  const providedToken = request.headers.get('x-userbase-internal-token') || '';
  const requiredBuffer = Buffer.from(requiredToken);
  const providedBuffer = Buffer.from(providedToken);

  if (
    providedBuffer.length !== requiredBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, requiredBuffer)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function deriveDisplayName(identifier: string | null, handle: string | null) {
  if (handle) {
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }
  if (!identifier) return "Skater";
  const local = identifier.split("@")[0] || "";
  const words = local
    .replace(/[_\-.]+/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (words.length === 0) {
    return "Skater";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getAvatarUrl(seed: string | null) {
  const safeSeed = encodeURIComponent(seed || "skatehive");
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${safeSeed}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const authError = requireInternalToken(request);
    if (authError) {
      return authError;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    const payload = body as Record<string, any>;
    const type = payload?.type ?? 'email_magic';
    const rawIdentifier = payload?.identifier;
    const handle = payload?.handle
      ? String(payload.handle).trim().toLowerCase()
      : null;
    const deviceId = payload?.device_id ? String(payload.device_id) : null;
    const userAgent = payload?.user_agent || request.headers.get('user-agent') || null;
    const createUser = payload?.create_user !== false;

    if (!rawIdentifier || typeof rawIdentifier !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: identifier' },
        { status: 400 }
      );
    }

    if (type !== 'email_magic') {
      return NextResponse.json(
        { error: 'Unsupported auth method type' },
        { status: 400 }
      );
    }

    const identifier = normalizeIdentifier(rawIdentifier);

    const { data: existingAuthMethods, error: authLookupError } = await supabase
      .from('userbase_auth_methods')
      .select('id, user_id')
      .eq('type', type)
      .eq('identifier', identifier)
      .limit(1);

    if (authLookupError) {
      console.error('Auth method lookup failed:', authLookupError);
      return NextResponse.json(
        {
          error: 'Failed to lookup auth method',
          details:
            process.env.NODE_ENV !== 'production'
              ? authLookupError?.message || authLookupError
              : undefined,
        },
        { status: 500 }
      );
    }

    let authMethodId = existingAuthMethods?.[0]?.id ?? null;
    let userId = existingAuthMethods?.[0]?.user_id ?? null;

    if (!userId) {
      if (!createUser) {
        return NextResponse.json(
          { error: 'User not found for identifier' },
          { status: 404 }
        );
      }

      const { data: userData, error: userInsertError } = await supabase
        .from('userbase_users')
        .insert({
          handle,
          status: 'active',
          onboarding_step: 0,
        })
        .select('id')
        .single();

      if (userInsertError || !userData) {
        console.error('User creation failed:', userInsertError);
        return NextResponse.json(
          {
            error: 'Failed to create user',
            details:
              process.env.NODE_ENV !== 'production'
                ? userInsertError?.message || userInsertError
                : undefined,
          },
          { status: 500 }
        );
      }

      userId = userData.id;

      const { data: authMethodData, error: authInsertError } = await supabase
        .from('userbase_auth_methods')
        .insert({
          user_id: userId,
          type,
          identifier,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (authInsertError || !authMethodData) {
        console.error('Auth method creation failed:', authInsertError);
        await supabase.from('userbase_users').delete().eq('id', userId);
        return NextResponse.json(
          {
            error: 'Failed to create auth method',
            details:
              process.env.NODE_ENV !== 'production'
                ? authInsertError?.message || authInsertError
                : undefined,
          },
          { status: 500 }
        );
      }

      authMethodId = authMethodData.id;
    }

    const refreshToken = crypto.randomUUID();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { error: sessionError } = await supabase
      .from('userbase_sessions')
      .insert({
        user_id: userId,
        refresh_token_hash: refreshTokenHash,
        device_id: deviceId,
        user_agent: userAgent,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

    if (sessionError) {
      console.error('Session creation failed:', sessionError);
      return NextResponse.json(
        {
          error: 'Failed to create session',
          details:
            process.env.NODE_ENV !== 'production'
              ? sessionError?.message || sessionError
              : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user_id: userId,
      auth_method_id: authMethodId,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Userbase auth session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const token = request.cookies.get('userbase_refresh')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing session token' },
        { status: 401 }
      );
    }

    const refreshTokenHash = hashToken(token);

    const { data: sessionRows, error: sessionError } = await supabase
      .from('userbase_sessions')
      .select('id, user_id, expires_at, revoked_at, userbase_users(id, handle, display_name, avatar_url, bio, status, onboarding_step, created_at)')
      .eq('refresh_token_hash', refreshTokenHash)
      .is('revoked_at', null)
      .limit(1);

    if (sessionError) {
      console.error('Session lookup failed:', sessionError);
      return NextResponse.json(
        {
          error: 'Failed to validate session',
          details:
            process.env.NODE_ENV !== 'production'
              ? sessionError?.message || sessionError
              : undefined,
        },
        { status: 500 }
      );
    }

    const session = sessionRows?.[0];
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    // userbase_users is returned as an array from the join, take the first element
    const userbaseUsers = session.userbase_users;
    let user = Array.isArray(userbaseUsers) ? userbaseUsers[0] ?? null : userbaseUsers ?? null;
    if (user && (!user.display_name || !user.avatar_url)) {
      const { data: authRows } = await supabase
        .from("userbase_auth_methods")
        .select("identifier")
        .eq("user_id", user.id)
        .eq("type", "email_magic")
        .limit(1);
      const identifier = authRows?.[0]?.identifier || null;
      const updates: Record<string, any> = {};

      if (!user.display_name) {
        updates.display_name = deriveDisplayName(identifier, user.handle || null);
      }
      if (!user.avatar_url) {
        updates.avatar_url = getAvatarUrl(user.handle || identifier);
      }

      if (Object.keys(updates).length > 0) {
        const { data: updatedUser } = await supabase
          .from("userbase_users")
          .update(updates)
          .eq("id", user.id)
          .select("id, handle, display_name, avatar_url, bio, status, onboarding_step, created_at")
          .single();
        if (updatedUser) {
          user = updatedUser;
        }
      }
    }

    return NextResponse.json({
      user_id: session.user_id,
      session_id: session.id,
      expires_at: session.expires_at,
      user,
    });
  } catch (error) {
    console.error('Userbase session validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
