import { TokenDetail } from "../../types/portfolio";

export const formatBalance = (balance: number): string => {
  return balance.toFixed(4).replace(/\.?0+$/, "");
};

export const formatValue = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
};

export const formatPrice = (price: number | string | undefined | null): string => {
  // Handle null/undefined
  if (price == null) {
    return "N/A";
  }
  
  // Convert string to number if needed
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  
  // Check if it's a valid number
  if (typeof numPrice !== "number" || isNaN(numPrice)) {
    return "N/A";
  }
  
  // Smart decimal formatting based on price magnitude
  let decimals: number;
  
  if (numPrice >= 1000) {
    // For prices $1000+: show 2 decimals (e.g., $1,234.56)
    decimals = 2;
  } else if (numPrice >= 1) {
    // For prices $1-$999: show 3 decimals (e.g., $123.456)
    decimals = 3;
  } else if (numPrice >= 0.01) {
    // For prices $0.01-$0.99: show 4 decimals (e.g., $0.1234)
    decimals = 4;
  } else if (numPrice >= 0.001) {
    // For prices $0.001-$0.009: show 5 decimals (e.g., $0.01234)
    decimals = 5;
  } else if (numPrice >= 0.0001) {
    // For prices $0.0001-$0.0009: show 6 decimals (e.g., $0.012345)
    decimals = 6;
  } else {
    // For very small prices: show 8 decimals (e.g., $0.00001234)
    decimals = 8;
  }
  
  // Format with appropriate decimals and add thousand separators for large numbers
  if (numPrice >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(numPrice);
  } else {
    return `$${numPrice.toFixed(decimals)}`;
  }
};





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

// GeckoTerminal API types
export interface GeckoTokenAttribute {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  image_url: string;
  coingecko_coin_id: string | null;
  total_supply: string;
  price_usd: string | null;
  fdv_usd: string | null;
  total_reserve_in_usd: string | null;
  volume_usd: {
    h24: string | null;
  };
  market_cap_usd: string | null;
  priceChange: string | null;
}

interface RelationshipData {
  id: string;
  type: string;
}

interface Relationships {
  top_pools: {
    data: RelationshipData[];
  };
}

export interface GeckoTokenResponse {
  data: {
    id: string;
    type: string;
    attributes: GeckoTokenAttribute;
    relationships: Relationships;
  };
  included: {
    id: string;
    type: string;
    attributes: {
      price_change_percentage: {
        h24: string;
      };
      market_cap_usd: string | null;
    };
  }[];
}

type EtherScanChainName = string;

// Cache for token data
const tokenDataCache = new Map<string, GeckoTokenAttribute | null>();
const cacheExpiry = new Map<string, number>();
const pendingRequests = new Map<string, Promise<GeckoTokenAttribute | null>>();
const failureCount = new Map<string, number>(); // Track failures per token
const lastFailureTime = new Map<string, number>(); // Track when failures occurred
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const FAILURE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for failed requests
const REQUEST_DELAY = 1000; // Increase to 1 second
const MAX_CONCURRENT_REQUESTS = 2; // Reduce to 2
const MAX_FAILURES_PER_TOKEN = 3; // Max retries per token
const EXPONENTIAL_BACKOFF_BASE = 2; // Exponential backoff multiplier

let lastRequestTime = 0;
let activeRequests = 0;
let globalRateLimited = false;
let globalRateLimitExpiry = 0;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const getGeckoNetwork = (networkName: EtherScanChainName): string => {
  const networkMap: Record<string, string> = {
    'ethereum': 'eth',
    'base': 'base',
    'polygon': 'polygon_pos',
    'arbitrum': 'arbitrum',
    'optimism': 'optimism',
    'bsc': 'bsc',
    'avalanche': 'avax',
    'fantom': 'fantom', // Add fantom support
    'gnosis': 'gnosis', // Add gnosis support
    // Add more networks as needed
  };
  return networkMap[networkName.toLowerCase()] || networkName.toLowerCase();
};

const isTokenBlacklisted = (cacheKey: string): boolean => {
  const failures = failureCount.get(cacheKey) || 0;
  const lastFailure = lastFailureTime.get(cacheKey) || 0;
  const now = Date.now();

  // If max failures reached and not enough time has passed, blacklist
  if (failures >= MAX_FAILURES_PER_TOKEN) {
    const backoffTime = FAILURE_CACHE_DURATION * Math.pow(EXPONENTIAL_BACKOFF_BASE, failures - MAX_FAILURES_PER_TOKEN);
    return (now - lastFailure) < backoffTime;
  }

  return false;
};

const incrementFailureCount = (cacheKey: string): void => {
  const currentCount = failureCount.get(cacheKey) || 0;
  failureCount.set(cacheKey, currentCount + 1);
  lastFailureTime.set(cacheKey, Date.now());
};

const resetFailureCount = (cacheKey: string): void => {
  failureCount.delete(cacheKey);
  lastFailureTime.delete(cacheKey);
};

