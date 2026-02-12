import { MetadataRoute } from 'next';
import HiveClient from '@/lib/hive/hiveclient';
import { APP_CONFIG, HIVE_CONFIG } from '@/config/app.config';

const REVALIDATE_SECONDS = 60 * 30; // 30 minutes
const BRIDGE_PAGE_SIZE = 20;
const MAX_BLOG_POSTS = 120;
const MAX_SNAP_POSTS = 120;
const SNAP_API_PAGE_SIZE = 50;

export const revalidate = 1800;

type RankedPost = {
    author?: string;
    permlink?: string;
    created?: string;
    last_update?: string;
    body?: string;
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
    }

    return posts;
}

async function fetchSnapsFromApi(maxItems: number): Promise<FeedSnap[]> {
    const snaps: FeedSnap[] = [];
    const seen = new Set<string>();
    const maxPages = Math.ceil(maxItems / SNAP_API_PAGE_SIZE);

    for (let page = 1; page <= maxPages; page += 1) {
        const url = `${APP_CONFIG.API_BASE_URL}/api/v2/feed?limit=${SNAP_API_PAGE_SIZE}&page=${page}`;
        const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
        if (!response.ok) break;
        const payload = await response.json();
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
            if (snaps.length >= maxItems) break;
        }

        if (addedThisBatch === 0 || batch.length < SNAP_API_PAGE_SIZE) break;
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

    // Static pages with proper priorities
    // Only include pages that are NOT blocked in robots.txt
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
            priority: 0.6,
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

        const [blogPosts, feedSnaps] = await Promise.all([
            fetchRankedPosts('created', tag, MAX_BLOG_POSTS),
            fetchSnapsFromApi(MAX_SNAP_POSTS),
        ]);

        for (const post of blogPosts) {
            if (!post?.author || !post?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/post/${post.author}/${post.permlink}`,
                lastModified: safeDate(post.created || post.last_update),
                changeFrequency: 'monthly',
                priority: 0.5,
            });
        }

        for (const snap of feedSnaps) {
            if (!snap?.author || !snap?.permlink) continue;
            pushUrl({
                url: `${baseUrl}/user/${snap.author}/snap/${snap.permlink}`,
                lastModified: safeDate(snap.created || snap.last_update),
                changeFrequency: 'weekly',
                priority: 0.6,
            });
        }

        // Collect unique author profiles from blog posts and snaps
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

        return urls;
    } catch (error) {
        console.error('Error generating sitemap:', error);
        // Return at least static pages if dynamic generation fails
        return staticPages;
    }
}
