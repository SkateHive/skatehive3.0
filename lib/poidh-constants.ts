// Supported chains for POIDH bounties
export const ALLOWED_CHAINS = [8453, 42161] as const;

export const CHAIN_LABEL: Record<number, string> = {
  8453: 'Base',
  42161: 'Arbitrum',
};

export const CHAIN_LABEL_SHORT: Record<number, string> = {
  8453: 'Base',
  42161: 'Arb',
};

export const CHAIN_COLOR: Record<number, string> = {
  8453: 'blue',
  42161: 'purple',
};

export const CHAIN_PATH: Record<number, string> = {
  8453: 'base',
  42161: 'arbitrum',
};
