/**
 * USD price for native ETH.
 *
 * The portfolio route used to take the upstream indexer's ETH price and return
 * it whenever it was above zero, consulting CoinGecko only when the upstream
 * had nothing. That is the wrong way round: the upstream is an indexer that
 * lags, and it was reporting ETH near $2,032 against a market near $2,483 —
 * understating every native ETH balance by ~18%.
 *
 * The order below is the one lib/evm/erc20Balances.ts already applies to
 * ERC-20s: the trusted price source wins and the upstream is the fallback.
 *
 * Resolution is kept separate from fetching so the source matrix is testable
 * without a network — including the cases nobody can reproduce by hand, like
 * CoinGecko rate-limiting while the upstream is also silent.
 */

export type EthPriceSource = "coingecko" | "upstream";

export interface EthPriceResolution {
  /** USD per ETH, or null when no source could determine it. Never 0. */
  priceUsd: number | null;
  /** Which source the price came from, or null when undeterminable. */
  source: EthPriceSource | null;
}

export interface EthPriceInputs {
  /** CoinGecko's price. null when the read failed. */
  coingeckoUsd: number | null;
  /** The upstream indexer's price for ETH. null when it listed none. */
  upstreamUsd: number | null;
}

/**
 * A price is only usable if it is a finite number above zero. Zero is not a
 * price — it is a failed read wearing a number's clothes, and multiplying a
 * balance by it produces a $0.00 line for real ETH. NaN is worse: it spreads
 * to every total on the page.
 */
function usablePrice(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
}

/**
 * Pick the ETH price by source priority — CoinGecko first, upstream second.
 *
 * Deliberately NOT "whichever is larger": the upstream is stale in whichever
 * direction the market last moved, so picking by value would be right only
 * while ETH is rising.
 */
export function resolveEthPriceUsd(inputs: EthPriceInputs): EthPriceResolution {
  const coingecko = usablePrice(inputs.coingeckoUsd);
  if (coingecko !== null) return { priceUsd: coingecko, source: "coingecko" };

  const upstream = usablePrice(inputs.upstreamUsd);
  if (upstream !== null) return { priceUsd: upstream, source: "upstream" };

  return { priceUsd: null, source: null };
}

interface CoinGeckoPriceResponse {
  ethereum?: { usd?: number };
}

/**
 * Read ETH/USD from CoinGecko.
 *
 * Returns null — not 0 — on every failure path, so callers can tell "the read
 * failed" apart from "the price is zero". The previous version returned 0 for
 * both, which is how an unreadable price became a $0.00 balance.
 */
export async function fetchCoinGeckoEthPriceUsd(): Promise<number | null> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { next: { revalidate: 60 } },
    );
    if (!response.ok) {
      console.warn(`[Portfolio API] CoinGecko ETH price failed: HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as CoinGeckoPriceResponse;
    const price = usablePrice(data.ethereum?.usd);
    if (price === null) {
      console.warn("[Portfolio API] CoinGecko ETH price missing or unusable in response body");
    }
    return price;
  } catch (error) {
    console.warn(
      "[Portfolio API] CoinGecko ETH price failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
