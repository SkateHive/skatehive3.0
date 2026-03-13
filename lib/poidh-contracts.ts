import { POIDH_ABI, POIDH_CONTRACT_ADDRESS } from './poidh-abi';

// Contract config for Base (8453) and Arbitrum (42161) — same address
export const POIDH_CONTRACT = {
  address: POIDH_CONTRACT_ADDRESS,
  abi: POIDH_ABI,
} as const;

// Chain-specific configs (same contract, different chain context)
export const POIDH_CONTRACTS: Record<number, typeof POIDH_CONTRACT> = {
  8453: POIDH_CONTRACT,
  42161: POIDH_CONTRACT,
};

// Get contract config for a chain, or default to Base
export function getPoidhContract(chainId: number = 8453) {
  return POIDH_CONTRACTS[chainId] ?? POIDH_CONTRACT;
}
