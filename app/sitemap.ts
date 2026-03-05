import { MetadataRoute } from 'next';
import HiveClient from '@/lib/hive/hiveclient';
import { APP_CONFIG, HIVE_CONFIG } from '@/config/app.config';

// Aggressive sitemap — index ALL community content
const REVALIDATE_SECONDS = 60 * 60; // 1 hour (was 30min — heavier now)
const BRIDGE_PAGE_SIZE = 20;
const MAX_BLOG_POSTS = 500; // Up from 120 → 500 recent blog posts via Hive
const SNAP_API_PAGE_SIZE = 50;
const MAX_SNAP_PAGES = 100; // Up to 5000 snaps from API

export const revalidate = 3600;

type RankedPost = {
    author?: string;
    permlink?: string;
    created?: string;
    last_update?: string;
    body?: string;
    json_metadata?: any;
};

type FeedSnap = {
    author?: string;
    permlink?: string;
    created?: string;
    last_update?: string;
    body?: string;
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

async function fetchRankedPosts(sort: string, tag: string, maxItems: number): Promise<RankedPost[]> {
    const posts: RankedPost[] = [];
    const seen = new Set<string>();
    let startAuthor: string | undefined;
    let startPermlink: string | undefined;

    const maxPages = Math.ceil(maxItems / BRIDGE_PAGE_SIZE);

    for (let page = 0; page < maxPages; page += 1) {
        const limit = Math.min(BRIDGE_PAGE_SIZE, maxItems - posts.length);
        try {
            const batch: RankedPost[] = await HiveClient.call('bridge', 'get_ranked_posts', {
                sort,
                tag,
                limit,
                start_author: startAuthor || undefined,
                start_permlink: startPermlink || undefined,
                observer: ''
            });

            if (!batch?.length) break;

            let addedThisBatch = 0;
            for (const post of batch) {
                if (!post?.author || !post?.permlink) continue;
                const key = `${post.author}/${post.permlink}`;
                if (seen.has(key)) continue;
                seen.add(key);
                posts.push(post);
                addedThisBatch += 1;
                if (posts.length >= maxItems) break;
            }

            const last = batch[batch.length - 1];
            if (!last?.author || !last?.permlink || addedThisBatch === 0) break;
            startAuthor = last.author;
            startPermlink = last.permlink;

            if (batch.length < limit) break;
        } catch {
            break; // Don't let one failed page break the whole sitemap
        }
    }

    return posts;
}

async function fetchAllSnapsFromApi(): Promise<FeedSnap[]> {
    const snaps: FeedSnap[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= MAX_SNAP_PAGES; page += 1) {
        try {
            const url = `${APP_CONFIG.API_BASE_URL}/api/v2/feed?limit=${SNAP_API_PAGE_SIZE}&page=${page}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout per page

            const response = await fetch(url, {
                next: { revalidate: REVALIDATE_SECONDS },
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) break;
            const payload = await response.json();

            // Check total from pagination
            const pagination = payload?.pagination;
            const batch = extractFeedItems(payload);
            if (!batch.length) break;

            let addedThisBatch = 0;
            for (const snap of batch) {
                if (!snap?.author || !snap?.permlink) continue;
                const key = `${snap.author}/${snap.permlink}`;
                if (seen.has(key)) continue;
                seen.add(key);
                snaps.push(snap);
                addedThisBatch += 1;
            }

            if (addedThisBatch === 0 || batch.length < SNAP_API_PAGE_SIZE) break;

            // If pagination says no next page, stop
            if (pagination && !pagination.hasNextPage) break;
        } catch {
            break; // Timeout or error — stop paginating, use what we have
        }
    }

    return snaps;
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
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/blog`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/leaderboard`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/bounties`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/auction`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/map`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.8, // Bumped — highest SEO value page
        },
        {
            url: `${baseUrl}/magazine`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/invite`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.4,
        },
    ];

    try {
        const tag = HIVE_CONFIG.COMMUNITY_TAG;
        if (!tag) {
            throw new Error('Missing Hive community tag for sitemap');
        }

        staticPages.forEach(pushUrl);

        // Fetch blog posts from Hive AND all snaps from API in parallel
        const [blogPosts, feedSnaps] = await Promise.all([
            fetchRankedPosts('created', tag, MAX_BLOG_POSTS),
            fetchAllSnapsFromApi(),
        ]);

        console.log(`[Sitemap] Fetched ${blogPosts.length} blog posts + ${feedSnaps.length} snaps`);

        // Blog posts — full articles get higher priority
        for (const post of blogPosts) {
            if (!post?.author || !post?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/post/${post.author}/${post.permlink}`,
                lastModified: safeDate(post.created || post.last_update),
                changeFrequency: 'monthly',
                priority: 0.6, // Bumped from 0.5
            });
        }

        // Snaps — shorter content but still valuable
        for (const snap of feedSnaps) {
            if (!snap?.author || !snap?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/user/${snap.author}/snap/${snap.permlink}`,
                lastModified: safeDate(snap.created || snap.last_update),
                changeFrequency: 'monthly',
                priority: 0.5,
            });
        }

        // Collect unique author profiles
        const authors = new Set<string>();
        for (const post of blogPosts) {
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

        // Collect unique tags from blog posts
        const tags = new Set<string>();
        for (const post of blogPosts) {
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
            } catch {
                // skip invalid metadata
            }
        }
        for (const t of tags) {
            pushUrl({
                url: `${baseUrl}/blog/tag/${t}`,
                lastModified: new Date(),
                changeFrequency: 'weekly',
                priority: 0.3,
            });
        }

        console.log(`[Sitemap] Total URLs: ${urls.length}`);
        return urls;
    } catch (error) {
        console.error('Error generating sitemap:', error);
        return staticPages;
    }
}
