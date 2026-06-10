import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { APP_CONFIG, EMAIL_DEFAULTS } from "@/config/app.config";
import { checkHiveAccountExists, validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";

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

const MAGIC_LINK_TTL_MINUTES = 15;

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function normalizeHandle(handle: string | null) {
  if (!handle) return null;
  return handle.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
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
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  if (value.includes("://")) return "/";
  if (value.includes("\n") || value.includes("\r")) return "/";
  return value;
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || EMAIL_DEFAULTS.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || String(EMAIL_DEFAULTS.SMTP_PORT), 10),
    secure:
      process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === "true"
        : EMAIL_DEFAULTS.SMTP_SECURE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function getAvatarUrl(seed: string) {
  const safeSeed = encodeURIComponent(seed || "skatehive");
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${safeSeed}`;
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
    const rawEmail = payload?.email;
    const rawDisplayName = payload?.display_name;
    const rawHandle = payload?.handle;
    const redirect = payload?.redirect ? String(payload.redirect) : null;

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "Missing required field: email" },
        { status: 400 }
      );
    }

    if (!rawDisplayName || typeof rawDisplayName !== "string") {
      return NextResponse.json(
        { error: "Missing required field: display_name" },
        { status: 400 }
      );
    }

    const identifier = normalizeIdentifier(rawEmail);
    const displayName = rawDisplayName.trim();
    const handle = normalizeHandle(
      typeof rawHandle === "string" ? rawHandle : null
    );

    if (!handle) {
      return NextResponse.json(
        { error: "Missing required field: handle" },
        { status: 400 }
      );
    }

    const handleValidation = validateHiveUsernameFormat(handle);
    if (!handleValidation.isValid) {
      return NextResponse.json(
        { error: handleValidation.error || "Invalid Hive username format" },
        { status: 400 }
      );
    }

    if (await checkHiveAccountExists(handle)) {
      return NextResponse.json(
        { error: "Handle already in use on Hive" },
        { status: 409 }
      );
    }
    const avatarUrl =
      typeof payload?.avatar_url === "string" && payload.avatar_url.trim()
        ? payload.avatar_url.trim()
        : getAvatarUrl(handle || displayName || identifier);

    const { data: existingAuth } = await supabase
      .from("userbase_auth_methods")
      .select("id, user_id")
      .eq("type", "email_magic")
      .eq("identifier", identifier)
      .limit(1);

    let userId = existingAuth?.[0]?.user_id ?? null;
    let createdUserId: string | null = null;

    if (!userId) {
      const { data: createdUser, error: userError } = await supabase
        .from("userbase_users")
        .insert({
          handle,
          display_name: displayName,
          avatar_url: avatarUrl,
          status: "active",
          onboarding_step: 0,
        })
        .select("id")
        .single();

      if (userError || !createdUser) {
        if (userError?.code === "23505") {
          return NextResponse.json(
            { error: "Handle already in use" },
            { status: 409 }
          );
        }
        console.error("Failed to create userbase user:", userError);
        return NextResponse.json(
          {
            error: "Failed to create user",
            details:
              process.env.NODE_ENV !== "production"
                ? userError?.message || userError
                : undefined,
          },
          { status: 500 }
        );
      }

      userId = createdUser.id;
      createdUserId = createdUser.id;

      const { error: authError } = await supabase
        .from("userbase_auth_methods")
        .insert({
          user_id: userId,
          type: "email_magic",
          identifier,
          created_at: new Date().toISOString(),
        });

      if (authError) {
        if (authError?.code === "23505") {
          return NextResponse.json(
            { error: "Auth method already exists" },
            { status: 409 }
          );
        }
        console.error("Failed to create auth method:", authError);
        if (createdUserId) {
          await supabase.from("userbase_users").delete().eq("id", createdUserId);
        }
        return NextResponse.json(
          {
            error: "Failed to create auth method",
            details:
              process.env.NODE_ENV !== "production"
                ? authError?.message || authError
                : undefined,
          },
          { status: 500 }
        );
      }
    } else {
      const { data: existingUser } = await supabase
        .from("userbase_users")
        .select("id, handle, display_name, avatar_url")
        .eq("id", userId)
        .single();

      if (existingUser) {
        const updates: Record<string, any> = {};
        if (!existingUser.display_name && displayName) {
          updates.display_name = displayName;
        }
        if (!existingUser.avatar_url && avatarUrl) {
          updates.avatar_url = avatarUrl;
        }
        if (!existingUser.handle && handle) {
          const existingHandleValidation = validateHiveUsernameFormat(handle);
          if (!existingHandleValidation.isValid) {
            return NextResponse.json(
              { error: existingHandleValidation.error || "Invalid Hive username format" },
              { status: 400 }
            );
          }
          if (await checkHiveAccountExists(handle)) {
            return NextResponse.json(
              { error: "Handle already in use on Hive" },
              { status: 409 }
            );
          }
          updates.handle = handle;
        }
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabase
            .from("userbase_users")
            .update(updates)
            .eq("id", userId);

          if (updateError?.code === "23505") {
            return NextResponse.json(
              { error: "Handle already in use" },
              { status: 409 }
            );
          }
          if (updateError) {
            console.error("Failed to update user:", updateError);
            // Continue anyway - user already exists, this is best-effort
          }
        }
      }
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { error: tokenError } = await supabase
      .from("userbase_magic_links")
      .insert({
        user_id: userId,
        identifier,
        token_hash: tokenHash,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      });

    if (tokenError) {
      console.error("Failed to create magic link token:", tokenError);
      return NextResponse.json(
        {
          error: "Failed to create magic link",
          details:
            process.env.NODE_ENV !== "production"
              ? tokenError?.message || tokenError
              : undefined,
        },
        { status: 500 }
      );
    }

    const baseUrl = getBaseUrl(request);
    const redirectPath = sanitizeRedirect(redirect);
    const link = new URL("/api/userbase/auth/magic-link", baseUrl);
    link.searchParams.set("token", token);
    if (redirectPath && redirectPath !== "/") {
      link.searchParams.set("redirect", redirectPath);
    }

    const transporter = createTransport();
    await transporter.sendMail({
      from: process.env.EMAIL_USER || EMAIL_DEFAULTS.FROM_ADDRESS,
      to: identifier,
      subject: "Your Skatehive login link",
      text: `Click to sign in: ${link.toString()}`,
      html: `<p>Click to sign in:</p><p><a href="${link.toString()}">${link.toString()}</a></p>`,
    });

    return NextResponse.json({
      success: true,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error("Sign up request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
