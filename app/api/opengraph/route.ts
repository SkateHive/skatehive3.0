import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';
import { assertPublicHttpsUrl, PublicUrlGuardError } from '@/lib/utils/publicUrlGuard';
import { createRateLimiter, getClientIP } from '@/lib/utils/rate-limiter';

// dns.lookup (used by the SSRF guard) needs the Node runtime, not edge.
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

/** Reads a Response body as text, stopping once maxBytes have been read. */
async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const decoder = new TextDecoder();
  let received = 0;
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (received + value.byteLength > maxBytes) {
      const remaining = Math.max(0, maxBytes - received);
      result += decoder.decode(value.subarray(0, remaining));
      reader.cancel().catch(() => {});
      break;
    }

    received += value.byteLength;
    result += decoder.decode(value, { stream: true });
  }

  return result;
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
  try {
    urlObj = await assertPublicHttpsUrl(rawUrl);
  } catch (err) {
    const message = err instanceof PublicUrlGuardError ? err.message : 'Invalid URL';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(urlObj.toString(), {
      headers: {
        'User-Agent': `Mozilla/5.0 (compatible; SkateHive/1.0; +${APP_CONFIG.BASE_URL})`,
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error('Redirects are not followed');
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await readCappedText(response, MAX_BODY_BYTES);
    const ogData = extractOpenGraphData(html, urlObj);

    return NextResponse.json(ogData, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  } catch (error) {
    console.error('Error fetching OpenGraph data:', error);
    return NextResponse.json(fallbackData(urlObj.toString()), {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
