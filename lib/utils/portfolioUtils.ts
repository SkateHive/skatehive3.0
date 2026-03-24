// lib/utils/portfolioUtils.ts — re-export barrel (backward compat)
// All implementations have been split into focused modules.
// This file re-exports everything so existing imports continue to work.

export * from "./formatters";
export * from "./tokenConsolidation";
export * from "./geckoTerminal";

import { TokenDetail } from "../../types/portfolio";
import { fetchTokenData, notifyLogoUpdates } from "./geckoTerminal";

// tokenDataCache and related state are module-level in geckoTerminal.ts
// filterTokensByBalance is kept here because it bridges gecko and consolidation
// and references the module-level cache state via fetchTokenData

// We need access to the cache state to implement filterTokensByBalance.
// To avoid re-importing internal cache maps, we replicate the rate-limit guard
// by calling fetchTokenData (which already checks the cache internally).
// The original filterTokensByBalance just triggered fetches as a side-effect
// and returned the (possibly already filtered) list synchronously.

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

  // Trigger background fetches for tokens (fire-and-forget, same as original)
  const tokensToFetch = filteredTokens.slice(0, 1);
  if (tokensToFetch.length > 0) {
    tokensToFetch.forEach((token, index) => {
      setTimeout(() => {
        fetchTokenData(token.token.address, null, token.network)
          .then(result => {
            if (result) {
              notifyLogoUpdates();
            }
          })
          .catch(() => {
            // ignore
          });
      }, index * 3000);
    });
  }

  return filteredTokens;
};
