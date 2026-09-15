import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { APP_CONFIG, INVITE_CONFIG } from "@/config/app.config";
import { buildMagicLinkEmail } from "@/lib/email/magicLinkTemplate";
import { buildWelcomeEmail } from "@/lib/email/welcomeTemplate";
import { createTransport, fromAddress } from "@/lib/email/transport";
import { resolveSessionUserId } from "@/lib/userbase/session";
import { LRUCache } from "@/lib/utils/LRUCache";
import {
  createUserWithUniqueHandle,
  deriveDisplayName,
  getAvatarUrl,
  normalizeIdentifier,
} from "@/lib/userbase/accountProvisioning";
import { assessInviteQuota } from "@/lib/userbase/inviteQuota";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const MAGIC_LINK_TTL_MINUTES = 15;

/**
 * Per-IP burst counter. In-memory and therefore per-instance: a determined
 * sender on a warm pool slips past it. It is the cheap first swat, not the
 * control — that is the per-inviter count, which is read from the table and
 * so holds across every instance.
 *
 * The window is tracked in the value rather than left to the cache TTL, which
 * restamps on every write: under a steady trickle the entry would never expire
 * and whoever once hit the ceiling would stay locked out for good. The LRU is
 * here only to bound memory.
 */
const ipBurst = new LRUCache<string, { count: number; resetAt: number }>(5000);

const BURST_WINDOW_MS = INVITE_CONFIG.BURST_WINDOW_MINUTES * 60 * 1000;

