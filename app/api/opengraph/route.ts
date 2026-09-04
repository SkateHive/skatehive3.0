import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';
import net from 'node:net';
import type { IncomingMessage } from 'node:http';
import { APP_CONFIG } from '@/config/app.config';
import { assertPublicHttpsUrl, PublicUrlGuardError } from '@/lib/utils/publicUrlGuard';
import { createRateLimiter, getClientIP } from '@/lib/utils/rate-limiter';

// The pinned-connection fetch below needs node:https/node:net, not edge.
export const runtime = 'nodejs';

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  siteName?: string;
}

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 512 * 1024; // 512KB — plenty for <head>, caps a malicious/huge response

const opengraphLimiter = createRateLimiter({
  limit: 20,
  windowMs: 60 * 1000,
  keyPrefix: 'opengraph',
});

/**
 * Fetches `url` over a TCP connection pinned to `address` — the exact IP
 * assertPublicHttpsUrl() already validated — instead of letting the HTTP
 * client re-resolve the hostname itself. Without this, the guard's
 * validation and the actual request would race two separate DNS lookups:
 * an attacker controlling the DNS record could return a public IP for our
 * lookup and a private one a few milliseconds later for the real request
 * (DNS rebinding), sailing straight through the guard.
 *
 * The `lookup` override only changes which IP the socket connects to; the
 * `hostname` (Host header, TLS SNI) stays the original hostname the caller
 * asked for, so this is transparent to the origin server.
 *
 * Uses node:https directly (not fetch) because fetch's Node implementation
 * doesn't expose a way to override the connection's resolved address
 * without depending on the `undici` package directly, which isn't a
 * dependency of this project.
 */
function fetchPinned(
  url: URL,
  address: string,
  opts: { userAgent: string; timeoutMs: number }
): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const family = net.isIPv6(address) ? 6 : 4;
    const agent = new https.Agent({
      // Node's connect path asks for `{ all: true }` (Happy Eyeballs, added
      // for dual-stack support) or the older single-address form depending
      // on internals we don't control — honor both, always answering with
      // the one pinned address either way.
      lookup: (_hostname, lookupOpts, callback) => {
        if (lookupOpts && typeof lookupOpts === 'object' && 'all' in lookupOpts && lookupOpts.all) {
          callback(null, [{ address, family }]);
        } else {
          callback(null, address, family);
        }
      },
    });

    const req = https.request(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ''), // strip [] from an IPv6 literal host
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        agent,
        headers: { 'User-Agent': opts.userAgent },
        timeout: opts.timeoutMs,
      },
      resolve
    );

    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** Reads a Node response stream as text, stopping once maxBytes have been read. */
function readCappedText(stream: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf-8'));
    };

    stream.on('data', (chunk: Buffer) => {
      if (settled) return;
      const remaining = maxBytes - received;
      if (chunk.length >= remaining) {
        chunks.push(chunk.subarray(0, Math.max(0, remaining)));
        received = maxBytes;
        finish();
        stream.destroy();
        return;
      }
      chunks.push(chunk);
      received += chunk.length;
    });
    stream.on('end', finish);
    stream.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
  });
}

function extractOpenGraphData(html: string, urlObj: URL): OpenGraphData {
  const ogData: OpenGraphData = { url: urlObj.toString() };

  const titleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (titleMatch) ogData.title = titleMatch[1].trim();

  const descMatch =
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  if (descMatch) ogData.description = descMatch[1].trim();

  const imageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  if (imageMatch) {
    let imageUrl = imageMatch[1].trim();
    if (imageUrl.startsWith('//')) {
      imageUrl = `${urlObj.protocol}${imageUrl}`;
    } else if (imageUrl.startsWith('/')) {
      imageUrl = `${urlObj.protocol}//${urlObj.host}${imageUrl}`;
    }
    ogData.image = imageUrl;
  }

  const siteNameMatch = html.match(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  ogData.siteName = siteNameMatch
    ? siteNameMatch[1].trim()
    : urlObj.hostname.replace('www.', '');

  return ogData;
}

function fallbackData(url: string): OpenGraphData {
  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace('www.', '');
  } catch {
    // keep the raw url as a last resort
  }
  return { title: hostname, description: url, url, siteName: hostname };
}

export async function GET(request: NextRequest) {
  // getClientIP trusts client-suppliable headers (x-forwarded-for etc.) —
  // fine for "make abuse a little more expensive", not a real identity
  // check — and this limiter is in-memory per serverless instance, so it
  // resets on cold start and doesn't share state across instances. Not
  // changing that behavior here; see lib/utils/rate-limiter.ts.
  const ip = getClientIP(request);
  const { allowed } = opengraphLimiter.check(ip);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  let urlObj: URL;
  let address: string;
  try {
    ({ url: urlObj, address } = await assertPublicHttpsUrl(rawUrl));
  } catch (err) {
    const message = err instanceof PublicUrlGuardError ? err.message : 'Invalid URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const res = await fetchPinned(urlObj, address, {
      userAgent: `Mozilla/5.0 (compatible; SkateHive/1.0; +${APP_CONFIG.BASE_URL})`,
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    const status = res.statusCode ?? 0;
    if (status >= 300 && status < 400) {
      res.destroy();
      throw new Error('Redirects are not followed');
    }
    if (status < 200 || status >= 300) {
      res.destroy();
      throw new Error(`HTTP ${status}`);
    }

    const html = await readCappedText(res, MAX_BODY_BYTES);
    const ogData = extractOpenGraphData(html, urlObj);

    return NextResponse.json(ogData, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  } catch (error) {
    console.error('Error fetching OpenGraph data:', error);
    return NextResponse.json(fallbackData(urlObj.toString()), {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  }
}
