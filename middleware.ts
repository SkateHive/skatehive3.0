import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * SkateHive Middleware
 * 
 * Purpose:
 * 1. Handle snap URL rewrites
 * 
 * What we DON'T do:
 * - Bot detection via user-agent (ineffective, blocks legitimate crawlers)
 * - Use Vercel Firewall for IP-based blocking if needed
 */

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();

    // Handle snap URLs: /user/username/snap/permlink
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
        // Keep middleware scoped to the only app route that needs a rewrite.
        // The www -> apex redirect is configured at the Vercel domain level.
        '/user/:username/snap/:permlink',
    ],
};
