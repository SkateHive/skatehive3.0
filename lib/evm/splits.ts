/**
 * Skatehive swap-fee split configuration and helpers.
 *
 * The ERC-20 swap flow (0x affiliate fee) routes fees to a 0xSplits PullSplit
 * V2.2 contract on Base. This module centralises everything the admin panel
 * needs to read that contract, verify its configuration is current, and
 * distribute the accrued fees.
 *
 * The canonical `split` below was read directly from the on-chain
 * `SplitUpdated` event and verified against the contract's stored `splitHash`
 * (see `computeSplitHash`). Distribution passes this exact tuple; the contract
 * hashes it and reverts on any mismatch, so `useIsSplitConfigCurrent` should
 * be checked before enabling distribute.
 */
import { keccak256, encodeAbiParameters, type Address, type Hex } from "viem";
import { base } from "wagmi/chains";

/** Reusable ABI param for the SplitV2Lib.Split tuple (for hashing / encoding). */
export const SPLIT_TUPLE_PARAM = {
  type: "tuple",
  components: [
    { name: "recipients", type: "address[]" },
    { name: "allocations", type: "uint256[]" },
    { name: "totalAllocation", type: "uint256" },
    { name: "distributionIncentive", type: "uint16" },
  ],
} as const;

export interface SplitConfig {
  recipients: Address[];
  allocations: bigint[];
  totalAllocation: bigint;
  distributionIncentive: number;
}

/**
 * Native-token placeholder used by the split / SplitsWarehouse for ETH.
 * (Passing the zero address to `getSplitBalance` reverts.)
 */
export const SPLIT_NATIVE_TOKEN =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as Address;

const SPLIT_ADDRESS = "0x1c043B5c01E7d29F85493830b98EB182BD205F21" as Address;

/**
 * Canonical split configuration — read from the on-chain `SplitUpdated` event
 * and verified against the contract's stored `splitHash`. Typed as a mutable
 * `SplitConfig` so it passes directly to viem write calls and `computeSplitHash`.
 */
export const SKATEHIVE_SPLIT_CONFIG: SplitConfig = {
  recipients: [
    "0xB4964e1ecA55Db36a94e8aeFfBFBAb48529a2f6c",
    "0x96c37393b79ad7eabdf9ccf82c2edad3d3c0eea2",
  ],
  allocations: [500000n, 500000n],
  totalAllocation: 1000000n,
  distributionIncentive: 0,
};

export const SKATEHIVE_SWAP_SPLIT = {
  address: SPLIT_ADDRESS,
  chainId: base.id, // 8453
  owner: "0x8Bf5941d27176242745B716251943Ae4892a3C26" as Address,
  warehouse: "0x8fb66F38cF86A3d5e8768f8F1754A24A6c661Fb8" as Address,
  explorerUrl: `https://basescan.org/address/${SPLIT_ADDRESS}`,
  splitsAppUrl: `https://app.splits.org/accounts/${SPLIT_ADDRESS}/?chainId=${base.id}`,
  split: SKATEHIVE_SPLIT_CONFIG,
};

export interface SplitFeeToken {
  symbol: string;
  address: Address;
  decimals: number;
  logo?: string;
  /** True for the ETH native placeholder token. */
  isNative?: boolean;
}

/**
 * Tokens surfaced in the admin panel. Fees accrue in whichever token a user
 * buys, so this is a curated shortlist (ETH + the common Base tokens); extend
 * as new fee tokens appear. Order controls display order.
 */
export const SPLIT_FEE_TOKENS: SplitFeeToken[] = [
  { symbol: "ETH", address: SPLIT_NATIVE_TOKEN, decimals: 18, logo: "/logos/ethereum_logo.png", isNative: true },
  { symbol: "USDC", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address, decimals: 6, logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png" },
  { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" as Address, decimals: 18, logo: "/logos/ethereum_logo.png" },
  { symbol: "DEGEN", address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed" as Address, decimals: 18, logo: "/logos/degen.png" },
  { symbol: "HIGHER", address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe" as Address, decimals: 18, logo: "/logos/higher.png" },
];

/**
 * Extra EVM addresses (besides the on-chain owner) allowed to see and use the
 * admin panel. Maintain here or via NEXT_PUBLIC_SPLIT_ADMINS (comma-separated).
 * All comparisons are lowercased.
 */
const SPLIT_ADMIN_ALLOWLIST: string[] = [];

export function getSplitAdminAllowlist(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_SPLIT_ADMINS || "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(
    new Set([
      SKATEHIVE_SWAP_SPLIT.owner.toLowerCase(),
      ...SPLIT_ADMIN_ALLOWLIST,
      ...fromEnv,
    ]),
  );
}

/**
 * Is `address` allowed to administer the split? True when it is the on-chain
 * owner (pass `owner` when known) or is in the maintained allowlist.
 */
export function isSplitAdminAddress(
  address?: string | null,
  owner?: string | null,
): boolean {
  if (!address) return false;
  const a = address.toLowerCase();
  if (owner && a === owner.toLowerCase()) return true;
  return getSplitAdminAllowlist().includes(a);
}

/** keccak256(abi.encode(split)) — matches the contract's stored splitHash. */
export function computeSplitHash(split: SplitConfig): Hex {
  return keccak256(
    encodeAbiParameters([SPLIT_TUPLE_PARAM], [
      {
        recipients: split.recipients,
        allocations: split.allocations,
        totalAllocation: split.totalAllocation,
        distributionIncentive: split.distributionIncentive,
      },
    ]),
  );
}

/** Recipient allocation as a percentage (2 decimals) of the total. */
export function recipientPercent(allocation: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((allocation * 10000n) / total) / 100;
}

/** Short 0x1234…abcd form for display. */
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
