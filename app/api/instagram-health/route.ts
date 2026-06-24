import { NextRequest, NextResponse } from 'next/server';

// Instagram server configuration - only public servers that users can access
const getInstagramServers = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return [
    'https://minivlad.tail83ea3e.ts.net',        // Mac Mini M4 (primary)
    'https://vladsberry.tail83ea3e.ts.net'      // Raspberry Pi (secondary)
  ];
};

const INSTAGRAM_SERVERS = getInstagramServers();

async function checkServerHealth(serverUrl: string): Promise<{ healthy: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000); // 10 seconds timeout per server

  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🏥 Checking health for: ${serverUrl}/instagram/healthz`);
    }

    // Try Instagram-specific health endpoint first
    let response = await fetch(`${serverUrl}/instagram/healthz`, {
      method: 'GET',
      signal: controller.signal
    });

    // If Instagram health endpoint doesn't exist, try generic healthz
    if (!response.ok && response.status === 404) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Trying generic healthz for: ${serverUrl}`);
      }
      response = await fetch(`${serverUrl}/healthz`, {
        method: 'GET',
        signal: controller.signal
      });
    }

    // If still no luck, try root endpoint
    if (!response.ok && response.status === 404) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 Trying root endpoint for: ${serverUrl}`);
      }
      response = await fetch(serverUrl, {
        method: 'GET',
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Response for ${serverUrl}: status=${response.status}, ok=${response.ok}`);
    }

    if (response.ok) {
      try {
        const data = await response.json();
        if (process.env.NODE_ENV === 'development') {
          console.log(`📋 Response data for ${serverUrl}:`, data);
        }
        // Check if the response indicates the server is ok
        const isHealthy = data.status === 'ok' || response.status === 200;
        return { healthy: isHealthy, status: response.status };
      } catch {
        // If JSON parsing fails but response is ok, consider it healthy
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ JSON parse failed but response OK for ${serverUrl}`);
        }
        return { healthy: true, status: response.status };
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(`❌ Server error for ${serverUrl}: ${response.status}`);
      }
      return { healthy: false, status: response.status, error: 'Server returned error status' };
    }

  } catch (fetchError) {
    clearTimeout(timeoutId);

    if (process.env.NODE_ENV === 'development') {
      console.error(`💥 Fetch error for ${serverUrl}:`, fetchError);
    }

    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏰ Timeout for ${serverUrl}`);
      }
      return { healthy: false, error: 'Server timeout' };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔌 Connection failed for ${serverUrl}`);
    }
    return { healthy: false, error: 'Server unreachable' };
  }
}

export async function GET() {
  try {
    // Check all servers in parallel
    const healthChecks = await Promise.allSettled(
      INSTAGRAM_SERVERS.map(server => checkServerHealth(server))
    );

    const results = healthChecks.map((result, index) => ({
      server: INSTAGRAM_SERVERS[index],
      ...(result.status === 'fulfilled' ? result.value : { healthy: false, error: 'Check failed' })
    }));

    // At least one server should be healthy
    const hasHealthyServer = results.some(result => result.healthy);
    const healthyServers = results.filter(result => result.healthy);

    return NextResponse.json({
      healthy: hasHealthyServer,
      servers: results,
      healthyCount: healthyServers.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      healthy: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}
