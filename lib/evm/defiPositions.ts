import { createPublicClient, formatUnits, http, type Address } from "viem";
import { mainnet } from "viem/chains";

/**
 * DeFi positions = claims against protocol contracts, read from the protocol's
 * OWN on-chain state (never inferred from deposit events or past balances).
 *
 * Shared definitions across SkateHive / Gnars / SOPA surfaces:
 *  - "In wallet" = token balances; "In DeFi" = protocol positions; Total = both.
 *  - Never double-count: the underlying of a position is held by the protocol
 *    contract, so it is NOT in the wallet's token list. Morpheus holds the
 *    stETH in the DepositPool; the wallet list only sees what is still in
 *    the wallet.
 *  - Liquidity is part of the value: locks are reported with their unlock time.
 *  - Unknown ≠ zero: a failed read is returned as an error, never as 0.
 *
 * Morpheus stETH DepositPool (Ethereum mainnet, rewardPoolIndex 0).
 * Proxy 0x4717…4790 → impl 0xdb10…d670 ("DepositPool", verified). The correct
 * getter is usersData(address,uint256) returning a 9-field tuple (lastStake,
 * deposited, rate, pendingRewards, claimLockStart, claimLockEnd,
 * virtualDeposited, lastClaim, referrer) — an 8-field ABI reverts. Verified
 * 2026-08-23 against the treasury Safe: deposited 0.777 stETH,
 * claimLockStart 1787451623, claimLockEnd 1788056636.
 *  - withdraw unlock = lastStake + rewardPoolsProtocolDetails(0).withdrawLockPeriodAfterStake
 *  - MOR pending   = getLatestUserReward(0, user)   (index FIRST)
 */

export const MORPHEUS_STETH_POOL = "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790" as const;
export const MORPHEUS_REWARD_POOL_INDEX = 0n;
const STETH = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as const;

const DEPOSIT_POOL_ABI = [
  { type: "function", name: "usersData", stateMutability: "view",
    inputs: [{ name: "user", type: "address" }, { name: "rewardPoolIndex", type: "uint256" }],
    outputs: [
      { name: "lastStake", type: "uint128" }, { name: "deposited", type: "uint256" }, { name: "rate", type: "uint256" },
      { name: "pendingRewards", type: "uint256" }, { name: "claimLockStart", type: "uint128" }, { name: "claimLockEnd", type: "uint128" },
      { name: "virtualDeposited", type: "uint256" }, { name: "lastClaim", type: "uint128" }, { name: "referrer", type: "address" },
    ] },
  { type: "function", name: "rewardPoolsProtocolDetails", stateMutability: "view",
    inputs: [{ name: "rewardPoolIndex", type: "uint256" }],
    outputs: [
      { name: "withdrawLockPeriodAfterStake", type: "uint128" }, { name: "claimLockPeriodAfterStake", type: "uint128" },
      { name: "claimLockPeriodAfterClaim", type: "uint128" }, { name: "minimalStake", type: "uint256" }, { name: "distributedRewards", type: "uint256" },
    ] },
  { type: "function", name: "getLatestUserReward", stateMutability: "view",
    inputs: [{ name: "rewardPoolIndex", type: "uint256" }, { name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "depositToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export interface DefiPosition {
  positionId: string;
  protocol: "Morpheus";
  label: string;
  chainId: number;
  network: "ethereum";
  contract: string;
  asset: { symbol: string; address: string; decimals: number };
  /** Underlying amount the user has a claim on (from contract state). */
  deposited: number;
  depositedRaw: string;
  priceUsd: number;
  valueUSD: number;
  /** true while withdrawing the underlying is not allowed. */
  locked: boolean;
  /** unix seconds when the underlying can be withdrawn. */
  withdrawUnlockAt: number | null;
  /** unix seconds when rewards become claimable. */
  claimUnlockAt: number | null;
  rewards: { symbol: "MOR"; pending: number; pendingRaw: string };
  source: "onchain-state";
  readAt: string;
}

export interface DefiReadError { positionId: string; protocol: "Morpheus"; label: string; message: string }

export interface DefiSummary {
  positions: DefiPosition[];
  totalUSD: number;
  errors: DefiReadError[];
}

export async function fetchMorpheusPosition(
  address: Address,
  alchemyApiKey: string | undefined,
  stEthPriceUsd: number,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<{ position: DefiPosition | null; error: DefiReadError | null }> {
  const label = "Morpheus · stETH capital pool";
  const positionId = "morpheus-steth-pool-0";
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http(alchemyApiKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}` : "https://ethereum-rpc.publicnode.com"),
    });
    const [user, details, pendingMor, depositToken] = await Promise.all([
      client.readContract({ address: MORPHEUS_STETH_POOL, abi: DEPOSIT_POOL_ABI, functionName: "usersData", args: [address, MORPHEUS_REWARD_POOL_INDEX] }),
      client.readContract({ address: MORPHEUS_STETH_POOL, abi: DEPOSIT_POOL_ABI, functionName: "rewardPoolsProtocolDetails", args: [MORPHEUS_REWARD_POOL_INDEX] }),
      client.readContract({ address: MORPHEUS_STETH_POOL, abi: DEPOSIT_POOL_ABI, functionName: "getLatestUserReward", args: [MORPHEUS_REWARD_POOL_INDEX, address] }),
      client.readContract({ address: MORPHEUS_STETH_POOL, abi: DEPOSIT_POOL_ABI, functionName: "depositToken" }),
    ]);
    if (depositToken.toLowerCase() !== STETH.toLowerCase()) {
      throw new Error(`pool depositToken is ${depositToken}, expected stETH`);
    }
    const [lastStake, depositedRaw, , , , claimLockEnd] = user;
    const deposited = Number(formatUnits(depositedRaw, 18));
    if (depositedRaw === 0n) return { position: null, error: null };
    const withdrawUnlockAt = Number(lastStake) + Number(details[0]);
    const claimUnlockAt = Number(claimLockEnd);
    if (!(stEthPriceUsd > 0)) throw new Error("no stETH price available — refusing to value the position at 0");
    return {
      position: {
        positionId, protocol: "Morpheus", label, chainId: 1, network: "ethereum", contract: MORPHEUS_STETH_POOL,
        asset: { symbol: "stETH", address: STETH.toLowerCase(), decimals: 18 },
        deposited, depositedRaw: depositedRaw.toString(), priceUsd: stEthPriceUsd, valueUSD: deposited * stEthPriceUsd,
        locked: nowSec < withdrawUnlockAt, withdrawUnlockAt, claimUnlockAt,
        rewards: { symbol: "MOR", pending: Number(formatUnits(pendingMor, 18)), pendingRaw: pendingMor.toString() },
        source: "onchain-state", readAt: new Date(nowSec * 1000).toISOString(),
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? (error as { shortMessage?: string }).shortMessage ?? error.message : String(error);
    console.error(`[Portfolio API] Morpheus position read FAILED for ${address}: ${message}`);
    return { position: null, error: { positionId, protocol: "Morpheus", label, message } };
  }
}

export async function fetchDefiPositions(address: Address, alchemyApiKey: string | undefined, stEthPriceUsd: number): Promise<DefiSummary> {
  const results = await Promise.all([fetchMorpheusPosition(address, alchemyApiKey, stEthPriceUsd)]);
  const positions = results.map((r) => r.position).filter((p): p is DefiPosition => !!p);
  const errors = results.map((r) => r.error).filter((e): e is DefiReadError => !!e);
  return { positions, totalUSD: positions.reduce((s, p) => s + p.valueUSD, 0), errors };
}
