import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

export const dynamic = 'force-dynamic';

/**
 * Service health for skatehive.app.
 *
 * The SkateHive API service (api.skatehive.app) is the SINGLE SOURCE OF TRUTH
 * for service health — it monitors transcoding, Instagram downloaders, Hive
 * RPC, Base, Supabase and Pinata from one place. This route proxies it so
 * skatehive.app/api/status and api.skatehive.app/api/status never drift.
 *
 * (The transcoding server list itself lives in config/transcode.config.ts,
 * mirrored on both sides — see that file.)
 */
const UPSTREAM_STATUS_URL = `${APP_CONFIG.API_BASE_URL.replace(/\/$/, '')}/api/status`;
const TIMEOUT_MS = 8000;

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(UPSTREAM_STATUS_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(timeoutId);

    const data = await upstream.json().catch(() => null);
    if (!data) {
      return NextResponse.json(
        {
          status: 'down',
          timestamp: new Date().toISOString(),
          error: 'Upstream status returned no JSON',
          source: UPSTREAM_STATUS_URL,
        },
        { status: 502 }
      );
    }

    // Pass the upstream payload and HTTP status straight through, tagging the
    // source so consumers know this mirrors api.skatehive.app.
    return NextResponse.json({ ...data, source: UPSTREAM_STATUS_URL }, { status: upstream.status });
  } catch (error) {
    clearTimeout(timeoutId);
    return NextResponse.json(
      {
        status: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Failed to reach upstream status',
        source: UPSTREAM_STATUS_URL,
      },
      { status: 503 }
    );
  }
}
