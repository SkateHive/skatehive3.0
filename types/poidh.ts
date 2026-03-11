// POIDH v3 Contract Types (Base Chain)
export interface PoidhBounty {
  id: string;
  issuer: string;
  name: string;
  description: string;
  amount: string; // in wei, convert to ETH for display
  claimer: string | null;
  createdAt: number;
  claimId: number;
  isOpenBounty: boolean;
  participants?: {
    addresses: string[];
    amounts: string[];
  };
  claimCount?: number;
  claims?: PoidhClaim[];
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
