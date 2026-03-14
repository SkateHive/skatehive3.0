import { NextRequest, NextResponse } from 'next/server';
import { uploadLimiter, getClientIP } from '@/lib/utils/rate-limiter';
import { logUpload } from '@/lib/utils/upload-logger';

/**
 * Returns a temporary signed JWT for direct client-side uploads to Pinata.
 * This avoids Vercel's 4.5MB body size limit by letting the browser
 * upload directly to Pinata's API.
 *
 * GET /api/pinata/signed-url
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, remaining, resetIn } = uploadLimiter.check(ip);

  if (!allowed) {
    logUpload({ status: 'rate-limited', route: 'signed-url', ip });
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: Math.ceil(resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(resetIn / 1000).toString() } }
    );
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    logUpload({ status: 'failed', route: 'signed-url', ip, error: 'Pinata not configured' });
    return NextResponse.json({ error: 'Pinata not configured' }, { status: 500 });
  }

  try {
    // Request a temporary upload key from Pinata (valid for 30 minutes, 1 use)
    const keyRes = await fetch('https://api.pinata.cloud/v3/files/keys', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pinataJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `skatehive-upload-${Date.now()}`,
        permissions: { admin: false, endpoints: { pinning: { pinFileToIPFS: true } } },
        max_uses: 1,
        expires: 1800, // 30 minutes
      }),
    });

    if (!pinataJwt || !keyRes.ok) {
      const errorText = await keyRes.text();
      logUpload({
        status: 'failed',
        route: 'signed-url',
        ip,
        error: `Key creation failed: ${keyRes.status} - ${errorText}`,
        meta: { fallback: true },
      });

      // Fallback: return the main JWT directly
      return NextResponse.json({ jwt: pinataJwt });
    }

    const keyData = await keyRes.json();

    logUpload({
      status: 'success',
      route: 'signed-url',
      ip,
      meta: { tempKey: true },
    });

    return NextResponse.json({ jwt: keyData.data?.JWT || keyData.JWT });
  } catch (error) {
    logUpload({
      status: 'failed',
      route: 'signed-url',
      ip,
      error: error instanceof Error ? error.message : String(error),
      meta: { fallback: true },
    });
    // Fallback: return the main JWT
    return NextResponse.json({ jwt: pinataJwt });
  }
}
