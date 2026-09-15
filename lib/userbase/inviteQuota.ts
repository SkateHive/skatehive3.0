/**
 * The decision of whether a sender may send another invite, kept apart from the
 * route so it can be tested directly.
 *
 * This logic has failed open twice, both times quietly. A Supabase count read
 * with `head: true` returns `{ error: null, count: null }` against a missing
 * table rather than an error, and the original guard checked only the error and
 * then read the count as `count ?? 0` — so "I could not find out" arrived at
 * the same answer as "none yet", and the daily cap switched itself off with
 * nothing in the logs. The table is the only thing standing between a signed-in
 * account and unlimited mail on the platform's SMTP reputation, so anything
 * that is not a real number has to close the door.
 */

export type QuotaVerdict =
  /** Under the cap. `used` is how many are already spent in the window. */
  | { allow: true; used: number }
  /** The count could not be established. Never send on this verdict. */
  | { allow: false; reason: "unavailable" }
  /** The cap is genuinely spent for this window. */
  | { allow: false; reason: "exhausted"; limit: number };

/**
 * @param count the row count as reported by the database, which may be null
 * @param error whatever the client returned alongside it
 * @param limit invites permitted per sender per window
 */
export function assessInviteQuota(
  count: number | null | undefined,
  error: unknown,
  limit: number
): QuotaVerdict {
  if (error) return { allow: false, reason: "unavailable" };

  // Covers null, undefined, and the NaN a bad parse would produce. Only a
  // finite, non-negative number counts as having actually been told something.
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    return { allow: false, reason: "unavailable" };
  }

  if (count >= limit) return { allow: false, reason: "exhausted", limit };

  return { allow: true, used: count };
}
