export const BASE_CHAIN_ID = "8453";

export const SKATEHIVE_SPLIT_CONTRACT =
  "0x1c043B5c01E7d29F85493830b98EB182BD205F21";

/**
 * The 0xSplits split is deployed at the SAME address on every supported chain
 * (verified on-chain: identical owner + split config on Base, Ethereum and
 * Arbitrum), so swap fees route straight to it on each of them and auto-split
 * 50/50. Any other chain falls back to SKATEHIVE_FEE_RECIPIENT (or no fee).
 */
export const SPLIT_FEE_CHAIN_IDS = ["8453", "1", "42161"];

export const getSwapFeeRecipient = (chainId: string | null): string => {
  if (chainId && SPLIT_FEE_CHAIN_IDS.includes(chainId)) return SKATEHIVE_SPLIT_CONTRACT;

  return process.env.SKATEHIVE_FEE_RECIPIENT || "";
};

export const getSwapFeeBps = (): string => process.env.SKATEHIVE_FEE_BPS || "50";
