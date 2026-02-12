import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CANONICAL_HOST = 'skatehive.app';

export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone();
    const host = request.headers.get('host') || '';

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
