import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * SkateHive Middleware
 * 
 * Purpose:
 * 1. Redirect www → non-www (SEO canonical)
 * 2. Handle snap URL rewrites
 * 
 * What we DON'T do:
 * - Bot detection via user-agent (ineffective, blocks legitimate crawlers)
 * - Use Vercel Firewall for IP-based blocking if needed
 */

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();
    const host = request.headers.get('host') || '';

    // 1. Redirect www → non-www (SEO canonical)
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
        // Match all paths except:
        // - Static files (_next/static, _next/image, etc)
        // - SEO critical files (robots.txt, sitemap.xml)
        // - Public assets
        '/((?!_next/static|_next/image|favicon.ico|ogimage.png|SKATE_HIVE_VECTOR_FIN.svg|manifest.json|robots.txt|sitemap.xml).*)',
    ],
};
