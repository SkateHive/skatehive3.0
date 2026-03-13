/**
 * Shared types for DAO functionality (Auctions & Governance)
 * Based on Nouns Builder subgraph schema
 */

import { Address } from 'viem';

// ============================================================================
// AUCTION TYPES
// ============================================================================

export interface Auction {
  bidCount: number;
  bids: Bid[];
  endTime: string;
  extended: boolean;
  settled: boolean;
  startTime: string;
  token: Token;
  dao: Dao;
  firstBidTime?: string;
  highestBid?: HighestBid;
  winningBid?: WinningBid;
}

export interface Bid {
  amount: string;
  bidder: Address;
  bidTime: string;
}

export interface HighestBid {
  amount: string;
  bidTime: string;
  bidder: Address;
}

export interface WinningBid {
  amount: string;
  bidTime: string;
  bidder: Address;
}

export interface Token {
  content: unknown;
  image: string;
  name: string;
  tokenContract: string;
  tokenId: bigint;
  id: string;
}

export interface Dao {
  auctionConfig: AuctionConfig;
}

export interface AuctionConfig {
  minimumBidIncrement: string;
  reservePrice: string;
}

// ============================================================================
// GOVERNANCE TYPES
// ============================================================================

export type ProposalStatus = 
  | 'Pending'
  | 'Active'
  | 'Canceled'
  | 'Defeated'
  | 'Succeeded'
  | 'Queued'
  | 'Expired'
  | 'Executed'
  | 'Vetoed';

export interface Proposal {
  proposalId: string;
  proposalNumber?: number;
  title: string;
  description: string;
  descriptionHash?: string;
  proposer: Address;
  status?: ProposalStatus;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  quorumVotes: string;
  startBlock?: string;
  endBlock?: string;
  timeCreated: string;
  executableFrom?: string;
  expiresAt?: string;
  targets?: string[];
  values?: string[];
  calldatas?: string[];
  voteStart?: string;
  voteEnd?: string;
  executed?: boolean;
  canceled?: boolean;
  vetoed?: boolean;
}

export interface Vote {
  voter: Address;
  support: 0 | 1 | 2; // 0=Against, 1=For, 2=Abstain
  weight: string;
  reason?: string;
}

// ============================================================================
// BUILDER DAO CONFIG
// ============================================================================

export interface BuilderDaoConfig {
  name: string;
  domain: string;
  chainId: number;
  subgraphUrl: string;
  addresses: {
    token: Address;
    auction: Address;
    governor: Address;
    treasury: Address;
    metadata: Address;
  };
}
