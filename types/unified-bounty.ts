import type { Discussion } from '@hiveio/dhive';
import type { PoidhBounty } from './poidh';

export type BountySource = 'hive' | 'poidh';

export interface UnifiedBounty {
  // Identity
  id: string;
  source: BountySource;

  // Display
  title: string;
  description: string;
  imageUrl: string | null;

  // Reward
  rewardAmount: number;
  rewardCurrency: string;
  rewardDisplay: string;

  // Status
  isActive: boolean;
  statusLabel: 'OPEN' | 'CLOSED';

  // Time
  createdAt: number; // unix seconds
  deadline: number | null; // unix seconds, Hive only

  // Engagement
  submissionCount: number;
  claimCount: number;

  // Author
  authorDisplay: string;
  authorAvatar: string | null;

  // Navigation
  detailHref: string;

  // Winner (for closed bounties)
  winnerDisplay: string | null;
  winnerAvatar: string | null;

  // Chain/source info
  chainLabel: string | null; // null for Hive, "Base"/"Arb" for POIDH

  // Raw source data passthrough
  _hiveDiscussion?: Discussion;
  _poidhBounty?: PoidhBounty;
}
