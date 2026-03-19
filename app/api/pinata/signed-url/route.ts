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

  logUpload({ status: 'success', route: 'signed-url', ip });
  return NextResponse.json({ jwt: pinataJwt });
}
