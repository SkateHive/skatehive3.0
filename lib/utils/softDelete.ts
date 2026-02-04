interface PostLike {
  author?: string;
  permlink?: string;
}

interface DeletedPostsResponse {
  data?: Array<{ author: string; permlink: string }>;
}

const CACHE_TTL_MS = 30_000;

let deletedPostKeysCache: Set<string> | null = null;
let deletedPostKeysFetchedAt = 0;
let pendingFetch: Promise<Set<string>> | null = null;

function getPostKey(author: string, permlink: string): string {
  return `${author.trim().toLowerCase()}/${permlink.trim().toLowerCase()}`;
}

async function loadDeletedPostKeysFromApi(): Promise<Set<string>> {
  const response = await fetch('/api/lite-posts/deleted', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch deleted post keys (${response.status})`);
  }

  const payload = (await response.json()) as DeletedPostsResponse;
  const records = payload.data || [];
  return new Set(records.map((record) => getPostKey(record.author, record.permlink)));
}

export async function getDeletedPostKeys(): Promise<Set<string>> {
  if (typeof window === 'undefined') {
    return new Set();
  }

  const now = Date.now();
  if (deletedPostKeysCache && now - deletedPostKeysFetchedAt < CACHE_TTL_MS) {
    return deletedPostKeysCache;
  }

  if (!pendingFetch) {
    pendingFetch = loadDeletedPostKeysFromApi()
      .then((keys) => {
        deletedPostKeysCache = keys;
        deletedPostKeysFetchedAt = Date.now();
        return keys;
      })
      .finally(() => {
        pendingFetch = null;
      });
  }

  return pendingFetch;
}

export function markPostAsSoftDeleted(author: string, permlink: string): void {
  if (!deletedPostKeysCache) {
    deletedPostKeysCache = new Set();
  }
  deletedPostKeysCache.add(getPostKey(author, permlink));
  deletedPostKeysFetchedAt = Date.now();
}

export async function filterSoftDeletedPosts<T extends PostLike>(posts: T[]): Promise<T[]> {
  if (!posts || posts.length === 0) {
    return posts;
  }

  try {
    const deletedKeys = await getDeletedPostKeys();
    if (deletedKeys.size === 0) {
      return posts;
    }

    return posts.filter((post) => {
      const author = String(post.author || '');
      const permlink = String(post.permlink || '');
      if (!author || !permlink) return true;
      return !deletedKeys.has(getPostKey(author, permlink));
    });
  } catch (error) {
    console.error('Failed to filter soft-deleted posts:', error);
    return posts;
  }
}

export async function softDeletePostByApi(
  author: string,
  permlink: string,
  deletedBy: string
): Promise<void> {
  const response = await fetch('/api/lite-posts/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      author,
      permlink,
      deletedBy,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Soft delete failed with status ${response.status}`);
  }

  markPostAsSoftDeleted(author, permlink);
}
