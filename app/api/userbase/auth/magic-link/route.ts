import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { APP_CONFIG, EMAIL_DEFAULTS } from '@/config/app.config';
import { checkHiveAccountExists } from '@/lib/utils/hiveAccountUtils';

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

const MAGIC_LINK_TTL_MINUTES = 15;
const SESSION_TTL_DAYS = 30;

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function deriveDisplayName(identifier: string) {
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

function getAvatarUrl(seed: string) {
  const safeSeed = encodeURIComponent(seed || "skatehive");
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${safeSeed}`;
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBaseUrl(request: NextRequest) {
  const origin = APP_CONFIG.ORIGIN;
  if (origin) {
    return origin;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function sanitizeRedirect(value: string | null) {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  if (value.includes('\\')) return '/';
  if (value.includes('://')) return '/';
  if (value.includes('\n') || value.includes('\r')) return '/';
  return value;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || EMAIL_DEFAULTS.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || String(EMAIL_DEFAULTS.SMTP_PORT), 10),
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : EMAIL_DEFAULTS.SMTP_SECURE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Atomically creates a user with a unique handle.
 * Instead of checking availability first (TOCTOU race), we attempt inserts
 * directly and catch unique constraint errors (23505) to retry with suffixes.
 */
async function createUserWithUniqueHandle(
  baseHandle: string,
  displayName: string,
  avatarUrl: string,
  maxAttempts = 7
): Promise<{ id: string; handle: string } | null> {
  const sanitized = slugify(baseHandle) || "skater";

  if (await checkHiveAccountExists(sanitized)) {
    // Avoid creating an app account handle that already exists on Hive
  } else {
  // First attempt: try the sanitized handle directly
  const { data: firstAttempt, error: firstError } = await supabase!
    .from("userbase_users")
    .insert({
      handle: sanitized,
      display_name: displayName,
      avatar_url: avatarUrl,
      status: "active",
      onboarding_step: 0,
    })
    .select("id, handle")
    .single();

  if (firstAttempt && !firstError) {
    return firstAttempt;
  }

  // If error is not a unique constraint violation, surface it
  if (firstError?.code !== "23505") {
    console.error("Failed to create user (non-unique error):", firstError);
    return null;
  }
  }

  // Retry with random suffixes
  for (let attempt = 0; attempt < maxAttempts - 1; attempt++) {
    const suffix = crypto.randomBytes(2).toString("hex");
    const candidate = `${sanitized}-${suffix}`;

    if (await checkHiveAccountExists(candidate)) {
      continue;
    }

    const { data, error } = await supabase!
      .from("userbase_users")
      .insert({
        handle: candidate,
        display_name: displayName,
        avatar_url: avatarUrl,
        status: "active",
        onboarding_step: 0,
      })
      .select("id, handle")
      .single();

    if (data && !error) {
      return data;
    }

    // If it's a unique constraint error, continue retrying
    if (error?.code === "23505") {
      continue;
    }

    // Non-unique error, bail out
    console.error("Failed to create user (non-unique error):", error);
    return null;
  }

  // All attempts exhausted
  console.error("Failed to create user: all handle attempts exhausted");
  return null;
}

/**
 * Atomically updates a user's handle if they don't have one.
 * Uses insert-retry pattern to avoid TOCTOU race.
 */
async function trySetUserHandle(
  userId: string,
  baseHandle: string,
  maxAttempts = 7
): Promise<string | null> {
  const sanitized = slugify(baseHandle) || "skater";

  if (!(await checkHiveAccountExists(sanitized))) {
  // First attempt: try the sanitized handle directly
  const { error: firstError } = await supabase!
    .from("userbase_users")
    .update({ handle: sanitized })
    .eq("id", userId)
    .is("handle", null); // Only update if handle is null

  if (!firstError) {
    // Verify the update worked (handle wasn't taken by concurrent request)
    const { data: check } = await supabase!
      .from("userbase_users")
      .select("handle")
      .eq("id", userId)
      .single();
    if (check?.handle === sanitized) {
      return sanitized;
    }
    // User already has a different handle set - return it
    if (check?.handle) {
      return check.handle;
    }
  }

  // If error is not a unique constraint violation, surface it
  if (firstError && firstError.code !== "23505") {
    console.error("Failed to update handle (non-unique error):", firstError);
    return null;
  }
  }

  // Retry with random suffixes
  for (let attempt = 0; attempt < maxAttempts - 1; attempt++) {
    const suffix = crypto.randomBytes(2).toString("hex");
    const candidate = `${sanitized}-${suffix}`;

    if (await checkHiveAccountExists(candidate)) {
      continue;
    }

    const { error } = await supabase!
      .from("userbase_users")
      .update({ handle: candidate })
      .eq("id", userId)
      .is("handle", null);

    if (!error) {
      const { data: check } = await supabase!
        .from("userbase_users")
        .select("handle")
        .eq("id", userId)
        .single();
      if (check?.handle === candidate) {
        return candidate;
      }
    }

    if (error?.code === "23505") {
      continue;
    }

    console.error("Failed to update handle (non-unique error):", error);
    return null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
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
    const rawIdentifier = payload?.identifier;
    const handle = payload?.handle
      ? String(payload.handle).trim().toLowerCase()
      : null;
    const avatarUrl =
      payload?.avatar_url && typeof payload.avatar_url === 'string'
        ? payload.avatar_url.trim()
        : null;
    const redirect = payload?.redirect ? String(payload.redirect) : null;

    if (!rawIdentifier || typeof rawIdentifier !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: identifier' },
        { status: 400 }
      );
    }

    const identifier = normalizeIdentifier(rawIdentifier);
    const slugifiedHandle = handle ? slugify(handle) : null;
    if (slugifiedHandle && (await checkHiveAccountExists(slugifiedHandle))) {
      return NextResponse.json(
        { error: 'Handle already in use on Hive' },
        { status: 409 }
      );
    }

    const { data: existingAuth } = await supabase
      .from('userbase_auth_methods')
      .select('id, user_id')
      .eq('type', 'email_magic')
      .eq('identifier', identifier)
      .limit(1);

    let userId = existingAuth?.[0]?.user_id ?? null;
    let createdUserId: string | null = null;

    if (!userId) {
      const baseHandle = handle
        ? slugify(handle)
        : identifier.split("@")[0] || "skater";
      const displayName = deriveDisplayName(identifier);
      const resolvedAvatar = avatarUrl || getAvatarUrl(baseHandle || identifier);

      // Use atomic insert with retry to avoid TOCTOU race
      const createdUser = await createUserWithUniqueHandle(
        baseHandle,
        displayName,
        resolvedAvatar
      );

      if (!createdUser) {
        return NextResponse.json(
          { error: 'Failed to create user: handle unavailable' },
          { status: 409 }
        );
      }

      userId = createdUser.id;
      createdUserId = createdUser.id;

      const { error: authError } = await supabase
        .from('userbase_auth_methods')
        .insert({
          user_id: userId,
          type: 'email_magic',
          identifier,
          created_at: new Date().toISOString(),
        });

      if (authError) {
        if (authError?.code === '23505') {
          return NextResponse.json(
            { error: 'Auth method already exists' },
            { status: 409 }
          );
        }
        console.error('Failed to create auth method:', authError);
        if (createdUserId) {
          await supabase.from('userbase_users').delete().eq('id', createdUserId);
        }
        return NextResponse.json(
          {
            error: 'Failed to create auth method',
            details:
              process.env.NODE_ENV !== 'production'
                ? authError?.message || authError
                : undefined,
          },
          { status: 500 }
        );
      }
    }

    if (userId) {
      const { data: existingUser } = await supabase
        .from('userbase_users')
        .select('id, handle, display_name, avatar_url')
        .eq('id', userId)
        .single();

      if (existingUser) {
        const updates: Record<string, string> = {};
        if (!existingUser.display_name) {
          updates.display_name = deriveDisplayName(identifier);
        }
        if (!existingUser.avatar_url) {
          updates.avatar_url = avatarUrl || getAvatarUrl(existingUser.handle || identifier);
        }

        // Handle update for existing users without a handle - use atomic approach
        if (!existingUser.handle) {
          const baseHandle = handle
            ? slugify(handle)
            : identifier.split("@")[0] || "skater";
          const newHandle = await trySetUserHandle(userId, baseHandle);
          // If handle was set via trySetUserHandle, remove from updates to avoid conflict
          if (newHandle) {
            delete updates.handle;
          }
        }

        // Apply non-handle updates if any remain
        if (Object.keys(updates).length > 0) {
          await supabase
            .from("userbase_users")
            .update(updates)
            .eq("id", userId);
        }
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { error: tokenError } = await supabase
      .from('userbase_magic_links')
      .insert({
        user_id: userId,
        identifier,
        token_hash: tokenHash,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

    if (tokenError) {
      console.error('Failed to create magic link token:', tokenError);
      return NextResponse.json(
        {
          error: 'Failed to create magic link',
          details:
            process.env.NODE_ENV !== 'production'
              ? tokenError?.message || tokenError
              : undefined,
        },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl(request);
    const redirectPath = sanitizeRedirect(redirect);
    const link = new URL('/api/userbase/auth/magic-link', baseUrl);
    link.searchParams.set('token', token);
    if (redirectPath && redirectPath !== '/') {
      link.searchParams.set('redirect', redirectPath);
    }

    const transporter = createTransport();
    await transporter.sendMail({
      from: process.env.EMAIL_USER || EMAIL_DEFAULTS.FROM_ADDRESS,
      to: identifier,
      subject: 'Your Skatehive login link',
      text: `Click to sign in: ${link.toString()}`,
      html: `<p>Click to sign in:</p><p><a href="${link.toString()}">${link.toString()}</a></p>`,
    });

    return NextResponse.json({
      success: true,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Magic link request error:', error);
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

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const redirect = sanitizeRedirect(searchParams.get('redirect'));

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // First, get the token to retrieve user_id (needed for session creation)
    const { data: tokenRow, error: tokenError } = await supabase
      .from('userbase_magic_links')
      .select('id, user_id, expires_at')
      .eq('token_hash', tokenHash)
      .is('consumed_at', null)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        {
          error: 'Invalid or expired token',
          details:
            process.env.NODE_ENV !== 'production'
              ? tokenError?.message || tokenError
              : undefined,
        },
        { status: 401 }
      );
    }

    // Atomic conditional update: only consume if still valid and not already consumed
    // This prevents TOCTOU race between expiry check and consumption
    const consumedAt = new Date().toISOString();
    const { data: consumeResult, error: consumeError } = await supabase
      .from('userbase_magic_links')
      .update({ consumed_at: consumedAt })
      .eq('id', tokenRow.id)
      .is('consumed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('id');

    if (consumeError) {
      console.error('Failed to consume magic link:', consumeError);
      return NextResponse.json(
        {
          error: 'Failed to consume token',
          details:
            process.env.NODE_ENV !== 'production'
              ? consumeError?.message || consumeError
              : undefined,
        },
        { status: 500 }
      );
    }

    // Check if exactly one row was updated (atomic verification)
    if (!consumeResult || consumeResult.length === 0) {
      // Token was either already consumed or expired between fetch and update
      return NextResponse.json(
        { error: 'Token has expired or was already used' },
        { status: 401 }
      );
    }

    const refreshToken = crypto.randomUUID();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const userAgent = request.headers.get('user-agent') || null;

    const { error: sessionError } = await supabase
      .from('userbase_sessions')
      .insert({
        user_id: tokenRow.user_id,
        refresh_token_hash: refreshTokenHash,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
        user_agent: userAgent,
      });

    if (sessionError) {
      console.error('Failed to create session:', sessionError);
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

    const response = NextResponse.redirect(
      new URL(redirect, getBaseUrl(request))
    );
    response.cookies.set('userbase_refresh', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Magic link verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
