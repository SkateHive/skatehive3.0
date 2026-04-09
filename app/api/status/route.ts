import { NextResponse } from 'next/server';
import { EXTERNAL_SERVICES } from '@/config/app.config';

export const dynamic = 'force-dynamic';

type HealthStatus = 'operational' | 'degraded' | 'down';

type ServiceDefinition = {
  id: string;
  name: string;
  category: string;
  description: string;
  healthUrl: string;
  priority?: number;
  headers?: Record<string, string>;
};

type ServiceHealth = ServiceDefinition & {
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  lastChecked: string;
  authStatus?: string;
  rcInfo?: string;
  cookieInfo?: {
    valid: boolean;
    exists: boolean;
    expiresAt?: string;
    daysUntilExpiry?: number;
  };
};

const HEALTH_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 300000; // 5 minutes

const signerUrl =
  process.env.NEXT_PUBLIC_SIGNER_URL ||
  EXTERNAL_SERVICES.SIGNER_URL;
const signerToken =
  process.env.NEXT_PUBLIC_SIGNER_TOKEN ||
  EXTERNAL_SERVICES.SIGNER_TOKEN;

const SERVICE_DEFINITIONS: ServiceDefinition[] = [
  // Instagram Downloaders
  {
    id: 'skate-insta',
    name: 'Skate-Insta',
    category: 'Instagram Downloader',
    description: 'Media/share app used for IG pulls',
    healthUrl: 'https://skate-insta.onrender.com/healthz',
  },
  {
    id: 'macmini-insta',
    name: 'Mac Mini IG',
    category: 'Instagram Downloader',
    description: 'Mac Mini Instagram downloader / helper',
    healthUrl: 'https://minivlad.tail83ea3e.ts.net/instagram/healthz',
  },
  {
    id: 'raspi-insta',
    name: 'Raspberry Pi IG',
    category: 'Instagram Downloader',
    description: 'Raspberry Pi Instagram downloader / fallback',
    healthUrl: 'https://vladsberry.tail83ea3e.ts.net/instagram/healthz',
  },
  // SignUp
  {
    id: 'signup-signer',
    name: 'Signup Signer',
    category: 'SignUp',
    description: 'Hive account manager / signer health',
    healthUrl: `${signerUrl.replace(/\/$/, '')}/healthz`,
    headers: { 'x-signer-token': signerToken },
  },
  // Video Transcoding  
  {
    id: 'transcode-macmini',
    name: 'Mac Mini M4 (Primary)',
    category: 'Video Transcoding',
    description: 'Mac Mini M4 (Primary) video transcoding node',
    healthUrl: 'https://minivlad.tail83ea3e.ts.net/video/healthz',
    priority: 1,
  },
  {
    id: 'transcode-oracle',
    name: 'Oracle (Secondary)',
    category: 'Video Transcoding',
    description: 'Oracle (Secondary) video transcoding node',
    healthUrl: 'https://transcode.skatehive.app/healthz',
    priority: 2,
  },
  {
    id: 'transcode-pi',
    name: 'Raspberry Pi (Tertiary)',
    category: 'Video Transcoding',
    description: 'Raspberry Pi (Tertiary) video transcoding node',
    healthUrl: 'https://vladsberry.tail83ea3e.ts.net/video/healthz',
    priority: 3,
  },
];

const healthCache: Record<string, ServiceHealth> = {};

