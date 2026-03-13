/**
 * Governance Service
 * Fetches proposal data from Nouns Builder subgraph
 */

import { noCacheApolloClient } from '@/lib/utils/apollo';
import { gql } from '@apollo/client';
import { Proposal } from './types';

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const GET_PROPOSALS = gql`
  query Proposals(
    $where: Proposal_filter
    $orderBy: Proposal_orderBy
    $orderDirection: OrderDirection
    $first: Int
  ) {
    proposals(
      where: $where
      orderBy: $orderBy
      orderDirection: $orderDirection
      first: $first
    ) {
      proposalId
      proposalNumber
      title
      description
      descriptionHash
      proposer
      timeCreated
      voteStart
      voteEnd
      forVotes
      againstVotes
      abstainVotes
      quorumVotes
      executableFrom
      expiresAt
      canceled
      vetoed
      executed
      targets
      values
      calldatas
    }
  }
`;

const GET_PROPOSAL = gql`
  query Proposal($id: ID!) {
    proposal(id: $id) {
      proposalId
      proposalNumber
      title
      description
      descriptionHash
      proposer
      timeCreated
      voteStart
      voteEnd
      forVotes
      againstVotes
      abstainVotes
      quorumVotes
      executableFrom
      expiresAt
      canceled
      vetoed
      executed
      targets
      values
      calldatas
    }
  }
`;

const GET_PROPOSAL_BY_NUMBER = gql`
  query ProposalByNumber($dao: String!, $proposalNumber: Int!) {
    proposals(where: { dao: $dao, proposalNumber: $proposalNumber }, first: 1) {
      proposalId
      proposalNumber
      title
      description
      descriptionHash
      proposer
      timeCreated
      voteStart
      voteEnd
      forVotes
      againstVotes
      abstainVotes
      quorumVotes
      executableFrom
      expiresAt
      canceled
      vetoed
      executed
      targets
      values
      calldatas
    }
  }
`;

// ============================================================================
// QUERY RESPONSE TYPES
// ============================================================================

interface ProposalsQueryResponse {
  proposals: Proposal[];
}

interface ProposalQueryResponse {
  proposal: Proposal | null;
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch all proposals for a DAO
 * @param daoAddress - DAO token contract address
 * @param limit - Maximum number of proposals to fetch (default: 50)
 * @returns Array of proposals
 */
export async function fetchProposals(
  daoAddress: string,
  limit: number = 50
): Promise<Proposal[]> {
  const where = { dao: daoAddress.toLowerCase() };

  try {
    const { data } = await noCacheApolloClient.query<ProposalsQueryResponse>({
      query: GET_PROPOSALS,
      variables: {
        where,
        orderBy: 'timeCreated',
        orderDirection: 'desc',
        first: limit,
      },
    });

    return data.proposals;
  } catch (error) {
    console.error('Error fetching proposals:', error);
    throw error instanceof Error ? error : new Error('Error fetching proposals');
  }
}

/**
 * Fetch a single proposal by ID
 * @param proposalId - Proposal ID (bytes32 hash)
 * @returns Single proposal or null
 */
export async function fetchProposal(proposalId: string): Promise<Proposal | null> {
  try {
    const { data } = await noCacheApolloClient.query<ProposalQueryResponse>({
      query: GET_PROPOSAL,
      variables: {
        id: proposalId,
      },
    });

    return data.proposal;
  } catch (error) {
    console.error('Error fetching proposal:', error);
    throw error instanceof Error ? error : new Error('Error fetching proposal');
  }
}

/**
 * Fetch a single proposal by proposal number and DAO address
 * @param daoAddress - DAO token contract address
 * @param proposalNumber - Proposal number (e.g., 118)
 * @returns Single proposal or null
 */
export async function fetchProposalByNumber(
  daoAddress: string,
  proposalNumber: number
): Promise<Proposal | null> {
  try {
    const { data } = await noCacheApolloClient.query<ProposalsQueryResponse>({
      query: GET_PROPOSAL_BY_NUMBER,
      variables: {
        dao: daoAddress.toLowerCase(),
        proposalNumber,
      },
    });

    return data.proposals?.[0] || null;
  } catch (error) {
    console.error('Error fetching proposal by number:', error);
    throw error instanceof Error ? error : new Error('Error fetching proposal by number');
  }
}

/**
 * Determine proposal status from on-chain data
 * @param proposal - Proposal data
 * @returns ProposalStatus
 */
export function getProposalStatus(proposal: Proposal): string {
  const now = Math.floor(Date.now() / 1000);
  const voteStart = parseInt(proposal.voteStart || '0');
  const voteEnd = parseInt(proposal.voteEnd || '0');
  const forVotes = BigInt(proposal.forVotes || '0');
  const quorumVotes = BigInt(proposal.quorumVotes || '0');

  // Terminal states
  if (proposal.executed) return 'Executed';
  if (proposal.canceled) return 'Canceled';
  if (proposal.vetoed) return 'Vetoed';

  // Time-based states
  if (now < voteStart) return 'Pending';
  if (now >= voteStart && now <= voteEnd) return 'Active';

  // Post-voting states
  if (forVotes < quorumVotes) return 'Defeated';
  
  const executableFrom = parseInt(proposal.executableFrom || '0');
  const expiresAt = parseInt(proposal.expiresAt || '0');

  if (now < executableFrom) return 'Queued';
  if (now > expiresAt) return 'Expired';

  return 'Succeeded';
}
