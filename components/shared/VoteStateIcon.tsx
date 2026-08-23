"use client";

import React from "react";
import { Box } from "@chakra-ui/react";
import { LuArrowUp, LuCheck, LuGift } from "react-icons/lu";

/** How long the success check stays up before turning into the gift. */
export const CHECK_TO_GIFT_DELAY_MS = 1200;

export type VoteIconState = "unvoted" | "voted" | "tip";

interface VoteStateIconProps {
  state: VoteIconState;
  size?: number;
}

/**
 * Single source of truth for the vote button glyph.
 *
 * This ternary used to be copy-pasted in seven places (four render variants in
 * UpvoteButton, one in Snap, two in PostCard), so every new state had to be
 * added seven times. Anything that shows a vote affordance renders this.
 */
export default function VoteStateIcon({ state, size = 24 }: VoteStateIconProps) {
  const boxSize = `${size}px`;

  return (
    <Box
      boxSize={boxSize}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      {state === "tip" ? (
        <LuGift size={size} color="var(--chakra-colors-primary)" />
      ) : state === "voted" ? (
        <LuCheck size={size} color="var(--chakra-colors-primary)" />
      ) : (
        <LuArrowUp size={size} color="var(--chakra-colors-text)" />
      )}
    </Box>
  );
}
