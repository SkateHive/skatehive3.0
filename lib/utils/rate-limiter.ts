/**
 * Simple in-memory rate limiter for API endpoints
 * 
 * ⚠️ LLM NOTICE: This is a simple in-memory rate limiter. For production
 * multi-instance deployments, consider using Redis-based rate limiting
 * via Upstash or similar service.
 * 
 * Usage:
 * ```typescript
 * import { createRateLimiter, getClientIP } from '@/lib/utils/rate-limiter';
 * 
 * const limiter = createRateLimiter({ limit: 10, windowMs: 60000 });
 * 
 * export async function POST(request: NextRequest) {
 *   const ip = getClientIP(request);
 *   const { allowed, remaining, resetIn } = limiter.check(ip);
 *   
 *   if (!allowed) {
 *     return NextResponse.json(
 *       { error: 'Rate limit exceeded', retryAfter: resetIn },
 *       { status: 429 }
 *     );
 *   }
 *   // ... handle request
 * }
 * ```
 */

import { NextRequest } from 'next/server';

interface RateLimitRecord {
    count: number;
    timestamp: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number; // milliseconds until reset
}

interface RateLimiterOptions {
    limit: number;       // max requests per window
    windowMs: number;    // window size in milliseconds
    keyPrefix?: string;  // prefix for keys (useful for multiple limiters)
}

interface RateLimiter {
    check: (key: string) => RateLimitResult;
    reset: (key: string) => void;
    cleanup: () => void;
}

// Store for all rate limiters
const stores = new Map<string, Map<string, RateLimitRecord>>();

/**
 * Get client IP address from request headers.
 *
 * These headers are client-suppliable — a caller can send any value it
 * wants for x-forwarded-for/x-real-ip unless the platform in front of this
 * (Vercel, a trusted proxy) overwrites them, so this is "make abuse a
 * little more expensive", not an identity check. Combined with the in-memory
 * store below (per serverless instance, reset on cold start, not shared
 * across instances), this rate limiter is a soft speed bump, not a hard
 * guarantee. That's an accepted tradeoff for now, not something to fix here.
 */
export function getClientIP(request: NextRequest): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        request.headers.get('cf-connecting-ip') || // Cloudflare
        'unknown'
    );
}

/**
 * Create a rate limiter instance
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
    const { limit, windowMs, keyPrefix = 'default' } = options;

    // Get or create store for this limiter
    if (!stores.has(keyPrefix)) {
        stores.set(keyPrefix, new Map());
    }
    const store = stores.get(keyPrefix)!;

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const fullKey = `${keyPrefix}:${key}`;
            const record = store.get(fullKey);

            // No record exists - first request
            if (!record) {
                store.set(fullKey, { count: 1, timestamp: now });
                return {
                    allowed: true,
                    remaining: limit - 1,
                    resetIn: windowMs,
                };
            }

            // Window has expired - reset
            if (now - record.timestamp > windowMs) {
                store.set(fullKey, { count: 1, timestamp: now });
                return {
                    allowed: true,
                    remaining: limit - 1,
                    resetIn: windowMs,
                };
            }

            // Within window
            record.count++;
            store.set(fullKey, record);

            const resetIn = windowMs - (now - record.timestamp);
            const allowed = record.count <= limit;
            const remaining = Math.max(0, limit - record.count);

            return { allowed, remaining, resetIn };
        },

        reset(key: string): void {
            store.delete(`${keyPrefix}:${key}`);
        },

        cleanup(): void {
            const now = Date.now();
            for (const [key, record] of store.entries()) {
                if (now - record.timestamp > windowMs) {
                    store.delete(key);
                }
            }
        },
    };
}

// Pre-configured rate limiters for common use cases
export const uploadLimiter = createRateLimiter({
    limit: 10,
    windowMs: 60 * 60 * 1000, // 10 uploads per hour
    keyPrefix: 'upload',
});

export const downloadLimiter = createRateLimiter({
    limit: 30,
    windowMs: 60 * 1000, // 30 downloads per minute
    keyPrefix: 'download',
});

export const apiLimiter = createRateLimiter({
    limit: 100,
    windowMs: 60 * 1000, // 100 requests per minute
    keyPrefix: 'api',
});

export const authLimiter = createRateLimiter({
    limit: 10,
    windowMs: 15 * 60 * 1000, // 10 auth attempts per 15 minutes
    keyPrefix: 'auth',
});

/**
 * Cleanup expired records periodically (call this in a cron job or interval)
 */
export function cleanupAllLimiters(): void {
    uploadLimiter.cleanup();
    downloadLimiter.cleanup();
    apiLimiter.cleanup();
    authLimiter.cleanup();
}
