/**
 * @deprecated This path is deprecated. Use @/lib/dao/auction instead.
 * Keeping for backward compatibility during migration.
 */

export * from '../lib/dao/auction';
export type { Auction, Bid, Token, HighestBid, WinningBid } from '../lib/dao/types';

// Legacy type for tests
import type { Auction } from '../lib/dao/types';
export interface AuctionsQuery {
  auctions: Auction[];
}
