"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CHECK_TO_GIFT_DELAY_MS,
  type VoteIconState,
} from "@/components/shared/VoteStateIcon";

interface UseVoteIconStateOptions {
  /** Whether the viewer has an active vote on this post. */
  voted: boolean;
  /** Opt-in: a voted post settles on the gift instead of the check. */
  enableTipping?: boolean;
}

interface UseVoteIconState {
  iconState: VoteIconState;
  /** Call right after a vote broadcast succeeds. */
  markJustVoted: () => void;
}

/**
 * Derives which glyph the vote control should show.
 *
 * A vote cast in THIS session shows the check first as success feedback, then
 * settles on the gift. A vote that already existed when the component mounted
 * goes straight to the gift — the upvote moment has passed, and holding the
 * check there would mean the same state renders as two different glyphs
 * depending on when the vote happened.
 */
export default function useVoteIconState({
  voted,
  enableTipping = false,
}: UseVoteIconStateOptions): UseVoteIconState {
  const [justVoted, setJustVoted] = useState(false);

  useEffect(() => {
    if (!justVoted) return;
    const timer = setTimeout(() => setJustVoted(false), CHECK_TO_GIFT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [justVoted]);

  const iconState: VoteIconState = !voted
    ? "unvoted"
    : enableTipping && !justVoted
      ? "tip"
      : "voted";

  // Stable identity so callers can list it in dependency arrays without
  // re-creating their callbacks on every render.
  const markJustVoted = useCallback(() => setJustVoted(true), []);

  return { iconState, markJustVoted };
}
