// POIDH v3 Contract ABI (minimal - only read functions we need)
export const POIDH_ABI = [
  {
    inputs: [],
    name: 'bountyCounter',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: 'offset', type: 'uint256' }],
    name: 'getBounties',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'id', type: 'uint256' },
          { internalType: 'address', name: 'issuer', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'uint256', name: 'amount', type: 'uint256' },
          { internalType: 'address', name: 'claimer', type: 'address' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'uint256', name: 'claimId', type: 'uint256' }
        ],
        internalType: 'struct PoidhV3.Bounty[]',
        name: '',
        type: 'tuple[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'bountyId', type: 'uint256' },
      { internalType: 'uint256', name: 'offset', type: 'uint256' }
    ],
    name: 'getClaimsByBountyId',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'id', type: 'uint256' },
          { internalType: 'address', name: 'issuer', type: 'address' },
          { internalType: 'uint256', name: 'bountyId', type: 'uint256' },
          { internalType: 'address', name: 'bountyIssuer', type: 'address' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
          { internalType: 'bool', name: 'accepted', type: 'bool' }
        ],
        internalType: 'struct PoidhV3.Claim[]',
        name: '',
        type: 'tuple[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

export const POIDH_CONTRACT_ADDRESS = '0x5555Fa783936C260f77385b4E153B9725feF1719';
