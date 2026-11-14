/**
 * The decision of whether a sender may send another invite, kept apart from the
 * route so it can be tested directly.
 *
 * The count and the claim happen together in the database
 * (userbase_reserve_invite, migration 0034): counting from the route and
 * inserting afterwards let concurrent requests all read the same count and all
 * pass. What is left here is reading the function's answer — and that reading
 * has to fail closed.
 *
 * This logic has failed open twice before, both times quietly. A Supabase count
 * read with `head: true` returns `{ error: null, count: null }` against a
 * missing table rather than an error, and the original guard checked only the
 * error and then read the count as `count ?? 0` — so "I could not find out"
 * arrived at the same answer as "none yet", and the daily cap switched itself
 * off with nothing in the logs. The cap is the only thing standing between a
 * signed-in account and unlimited mail on the platform's SMTP reputation, so
 * anything that is not a well-formed answer has to close the door.
 */

export type QuotaVerdict =
  /** A slot was claimed. `used` is how many were already spent in the window. */
  | { allow: true; reservationId: string; used: number }
  /** The answer could not be established. Never send on this verdict. */
  | { allow: false; reason: "unavailable" }
  /** The cap is genuinely spent for this window. */
  | { allow: false; reason: "exhausted"; limit: number };

/**
 * @param data what the userbase_reserve_invite RPC returned: one row of
 *   `{ reservation_id, used }`, with a null id when the cap is spent
 * @param error whatever the client returned alongside it
 * @param limit invites permitted per sender per window, for the message
 */
export function assessInviteReservation(
  data: unknown,
  error: unknown,
  limit: number
): QuotaVerdict {
  if (error) return { allow: false, reason: "unavailable" };

  if (!Array.isArray(data) || data.length !== 1) {
    return { allow: false, reason: "unavailable" };
  }
  const row = data[0] as { reservation_id?: unknown; used?: unknown } | null;
  if (!row || typeof row !== "object") {
    return { allow: false, reason: "unavailable" };
  }

  // Covers null, undefined, and the NaN a bad parse would produce. Only a
  // finite, non-negative number counts as having actually been told something.
  const { used, reservation_id } = row;
  if (typeof used !== "number" || !Number.isFinite(used) || used < 0) {
    return { allow: false, reason: "unavailable" };
  }

  if (reservation_id === null) {
    return { allow: false, reason: "exhausted", limit };
  }
  if (typeof reservation_id !== "string" || !reservation_id) {
    return { allow: false, reason: "unavailable" };
  }

  return { allow: true, reservationId: reservation_id, used };
}
