/**
 * Multi-chain token registry for the ERC-20 swap.
 *
 * Curated shortlist of the tokens most people trade on Base, Ethereum and
 * Arbitrum. The long tail is handled by paste-address import in the selector
 * (resolved on-chain), so this list only needs to cover the popular set.
 *
 * `network` strings match the portfolio API (`base` / `ethereum` / `arbitrum`)
 * so held balances can be joined onto these entries in the selector.
 */
import { mainnet, base, arbitrum } from "wagmi/chains";

/** Native-token placeholder understood by 0x (and our swap code). */
export const NATIVE_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

export interface SwapChain {
  id: number;
  name: string;
  /** Portfolio API network key. */
  network: string;
  logo: string;
  color: string;
}

export const SWAP_CHAINS: SwapChain[] = [
  { id: base.id, name: "Base", network: "base", logo: "/logos/base_logo.png", color: "#0052FF" },
  { id: mainnet.id, name: "Ethereum", network: "ethereum", logo: "/logos/ethereum_logo.png", color: "#627EEA" },
  { id: arbitrum.id, name: "Arbitrum", network: "arbitrum", logo: "/logos/arbitrum_logo.png", color: "#28A0F0" },
];

export const SWAP_CHAIN_IDS = SWAP_CHAINS.map((c) => c.id);

export function getSwapChain(id: number): SwapChain | undefined {
  return SWAP_CHAINS.find((c) => c.id === id);
}

/** Map a portfolio API network string to a chain id (undefined if unsupported). */
export function networkToChainId(network: string): number | undefined {
  return SWAP_CHAINS.find((c) => c.network === network.toLowerCase())?.id;
}

export interface SwapToken {
  chainId: number;
  symbol: string;
  name: string;
  /** NATIVE_TOKEN for the native coin, otherwise the ERC-20 address. */
  address: string;
  decimals: number;
  logo?: string;
  popular?: boolean;
}

/** Trust Wallet asset logo (falls back to a letter avatar if it 404s). */
const tw = (chain: string, checksum: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/assets/${checksum}/logo.png`;

const ETH_LOGO = "/logos/ethereum_logo.png";
const USDC_LOGO = "/logos/usdc.png";

export const SWAP_TOKENS: SwapToken[] = [
  // ── Base (8453) ──────────────────────────────────────────────────────────
  { chainId: base.id, symbol: "ETH", name: "Ethereum", address: NATIVE_TOKEN, decimals: 18, logo: ETH_LOGO, popular: true },
  { chainId: base.id, symbol: "USDC", name: "USD Coin", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6, logo: USDC_LOGO, popular: true },
  { chainId: base.id, symbol: "cbBTC", name: "Coinbase Wrapped BTC", address: "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", decimals: 8, logo: tw("base", "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"), popular: true },
  { chainId: base.id, symbol: "WETH", name: "Wrapped Ether", address: "0x4200000000000000000000000000000000000006", decimals: 18, logo: ETH_LOGO },
  { chainId: base.id, symbol: "DAI", name: "Dai Stablecoin", address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", decimals: 18, logo: tw("base", "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb") },
  { chainId: base.id, symbol: "DEGEN", name: "Degen", address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", decimals: 18, logo: "/logos/degen.png" },
  { chainId: base.id, symbol: "HIGHER", name: "Higher", address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe", decimals: 18, logo: "/logos/higher.png" },

  // ── Ethereum (1) ─────────────────────────────────────────────────────────
  { chainId: mainnet.id, symbol: "ETH", name: "Ethereum", address: NATIVE_TOKEN, decimals: 18, logo: ETH_LOGO, popular: true },
  { chainId: mainnet.id, symbol: "USDC", name: "USD Coin", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6, logo: USDC_LOGO, popular: true },
  { chainId: mainnet.id, symbol: "USDT", name: "Tether USD", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6, logo: tw("ethereum", "0xdAC17F958D2ee523a2206206994597C13D831ec7"), popular: true },
  { chainId: mainnet.id, symbol: "WBTC", name: "Wrapped BTC", address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", decimals: 8, logo: tw("ethereum", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"), popular: true },
  { chainId: mainnet.id, symbol: "WETH", name: "Wrapped Ether", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", decimals: 18, logo: ETH_LOGO },
  // ETH→stETH is handled as a direct Lido stake (1:1), see lib/evm/lido.ts
  { chainId: mainnet.id, symbol: "stETH", name: "Lido Staked Ether", address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", decimals: 18, logo: tw("ethereum", "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"), popular: true },
  { chainId: mainnet.id, symbol: "DAI", name: "Dai Stablecoin", address: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18, logo: tw("ethereum", "0x6B175474E89094C44Da98b954EedeAC495271d0F") },
  { chainId: mainnet.id, symbol: "LINK", name: "Chainlink", address: "0x514910771af9ca656af840dff83e8264ecf986ca", decimals: 18, logo: tw("ethereum", "0x514910771AF9Ca656af840dff83E8264EcF986CA") },
  { chainId: mainnet.id, symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", decimals: 18, logo: tw("ethereum", "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984") },

  // ── Arbitrum (42161) ─────────────────────────────────────────────────────
  { chainId: arbitrum.id, symbol: "ETH", name: "Ethereum", address: NATIVE_TOKEN, decimals: 18, logo: ETH_LOGO, popular: true },
  { chainId: arbitrum.id, symbol: "USDC", name: "USD Coin", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", decimals: 6, logo: USDC_LOGO, popular: true },
  { chainId: arbitrum.id, symbol: "ARB", name: "Arbitrum", address: "0x912ce59144191c1204e64559fe8253a0e49e6548", decimals: 18, logo: "/logos/arbitrum_logo.png", popular: true },
  { chainId: arbitrum.id, symbol: "USDT", name: "Tether USD", address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", decimals: 6, logo: tw("arbitrum", "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9") },
  { chainId: arbitrum.id, symbol: "WETH", name: "Wrapped Ether", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", decimals: 18, logo: ETH_LOGO },
  { chainId: arbitrum.id, symbol: "WBTC", name: "Wrapped BTC", address: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", decimals: 8, logo: tw("arbitrum", "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f") },
  { chainId: arbitrum.id, symbol: "LINK", name: "Chainlink", address: "0xf97f4df75117a78c1a5a0dbb814af92458539fb4", decimals: 18, logo: tw("arbitrum", "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4") },
];

export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === NATIVE_TOKEN;
}

export function tokensForChain(chainId: number): SwapToken[] {
  return SWAP_TOKENS.filter((t) => t.chainId === chainId);
}

export function popularForChain(chainId: number): SwapToken[] {
  return SWAP_TOKENS.filter((t) => t.chainId === chainId && t.popular);
}

export function findToken(chainId: number, address: string): SwapToken | undefined {
  const addr = address.toLowerCase();
  return SWAP_TOKENS.find((t) => t.chainId === chainId && t.address.toLowerCase() === addr);
}

/** Default sell/buy pair for a chain: native → the chain's USDC (falls back to Base). */
export function defaultPair(chainId: number): { sell: SwapToken; buy: SwapToken } {
  const list = tokensForChain(chainId).length ? tokensForChain(chainId) : tokensForChain(base.id);
  const sell = list.find((t) => isNativeToken(t.address)) ?? list[0];
  const buy = list.find((t) => t.symbol === "USDC") ?? list[1] ?? list[0];
  return { sell, buy };
}