export async function fetchTokenData(
  tokenAddress: string,
  contractImage: string | null,
  networkName: string,
): Promise<GeckoTokenAttribute | null> {
  const cacheKey = `${networkName}-${tokenAddress}`;

  // Check if globally rate limited
  if (globalRateLimited && Date.now() < globalRateLimitExpiry) {
    return null;
  }

  // Check if token is blacklisted due to repeated failures
  if (isTokenBlacklisted(cacheKey)) {
    return null;
  }

  // Check cache first
  const now = Date.now();
  const cachedData = tokenDataCache.get(cacheKey);
  const cacheTime = cacheExpiry.get(cacheKey);

  if (cachedData !== undefined && cacheTime && now - cacheTime < CACHE_DURATION) {
    return cachedData;
  }

  // Check if request is already pending
  const pendingRequest = pendingRequests.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  // Wait if too many concurrent requests
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return null;
  }

  // Create new request with enhanced throttling
  const requestPromise = (async () => {
    try {
      activeRequests++;

      // Enhanced throttling
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < REQUEST_DELAY) {
        await delay(REQUEST_DELAY - timeSinceLastRequest);
      }
      lastRequestTime = Date.now();

      const network = getGeckoNetwork(networkName as EtherScanChainName);
      const apiUrl = `/api/geckoterminal?network=${network}&address=${tokenAddress}`;

      const response = await fetch(apiUrl, {
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Set global rate limit for longer duration
          globalRateLimited = true;
          globalRateLimitExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes instead of 5

          incrementFailureCount(cacheKey);
          tokenDataCache.set(cacheKey, null);
          cacheExpiry.set(cacheKey, Date.now() + FAILURE_CACHE_DURATION);
          return null;
        } else if (response.status === 404) {
          // Cache 404s for longer to avoid retrying
          tokenDataCache.set(cacheKey, null);
          cacheExpiry.set(cacheKey, Date.now() + CACHE_DURATION);
          return null;
        } else {
          console.error(`❌ API request failed for ${cacheKey}: ${response.status}`);
          incrementFailureCount(cacheKey);
          tokenDataCache.set(cacheKey, null);
          cacheExpiry.set(cacheKey, Date.now() + FAILURE_CACHE_DURATION);
          return null;
        }
      }

      const result: GeckoTokenResponse = await response.json();
      const token = result.data.attributes;

      // Reset failure count on success
      resetFailureCount(cacheKey);

      let marketCap = token.market_cap_usd || null;

      // Check included pools for market cap if not available in token attributes
      if (!marketCap) {
        for (const pool of result.included) {
          if (pool.attributes.market_cap_usd) {
            marketCap = pool.attributes.market_cap_usd;
            break;
          }
        }
      }

      let priceChange: string | null = null;
      for (const pool of result.included) {
        if (pool.attributes?.price_change_percentage?.h24) {
          priceChange = pool.attributes.price_change_percentage.h24;
          break;
        }
      }

      // Calculate market cap if not available
      if (!marketCap && token.price_usd) {
        const totalSupply = token.total_supply;
        if (totalSupply) {
          const adjustedTotalSupply =
            parseFloat(totalSupply) / Math.pow(10, token.decimals);
          marketCap = (
            parseFloat(token.price_usd) * adjustedTotalSupply
          ).toString();
        }
      }

      let image = token.image_url;
      if (image === "missing.png") {
        image = contractImage || image;
      }

      const enhancedToken = {
        ...token,
        image_url: image,
        market_cap_usd: marketCap,
        priceChange,
      };

      // Cache the result
      tokenDataCache.set(cacheKey, enhancedToken);
      cacheExpiry.set(cacheKey, Date.now());

      return enhancedToken;
    } catch (error) {
      console.error(`💥 Error fetching token data for ${cacheKey}:`, error);
      incrementFailureCount(cacheKey);
      tokenDataCache.set(cacheKey, null);
      cacheExpiry.set(cacheKey, Date.now() + FAILURE_CACHE_DURATION);
      return null;
    } finally {
      activeRequests--;
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, requestPromise);
  return requestPromise;
}

