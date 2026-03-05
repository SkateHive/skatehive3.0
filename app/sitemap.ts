import { MetadataRoute } from 'next';
import HiveClient from '@/lib/hive/hiveclient';
import { APP_CONFIG, HIVE_CONFIG } from '@/config/app.config';

// === CONFIG ===
const REVALIDATE_SECONDS = 60 * 60; // 1 hour
const BRIDGE_PAGE_SIZE = 20;
const SNAP_API_PAGE_SIZE = 50;
const MAX_SNAP_PAGES = 100;

// Community posts (hive-173115)
const MAX_COMMUNITY_POSTS = 500;

// Global skate tags — posts from ALL of Hive, not just our community
const GLOBAL_SKATE_TAGS = [
    'skateboarding', 'skateboard', 'skate', 'skatelife',
    'skating', 'skatepark', 'streetskating', 'sk8',
    'skatevideo', 'kickflip', 'longboard', 'skateshop',
    'skatetricks', 'skater', 'skateclips', 'cruiser',
];
const MAX_POSTS_PER_TAG = 100; // 100 posts per tag × 16 tags = up to 1600 extra posts

export const revalidate = 3600;

type HivePost = {
    author?: string;
    permlink?: string;
    created?: string;
    last_update?: string;
    json_metadata?: any;
    pending_payout_value?: string;
    total_payout_value?: string;
    net_votes?: number;
    children?: number;
};

type FeedSnap = {
    author?: string;
    permlink?: string;
    created?: string;
    last_update?: string;
};

