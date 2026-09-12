import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverMailer from '@/lib/invite/route';
import { resolveSessionUserId } from '@/lib/userbase/session';

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
 * request would cost the inviter 3 HIVE and strand the keys. The Hive path
 * needs no rate limit for the same reason — the fee is the limit.
 *
 * Attribution comes from the session cookie, not the `createdby` field, which
 * the client supplies and could say anything.
 */
async function logHiveInvite(request: NextRequest, to: string, hiveUsername: string) {
    if (!supabase) return;
    try {
        const inviterId = await resolveSessionUserId(request, supabase);
        if (!inviterId) return;
        await supabase.from('userbase_invites').insert({
            inviter_user_id: inviterId,
            kind: 'hive',
            invitee_email: String(to).trim().toLowerCase(),
            hive_username: hiveUsername,
        });
    } catch (error) {
        console.error('Failed to log hive invite:', error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, subject, createdby, desiredUsername, masterPassword, keys, language } = body;
        const result = await serverMailer(to, subject, createdby, desiredUsername, masterPassword, keys, language);

        await logHiveInvite(req, to, desiredUsername);

        if (result.ok) {
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
