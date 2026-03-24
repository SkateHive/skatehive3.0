import { TokenDetail } from "../../types/portfolio";

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

// Callback system for re-renders
let logoUpdateCallbacks: Set<() => void> = new Set();

export const subscribeToLogoUpdates = (callback: () => void) => {
  logoUpdateCallbacks.add(callback);
  return () => logoUpdateCallbacks.delete(callback);
};

export const notifyLogoUpdates = () => {
  logoUpdateCallbacks.forEach(callback => callback());
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
          console.error(`[GeckoTerminal] request failed for ${cacheKey}: ${response.status}`);
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
      console.error(`[GeckoTerminal] error fetching ${cacheKey}:`, error);
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
      // result fetched successfully
    }
    return result;
  });

  await Promise.allSettled(promises);

  notifyLogoUpdates();
};

// Preload token logos in parallel batches — notifies subscribers after each batch
// so logos paint incrementally instead of all-at-once after a 2s+ wait.
export const preloadTokenLogos = async (tokens: TokenDetail[]): Promise<void> => {
  const higherToken = tokens.find(t => t.token.symbol.toLowerCase() === "higher");

  const topTokens = [...tokens]
    .sort((a, b) => (b.token.balanceUSD || 0) - (a.token.balanceUSD || 0))
    .slice(0, 5);

  const tokensToFetch = higherToken
    ? [higherToken, ...topTokens.filter(t => t.token.address !== higherToken.token.address)].slice(0, 6)
    : topTokens;

  // Process in parallel batches of MAX_CONCURRENT_REQUESTS.
  // Each batch fires simultaneously; we wait 1s between batches to respect the API rate limit.
  // Worst-case: 6 tokens → 3 batches → ~2s total (vs 2.4s sequential).
  // Best-case: logos from first batch appear after the very first parallel fetch (~500ms).
  for (let i = 0; i < tokensToFetch.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = tokensToFetch.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const results = await Promise.allSettled(
      batch.map(t => fetchTokenData(t.token.address, null, t.network))
    );
    const anyLoaded = results.some(r => r.status === "fulfilled" && r.value !== null);
    if (anyLoaded) notifyLogoUpdates(); // paint this batch immediately
    if (i + MAX_CONCURRENT_REQUESTS < tokensToFetch.length) {
      await delay(REQUEST_DELAY); // pace between batches
    }
  }
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
