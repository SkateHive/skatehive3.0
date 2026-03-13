/**
 * Governor ABI
 * Simplified ABI for Nouns Builder Governor contract
 * Full interface: https://github.com/ourzora/nouns-protocol
 */

const GOVERNOR_ABI = [
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'bytes32' },
      { name: 'support', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'castVoteWithReason',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'bytes32' },
      { name: 'support', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getVotes',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'timestamp', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'state',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'proposalThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'quorum',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalSnapshot',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalDeadline',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proposalVotes',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [
      { name: 'againstVotes', type: 'uint256' },
      { name: 'forVotes', type: 'uint256' },
      { name: 'abstainVotes', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getProposal',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'proposer', type: 'address' },
          { name: 'timeCreated', type: 'uint32' },
          { name: 'againstVotes', type: 'uint32' },
          { name: 'forVotes', type: 'uint32' },
          { name: 'abstainVotes', type: 'uint32' },
          { name: 'voteStart', type: 'uint32' },
          { name: 'voteEnd', type: 'uint32' },
          { name: 'proposalThreshold', type: 'uint32' },
          { name: 'quorumVotes', type: 'uint32' },
          { name: 'executed', type: 'bool' },
          { name: 'canceled', type: 'bool' },
          { name: 'vetoed', type: 'bool' },
        ],
      },
    ],
  },
] as const;

export default GOVERNOR_ABI;