function safeDate(value?: string): Date {
    if (!value) return new Date();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function extractFeedItems(payload: any): FeedSnap[] {
    if (Array.isArray(payload)) return payload;
    if (payload?.data && Array.isArray(payload.data)) return payload.data;
    if (payload?.posts && Array.isArray(payload.posts)) return payload.posts;
    if (payload?.result && Array.isArray(payload.result)) return payload.result;
    return [];
}

/**
 * Calculate SEO priority for a post based on engagement signals.
 * Higher engagement = higher priority in sitemap = Google crawls it first.
 */
function calculatePostPriority(post: HivePost): number {
    let score = 0.5; // base

    const votes = post.net_votes || 0;
    const comments = post.children || 0;

    // Parse payout values
    const pendingPayout = parseFloat(post.pending_payout_value?.replace(' HBD', '') || '0');
    const totalPayout = parseFloat(post.total_payout_value?.replace(' HBD', '') || '0');
    const payout = Math.max(pendingPayout, totalPayout);

    // Engagement scoring
    if (votes > 50) score += 0.15;
    else if (votes > 20) score += 0.1;
    else if (votes > 5) score += 0.05;

    if (comments > 10) score += 0.1;
    else if (comments > 3) score += 0.05;

    if (payout > 10) score += 0.1;
    else if (payout > 1) score += 0.05;

    return Math.min(score, 0.9); // cap at 0.9 (1.0 = homepage only)
}

async function fetchRankedPosts(sort: string, tag: string, maxItems: number): Promise<HivePost[]> {
    const posts: HivePost[] = [];
    const seen = new Set<string>();
    let startAuthor: string | undefined;
    let startPermlink: string | undefined;
    const maxPages = Math.ceil(maxItems / BRIDGE_PAGE_SIZE);

    for (let page = 0; page < maxPages; page += 1) {
        const limit = Math.min(BRIDGE_PAGE_SIZE, maxItems - posts.length);
        try {
            const batch: HivePost[] = await HiveClient.call('bridge', 'get_ranked_posts', {
                sort, tag, limit,
                start_author: startAuthor || undefined,
                start_permlink: startPermlink || undefined,
                observer: ''
            });
            if (!batch?.length) break;

            let added = 0;
            for (const post of batch) {
                if (!post?.author || !post?.permlink) continue;
                const key = `${post.author}/${post.permlink}`;
                if (seen.has(key)) continue;
                seen.add(key);
                posts.push(post);
                added += 1;
                if (posts.length >= maxItems) break;
            }

            const last = batch[batch.length - 1];
            if (!last?.author || !last?.permlink || added === 0) break;
            startAuthor = last.author;
            startPermlink = last.permlink;
            if (batch.length < limit) break;
        } catch {
            break;
        }
    }
    return posts;
}

async function fetchAllSnaps(): Promise<FeedSnap[]> {
    const snaps: FeedSnap[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_SNAP_PAGES; page += 1) {
        try {
            const url = `${APP_CONFIG.API_BASE_URL}/api/v2/feed?limit=${SNAP_API_PAGE_SIZE}&page=${page}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(url, {
                next: { revalidate: REVALIDATE_SECONDS },
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!response.ok) break;

            const payload = await response.json();
            const batch = extractFeedItems(payload);
            if (!batch.length) break;

            let added = 0;
            for (const snap of batch) {
                if (!snap?.author || !snap?.permlink) continue;
                const key = `${snap.author}/${snap.permlink}`;
                if (seen.has(key)) continue;
                seen.add(key);
                snaps.push(snap);
                added += 1;
            }

            if (added === 0 || batch.length < SNAP_API_PAGE_SIZE) break;
            if (payload?.pagination && !payload.pagination.hasNextPage) break;
        } catch {
            break;
        }
    }
    return snaps;
}

/**
 * Fetch posts from global skate tags across ALL of Hive blockchain.
 * This is the key SEO strategy — aggregate all skate content as indexable pages.
 */
async function fetchGlobalSkatePosts(): Promise<HivePost[]> {
    const allPosts: HivePost[] = [];
    const seen = new Set<string>();

    // Fetch from each tag in parallel (batches of 4 to not overload the API)
    for (let i = 0; i < GLOBAL_SKATE_TAGS.length; i += 4) {
        const batch = GLOBAL_SKATE_TAGS.slice(i, i + 4);
        const results = await Promise.allSettled(
            batch.map(tag => fetchRankedPosts('created', tag, MAX_POSTS_PER_TAG))
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                for (const post of result.value) {
                    if (!post?.author || !post?.permlink) continue;
                    const key = `${post.author}/${post.permlink}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    allPosts.push(post);
                }
            }
        }
    }

    return allPosts;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = APP_CONFIG.BASE_URL;
    const urls: MetadataRoute.Sitemap = [];
    const seenUrls = new Set<string>();

    const pushUrl = (entry: MetadataRoute.Sitemap[number]) => {
        if (seenUrls.has(entry.url)) return;
        seenUrls.add(entry.url);
        urls.push(entry);
    };

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
        { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${baseUrl}/map`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
        { url: `${baseUrl}/leaderboard`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
        { url: `${baseUrl}/bounties`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
        { url: `${baseUrl}/auction`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
        { url: `${baseUrl}/magazine`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
        { url: `${baseUrl}/invite`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    ];

    try {
        const tag = HIVE_CONFIG.COMMUNITY_TAG;
        if (!tag) throw new Error('Missing Hive community tag');

        staticPages.forEach(pushUrl);

        // Fetch ALL content sources in parallel
        const [communityPosts, feedSnaps, globalPosts] = await Promise.all([
            fetchRankedPosts('created', tag, MAX_COMMUNITY_POSTS),
            fetchAllSnaps(),
            fetchGlobalSkatePosts(),
        ]);

        console.log(`[Sitemap] Community: ${communityPosts.length} | Snaps: ${feedSnaps.length} | Global skate: ${globalPosts.length}`);

        // Community blog posts (highest priority — our own community)
        for (const post of communityPosts) {
            if (!post?.author || !post?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/post/${post.author}/${post.permlink}`,
                lastModified: safeDate(post.created || post.last_update),
                changeFrequency: 'monthly',
                priority: calculatePostPriority(post),
            });
        }

        // Global skate posts from all of Hive (lower base priority but engagement-boosted)
        for (const post of globalPosts) {
            if (!post?.author || !post?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/post/${post.author}/${post.permlink}`,
                lastModified: safeDate(post.created || post.last_update),
                changeFrequency: 'monthly',
                priority: Math.max(0.3, calculatePostPriority(post) - 0.1), // slightly lower than community
            });
        }

        // Snaps
        for (const snap of feedSnaps) {
            if (!snap?.author || !snap?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/user/${snap.author}/snap/${snap.permlink}`,
                lastModified: safeDate(snap.created || snap.last_update),
                changeFrequency: 'monthly',
                priority: 0.5,
            });
        }

        // Unique author profiles
        const authors = new Set<string>();
        for (const post of [...communityPosts, ...globalPosts]) {
            if (post?.author) authors.add(post.author);
        }
        for (const snap of feedSnaps) {
            if (snap?.author) authors.add(snap.author);
        }
        for (const author of authors) {
            pushUrl({
                url: `${baseUrl}/user/${author}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.4,
            });
        }

        // Tag pages — from community posts + global skate tags
        const tags = new Set<string>();
        for (const post of [...communityPosts, ...globalPosts]) {
            try {
                let meta = post.json_metadata;
                if (typeof meta === 'string') meta = JSON.parse(meta);
                if (Array.isArray(meta?.tags)) {
                    for (const t of meta.tags) {
                        if (typeof t === 'string' && t.length > 1 && t.length < 50) {
                            const cleaned = t.toLowerCase().replace(/^#/, '');
                            if (cleaned && /^[a-z0-9]/.test(cleaned)) {
                                tags.add(cleaned);
                            }
                        }
                    }
                }
            } catch { /* skip */ }
        }
        // Also add the global skate tags themselves
        for (const t of GLOBAL_SKATE_TAGS) {
            tags.add(t);
        }
        for (const t of tags) {
            pushUrl({
                url: `${baseUrl}/blog/tag/${t}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.3,
            });
        }

        console.log(`[Sitemap] Total URLs: ${urls.length} (${authors.size} authors, ${tags.size} tags)`);
        return urls;
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return staticPages;
    }
}