async function checkHealth(service: ServiceDefinition): Promise<ServiceHealth> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(service.healthUrl, {
      signal: controller.signal,
      headers: service.headers,
    });
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        ...service,
        isHealthy: false,
        responseTime,
        error: `HTTP ${response.status} ${response.statusText}`,
        lastChecked: new Date().toISOString(),
      };
    }

    const data = await response.json().catch(() => ({}));

    // Special handling for signer health to include auth + RC context
    if (service.id === 'signup-signer') {
      const authStatus = data.auth ?? 'unknown';

      // Auth failures
      if (authStatus === 'invalid' || authStatus === 'not-provided') {
        return {
          ...service,
          isHealthy: false,
          responseTime,
          lastChecked: new Date().toISOString(),
          authStatus,
          error: authStatus === 'invalid'
            ? 'Invalid signer token'
            : 'Signer token not configured',
        };
      }

      // If auth ok, attempt lightweight RC probe
      if (data.status === 'ok' && authStatus === 'valid') {
        try {
          const probe = await fetch(`${signerUrl.replace(/\/$/, '')}/claim-account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-signer-token': signerToken,
            },
            body: JSON.stringify({ username: `healthcheck-test-${Date.now()}` }),
          });
          const probeJson = await probe.json().catch(() => ({}));

          // Detect RC issues
          if (probeJson?.error && typeof probeJson.error === 'string' && probeJson.error.toLowerCase().includes('insufficient')) {
            const match = probeJson.hive_error?.match(/has (\d+) RC, needs (\d+) RC/i);
            const rcInfo = match
              ? `RC: ${(parseInt(match[1], 10) / 1e12).toFixed(1)}T / ${(parseInt(match[2], 10) / 1e12).toFixed(1)}T needed`
              : 'Insufficient Resource Credits';

            return {
              ...service,
              isHealthy: false,
              responseTime,
              lastChecked: new Date().toISOString(),
              authStatus,
              rcInfo,
              error: rcInfo,
            };
          }
        } catch {
          // ignore probe failure, fall through as operational with unknown RC
        }
      }

      // Auth valid and no RC error detected
      const okFlag = data.ok === true || data.healthy === true || data.status === 'ok';
      return {
        ...service,
        isHealthy: okFlag || response.ok,
        responseTime,
        lastChecked: new Date().toISOString(),
        authStatus,
        rcInfo: data.rcInfo,
        error: okFlag ? undefined : 'Signer health did not report ok',
      };
    }

    // Special handling for Instagram services to extract cookie information
    if (service.category === 'Instagram Downloader' && data.authentication) {
      const auth = data.authentication;
      const cookieInfo = {
        valid: auth.cookies_valid === true,
        exists: auth.cookies_exist === true,
        expiresAt: auth.cookie_expires_at,
        daysUntilExpiry: auth.days_until_expiry,
      };

      const okFlag = data.ok === true || data.healthy === true || data.status === 'ok';
      return {
        ...service,
        isHealthy: okFlag || response.ok,
        responseTime,
        lastChecked: new Date().toISOString(),
        cookieInfo,
        error: !cookieInfo.valid && cookieInfo.exists
          ? `Invalid Instagram cookies${cookieInfo.daysUntilExpiry !== undefined ? ` (expires in ${cookieInfo.daysUntilExpiry} days)` : ''}`
          : !cookieInfo.exists
            ? 'Instagram cookies missing'
            : okFlag ? undefined : 'Health endpoint did not report ok',
      };
    }

    const okFlag = data.ok === true || data.healthy === true || data.status === 'ok';
    return {
      ...service,
      isHealthy: okFlag || response.ok,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: okFlag ? undefined : 'Health endpoint did not report ok',
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      ...service,
      isHealthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function getServiceHealth(service: ServiceDefinition): Promise<ServiceHealth> {
  const cached = healthCache[service.id];
  const now = Date.now();

  if (cached && now - new Date(cached.lastChecked).getTime() < CACHE_TTL_MS) {
    return cached;
  }

  const result = await checkHealth(service);
  healthCache[service.id] = result;
  return result;
}

function getSystemStatus(services: ServiceHealth[]): HealthStatus {
  const healthyCount = services.filter((s) => s.isHealthy).length;
  if (healthyCount === services.length) return 'operational';
  if (healthyCount > 0) return 'degraded';
  return 'down';
}

export async function GET() {
  try {
    const results = await Promise.all(SERVICE_DEFINITIONS.map((service) => getServiceHealth(service)));
    const status = getSystemStatus(results);

    const sortedResults = results.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      {
        status,
        timestamp: new Date().toISOString(),
        summary: {
          healthy: results.filter((r) => r.isHealthy).length,
          total: results.length,
        },
        services: sortedResults,
      },
      { status: status === 'down' ? 503 : 200 }
    );
  } catch (error) {
    console.error('Status check failed:', error);
    return NextResponse.json(
      {
        status: 'down',
        timestamp: new Date().toISOString(),
        error: 'Failed to collect service health',
      },
      { status: 500 }
    );
  }
}
