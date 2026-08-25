/**
 * What a portfolio fetch is allowed to do to what is already on screen.
 *
 * PortfolioContext used to treat a failed fetch as a result: the fetcher
 * returned null on any error and the caller committed it, so a network failure
 * replaced a wallet that was sitting valid in localStorage with nothing. On
 * screen that reads as "you have no money" — a stronger and more wrong claim
 * than the truth, which is "we could not read it just now".
 *
 * The rule below is deliberately narrow: only SUCCESS may write. Failure and
 * abort leave the previous value exactly as it was. Emptiness is not failure —
 * a wallet that really holds nothing is an answer, and it does replace.
 *
 * Kept pure and free of React so the outcome matrix is testable, including the
 * full-outage case that is awkward to reproduce by hand.
 */

export type FetchOutcome<T> =
  | { status: "success"; data: T }
  | { status: "failed"; message: string }
  | { status: "aborted" };

/**
 * The value to render after a fetch attempt.
 *
 * @param previous what is on screen now (from cache or an earlier fetch)
 * @param outcome  what the attempt produced
 */
export function resolvePortfolioState<T>(
  previous: T | null,
  outcome: FetchOutcome<T>,
): T | null {
  if (outcome.status === "success") return outcome.data;
  return previous;
}

export interface VerifiedOutcome<T> {
  address: string;
  outcome: FetchOutcome<T>;
}

/**
 * Same rule, applied per address, for the Farcaster-verified wallets.
 *
 * An address missing from `outcomes` is dropped rather than kept: that means
 * the user unlinked it, which is a real change and not a read failure. An
 * address that IS in the list but failed keeps whatever it had.
 */
export function mergeVerifiedPortfolios<T>(
  previous: Record<string, T>,
  outcomes: VerifiedOutcome<T>[],
): Record<string, T> {
  const merged: Record<string, T> = {};

  for (const { address, outcome } of outcomes) {
    const kept = resolvePortfolioState(previous[address] ?? null, outcome);
    if (kept !== null) merged[address] = kept;
  }

  return merged;
}
