export interface PoidhBounty {
  id: number;
  issuer: string;
  name: string;
  description: string;
  amount: bigint;
  createdAt: number;
  isOpen: boolean;
  isCancelled: boolean;
  hasActiveClaim: boolean;
  chainId: number;
  claimIds?: number[];
}

export interface PoidhClaim {
  id: number;
  bountyId: number;
  issuer: string;
  name: string;
  description: string;
  createdAt: number;
  accepted: boolean;
}

export type BountyStatus = "active" | "completed" | "cancelled";

export interface BountyFilter {
  status?: BountyStatus[];
  chains?: number[];
  searchTerm?: string;
}
