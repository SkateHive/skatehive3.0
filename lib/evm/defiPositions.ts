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

/**
 * One DepositPool per asset, all on Ethereum mainnet, same shape as the Gnars
 * repo's MORPHEUS_POOLS. Add a pool here and the wallet page follows — no
 * other code change. decimals are PER POOL (stETH 18, USDC 6): formatting
 * USDC with 18 would turn 562 USDC into 0.00000000056 and hide it as dust.
 */
export const MORPHEUS_POOLS = [
  { key: "stEth", pool: "0x47176B2Af9885dC6C4575d4eFd63895f7Aaa4790", token: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", decimals: 18, symbol: "stETH" },
  { key: "usdc", pool: "0x6cCE082851Add4c535352f596662521B4De4750E", token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, symbol: "USDC" },
] as const;
export type MorpheusPool = (typeof MORPHEUS_POOLS)[number];
export const MORPHEUS_REWARD_POOL_INDEX = 0n;

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

/** Resolve a USD price for a deposit token (lowercase address) — 0 when unknown. */
export type PriceResolver = (tokenAddress: string, symbol: string) => number;

export async function fetchMorpheusPosition(
  address: Address,
  poolCfg: MorpheusPool,
  alchemyApiKey: string | undefined,
  priceFor: PriceResolver,
  nowSec: number = Math.floor(Date.now() / 1000),
): Promise<{ position: DefiPosition | null; error: DefiReadError | null }> {
  const label = `Morpheus · ${poolCfg.symbol} capital pool`;
  const positionId = `morpheus-${poolCfg.key}-pool-0`;
  const pool = poolCfg.pool as Address;
  try {
    // Retries + generous timeout: these reads run next to the ERC-20/NFT
    // lookups and a throttled RPC must not turn a real position into an error
    // on the first hiccup. (If it still fails, it is reported — never as 0.)
    const client = createPublicClient({
      chain: mainnet,
      transport: http(
        alchemyApiKey ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyApiKey}` : "https://ethereum-rpc.publicnode.com",
        { timeout: 20_000, retryCount: 3, retryDelay: 750, batch: true },
      ),
    });
    const [user, details, pendingMor, depositToken] = await Promise.all([
      client.readContract({ address: pool, abi: DEPOSIT_POOL_ABI, functionName: "usersData", args: [address, MORPHEUS_REWARD_POOL_INDEX] }),
      client.readContract({ address: pool, abi: DEPOSIT_POOL_ABI, functionName: "rewardPoolsProtocolDetails", args: [MORPHEUS_REWARD_POOL_INDEX] }),
      client.readContract({ address: pool, abi: DEPOSIT_POOL_ABI, functionName: "getLatestUserReward", args: [MORPHEUS_REWARD_POOL_INDEX, address] }),
      client.readContract({ address: pool, abi: DEPOSIT_POOL_ABI, functionName: "depositToken" }),
    ]);
    if (depositToken.toLowerCase() !== poolCfg.token.toLowerCase()) {
      throw new Error(`pool depositToken is ${depositToken}, expected ${poolCfg.symbol} ${poolCfg.token}`);
    }
    const [lastStake, depositedRaw, , , , claimLockEnd] = user;
    if (depositedRaw === 0n) return { position: null, error: null };
    const deposited = Number(formatUnits(depositedRaw, poolCfg.decimals));
    const withdrawUnlockAt = Number(lastStake) + Number(details[0]);
    const claimUnlockAt = Number(claimLockEnd);
    const priceUsd = priceFor(poolCfg.token.toLowerCase(), poolCfg.symbol);
    if (!(priceUsd > 0)) throw new Error(`no ${poolCfg.symbol} price available — refusing to value the position at 0`);
    return {
      position: {
        positionId, protocol: "Morpheus", label, chainId: 1, network: "ethereum", contract: pool,
        asset: { symbol: poolCfg.symbol, address: poolCfg.token.toLowerCase(), decimals: poolCfg.decimals },
        deposited, depositedRaw: depositedRaw.toString(), priceUsd, valueUSD: deposited * priceUsd,
        locked: nowSec < withdrawUnlockAt, withdrawUnlockAt, claimUnlockAt,
        rewards: { symbol: "MOR", pending: Number(formatUnits(pendingMor, 18)), pendingRaw: pendingMor.toString() },
        source: "onchain-state", readAt: new Date(nowSec * 1000).toISOString(),
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? (error as { shortMessage?: string }).shortMessage ?? error.message : String(error);
    console.error(`[Portfolio API] Morpheus ${poolCfg.symbol} position read FAILED for ${address}: ${message}`);
    return { position: null, error: { positionId, protocol: "Morpheus", label, message } };
  }
}

export async function fetchDefiPositions(address: Address, alchemyApiKey: string | undefined, priceFor: PriceResolver): Promise<DefiSummary> {
  // Sequential on purpose: keeps the RPC burst small while the ERC-20 and NFT
  // lookups are also in flight.
  const results = [];
  for (const poolCfg of MORPHEUS_POOLS) results.push(await fetchMorpheusPosition(address, poolCfg, alchemyApiKey, priceFor));
  const positions = results.map((r) => r.position).filter((p): p is DefiPosition => !!p);
  const errors = results.map((r) => r.error).filter((e): e is DefiReadError => !!e);
  return { positions, totalUSD: positions.reduce((s, p) => s + p.valueUSD, 0), errors };
}
