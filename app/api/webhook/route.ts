import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const headers = Object.fromEntries(request.headers.entries());
    let body;
    try {
      body = await request.json();
    } catch (err) {
      console.warn('[FARCASTER WEBHOOK] Invalid JSON:', err);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Validate Farcaster payload structure
    if (!body || typeof body.payload !== 'string') {
      console.warn('[FARCASTER WEBHOOK] Invalid Farcaster payload:', body);
      return NextResponse.json({ error: 'Invalid Farcaster webhook format' }, { status: 400 });
    }

    // Decode base64 payload
    let decodedPayload;
    try {
      const jsonStr = Buffer.from(body.payload, 'base64').toString('utf8');
      decodedPayload = JSON.parse(jsonStr);
    } catch (err) {
      console.warn('[FARCASTER WEBHOOK] Failed to decode payload:', err, body.payload);
      return NextResponse.json({ error: 'Failed to decode Farcaster payload' }, { status: 400 });
    }

    // Validate event
    if (!decodedPayload || typeof decodedPayload.event !== 'string') {
      console.warn('[FARCASTER WEBHOOK] Invalid decoded payload:', decodedPayload);
      return NextResponse.json({ error: 'Invalid event in Farcaster payload' }, { status: 400 });
    }

    // Verify Farcaster signature before processing
    try {
      const { verifyFarcasterSignature } = await import('@/lib/farcaster/token-store');
      const isValid = await verifyFarcasterSignature({
        header: body.header,
        payload: body.payload,
        signature: body.signature
      });
      if (!isValid) {
        console.warn('[FARCASTER WEBHOOK] Invalid Farcaster signature:', body);
        return NextResponse.json({ error: 'Invalid Farcaster signature' }, { status: 401 });
      }
    } catch (err) {
      console.error('[FARCASTER WEBHOOK] Signature verification error:', err);
      return NextResponse.json({ error: 'Signature verification error' }, { status: 500 });
    }

    // Detailed logging for debugging webhook delivery
    console.log('[FARCASTER WEBHOOK] Received event:', {
      event: decodedPayload.event,
      payload: decodedPayload,
      headers,
      raw: body
    });

    // Handle different webhook events
    switch (decodedPayload.event) {
      case 'frame_added':
      case 'notifications_enabled': {
        // Store Farcaster token and notification URL in DB
        const notificationDetails = decodedPayload.notificationDetails;
        let fid = null;
        let username = null;
        try {
          const headerJson = JSON.parse(Buffer.from(body.header, 'base64').toString('utf8'));
          fid = headerJson.fid || null;
          username = headerJson.username || null;
        } catch (err) {
          console.warn('[FARCASTER WEBHOOK] Failed to decode header for FID/username:', err);
        }
        let dbSuccess = false;
        let dbError = null;
        if (notificationDetails && notificationDetails.token && notificationDetails.url) {
          try {
            const { getTokenStore } = await import('@/lib/farcaster/token-store-factory');
            const tokenStore = getTokenStore();
            // Deduplicate: check if token already exists for this FID
            const existingToken = tokenStore.getTokenByFid ? await tokenStore.getTokenByFid(fid || '') : null;
            if (!existingToken || existingToken.token !== notificationDetails.token) {
              await tokenStore.addToken(
                fid || '',
                username || '',
                notificationDetails.token,
                notificationDetails.url
              );
              dbSuccess = true;
              console.log('[FARCASTER WEBHOOK] Stored token for user:', { fid, username, notificationDetails });
            } else {
              dbSuccess = true;
              console.log('[FARCASTER WEBHOOK] Token already exists for FID:', fid);
            }
          } catch (err) {
            dbError = err instanceof Error ? err.message : String(err);
            console.error('[FARCASTER WEBHOOK] DB error:', dbError);
          }
        } else {
          dbError = 'Missing notificationDetails';
          console.warn('[FARCASTER WEBHOOK] Missing notificationDetails for event:', decodedPayload);
        }
        // Log event in farcaster_notification_logs
        try {
          const { Pool } = await import('pg');
          const pool = new Pool({ connectionString: process.env.STORAGE_POSTGRES_URL || process.env.POSTGRES_URL });
          await pool.query(
            `INSERT INTO farcaster_notification_logs (fid, notification_type, title, body, target_url, success, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              fid || '',
              decodedPayload.event,
              notificationDetails?.token || '',
              JSON.stringify(decodedPayload),
              notificationDetails?.url || '',
              dbSuccess,
              dbError
            ]
          );
        } catch (err) {
          console.warn('[FARCASTER WEBHOOK] Failed to log event:', err);
        }
        break;
      }
      case 'frame_removed': {
        // Remove user's token from DB
        let fid = null;
        try {
          const headerJson = JSON.parse(Buffer.from(body.header, 'base64').toString('utf8'));
          fid = headerJson.fid || null;
        } catch (err) {
          console.warn('[FARCASTER WEBHOOK] Failed to decode header for FID:', err);
        }
        if (fid) {
          const { getTokenStore } = await import('@/lib/farcaster/token-store-factory');
          const tokenStore = getTokenStore();
          await tokenStore.removeToken(fid);
          console.log('[FARCASTER WEBHOOK] Removed token for FID:', fid);
        }
        console.log('[FARCASTER WEBHOOK] User removed Mini App:', decodedPayload);
        break;
      }
      case 'notifications_disabled': {
        // Disable user's notifications in DB
        let fid = null;
        try {
          const headerJson = JSON.parse(Buffer.from(body.header, 'base64').toString('utf8'));
          fid = headerJson.fid || null;
        } catch (err) {
          console.warn('[FARCASTER WEBHOOK] Failed to decode header for FID:', err);
        }
        if (fid) {
          const { getTokenStore } = await import('@/lib/farcaster/token-store-factory');
          const tokenStore = getTokenStore();
          await tokenStore.disableNotifications(fid);
          console.log('[FARCASTER WEBHOOK] Disabled notifications for FID:', fid);
        }
        console.log('[FARCASTER WEBHOOK] Notifications disabled:', decodedPayload);
        break;
      }
      default:
        console.log('[FARCASTER WEBHOOK] Unknown event:', decodedPayload.event, decodedPayload);
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'Webhook endpoint is active' },
    { status: 200 }
  );
}
