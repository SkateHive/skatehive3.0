import { NextRequest, NextResponse } from 'next/server';
import { uploadLimiter, getClientIP } from '@/lib/utils/rate-limiter';
import { logUpload } from '@/lib/utils/upload-logger';

/**
 * Returns a single-use temporary JWT for direct client-side uploads to Pinata.
 * This avoids Vercel's 4.5MB body size limit by letting the browser
 * upload directly to Pinata's API.
 *
 * The temporary key is scoped to pinFileToIPFS only and expires after one use,
 * so the permanent PINATA_JWT is never exposed to the browser.
 *
 * GET /api/pinata/signed-url
 */
export async function GET(request: NextRequest) {
  const ip = getClientIP(request);
  const { allowed, resetIn } = uploadLimiter.check(ip);

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

  // Generate a single-use temporary API key scoped only to pinFileToIPFS.
  // The permanent PINATA_JWT stays server-side; the browser only ever sees
  // a key that auto-expires after one upload.
  const keyResponse = await fetch('https://api.pinata.cloud/users/generateApiKey', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify({
      keyName: `temp-upload-${Date.now()}`,
      maxUses: 1,
      permissions: {
        endpoints: {
          pinning: {
            pinFileToIPFS: true,
          },
        },
      },
    }),
  });

  if (!keyResponse.ok) {
    const errText = await keyResponse.text();
    logUpload({ status: 'failed', route: 'signed-url', ip, error: `Pinata key generation failed: ${errText}` });
    return NextResponse.json({ error: 'Failed to generate upload token' }, { status: 502 });
  }

  const keyData = await keyResponse.json();
  const tempJwt = keyData.JWT;

  if (!tempJwt) {
    logUpload({ status: 'failed', route: 'signed-url', ip, error: 'Pinata key response missing JWT' });
    return NextResponse.json({ error: 'Failed to generate upload token' }, { status: 502 });
  }

  logUpload({ status: 'success', route: 'signed-url', ip });
  return NextResponse.json({ jwt: tempJwt });
}
