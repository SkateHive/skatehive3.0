/**
 * Instagram Graph API client for the shared @skatehive Business account.
 *
 * Publishing flow (two-phase, per Meta's docs):
 *   1. POST /{ig-user-id}/media         → returns a media container id
 *   2. POST /{ig-user-id}/media_publish → publishes the container, returns media id
 *
 * Photos publish synchronously. Reels/videos require polling the container's
 * status_code until FINISHED before publish_media will accept it.
 */

// IG Login tokens (issued via "Configuração da API com login do Instagram") must
// be sent to graph.instagram.com. FB Login Page tokens use graph.facebook.com.
// The endpoint paths and parameters are identical; only the host differs.
const GRAPH_API_BASE = process.env.INSTAGRAM_GRAPH_HOST || "https://graph.instagram.com";

function getConfig() {
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v23.0";
  if (!igUserId || !accessToken) {
    return { ok: false as const, error: "Instagram cross-posting is not configured on the server." };
  }
  return { ok: true as const, igUserId, accessToken, version };
}

type PublishImageInput = {
  imageUrl: string;
  caption: string;
};

type PublishReelInput = {
  videoUrl: string;
  caption: string;
  /** Optional thumbnail/cover image URL (publicly hosted) */
  coverUrl?: string;
};

export type PublishResult =
  | { success: true; containerId: string; mediaId: string; permalink?: string }
  | { success: false; error: string };

async function graphFetch(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  const cfg = getConfig();
  if (!cfg.ok) return { ok: false, status: 500, data: { error: { message: cfg.error } } };
  const url = new URL(`${GRAPH_API_BASE}/${cfg.version}${path}`);
  if (init.searchParams) {
    for (const [k, v] of Object.entries(init.searchParams)) url.searchParams.set(k, v);
  }
  url.searchParams.set("access_token", cfg.accessToken);
  const res = await fetch(url.toString(), { ...init, searchParams: undefined } as RequestInit);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data };
}

function fbError(data: any, fallback: string): string {
  return data?.error?.message || data?.error_user_msg || fallback;
}

async function fetchPermalink(mediaId: string): Promise<string | undefined> {
  const res = await graphFetch(`/${mediaId}`, { searchParams: { fields: "permalink" } });
  if (res.ok && typeof res.data?.permalink === "string") return res.data.permalink;
  return undefined;
}

/**
 * Wait for a media container's status_code to become FINISHED, or fail.
 * Required before media_publish even for images — PNGs that Meta has to
 * convert to JPEG, or large images, can return IN_PROGRESS for a few seconds.
 */
async function waitForContainerReady(
  containerId: string,
  timeoutMs: number,
  pollMs: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statusRes = await graphFetch(`/${containerId}`, {
      searchParams: { fields: "status_code,status" },
    });
    const code = statusRes.data?.status_code;
    if (code === "FINISHED") return { ok: true };
    if (code === "ERROR" || code === "EXPIRED") {
      return {
        ok: false,
        error: `IG container ${code}: ${statusRes.data?.status || "no detail"}`,
      };
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return { ok: false, error: `IG container did not finish within ${timeoutMs}ms` };
}

/**
 * Publish a single image to the configured @skatehive IG account.
 * Image must be a publicly hosted JPEG or PNG. PNGs are auto-converted by Meta.
 */
export async function publishImageToInstagram(input: PublishImageInput): Promise<PublishResult> {
  const cfg = getConfig();
  if (!cfg.ok) return { success: false, error: cfg.error };

  // Step 1: create container
  const containerRes = await graphFetch(`/${cfg.igUserId}/media`, {
    method: "POST",
    searchParams: {
      image_url: input.imageUrl,
      caption: input.caption,
    },
  });
  if (!containerRes.ok || !containerRes.data?.id) {
    return { success: false, error: fbError(containerRes.data, "Failed to create IG media container.") };
  }
  const containerId: string = containerRes.data.id;

  // Step 2: wait for FINISHED — short timeout because images normally finish in 1-5s
  const ready = await waitForContainerReady(containerId, 30_000, 1500);
  if (!ready.ok) return { success: false, error: ready.error };

  // Step 3: publish
  const publishRes = await graphFetch(`/${cfg.igUserId}/media_publish`, {
    method: "POST",
    searchParams: { creation_id: containerId },
  });
  if (!publishRes.ok || !publishRes.data?.id) {
    return { success: false, error: fbError(publishRes.data, "Failed to publish IG media.") };
  }
  const mediaId: string = publishRes.data.id;
  const permalink = await fetchPermalink(mediaId);
  return { success: true, containerId, mediaId, permalink };
}

/**
 * Publish a Reel (video) to the configured @skatehive IG account.
 * Video must be publicly hosted MP4 (H.264/AAC) within IG Reels limits
 * (3–90s, ≤ 100MB, 9:16 recommended). We poll the container's status_code
 * until FINISHED (or fail/expire) before publishing.
 */
export async function publishReelToInstagram(input: PublishReelInput): Promise<PublishResult> {
  const cfg = getConfig();
  if (!cfg.ok) return { success: false, error: cfg.error };

  const containerRes = await graphFetch(`/${cfg.igUserId}/media`, {
    method: "POST",
    searchParams: {
      media_type: "REELS",
      video_url: input.videoUrl,
      caption: input.caption,
      ...(input.coverUrl ? { cover_url: input.coverUrl } : {}),
    },
  });
  if (!containerRes.ok || !containerRes.data?.id) {
    return { success: false, error: fbError(containerRes.data, "Failed to create IG Reel container.") };
  }
  const containerId: string = containerRes.data.id;

  // Reels can take up to ~2 minutes (encode + checks). Poll status_code.
  const ready = await waitForContainerReady(containerId, 180_000, 4000);
  if (!ready.ok) return { success: false, error: ready.error };

  const publishRes = await graphFetch(`/${cfg.igUserId}/media_publish`, {
    method: "POST",
    searchParams: { creation_id: containerId },
  });
  if (!publishRes.ok || !publishRes.data?.id) {
    return { success: false, error: fbError(publishRes.data, "Failed to publish IG Reel.") };
  }
  const mediaId: string = publishRes.data.id;
  const permalink = await fetchPermalink(mediaId);
  return { success: true, containerId, mediaId, permalink };
}

export function isInstagramConfigured(): boolean {
  return getConfig().ok;
}
