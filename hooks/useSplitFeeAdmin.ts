"use client";

/**
 * Reads and administers the Skatehive swap-fee split (0xSplits PullSplit V2.2
 * on Base). Exposes admin gating, live on-chain state (owner / paused / config
 * freshness), per-token distributable balances, and a `distribute` action with
 * transaction lifecycle state.
 *
 * Balance reads are heavier, so they are only issued when `balancesEnabled` is
 * true (i.e. when the admin panel is actually mounted). Owner/paused/hash reads
 * are cheap and used for tab gating.
 */
import { useCallback, useMemo } from "react";
import {
  useAccount,
  useChainId,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatUnits, type Address, type Hex } from "viem";
import { PULL_SPLIT_ABI } from "@/lib/evm/abis/pullSplitAbi";
import {
  SKATEHIVE_SWAP_SPLIT,
  SPLIT_FEE_TOKENS,
  computeSplitHash,
  isSplitAdminAddress,
  recipientPercent,
  type SplitFeeToken,
} from "@/lib/evm/splits";

export interface SplitTokenBalance {
  token: SplitFeeToken;
  splitBalance: bigint;
  warehouseBalance: bigint;
  /** splitBalance + warehouseBalance */
  total: bigint;
  /** Human-readable total, trimmed. */
  formatted: string;
  /** True when there is more than dust to distribute. */
  distributable: boolean;
}

export interface SplitRecipient {
  address: Address;
  allocation: bigint;
  percent: number;
}

export interface UseSplitFeeAdminOptions {
  /** Issue the (heavier) per-token balance reads. Enable only when the panel is open. */
  balancesEnabled?: boolean;
}

function trimAmount(value: string): string {
  if (!value.includes(".")) return value;
  const trimmed = value.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed.length ? trimmed : "0";
}

export function useSplitFeeAdmin(options: UseSplitFeeAdminOptions = {}) {
  const { balancesEnabled = false } = options;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const onBase = chainId === base.id;

  const split = SKATEHIVE_SWAP_SPLIT;

  // ── Core reads: owner / paused / splitHash (cheap; used for gating) ──────
  const {
    data: coreData,
    isLoading: coreLoading,
    error: coreError,
    refetch: refetchCore,
  } = useReadContracts({
    allowFailure: true,
    contracts: [
      { address: split.address, abi: PULL_SPLIT_ABI, functionName: "owner", chainId: base.id },
      { address: split.address, abi: PULL_SPLIT_ABI, functionName: "paused", chainId: base.id },
      { address: split.address, abi: PULL_SPLIT_ABI, functionName: "splitHash", chainId: base.id },
    ],
    query: { enabled: isConnected },
  });

  const owner = coreData?.[0]?.result as Address | undefined;
  const paused = coreData?.[1]?.result as boolean | undefined;
  const onChainHash = coreData?.[2]?.result as Hex | undefined;

  const isConfigCurrent = useMemo(() => {
    if (!onChainHash) return undefined;
    return computeSplitHash(split.split) === onChainHash;
  }, [onChainHash, split.split]);

  const isAdmin = useMemo(
    () => isConnected && isSplitAdminAddress(address, owner ?? split.owner),
    [isConnected, address, owner, split.owner],
  );

  // ── Balance reads per token (heavier; only when panel active) ────────────
  const balanceContracts = useMemo(
    () =>
      SPLIT_FEE_TOKENS.map((t) => ({
        address: split.address,
        abi: PULL_SPLIT_ABI,
        functionName: "getSplitBalance" as const,
        args: [t.address] as const,
        chainId: base.id,
      })),
    [split.address],
  );

  const {
    data: balData,
    isLoading: balLoading,
    isRefetching: balRefetching,
    refetch: refetchBalances,
  } = useReadContracts({
    allowFailure: true,
    contracts: balanceContracts,
    query: { enabled: isConnected && balancesEnabled },
  });

  const balances: SplitTokenBalance[] = useMemo(
    () =>
      SPLIT_FEE_TOKENS.map((token, i) => {
        const res = balData?.[i]?.result as readonly [bigint, bigint] | undefined;
        const splitBalance = res?.[0] ?? 0n;
        const warehouseBalance = res?.[1] ?? 0n;
        const total = splitBalance + warehouseBalance;
        return {
          token,
          splitBalance,
          warehouseBalance,
          total,
          formatted: trimAmount(formatUnits(total, token.decimals)),
          // 0xSplits keeps 1 wei per token in the warehouse for gas — that is dust.
          distributable: total > 1n,
        };
      }),
    [balData],
  );

  const recipients: SplitRecipient[] = useMemo(
    () =>
      split.split.recipients.map((r, i) => ({
        address: r,
        allocation: split.split.allocations[i],
        percent: recipientPercent(split.split.allocations[i], split.split.totalAllocation),
      })),
    [split.split],
  );

  // ── Distribute ───────────────────────────────────────────────────────────
  const {
    writeContractAsync,
    isPending: isDistributing,
    data: txHash,
    reset: resetTx,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash, chainId: base.id });

  const distribute = useCallback(
    async (tokenAddress: Address): Promise<Hex> => {
      const distributor = (address ?? split.owner) as Address;
      return writeContractAsync({
        address: split.address,
        abi: PULL_SPLIT_ABI,
        functionName: "distribute",
        args: [
          {
            recipients: split.split.recipients,
            allocations: split.split.allocations,
            totalAllocation: split.split.totalAllocation,
            distributionIncentive: split.split.distributionIncentive,
          },
          tokenAddress,
          distributor,
        ],
        chainId: base.id,
      });
    },
    [writeContractAsync, address, split],
  );

  const switchToBase = useCallback(async () => {
    await switchChain({ chainId: base.id });
  }, [switchChain]);

  const refetch = useCallback(() => {
    refetchCore();
    if (balancesEnabled) refetchBalances();
  }, [refetchCore, refetchBalances, balancesEnabled]);

  return {
    // gating
    isAdmin,
    // chain
    onBase,
    switchToBase,
    isSwitching,
    // state
    owner,
    paused,
    isConfigCurrent,
    recipients,
    balances,
    isLoading: coreLoading || (balancesEnabled && balLoading),
    isRefetching: balRefetching,
    error: coreError,
    // distribute
    distribute,
    isDistributing,
    txHash,
    isConfirming,
    isConfirmed,
    resetTx,
    refetch,
    // config
    config: split,
  };
}

export default useSplitFeeAdmin;