/** Counts this request against the IP, returning true when over the ceiling. */
function overBurstLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipBurst.get(ip);
  const window =
    entry && entry.resetAt > now
      ? { count: entry.count + 1, resetAt: entry.resetAt }
      : { count: 1, resetAt: now + BURST_WINDOW_MS };
  ipBurst.set(ip, window);
  return window.count > INVITE_CONFIG.BURST_LIMIT_PER_IP;
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getBaseUrl(request: NextRequest) {
  if (APP_CONFIG.ORIGIN) return APP_CONFIG.ORIGIN;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * POST /api/userbase/invites
 *
 * Creates a lite Skatehive account for a friend and mails them a login link.
 *
 * Requires a signed-in sender. Before that requirement this was reachable by
 * anyone: the route picked the handle, so desirable names could be reserved in
 * bulk, and every call mailed a stranger on the platform's SMTP reputation.
 * The handle is now derived from the address rather than chosen by the sender,
 * which removes the squatting angle and leaves the real name to the friend,
 * who picks it when a sponsorship turns this into a Hive account.
 */
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const inviterId = await resolveSessionUserId(request, supabase);
  if (!inviterId) {
    return NextResponse.json(
      { error: "You need to be signed in to invite someone." },
      { status: 401 }
    );
  }

  let payload: Record<string, any>;
  try {
    payload = (await request.json()) as Record<string, any>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawEmail = payload?.email;
  if (!rawEmail || typeof rawEmail !== "string" || !isEmail(rawEmail.trim())) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    );
  }
  const identifier = normalizeIdentifier(rawEmail);

  // Burst check first: it costs nothing and sheds an obvious flood before we
  // touch the database.
  if (overBurstLimit(clientIp(request))) {
    return NextResponse.json(
      { error: "Too many invites from this connection. Try again later." },
      { status: 429 }
    );
  }

  const windowStart = new Date(
    Date.now() - INVITE_CONFIG.WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString();

  // head: true is deliberately not used here. A HEAD request carries no body,
  // so supabase-js has nothing to parse an error out of: against a missing
  // table it returns { error: null, count: null } with a 204, and the guard
  // below would wave the request through. The same query without head returns
  // a real 404 and a real error. limit(1) keeps the row cost at one; the count
  // is exact either way.
  const { count: sentToday, error: countError } = await supabase
    .from("userbase_invites")
    .select("id", { count: "exact" })
    .eq("inviter_user_id", inviterId)
    .gte("created_at", windowStart)
    .limit(1);

  const quota = assessInviteQuota(
    sentToday,
    countError,
    INVITE_CONFIG.DAILY_LIMIT_PER_INVITER
  );

  if (!quota.allow && quota.reason === "unavailable") {
    console.error("Invite rate-limit lookup failed:", countError);
    return NextResponse.json(
      { error: "Invites are unavailable right now. Try again later." },
      { status: 503 }
    );
  }

  if (!quota.allow) {
    return NextResponse.json(
      {
        error: `You have sent your ${quota.limit} invites for today. More tomorrow.`,
      },
      { status: 429 }
    );
  }

  // Someone already on Skatehive must not receive a login link because a third
  // party typed their address — that is a login-email flood with extra steps.
  const { data: existingAuth } = await supabase
    .from("userbase_auth_methods")
    .select("user_id")
    .eq("type", "email_magic")
    .eq("identifier", identifier)
    .limit(1);

  if (existingAuth?.[0]?.user_id) {
    return NextResponse.json({ success: true, already_member: true });
  }

  const displayName = deriveDisplayName(identifier);
  const createdUser = await createUserWithUniqueHandle(
    supabase,
    identifier.split("@")[0] || "skater",
    displayName,
    getAvatarUrl(identifier),
    { invited_by: inviterId }
  );

  if (!createdUser) {
    return NextResponse.json(
      { error: "Could not create the account. Try again." },
      { status: 500 }
    );
  }

  const { error: authError } = await supabase
    .from("userbase_auth_methods")
    .insert({
      user_id: createdUser.id,
      type: "email_magic",
      identifier,
      created_at: new Date().toISOString(),
    });

  if (authError) {
    await supabase.from("userbase_users").delete().eq("id", createdUser.id);
    console.error("Failed to attach invite auth method:", authError);
    return NextResponse.json(
      { error: "Could not create the account. Try again." },
      { status: 500 }
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const { error: tokenError } = await supabase
    .from("userbase_magic_links")
    .insert({
      user_id: createdUser.id,
      identifier,
      token_hash: crypto.createHash("sha256").update(token).digest("hex"),
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

  if (tokenError) {
    console.error("Failed to create invite magic link:", tokenError);
    return NextResponse.json(
      { error: "Could not send the invite. Try again." },
      { status: 500 }
    );
  }

  const link = new URL("/api/userbase/auth/magic-link", getBaseUrl(request));
  link.searchParams.set("token", token);

  // The quota slot is claimed before the send, not after it.
  //
  // This row is the only record the rate limit counts, and writing it
  // afterwards meant a failed write left mail already delivered and nothing
  // counted — and since every later request counted the same zero, one broken
  // insert turned the daily cap off for good. Reserving first inverts the
  // failure: if the row cannot be written, nothing is sent.
  //
  // The original intent — not charging a sender for an invite that bounced —
  // is preserved by releasing the row when the send fails, just below.
  const { data: reservation, error: reserveError } = await supabase
    .from("userbase_invites")
    .insert({
      inviter_user_id: inviterId,
      kind: "lite",
      invitee_email: identifier,
      invitee_user_id: createdUser.id,
    })
    .select("id")
    .single();

  if (reserveError || !reservation) {
    console.error("Failed to reserve invite quota:", reserveError);
    return NextResponse.json(
      { error: "Invites are unavailable right now. Try again later." },
      { status: 503 }
    );
  }

  try {
    const transporter = createTransport();
    const magic = buildMagicLinkEmail(link.toString());
    await transporter.sendMail({
      from: fromAddress(),
      to: identifier,
      subject: magic.subject,
      text: magic.text,
      html: magic.html,
    });

    // Best effort: the login link is already out, so a failed welcome must not
    // fail the invite.
    try {
      const welcome = buildWelcomeEmail({
        handle: createdUser.handle,
        displayName,
      });
      await transporter.sendMail({
        from: fromAddress(),
        to: identifier,
        subject: welcome.subject,
        text: welcome.text,
        html: welcome.html,
      });
    } catch (welcomeError) {
      console.error("Invite welcome email failed:", welcomeError);
    }
  } catch (mailError: any) {
    console.error(`Invite email to ${identifier} failed:`, mailError);
    // Nothing was delivered, so give the slot back. If this delete fails the
    // sender is one invite down for the day, which is the safe way to be wrong.
    const { error: releaseError } = await supabase
      .from("userbase_invites")
      .delete()
      .eq("id", reservation.id);
    if (releaseError) {
      console.error("Failed to release invite reservation:", releaseError);
    }
    return NextResponse.json(
      {
        error: "Could not send the invite email.",
        code: String(mailError?.code || "UNKNOWN"),
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    handle: createdUser.handle,
    expires_at: expiresAt,
  });
}
