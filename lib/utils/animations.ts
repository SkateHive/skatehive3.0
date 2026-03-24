import { keyframes } from "@emotion/react";

export const shimmerKeyframe = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

export const pulseKeyframe = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
`;

export const shimmerStyles = {
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background: "linear-gradient(90deg, transparent 0%, var(--chakra-colors-primary) 50%, transparent 100%)",
    backgroundSize: "200% auto",
    opacity: 0.06,
    animation: `${shimmerKeyframe} 2.5s linear infinite`,
    pointerEvents: "none",
  },
} as const;
