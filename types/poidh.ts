export type PoidhApiStatus = "open" | "past" | "progress";

export interface PoidhBounty {
  id: number;
  onChainId: number;
  chainId: number;
  title: string;
  description: string;
  amount: string;
  issuer: string;
  createdAt: number;
  inProgress: boolean;
  isJoinedBounty: boolean;
  isCanceled: boolean;
  isMultiplayer: boolean;
  isVoting: boolean;
  deadline: number | null;
  amountSort?: number;
  hasClaims: boolean;
  hasParticipants: boolean;
}

export interface PoidhBountiesResponse {
  items: PoidhBounty[];
  nextCursor?: number | null;
}
