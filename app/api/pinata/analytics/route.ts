import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/pinata/analytics
 *
 * Returns gateway analytics for Skatehive content.
 *
 * Query params:
 *   creator  — filter by uploader username (queries files by keyvalue, then fetches their analytics)
 *   days     — rolling window in days (default: 30)
 *   by       — "requests" | "bandwidth" (default: "requests")
 *   limit    — max results (default: 10, max: 50)
 *
 * If no creator is specified, returns the top files account-wide.
 */
export async function GET(request: NextRequest) {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
        return NextResponse.json({ error: 'Pinata not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const creator = searchParams.get('creator') ?? null;
    const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 365);
    const by = searchParams.get('by') === 'bandwidth' ? 'bandwidth' : 'requests';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '10', 10), 50);

    try {
        // If filtering by creator: first get their file CIDs via the pin list
        let cidsToQuery: string[] | null = null;

        if (creator) {
            const pinListUrl = new URL('https://api.pinata.cloud/data/pinList');
            pinListUrl.searchParams.set('metadata[keyvalues]', JSON.stringify({
                creator: { value: creator, op: 'eq' },
            }));
            pinListUrl.searchParams.set('pageLimit', '100');
            pinListUrl.searchParams.set('status', 'pinned');

            const pinListRes = await fetch(pinListUrl.toString(), {
                headers: { Authorization: `Bearer ${pinataJwt}` },
            });

            if (pinListRes.ok) {
                const pinList = await pinListRes.json();
                cidsToQuery = (pinList.rows ?? []).map((r: { ipfs_pin_hash: string }) => r.ipfs_pin_hash);
            }

            if (cidsToQuery && cidsToQuery.length === 0) {
                return NextResponse.json({ analytics: [], creator, total: 0 });
            }
        }

        // Fetch gateway analytics
        const analyticsUrl = new URL('https://api.pinata.cloud/v3/ipfs/gateway_analytics_top_usage');
        analyticsUrl.searchParams.set('by', by);
        analyticsUrl.searchParams.set('sortBy', by);
        analyticsUrl.searchParams.set('sortOrder', 'desc');
        analyticsUrl.searchParams.set('limit', String(limit));
        analyticsUrl.searchParams.set('days', String(days));

        const analyticsRes = await fetch(analyticsUrl.toString(), {
            headers: { Authorization: `Bearer ${pinataJwt}` },
        });

        if (!analyticsRes.ok) {
            const text = await analyticsRes.text();
            console.error('Pinata analytics error:', analyticsRes.status, text);
            return NextResponse.json({ error: 'Analytics unavailable' }, { status: 502 });
        }

        const analyticsData = await analyticsRes.json();
        let items: Array<{ cid: string; requests?: number; bandwidth?: number }> =
            analyticsData.data?.items ?? analyticsData.items ?? [];

        // Filter to creator's CIDs if specified
        if (cidsToQuery) {
            const cidSet = new Set(cidsToQuery);
            items = items.filter((item) => cidSet.has(item.cid));
        }

        return NextResponse.json(
            {
                analytics: items,
                creator: creator ?? 'all',
                days,
                by,
                total: items.length,
            },
            {
                headers: {
                    // Cache for 5 minutes — analytics data is not real-time
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
                },
            }
        );
    } catch (error) {
        console.error('Analytics route error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
