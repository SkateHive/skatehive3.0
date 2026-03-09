import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'skatehive.app';

// Known malicious bot patterns (legitimate crawlers are allowed)
const MALICIOUS_BOTS = [
  'scrapy', 'scraper', 'python-requests', 'curl', 'wget',
  'headless', 'phantom', 'selenium', 'puppeteer',
  'beautifulsoup', 'mechanize', 'httpclient'
];

// Legitimate search engine bots (ALLOW these)
const ALLOWED_BOTS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot',
  'baiduspider', 'yandexbot', 'facebookexternalhit',
  'twitterbot', 'linkedinbot', 'discordbot'
];

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  
  // Allow legitimate search engines
  if (ALLOWED_BOTS.some(bot => ua.includes(bot))) {
    return false; // Not blocking, it's legitimate
  }
  
  // Block known malicious bots
  if (MALICIOUS_BOTS.some(bot => ua.includes(bot))) {
    return true; // Block this
  }
  
  return false;
}

function isSuspiciousBehavior(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  
  // Real browsers always send Accept header with HTML
  if (accept && !accept.includes('text/html') && !accept.includes('*/*')) {
    return true; // Likely a scraper
  }
  
  // Real browsers have complex user agents
  if (userAgent && userAgent.length < 50) {
    return true; // Too simple, likely fake
  }
  
  // Empty user agent = bot
  if (!userAgent) {
    return true;
  }
  
  return false;
}

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();
    const host = request.headers.get('host') || '';
    const userAgent = request.headers.get('user-agent') || '';

    // 0. Bot protection (runs first)
    if (isBot(userAgent)) {
        const country = (request as any).geo?.country || 'unknown';
        console.log(`[BOT BLOCKED] ${userAgent.substring(0, 100)} from ${country}`);
        return new NextResponse('Forbidden', { status: 403 });
    }

    // Log suspicious traffic (but don't block)
    if (isSuspiciousBehavior(request)) {
        const country = (request as any).geo?.country || 'unknown';
        console.log(`[SUSPICIOUS] UA: ${userAgent.substring(0, 50)}, Country: ${country}`);
    }

    // 1. Redirect www → non-www (fixes 174 redirect issues in Search Console)
    if (host.startsWith('www.')) {
        const newUrl = new URL(request.url);
        newUrl.host = host.replace(/^www\./, '');
        newUrl.protocol = 'https:';
        return NextResponse.redirect(newUrl, 301);
    }

    // 2. Handle snap URLs: /user/username/snap/permlink
    const snapMatch = url.pathname.match(/^\/user\/([^\/]+)\/snap\/([^\/]+)$/);

    if (snapMatch) {
        const [, username, permlink] = snapMatch;

        // Rewrite to the profile page with snaps view
        // The client-side will detect the URL structure and open the modal
        url.pathname = `/user/${username}`;
        url.searchParams.set('view', 'snaps');

        return NextResponse.rewrite(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Match all paths except static files and api routes
        '/((?!_next/static|_next/image|favicon.ico|ogimage.png|SKATE_HIVE_VECTOR_FIN.svg|manifest.json).*)',
    ],
};
