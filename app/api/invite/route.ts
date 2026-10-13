import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverMailer from '@/lib/invite/route';
import { resolveSessionUserId } from '@/lib/userbase/session';
import { validateAccountName } from '@/lib/invite/helpers';
import { verifyInviteClaim } from '@/lib/invite/verifyNewAccount';
import { createRateLimiter, getClientIP } from '@/lib/utils/rate-limiter';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
    supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
        : null;

/**
 * Record who paid for this Hive account.
 *
 * Deliberately best-effort and never a gate: by the time this route runs the
 * account is already on chain and the fee is spent, so refusing an unsigned
 * request would cost the inviter 3 HIVE and strand the keys. The fee is what
 * limits the mail; the per-IP limiter below only guards the chain lookup.
 *
 * Attribution comes from the session cookie, not the `createdby` field, which
 * the client supplies and could say anything.
 */
async function logHiveInvite(request: NextRequest, to: string, hiveUsername: string) {
    if (!supabase) return;
    try {
        const inviterId = await resolveSessionUserId(request, supabase);
        if (!inviterId) return;
        // One row per account, however many times the mail is retried. A resend
        // after fixing a mistyped address overwrites it, so the row holds the
        // address that actually received the keys.
        const { error } = await supabase.from('userbase_invites').upsert(
            {
                inviter_user_id: inviterId,
                kind: 'hive',
                invitee_email: String(to).trim().toLowerCase(),
                hive_username: hiveUsername,
            },
            { onConflict: 'hive_username' }
        );
        if (error) console.error('Failed to log hive invite:', error);
    } catch (error) {
        console.error('Failed to log hive invite:', error);
    }
}

// Waiting out block propagation in verifyInviteClaim takes up to ~12s.
export const maxDuration = 30;

// The fee limits mail, not verification: an account name that is not on chain
// holds the function for ~12s and costs five RPC calls, unauthenticated. A real
// inviter needs one send plus the odd resend. Per-instance, so a speed bump.
const claimLimiter = createRateLimiter({
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keyPrefix: 'hive-invite',
});

const CLAIM_ERRORS = {
    not_found: { status: 404, error: 'That account is not on chain yet.' },
    key_mismatch: { status: 403, error: 'Those credentials do not belong to that account.' },
    too_old: { status: 403, error: 'Invite emails can only be sent for newly created accounts.' },
} as const;

function isEmail(value: unknown): value is string {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, desiredUsername, masterPassword, language } = body ?? {};

        if (!isEmail(to)) {
            return NextResponse.json({ success: false, error: 'A valid email address is required.' }, { status: 400 });
        }
        if (validateAccountName(String(desiredUsername ?? '')) !== null
            || typeof masterPassword !== 'string' || !masterPassword) {
            return NextResponse.json({ success: false, error: 'Invalid account details.' }, { status: 400 });
        }

        if (!claimLimiter.check(getClientIP(req)).allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests. Try again later.' },
                { status: 429 }
            );
        }

        // The only proof this route accepts. Creator and keys come back from the
        // chain and from derivation; the request's own `createdby`, `keys` and
        // `subject` are ignored, since they are interpolated into the email.
        const claim = await verifyInviteClaim(desiredUsername, masterPassword);
        if (!claim.ok) {
            const { status, error } = CLAIM_ERRORS[claim.reason];
            return NextResponse.json({ success: false, error, code: claim.reason }, { status });
        }

        const result = await serverMailer(
            to.trim(),
            `Welcome to Skatehive @${desiredUsername}`,
            claim.createdBy,
            desiredUsername,
            masterPassword,
            claim.keys,
            typeof language === 'string' ? language : 'EN'
        );

        if (result.ok) {
            await logHiveInvite(req, to, desiredUsername);
            return NextResponse.json({ success: true });
        }
        // The account is already on chain by the time we get here, so the client
        // needs to know the send failed in order to surface the keys itself.
        return NextResponse.json(
            { success: false, error: 'Failed to send email.', code: result.code },
            { status: 500 }
        );
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error?.message || 'Unknown error.' }, { status: 500 });
    }
}
