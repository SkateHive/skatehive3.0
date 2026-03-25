/**
 * Module-level Zora enrichment cache.
 * Keyed by lowercase token contract address.
 *
 * Populated by useZoraWalletData hook.
 * Read by getEnhancedTokenData (24h change) and TokenLogo (logo).
 */

export interface ZoraTokenMeta {
  logo: string | null;
  change24h: number | null; // percent
  name: string;
  symbol: string;
  marketCap: string | null;
}

const zoraCache = new Map<string, ZoraTokenMeta>();

export function setZoraToken(address: string, meta: ZoraTokenMeta): void {
  zoraCache.set(address.toLowerCase(), meta);
}

export function getZoraToken(address: string): ZoraTokenMeta | undefined {
  return zoraCache.get(address.toLowerCase());
}

export function clearZoraCache(): void {
  zoraCache.clear();
}
