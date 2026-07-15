// Client-side fetchers that hit the local /api/predictions proxy (never
// hivepredict directly), plus a React Query key factory. Response shapes mirror
// the hivepredict public API (see types.ts).

import type {
  ActivityResponse,
  LeaderboardBoard,
  LeaderboardResponse,
  Market,
  MarketListResponse,
  MarketToken,
  Prediction,
  SportsEvent,
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
  getCategories: () =>
    getJson<{ categories: { id: string; name: string }[] }>("categories"),
  getStats: () => getJson<unknown>("stats"),
  getSportsEvents: (league: string) =>
    getJson<{ events: SportsEvent[] }>(
      `sports/${encodeURIComponent(league)}/events`
    ),
  getLeaderboard: (board: LeaderboardBoard, limit = 10) =>
    getJson<LeaderboardResponse>("leaderboard", { board, limit: String(limit) }),
  getActivity: (limit = 10) =>
    getJson<ActivityResponse>("activity", { limit: String(limit) }),
};

// React Query key factory — stable keys for cache read/invalidation.
export const predictionKeys = {
  all: ["predictions"] as const,
  markets: (query: Record<string, string>) =>
    [...predictionKeys.all, "markets", query] as const,
  market: (id: string) => [...predictionKeys.all, "market", id] as const,
  // Optional query keeps distinct pages/limits in distinct cache entries;
  // invalidating with just the id still prefix-matches every variant.
  predictions: (id: string, query?: Record<string, string>) =>
    query
      ? ([...predictionKeys.all, "market", id, "predictions", query] as const)
      : ([...predictionKeys.all, "market", id, "predictions"] as const),
  balance: (username: string, symbol: MarketToken) =>
    [...predictionKeys.all, "balance", username, symbol] as const,
  categories: () => [...predictionKeys.all, "categories"] as const,
  sportsEvents: (league: string) =>
    [...predictionKeys.all, "sportsEvents", league] as const,
  leaderboard: (board: string) =>
    [...predictionKeys.all, "leaderboard", board] as const,
  activity: () => [...predictionKeys.all, "activity"] as const,
};
