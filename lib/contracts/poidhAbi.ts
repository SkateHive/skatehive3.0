/**
 * POIDH v3 Contract ABI (minimal - only read functions)
 * Contract: 0xdffe8a4a4103f968ffd61fd082d08c41dcf9b940
 * Docs: https://docs.poidh.xyz/api.html
 */

export const POIDH_ABI = [
  {
    name: "bountyCounter",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getBounty",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "issuer", type: "address" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "isOpen", type: "bool" },
          { name: "isCancelled", type: "bool" },
          { name: "hasActiveClaim", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getClaim",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "bountyId", type: "uint256" },
          { name: "issuer", type: "address" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "accepted", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "bountyClaims",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ type: "uint256[]" }],
  },
] as const;

export const POIDH_CONTRACT_ADDRESS =
  "0xdffe8a4a4103f968ffd61fd082d08c41dcf9b940" as const;

export const POIDH_CHAINS = {
  arbitrum: 42161,
  base: 8453,
  degen: 666666666,
} as const;
