/**
 * Centralized ISR (Incremental Static Regeneration) policy.
 *
 * One source of truth for how long each class of route stays cached, so the
 * tradeoff is intentional and consistent instead of an ad-hoc per-file value.
 *
 * IMPORTANT: this is for RUNTIME use — e.g. `fetch(url, { next: { revalidate:
 * REVALIDATE.LISTING } })`. It CANNOT be used for a route's
 * `export const revalidate`: Next statically parses that segment config at
 * build time and rejects anything but a literal number. Use the matching
 * literal there and reference the tier name in a comment.
 *
 * Rule of thumb:
 *   - Content whose body is immutable after publish (a Hive post, a spot) can
 *     cache for a long time — votes/comments/engagement load client-side, so
 *     a stale HTML shell is invisible to the user.
 *   - Listings that gain new items (a tag feed, a profile) want a shorter
 *     window so new content appears without waiting a full day.
 *
 * Values are in seconds (the unit Next.js `export const revalidate` expects).
 */
export const REVALIDATE = {
  /** Immutable-after-publish bodies: posts, spots. */
  CONTENT: 86400, // 1 day
  /** Listings that accrue new items: tag feeds, profiles. */
  LISTING: 3600, // 1 hour
  /** Frequently-changing surfaces that still benefit from a short cache. */
  DYNAMIC: 300, // 5 minutes
} as const;
