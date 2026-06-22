export const BASE_CHAIN_ID = "8453";

export const SKATEHIVE_SPLIT_CONTRACT =
  "0x1c043B5c01E7d29F85493830b98EB182BD205F21";

export const getSwapFeeRecipient = (chainId: string | null): string => {
  if (chainId === BASE_CHAIN_ID) return SKATEHIVE_SPLIT_CONTRACT;

  return process.env.SKATEHIVE_FEE_RECIPIENT || "";
};

export const getSwapFeeBps = (): string => process.env.SKATEHIVE_FEE_BPS || "50";
