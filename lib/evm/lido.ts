/**
 * Lido direct staking.
 *
 * ETH → stETH on mainnet should never go through a DEX: Lido's `submit()`
 * mints stETH 1:1 for the ETH sent (no slippage, no pool fee). The swap panel
 * detects the ETH→stETH pair and calls Lido directly instead of 0x.
 *
 * Trap: `submit()` RETURNS SHARES, not stETH. 1 ETH ≈ 0.8 shares today. Never
 * show the raw return value as "you receive" — stETH balance == ETH staked.
 */
import { mainnet } from "viem/chains";
import { isNativeToken, type SwapToken } from "@/lib/evm/swapTokens";

export const LIDO_STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;

/** Lido referral address. SkateHive has none registered yet → zero address.
 *  Set NEXT_PUBLIC_LIDO_REFERRAL once one exists (Lido referral program). */
export const LIDO_REFERRAL = ((process.env.NEXT_PUBLIC_LIDO_REFERRAL as `0x${string}` | undefined) ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const LIDO_ABI = [
  { name: "submit", type: "function", stateMutability: "payable", inputs: [{ name: "_referral", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getPooledEthByShares", type: "function", stateMutability: "view", inputs: [{ name: "_sharesAmount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { name: "isStakingPaused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "getCurrentStakeLimit", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/** ETH (native) → stETH on Ethereum mainnet. */
export function isLidoStake(sell: SwapToken, buy: SwapToken): boolean {
  return (
    sell.chainId === mainnet.id &&
    buy.chainId === mainnet.id &&
    isNativeToken(sell.address) &&
    buy.address.toLowerCase() === LIDO_STETH.toLowerCase()
  );
}
