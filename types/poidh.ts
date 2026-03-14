// POIDH v3 Contract Types (Base Chain)
export interface PoidhBounty {
  id: string;
  onChainId: number; // actual on-chain bounty ID (different from indexer id)
  issuer: string;
  name: string;
  description: string;
  amount: string; // in wei, convert to ETH for display
  claimer: string | null;
  createdAt: number;
  claimId: number;
  isOpenBounty: boolean;
  chainId?: number; // 8453 Base, 42161 Arbitrum
  participants?: {
    addresses: string[];
    amounts: string[];
  };
  claimCount?: number;
  claims?: PoidhClaim[];
  imageUrl?: string | null;
  inProgress?: boolean;
  isCanceled?: boolean;
  isActive?: boolean; // True when fetched from status='open' endpoint
}

export interface PoidhClaim {
  id: string;
  bountyId: string;
  issuer: string;
  bountyIssuer: string;
  name: string;
  description: string;
  createdAt: number;
  accepted: boolean;
}

export interface PoidhBountiesResponse {
  bounties: PoidhBounty[];
  total: number;
  offset: number;
  limit: number;
}
