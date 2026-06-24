import { APP_CONFIG, HIVE_CONFIG } from '@/config/app.config';
import HiveClient from '@/lib/hive/hiveclient';

// === CONFIG ===
const BRIDGE_PAGE_SIZE = 20;
const SNAP_API_PAGE_SIZE = 50;
// Snaps are thin, ephemeral content and each URL maps to a per-request,
// bot-rendered (uncacheable) page. We index only the most recent ones to
// keep crawl surface — and therefore serverless invocations — bounded.
// (Was 100 pages = up to 5,000 snap URLs.)
const MAX_SNAP_PAGES = 10;
const MAX_COMMUNITY_POSTS = 500;
const COMMUNITY_TAG_ALLOWLIST = new Set([
  'intoskate',
  HIVE_CONFIG.COMMUNITY_TAG?.toLowerCase(),
].filter(Boolean));
const TAG_SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}$/;
const MIN_TAG_POSTS_FOR_SITEMAP = 2;

// Cache the generated sitemap for an hour. Previously `force-dynamic` was
// set alongside `revalidate`, which silently disabled it — every uncached
// request then re-ran the full Hive crawl (hundreds of RPCs). ISR lets the
// expensive generation run at most once per hour and serve from cache.
export const revalidate = 3600;

type HivePost = { author?: string; permlink?: string; created?: string; last_update?: string; json_metadata?: any; pending_payout_value?: string; total_payout_value?: string; net_votes?: number; children?: number; };
type FeedSnap = { author?: string; permlink?: string; created?: string; last_update?: string; };

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

function calculatePostPriority(post: HivePost): number {
  let score = 0.5;
  const votes = post.net_votes || 0;
  const comments = post.children || 0;
  const pendingPayout = parseFloat(post.pending_payout_value?.replace(' HBD', '') || '0');
  const totalPayout = parseFloat(post.total_payout_value?.replace(' HBD', '') || '0');
  const payout = Math.max(pendingPayout, totalPayout);
  if (votes > 50) score += 0.15; else if (votes > 20) score += 0.1; else if (votes > 5) score += 0.05;
  if (comments > 10) score += 0.1; else if (comments > 3) score += 0.05;
  if (payout > 10) score += 0.1; else if (payout > 1) score += 0.05;
  return Math.min(score, 0.9);
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
    } catch { break; }
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
      const response = await fetch(url, { signal: controller.signal });
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
    } catch { break; }
  }
  return snaps;
}

function extractCommunityTags(post: HivePost): string[] {
  try {
    let meta = post.json_metadata;
    if (typeof meta === 'string') meta = JSON.parse(meta);
    if (!Array.isArray(meta?.tags)) return [];

    return meta.tags
      .filter((tag: unknown): tag is string => typeof tag === 'string')
      .map((tag: string) => tag.toLowerCase().replace(/^#/, '').trim())
      .filter((tag: string) => TAG_SLUG_REGEX.test(tag));
  } catch {
    return [];
  }
}

function isCommunityRelevantTag(tag: string): boolean {
  return COMMUNITY_TAG_ALLOWLIST.has(tag) || tag.startsWith('skate');
}

export async function GET() {
  const baseUrl = APP_CONFIG.BASE_URL;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  const seenUrls = new Set<string>();
  const addUrl = (loc: string, lastmod: string, changefreq: string, priority: number) => {
    if (seenUrls.has(loc)) return;
    seenUrls.add(loc);
    xml += `  <url>\n`;
    xml += `    <loc>${loc}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += `  </url>\n`;
  };

  try {
    const tag = HIVE_CONFIG.COMMUNITY_TAG;
    if (!tag) throw new Error('Missing Hive community tag');

    const [communityPosts, feedSnaps] = await Promise.all([
      fetchRankedPosts('created', tag, MAX_COMMUNITY_POSTS),
      fetchAllSnaps(),
    ]);

    for (const post of communityPosts) {
      if (!post?.author || !post?.permlink) continue;
      addUrl(`${baseUrl}/post/${post.author}/${post.permlink}`, safeDate(post.created || post.last_update).toISOString(), 'monthly', calculatePostPriority(post));
    }

    for (const snap of feedSnaps) {
      if (!snap?.author || !snap?.permlink) continue;
      addUrl(`${baseUrl}/user/${snap.author}/snap/${snap.permlink}`, safeDate(snap.created || snap.last_update).toISOString(), 'monthly', 0.5);
    }

    const authors = new Set<string>();
    for (const post of communityPosts) if (post?.author) authors.add(post.author);
    for (const snap of feedSnaps) if (snap?.author) authors.add(snap.author);
    for (const author of authors) {
      addUrl(`${baseUrl}/user/${author}`, new Date().toISOString(), 'weekly', 0.4);
    }

    const tagCounts = new Map<string, number>();
    for (const post of communityPosts) {
      for (const tag of extractCommunityTags(post)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    for (const [tagName, count] of tagCounts.entries()) {
      if (count < MIN_TAG_POSTS_FOR_SITEMAP) continue;
      if (!isCommunityRelevantTag(tagName)) continue;
      addUrl(`${baseUrl}/blog/tag/${tagName}`, new Date().toISOString(), 'weekly', 0.3);
    }

  } catch (error) {
    console.error('Error generating posts sitemap:', error);
  }

  xml += `</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate',
    },
  });
}