export const filterTokensByBalance = (
  tokens: TokenDetail[],
  hideSmallBalances: boolean,
  minThreshold: number = 1,
  minMarketCap?: number
): TokenDetail[] => {
  let filteredTokens = tokens;

  if (hideSmallBalances) {
    filteredTokens = filteredTokens.filter(
      (token) => (token.token.balanceUSD || 0) >= minThreshold
    );
  }

  // Don't try to fetch if globally rate limited - this prevents the infinite loop
  if (globalRateLimited && Date.now() < globalRateLimitExpiry) {
    return filteredTokens;
  }

  // Only fetch data for tokens that don't have cached data, aren't blacklisted, and limit batch size
  const tokensNeedingFetch = filteredTokens
    .filter(token => {
      const cacheKey = `${token.network}-${token.token.address}`;
      const cachedData = tokenDataCache.get(cacheKey);
      const cacheTime = cacheExpiry.get(cacheKey);

      // Don't fetch if blacklisted
      if (isTokenBlacklisted(cacheKey)) {
        return false;
      }

      // Check if cache is expired or doesn't exist
      return !cachedData || !cacheTime || (Date.now() - cacheTime > CACHE_DURATION);
    })
    .slice(0, 1); // Reduce to 1 token at a time to be very gentle

  // Only fetch if we're not rate limited and there are tokens to fetch
  if (tokensNeedingFetch.length > 0) {

    // Only fetch one at a time with longer delays
    tokensNeedingFetch.forEach((token, index) => {
      setTimeout(() => {
        // Double-check rate limit before making the request
        if (globalRateLimited && Date.now() < globalRateLimitExpiry) {
          return;
        }

        fetchTokenData(token.token.address, null, token.network)
          .then(result => {
            if (result) {
              notifyLogoUpdates();
            }
          })
          .catch(error => {
          });
      }, index * 3000); // Increase delay to 3 seconds between requests
    });
  }

  return filteredTokens;
};

// Callback system for re-renders
let logoUpdateCallbacks: Set<() => void> = new Set();

export const subscribeToLogoUpdates = (callback: () => void) => {
  logoUpdateCallbacks.add(callback);
  return () => logoUpdateCallbacks.delete(callback);
};

const notifyLogoUpdates = () => {
  logoUpdateCallbacks.forEach(callback => callback());
};

// Function to preload token logos for better UX - more conservative approach
export const preloadTokenLogos = async (tokens: TokenDetail[]): Promise<void> => {
  // Always include HIGHER token for special handling
  const higherToken = tokens.find(t => t.token.symbol.toLowerCase() === "higher");

  // Get top 5 tokens by balance
  const topTokens = tokens
    .sort((a, b) => (b.token.balanceUSD || 0) - (a.token.balanceUSD || 0))
    .slice(0, 5);

  // Combine HIGHER token with top tokens, removing duplicates
  const tokensToFetch = higherToken
    ? [higherToken, ...topTokens.filter(t => t.token.address !== higherToken.token.address)].slice(0, 6)
    : topTokens;

  for (let i = 0; i < tokensToFetch.length; i++) {
    const tokenDetail = tokensToFetch[i];
    try {
      await new Promise(resolve => setTimeout(resolve, i * 400)); // 400ms delay between requests
      const result = await fetchTokenData(tokenDetail.token.address, null, tokenDetail.network);
      if (result) {
        notifyLogoUpdates();
      }
    } catch (error) {
    }
  }
};

export const sortTokensByBalance = (tokens: TokenDetail[]): TokenDetail[] => {
  return tokens.sort((a, b) => {
    const balanceA = a.token.balanceUSD || 0;
    const balanceB = b.token.balanceUSD || 0;
    return balanceB - balanceA; // Descending order (highest first)
  });
};

export const formatPriceChange = (priceChange: number | undefined | null): string => {
  if (typeof priceChange !== "number" || isNaN(priceChange)) {
    return "0.00";
  }
  return priceChange.toFixed(2);
};

// Enhanced function to get market cap from cached data
export const getEnhancedTokenData = (tokenDetail: TokenDetail): {
  marketCap: number | null;
  priceChange: number | null;
} => {
  const cacheKey = `${tokenDetail.network}-${tokenDetail.token.address}`;
  const cachedData = tokenDataCache.get(cacheKey);

  const marketCap = tokenDetail.token.marketCap ||
    (cachedData?.market_cap_usd ? parseFloat(cachedData.market_cap_usd) : null);

  const priceChange = (tokenDetail.token as any).priceChange ||
    (cachedData?.priceChange ? parseFloat(cachedData.priceChange) : null);

  return { marketCap, priceChange };
};


export const getTokenLogoSync = (
  token: any,
  networkInfo: any,
  networkName: string
): string | null => {
  const cacheKey = `${networkName}-${token.address}`;
  const cachedData = tokenDataCache.get(cacheKey);

  if (cachedData?.image_url && cachedData.image_url !== "missing.png") {
    return cachedData.image_url;
  }

  if (token.image_url && token.image_url !== "missing.png") {
    return token.image_url;
  }

  if (networkInfo?.logo) {
    return networkInfo.logo;
  }

  return null;
};

export const forceRefreshTokenData = async (tokens: TokenDetail[]): Promise<void> => {

  tokenDataCache.clear();
  cacheExpiry.clear();
  failureCount.clear();
  lastFailureTime.clear();
  globalRateLimited = false;
  globalRateLimitExpiry = 0;

  const promises = tokens.map(async (tokenDetail, index) => {
    await new Promise(resolve => setTimeout(resolve, index * 300));

    const result = await fetchTokenData(tokenDetail.token.address, null, tokenDetail.network);
    if (result) {
    }
    return result;
  });

  await Promise.allSettled(promises);

  notifyLogoUpdates();
};