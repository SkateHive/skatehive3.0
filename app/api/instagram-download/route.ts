import { NextRequest, NextResponse } from 'next/server';

// Environment-aware Instagram server configuration
const getInstagramServers = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return [
    isDevelopment 
      ? 'http://localhost:8000'                     // Local Docker service
      : 'http://raspberrypi.tail83ea3e.ts.net:8000', // Production Tailscale
    'https://skate-insta.onrender.com'              // Always as backup
  ];
};

const INSTAGRAM_SERVERS = getInstagramServers();

async function tryDownloadFromServer(serverUrl: string, instagramUrl: string): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 120000); // 2 minutes timeout per server

  try {
    const response = await fetch(`${serverUrl}/download`, {
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
      url: result.pinata_gateway || `https://ipfs.skatehive.app/ipfs/${result.cid}`,
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
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'Instagram URL is required' },
        { status: 400 }
      );
    }

    // Validate Instagram URL format
    const instagramRegex =
      /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p\/[A-Za-z0-9_-]+|([A-Za-z0-9_.]+\/)?(reel|tv)\/[A-Za-z0-9_-]+)\/?(\?.*)?$/;
    if (!instagramRegex.test(url)) {
      return NextResponse.json(
        { error: 'Invalid Instagram URL format' },
        { status: 400 }
      );
    }

    let finalUrl = url;

    // Handle reel or tv URLs without username by extracting from OpenGraph
    const noUsernameRegex =
      /^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(reel|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/;
    if (noUsernameRegex.test(url)) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        const html = await response.text();
        const match = html.match(/<meta property="og:url" content="([^\"]+)"/);
        if (match && match[1]) {
          finalUrl = match[1];
        }
      } catch {
        // If fetching fails, proceed with original URL
      }
    }

    let lastError = '';
    let allErrors: string[] = [];

    // Try each server in order
    for (const server of INSTAGRAM_SERVERS) {
      try {
        const result = await tryDownloadFromServer(server, finalUrl);
        
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
