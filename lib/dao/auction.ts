/**
 * Auction Service
 * Fetches auction data from Nouns Builder subgraph
 */

import { noCacheApolloClient } from '@/lib/utils/apollo';
import { gql } from '@apollo/client';
import { Auction } from './types';

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const GET_AUCTIONS = gql`
  query Auctions(
    $where: Auction_filter
    $orderBy: Auction_orderBy
    $orderDirection: OrderDirection
    $first: Int
  ) {
    auctions(
      where: $where
      orderBy: $orderBy
      orderDirection: $orderDirection
      first: $first
    ) {
      bidCount
      bids(orderBy: bidTime) {
        amount
        bidder
        bidTime
      }
      endTime
      extended
      firstBidTime
      highestBid {
        amount
        bidTime
        bidder
      }
      settled
      startTime
      token {
        content
        image
        name
        tokenContract
        tokenId
        id
      }
      winningBid {
        amount
        bidTime
        bidder
      }
      dao {
        auctionConfig {
          minimumBidIncrement
          reservePrice
        }
      }
    }
  }
`;

// ============================================================================
// QUERY RESPONSE TYPES
// ============================================================================

interface AuctionsQueryResponse {
  auctions: Auction[];
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch all auctions for a DAO
 * @param tokenAddress - DAO token contract address
 * @returns Array of auctions
 */
export async function fetchAuctions(tokenAddress: string): Promise<Auction[]> {
  const where = { dao: tokenAddress.toLowerCase() };

  try {
    const { data } = await noCacheApolloClient.query<AuctionsQueryResponse>({
      query: GET_AUCTIONS,
      variables: {
        where,
        orderBy: 'endTime',
        orderDirection: 'desc',
        first: 300,
      },
    });

    return data.auctions;
  } catch (error) {
    console.error('Error fetching auctions:', error);
    throw error instanceof Error ? error : new Error('Error fetching auctions');
  }
}

/**
 * Fetch auction by specific token ID
 * @param tokenAddress - DAO token contract address
 * @param tokenId - Token ID
 * @returns Single auction or null
 */
export async function fetchAuctionByTokenId(
  tokenAddress: string,
  tokenId: number
): Promise<Auction | null> {
  if (!tokenId) return null;

  try {
    // First try: Filter by both DAO and tokenId (string format)
    let queryResult = await noCacheApolloClient.query<AuctionsQueryResponse>({
      query: GET_AUCTIONS,
      variables: {
        where: {
          dao: tokenAddress.toLowerCase(),
          token_: { tokenId: tokenId.toString() },
        },
        orderBy: 'endTime',
        orderDirection: 'desc',
        first: 1,
      },
    });

    let data = queryResult.data;

    // If not found with string, try with number
    if (!data.auctions?.[0]) {
      queryResult = await noCacheApolloClient.query<AuctionsQueryResponse>({
        query: GET_AUCTIONS,
        variables: {
          where: {
            dao: tokenAddress.toLowerCase(),
            token_: { tokenId: tokenId },
          },
          orderBy: 'endTime',
          orderDirection: 'desc',
          first: 1,
        },
      });

      data = queryResult.data;
    }

    // If found, return it
    if (data.auctions?.[0]) {
      return data.auctions[0];
    }

    // Third try: Get a larger set of auctions and search locally
    const { data: broadData } = await noCacheApolloClient.query<AuctionsQueryResponse>({
      query: GET_AUCTIONS,
      variables: {
        where: {
          dao: tokenAddress.toLowerCase(),
        },
        orderBy: 'endTime',
        orderDirection: 'desc',
        first: 200,
      },
    });

    // Look for the auction by tokenId in the broader results
    const foundAuction = broadData.auctions?.find((auction) => {
      const auctionTokenId = Number(auction.token.tokenId);
      return auctionTokenId === tokenId;
    });

    if (foundAuction) {
      return foundAuction;
    }

    // Return null if not found after all attempts
    return null;
  } catch (error) {
    console.error('Error in fetchAuctionByTokenId:', error);
    throw error instanceof Error
      ? error
      : new Error('Error fetching auction by tokenId');
  }
}

/**
 * Legacy compatibility export
 * @deprecated Use fetchAuctions instead
 */
export const fetchAuction = fetchAuctions;
