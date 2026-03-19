import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/pinata/webhook
 *
 * Receives events from Pinata (file.pinned, file.unpinned, etc.)
 *
 * Setup:
 *  1. Go to Pinata dashboard → Webhooks → Add endpoint
 *  2. URL: https://skatehive.app/api/pinata/webhook
 *  3. Events: file.pinned (minimum)
 *  4. Copy the signing secret → PINATA_WEBHOOK_SECRET env var
 *
 * Pinata uses Svix for webhook delivery. Signatures are in headers:
 *   svix-id, svix-timestamp, svix-signature
 *
 * Current behavior: logs events. Extend with Hive post indexing as needed.
 */

interface PinataWebhookPayload {
    event: string;
    data: {
        id?: string;
        cid?: string;
        name?: string;
        size?: number;
        keyvalues?: Record<string, string>;
        group_id?: string;
        created_at?: string;
    };
}

async function verifySignature(
    body: string,
    headers: Headers,
    secret: string
): Promise<boolean> {
    try {
        const svixId = headers.get('svix-id') ?? '';
        const svixTimestamp = headers.get('svix-timestamp') ?? '';
        const svixSignature = headers.get('svix-signature') ?? '';

        if (!svixId || !svixTimestamp || !svixSignature) return false;

        // Svix signed content: "{svix-id}.{svix-timestamp}.{body}"
        const signedContent = `${svixId}.${svixTimestamp}.${body}`;

        // Decode the base64 secret (Svix secrets are prefixed with "whsec_")
        const secretBytes = Uint8Array.from(
            atob(secret.replace(/^whsec_/, '')),
            (c) => c.charCodeAt(0)
        );

        const key = await crypto.subtle.importKey(
            'raw',
            secretBytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const sig = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(signedContent)
        );

        const computedSig = 'v1,' + btoa(String.fromCharCode(...new Uint8Array(sig)));

        // svix-signature may contain multiple space-separated signatures
        const receivedSigs = svixSignature.split(' ');
        return receivedSigs.some((s) => s === computedSig);
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    const body = await request.text();
    const webhookSecret = process.env.PINATA_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (webhookSecret) {
        const valid = await verifySignature(body, request.headers, webhookSecret);
        if (!valid) {
            console.warn('⚠️ Pinata webhook: invalid signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
    }

    let payload: PinataWebhookPayload;
    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { event, data } = payload;
    const kv = data.keyvalues ?? {};

    console.log(`📡 Pinata webhook: ${event}`, {
        cid: data.cid,
        name: data.name,
        size: data.size,
        source: kv.source,
        creator: kv.creator,
        fileType: kv.fileType,
        groupId: data.group_id,
    });

    switch (event) {
        case 'file.pinned': {
            // File successfully pinned — extend here to:
            //  - Update Hive post metadata with confirmed IPFS CID
            //  - Index file in your database (creator → CID mapping)
            //  - Notify the user their upload is confirmed
            console.log(`✅ File pinned: ${data.cid} by ${kv.creator ?? 'unknown'} (${kv.source ?? 'unknown source'})`);
            break;
        }
        case 'file.unpinned': {
            console.log(`🗑️ File unpinned: ${data.cid}`);
            break;
        }
        default: {
            console.log(`ℹ️ Unhandled Pinata event: ${event}`);
        }
    }

    // Always return 200 — Pinata will retry on non-2xx responses
    return NextResponse.json({ received: true });
}
