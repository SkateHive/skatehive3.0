import { APP_CONFIG, HIVE_CONFIG } from '@/config/app.config';
import HiveClient from '@/lib/hive/hiveclient';

// === CONFIG ===
const BRIDGE_PAGE_SIZE = 20;
const SNAP_API_PAGE_SIZE = 50;
const MAX_SNAP_PAGES = 100;
const MAX_COMMUNITY_POSTS = 500;
const GLOBAL_SKATE_TAGS = [
  'skateboarding', 'skateboard', 'skate', 'skatelife',
  'skating', 'skatepark', 'streetskating', 'sk8',
  'skatevideo', 'kickflip', 'longboard', 'skateshop',
  'skatetricks', 'skater', 'skateclips', 'cruiser',
];
const MAX_POSTS_PER_TAG = 100;

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

async function fetchGlobalSkatePosts(): Promise<HivePost[]> {
  const allPosts: HivePost[] = [];
  const seen = new Set<string>();

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

    const [communityPosts, feedSnaps, globalPosts] = await Promise.all([
      fetchRankedPosts('created', tag, MAX_COMMUNITY_POSTS),
      fetchAllSnaps(),
      fetchGlobalSkatePosts(),
    ]);

    for (const post of communityPosts) {
      if (!post?.author || !post?.permlink) continue;
      addUrl(`${baseUrl}/post/${post.author}/${post.permlink}`, safeDate(post.created || post.last_update).toISOString(), 'monthly', calculatePostPriority(post));
    }

    for (const post of globalPosts) {
      if (!post?.author || !post?.permlink) continue;
      addUrl(`${baseUrl}/post/${post.author}/${post.permlink}`, safeDate(post.created || post.last_update).toISOString(), 'monthly', Math.max(0.3, calculatePostPriority(post) - 0.1));
    }

    for (const snap of feedSnaps) {
      if (!snap?.author || !snap?.permlink) continue;
      addUrl(`${baseUrl}/user/${snap.author}/snap/${snap.permlink}`, safeDate(snap.created || snap.last_update).toISOString(), 'monthly', 0.5);
    }

    const authors = new Set<string>();
    for (const post of [...communityPosts, ...globalPosts]) if (post?.author) authors.add(post.author);
    for (const snap of feedSnaps) if (snap?.author) authors.add(snap.author);
    for (const author of authors) {
      addUrl(`${baseUrl}/user/${author}`, new Date().toISOString(), 'weekly', 0.4);
    }

    const tags = new Set<string>();
    for (const post of [...communityPosts, ...globalPosts]) {
      try {
        let meta = post.json_metadata;
        if (typeof meta === 'string') meta = JSON.parse(meta);
        if (Array.isArray(meta?.tags)) {
          for (const t of meta.tags) {
            if (typeof t === 'string' && t.length > 1 && t.length < 50) {
              const cleaned = t.toLowerCase().replace(/^#/, '');
              if (cleaned && /^[a-z0-9]/.test(cleaned)) tags.add(cleaned);
            }
          }
        }
      } catch { /* skip */ }
    }
    for (const t of GLOBAL_SKATE_TAGS) tags.add(t);
    for (const t of tags) {
      addUrl(`${baseUrl}/blog/tag/${t}`, new Date().toISOString(), 'weekly', 0.3);
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
