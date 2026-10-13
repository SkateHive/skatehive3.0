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
import { assessInviteReservation } from "@/lib/userbase/inviteQuota";

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
 *
 * A failed send leaves nothing behind, so the invite can just be sent again,
 * and a sender may re-send to their own invitee until that friend first signs
 * in — which also covers a login link that lapsed unopened.
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

  const { data: inviter, error: inviterError } = await supabase
    .from("userbase_users")
    .select("handle, display_name")
    .eq("id", inviterId)
    .maybeSingle();

  // A failed read is not a missing user: answering 401 would tell a signed-in
  // sender to sign in again.
  if (inviterError) {
    console.error("Invite inviter lookup failed:", inviterError);
    return NextResponse.json(
      { error: "Invites are unavailable right now. Try again later." },
      { status: 503 }
    );
  }

  if (!inviter?.handle) {
    return NextResponse.json(
      { error: "You need to be signed in to invite someone." },
      { status: 401 }
    );
  }

  // Someone already on Skatehive must not receive a login link because a third
  // party typed their address — that is a login-email flood with extra steps.
  // The one exception is this sender's own invitee who has never signed in:
  // their first mail bounced or the link lapsed, and sending it again is the
  // only way they get in.
  const { data: existingAuth, error: existingAuthError } = await supabase
    .from("userbase_auth_methods")
    .select("user_id")
    .eq("type", "email_magic")
    .eq("identifier", identifier)
    .limit(1);

  // Read as "no account", a failed lookup would go on to create a duplicate
  // user that the unique auth index then rejects.
  if (existingAuthError) {
    console.error("Invite existing-account lookup failed:", existingAuthError);
    return NextResponse.json(
      { error: "Invites are unavailable right now. Try again later." },
      { status: 503 }
    );
  }

  let invitee: { id: string; handle: string } | null = null;
  const existingUserId = existingAuth?.[0]?.user_id;
  if (existingUserId) {
    invitee = await findResendableInvitee(existingUserId, inviterId);
    if (!invitee) {
      return NextResponse.json({ success: true, already_member: true });
    }
  }

  // Count and claim in one step, inside the database. Counting here and
  // inserting later let concurrent requests all read the same count and all
  // pass; the RPC holds a per-inviter lock across both. A resend claims a slot
  // like any invite — otherwise it would be an uncapped mailer to one address.
  const { data: reserved, error: reserveError } = await supabase.rpc(
    "userbase_reserve_invite",
    {
      p_inviter: inviterId,
      p_invitee_email: identifier,
      p_invitee_user_id: invitee?.id ?? null,
      p_limit: INVITE_CONFIG.DAILY_LIMIT_PER_INVITER,
      p_window_hours: INVITE_CONFIG.WINDOW_HOURS,
    }
  );

  const quota = assessInviteReservation(
    reserved,
    reserveError,
    INVITE_CONFIG.DAILY_LIMIT_PER_INVITER
  );

  if (!quota.allow && quota.reason === "unavailable") {
    console.error("Invite quota reservation failed:", reserveError ?? reserved);
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

  const reservationId = quota.reservationId;
  let createdUserId: string | null = null;

  /**
   * Undoes everything this request made, so the invite can simply be sent
   * again. Leaving a half-made account behind used to be a dead end: the retry
   * found the address taken and answered "already a member" without mailing
   * anything. Deleting the user cascades to its auth method and magic links.
   * The quota slot goes back too — nothing was delivered.
   */
  const rollback = async () => {
    const { error: releaseError } = await supabase
      .from("userbase_invites")
      .delete()
      .eq("id", reservationId);
    if (releaseError) {
      // The sender is one invite down for the day: the safe way to be wrong.
      console.error("Failed to release invite reservation:", releaseError);
    }
    if (createdUserId) {
      const { error: userError } = await supabase
        .from("userbase_users")
        .delete()
        .eq("id", createdUserId);
      if (userError) {
        console.error("Failed to roll back invited account:", userError);
      }
    }
  };

  const failed = async (status: number, body: Record<string, string>) => {
    await rollback();
    return NextResponse.json(body, { status });
  };

  const displayName = deriveDisplayName(identifier);

  if (!invitee) {
    const createdUser = await createUserWithUniqueHandle(
      supabase,
      identifier.split("@")[0] || "skater",
      displayName,
      getAvatarUrl(identifier),
      { invited_by: inviterId }
    );

    if (!createdUser) {
      return failed(500, { error: "Could not create the account. Try again." });
    }
    createdUserId = createdUser.id;

    const { error: authError } = await supabase
      .from("userbase_auth_methods")
      .insert({
        user_id: createdUser.id,
        type: "email_magic",
        identifier,
        created_at: new Date().toISOString(),
      });

    if (authError) {
      console.error("Failed to attach invite auth method:", authError);
      return failed(500, { error: "Could not create the account. Try again." });
    }

    // Attribution only; the reservation already counts against the quota.
    const { error: linkError } = await supabase
      .from("userbase_invites")
      .update({ invitee_user_id: createdUser.id })
      .eq("id", reservationId);
    if (linkError) {
      console.error("Failed to link invite to its account:", linkError);
    }

    invitee = { id: createdUser.id, handle: createdUser.handle };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000
  ).toISOString();

  const { error: tokenError } = await supabase
    .from("userbase_magic_links")
    .insert({
      user_id: invitee.id,
      identifier,
      token_hash: crypto.createHash("sha256").update(token).digest("hex"),
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
    });

  if (tokenError) {
    console.error("Failed to create invite magic link:", tokenError);
    return failed(500, { error: "Could not send the invite. Try again." });
  }

  const link = new URL("/api/userbase/auth/magic-link", getBaseUrl(request));
  link.searchParams.set("token", token);

  const transporter = createTransport();
  try {
    const invite = buildMagicLinkEmail(link.toString(), {
      invitedBy: { handle: inviter.handle, displayName: inviter.display_name },
    });
    await transporter.sendMail({
      from: fromAddress(),
      to: identifier,
      subject: invite.subject,
      text: invite.text,
      html: invite.html,
    });
  } catch (mailError: any) {
    console.error(`Invite email to ${identifier} failed:`, mailError);
    return failed(502, {
      error: "Could not send the invite email. You can try again.",
      code: String(mailError?.code || "UNKNOWN"),
    });
  }

  // Best effort, and only once: the login link is already out, so a failed
  // welcome must not fail the invite, and a resend must not welcome twice.
  if (createdUserId) {
    try {
      const welcome = buildWelcomeEmail({ handle: invitee.handle, displayName });
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
  }

  return NextResponse.json({
    success: true,
    handle: invitee.handle,
    resent: createdUserId === null,
    expires_at: expiresAt,
  });
}

/**
 * The account behind an address, when it is one this sender invited and that
 * has never signed in — the only kind an invite may be sent to again. Anything
 * uncertain answers null, which the caller treats as "already a member": a
 * wrong yes would mail a login link to an active account on a stranger's word.
 */
async function findResendableInvitee(
  userId: string,
  inviterId: string
): Promise<{ id: string; handle: string } | null> {
  if (!supabase) return null;

  const { data: user, error } = await supabase
    .from("userbase_users")
    .select("id, handle, invited_by")
    .eq("id", userId)
    .maybeSingle();
  if (error || !user?.handle || user.invited_by !== inviterId) return null;

  const [signIns, sessions] = await Promise.all([
    supabase
      .from("userbase_magic_links")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .not("consumed_at", "is", null)
      .limit(1),
    supabase
      .from("userbase_sessions")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .limit(1),
  ]);
  if (signIns.error || sessions.error) return null;
  if (signIns.count !== 0 || sessions.count !== 0) return null;

  return { id: user.id, handle: user.handle };
}
