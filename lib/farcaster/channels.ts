/**
 * Farcaster channels SkateHive is allowed to post into, and the embed budget
 * a cast can carry.
 *
 * Why this exists as a shared module: the miniapp path
 * (`sdk.actions.composeCast`) hands `channelKey` straight from the browser to
 * the Farcaster host. Our server-side allowlist in
 * `app/api/farcaster/cast/route.ts` is never consulted on that path, so the
 * client is the only place the rule can be enforced. Keeping the list here
 * means the miniapp path and the server path can't silently drift.
 *
 * NOTE: `app/api/farcaster/cast/route.ts` (ALLOWED_CHANNELS) and
 * `components/homepage/SnapComposer.tsx` (FARCASTER_CHANNELS) still carry
 * their own copies. Folding those into this module is a follow-up — it means
 * touching the composer and the cast route, which is outside this change.
 */

export const FARCASTER_CHANNELS = [
  { id: "skateboard", label: "/skateboard" },
  { id: "gnars", label: "/gnars" },
  { id: "higher", label: "/higher" },
] as const;

export type FarcasterChannelId = (typeof FARCASTER_CHANNELS)[number]["id"];

/**
 * Default channel for a cast SkateHive composes on the user's behalf.
 * Mirrors the composer's own default (SnapComposer.tsx) so a share from the
 * miniapp lands where a cross-post from the composer would.
 */
export const DEFAULT_FARCASTER_CHANNEL: FarcasterChannelId = "skateboard";

/** Farcaster's own cap: a cast carries at most two embeds. */
export const MAX_CAST_EMBEDS = 2;

/**
 * Normalize a channel key the way the cast route does (trim, lowercase, drop a
 * leading slash so both `/skateboard` and `skateboard` work) and return it only
 * if it is allowed. Anything else returns `undefined`, which composes the cast
 * into the user's own feed rather than failing the share.
 */
export function resolveChannelKey(
  channel: string | null | undefined
): FarcasterChannelId | undefined {
  if (!channel) {
    return undefined;
  }
  const normalized = channel.trim().toLowerCase().replace(/^\/+/, "");
  const match = FARCASTER_CHANNELS.find((c) => c.id === normalized);
  return match?.id;
}

/**
 * Trim a list of embed URLs to what a cast can actually carry.
 *
 * Drops empties, collapses URLs that differ only by trailing slash or
 * surrounding whitespace (so one link never burns both slots), preserves the
 * order the caller gave, and caps at {@link MAX_CAST_EMBEDS}.
 *
 * The normalization is for comparison only — the URL the caller passed is what
 * gets returned, because the normalized form is not always what should be
 * displayed or crawled.
 */
export function limitCastEmbeds(urls: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const url of urls) {
    if (!url || !url.trim()) {
      continue;
    }
    const key = normalizeEmbedUrl(url);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(url.trim());
    if (out.length >= MAX_CAST_EMBEDS) {
      break;
    }
  }

  return out;
}

function normalizeEmbedUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.endsWith("/") && parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return trimmed;
  }
}
