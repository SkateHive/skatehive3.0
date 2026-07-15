// Client-side fetchers that hit the local /api/predictions proxy (never
// hivepredict directly), plus a React Query key factory. Response shapes mirror
// the hivepredict public API (see types.ts).

import type {
  Market,
  MarketListResponse,
  MarketToken,
  Prediction,
  TokenBalance,
} from "./types";

const PROXY_BASE = "/api/predictions";

async function getJson<T>(path: string, query?: Record<string, string>): Promise<T> {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const res = await fetch(`${PROXY_BASE}/${path}${qs}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const predictionsApi = {
  listMarkets: (query: Record<string, string> = {}) =>
    getJson<MarketListResponse>("markets", query),
  getMarket: (id: string) => getJson<Market>(`markets/${encodeURIComponent(id)}`),
  getPredictions: (id: string, query: Record<string, string> = {}) =>
    getJson<{ predictions?: Prediction[]; total?: number }>(
      `markets/${encodeURIComponent(id)}/predictions`,
      query
    ),
  getBalance: (username: string, symbol: MarketToken) =>
    getJson<TokenBalance>(
      `tokens/balance/${encodeURIComponent(username)}/${encodeURIComponent(symbol)}`
    ),
  getCategories: () => getJson<unknown>("categories"),
  getStats: () => getJson<unknown>("stats"),
};

// React Query key factory — stable keys for cache read/invalidation.
export const predictionKeys = {
  all: ["predictions"] as const,
  markets: (query: Record<string, string>) =>
    [...predictionKeys.all, "markets", query] as const,
  market: (id: string) => [...predictionKeys.all, "market", id] as const,
  predictions: (id: string) =>
    [...predictionKeys.all, "market", id, "predictions"] as const,
  balance: (username: string, symbol: MarketToken) =>
    [...predictionKeys.all, "balance", username, symbol] as const,
};
