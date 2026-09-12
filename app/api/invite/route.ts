import { NextRequest, NextResponse } from 'next/server';
import serverMailer from '@/lib/invite/route';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { to, subject, createdby, desiredUsername, masterPassword, keys, language } = body;
        const result = await serverMailer(to, subject, createdby, desiredUsername, masterPassword, keys, language);
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
