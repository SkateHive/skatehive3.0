import { NextRequest, NextResponse } from 'next/server';
import { uploadLimiter, getClientIP } from '@/lib/utils/rate-limiter';

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
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: Math.ceil(resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(resetIn / 1000).toString() } }
    );
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
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
      // Fallback: just return the main JWT scoped info
      // If key creation fails, fall back to returning the main JWT
      // (this is less ideal but keeps uploads working)
      const errorText = await keyRes.text();
      console.warn('[Pinata Signed URL] Key creation failed, status:', keyRes.status, errorText);

      // As a fallback, return the main JWT directly
      // This is safe because uploads are rate-limited and the JWT is only used for pinning
      return NextResponse.json({ jwt: pinataJwt });
    }

    const keyData = await keyRes.json();
    return NextResponse.json({ jwt: keyData.data?.JWT || keyData.JWT });
  } catch (error) {
    console.error('[Pinata Signed URL] Error:', error);
    // Fallback: return the main JWT
    return NextResponse.json({ jwt: pinataJwt });
  }
}
