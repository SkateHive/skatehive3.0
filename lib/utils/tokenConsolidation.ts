import { TokenDetail } from "../../types/portfolio";

export const groupTokensByNetwork = (
  tokens: TokenDetail[] | undefined
): Record<string, TokenDetail[]> => {
  return tokens?.reduce((acc, tokenDetail) => {
    const network = tokenDetail.network;
    if (!acc[network]) {
      acc[network] = [];
    }
    acc[network].push(tokenDetail);
    return acc;
  }, {} as Record<string, TokenDetail[]>) || {};
};

export const getNetworkTotal = (tokens: TokenDetail[]): number => {
  return tokens.reduce(
    (sum, token) => sum + (token.token.balanceUSD || 0),
    0
  );
};

// New consolidated token interface
export interface ConsolidatedToken {
  symbol: string;
  name: string;
  totalBalanceUSD: number;
  chains: TokenDetail[];
  primaryChain: TokenDetail; // The chain with the highest balance
}

// Group tokens by symbol and consolidate across chains
export const consolidateTokensBySymbol = (
  tokens: TokenDetail[] | undefined
): ConsolidatedToken[] => {
  if (!tokens || tokens.length === 0) return [];

  const tokenGroups: Record<string, TokenDetail[]> = {};

  // Group tokens by symbol
  tokens.forEach((tokenDetail) => {
    const symbol = tokenDetail.token.symbol.toLowerCase();
    if (!tokenGroups[symbol]) {
      tokenGroups[symbol] = [];
    }
    tokenGroups[symbol].push(tokenDetail);
  });

  // Convert groups to ConsolidatedToken objects
  return Object.entries(tokenGroups).map(([symbol, tokenDetails]) => {
    // Calculate total balance across all chains
    const totalBalanceUSD = tokenDetails.reduce(
      (sum, token) => sum + (token.token.balanceUSD || 0),
      0
    );

    // Find primary chain (highest balance)
    const primaryChain = tokenDetails.reduce((primary, current) => {
      return (current.token.balanceUSD || 0) > (primary.token.balanceUSD || 0)
        ? current
        : primary;
    });

    // Sort chains by balance (highest first)
    const sortedChains = [...tokenDetails].sort(
      (a, b) => (b.token.balanceUSD || 0) - (a.token.balanceUSD || 0)
    );

    return {
      symbol: primaryChain.token.symbol,
      name: primaryChain.token.name,
      totalBalanceUSD,
      chains: sortedChains,
      primaryChain,
    };
  });
};

// Filter consolidated tokens by balance, but always include HIGHER token
export const filterConsolidatedTokensByBalance = (
  consolidatedTokens: ConsolidatedToken[],
  hideSmallBalances: boolean,
  minThreshold: number = 1
): ConsolidatedToken[] => {
  if (!hideSmallBalances) return consolidatedTokens;

  return consolidatedTokens.filter(
    (token) => token.totalBalanceUSD >= minThreshold || token.symbol.toLowerCase() === 'higher'
  );
};

// Sort consolidated tokens by total balance, with HIGHER token always first
export const sortConsolidatedTokensByBalance = (
  consolidatedTokens: ConsolidatedToken[]
): ConsolidatedToken[] => {
  const sorted = [...consolidatedTokens].sort(
    (a, b) => b.totalBalanceUSD - a.totalBalanceUSD
  );

  // Find HIGHER token and move it to first position
  const higherIndex = sorted.findIndex(
    token => token.symbol.toLowerCase() === 'higher'
  );

  if (higherIndex > 0) {
    const higherToken = sorted.splice(higherIndex, 1)[0];
    sorted.unshift(higherToken);
  }

  return sorted;
};

export const sortTokensByBalance = (tokens: TokenDetail[]): TokenDetail[] => {
  return tokens.sort((a, b) => {
    const balanceA = a.token.balanceUSD || 0;
    const balanceB = b.token.balanceUSD || 0;
    return balanceB - balanceA; // Descending order (highest first)
  });
};
