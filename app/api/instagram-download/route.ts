import { NextRequest, NextResponse } from 'next/server';
import { downloadLimiter, getClientIP } from '@/lib/utils/rate-limiter';
import { APP_CONFIG } from '@/config/app.config';

// Environment-aware Instagram server configuration
const getInstagramServers = () => {
  const isVercel = process.env.VERCEL === '1';

  if (isVercel) {
    // Vercel production - prioritize Mac Mini M4, then Pi
    return [
      'https://minivlad.tail83ea3e.ts.net/instagram/download',         // Mac Mini M4 (primary)
      'https://vladsberry.tail83ea3e.ts.net/instagram/download'   // Raspberry Pi (secondary)
    ];
  } else {
    // Other production - prioritize Mac Mini M4, then Pi
    return [
      'https://minivlad.tail83ea3e.ts.net/instagram/download',         // Mac Mini M4 (primary)
      'https://vladsberry.tail83ea3e.ts.net/instagram/download'   // Raspberry Pi (secondary)
    ];
  }
};

const INSTAGRAM_SERVERS = getInstagramServers();

async function tryDownloadFromServer(serverUrl: string, instagramUrl: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 120000); // 2 minutes timeout per server

  try {
    // Use the serverUrl as-is since it now includes the full path
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: instagramUrl }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server ${serverUrl} failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    if (result.status !== 'ok' || !result.cid) {
      throw new Error(`Server ${serverUrl} failed: ${result.error || 'No media found'}`);
    }

    return {
      success: true,
      cid: result.cid,
      url: result.pinata_gateway || `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${result.cid}`,
      filename: result.filename,
      bytes: result.bytes,
      server: serverUrl
    };

  } catch (fetchError) {
    clearTimeout(timeoutId);

    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error(`Server ${serverUrl} timed out`);
    }

    throw fetchError;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const ip = getClientIP(request);
    const { allowed, remaining, resetIn } = downloadLimiter.check(ip);

    if (!allowed) {
      console.warn('Instagram download rate limit exceeded for IP:', ip);
      return NextResponse.json(
        {
          error: 'Download rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(resetIn / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(resetIn / 1000).toString(),
            'X-RateLimit-Remaining': remaining.toString(),
          }
        }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Instagram URL is required' },
        { status: 400 }
      );
    }

    // Validate Instagram URL format
    const instagramRegex = /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p\/[A-Za-z0-9_-]+|[A-Za-z0-9_.]+\/(reel|tv)\/[A-Za-z0-9_-]+)\/?(\?.*)?$/;
    if (!instagramRegex.test(url)) {
      return NextResponse.json(
        { error: 'Invalid Instagram URL format' },
        { status: 400 }
      );
    }

    let lastError = '';
    let allErrors: string[] = [];

    // Try each server in order
    for (const server of INSTAGRAM_SERVERS) {
      try {
        const result = await tryDownloadFromServer(server, url);

        // Success! Return the result
        return NextResponse.json(result);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const serverError = `${server}: ${errorMessage}`;
        allErrors.push(serverError);
        lastError = errorMessage;

        // If this isn't the last server, continue to the next one
        if (server !== INSTAGRAM_SERVERS[INSTAGRAM_SERVERS.length - 1]) {
          continue;
        }
      }
    }

    // All servers failed - provide specific error messages for common Instagram issues
    let finalErrorMessage = `All servers failed. Errors: ${allErrors.join(' | ')}`;

    if (lastError.includes('rate-limit') || lastError.includes('login required')) {
      finalErrorMessage = 'Instagram rate limit reached or authentication required. Please try again later.';
    } else if (lastError.includes('not available') || lastError.includes('Requested content is not available')) {
      finalErrorMessage = 'This Instagram content is not available. It may be private, deleted, or restricted.';
    } else if (lastError.includes('timed out')) {
      finalErrorMessage = 'Instagram download servers are currently slow or unavailable. Please try again later.';
    }

    return NextResponse.json(
      { error: finalErrorMessage },
      { status: 503 }
    );

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
