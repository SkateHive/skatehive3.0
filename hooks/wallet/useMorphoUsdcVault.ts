"use client";

/**
 * Deposit/withdraw USDC in the Earn Morpho vault on Base, shared by the Earn
 * tab and the USDC savings jars. Callers own the UI (steps, toasts); these
 * functions throw on failure, including a user rejection (see isUserRejection).
 */

import { useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { useTranslations } from "@/contexts/LocaleContext";
import { isChainBoundWallet, chainBoundSwitchMessage } from "@/lib/evm/walletChain";
import { friendlyError, isTransportError, isUserRejection } from "@/lib/evm/txErrors";
import {
  EARN_CHAIN_ID,
  ERC20_EARN_ABI,
  ERC4626_ABI,
  MORPHO_USDC_VAULT,
  USDC_BASE,
} from "@/lib/evm/earn";

type EarnClient = NonNullable<ReturnType<typeof usePublicClient>>;

/** viem resolves the receipt of a reverted tx instead of throwing — make it throw. */
export async function waitForSuccess(client: EarnClient, hash: `0x${string}`, revertedMessage: string) {
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(revertedMessage);
}

/** Run a pre-sign simulation; only a contract revert blocks, RPC hiccups don't. */
export async function preflight(simulate: () => Promise<unknown>) {
  try {
    await simulate();
  } catch (e) {
    if (!isTransportError(e)) throw e;
  }
}

/** Switch the wallet to `target` if needed. Returns false when it couldn't. */
export function useEnsureChain() {
  const chainId = useChainId();
  const { connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const toast = useToast();
  const t = useTranslations();
  return useCallback(
    async (target: number) => {
      if (chainId === target) return true;
      if (isChainBoundWallet(connector)) {
        toast({ title: t("wallet.earn.switchFailed"), description: chainBoundSwitchMessage(target), status: "warning", duration: 8000, isClosable: true });
        return false;
      }
      try {
        await switchChainAsync({ chainId: target });
        return true;
      } catch (e) {
        if (isUserRejection(e)) toast({ title: t("wallet.earn.cancelled"), status: "info", duration: 2000, isClosable: true });
        else toast({ title: t("wallet.earn.switchFailed"), description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
        return false;
      }
    },
    [chainId, connector, switchChainAsync, toast, t],
  );
}

/** Thrown when the wallet could not be put on Base (the hook already toasted why). */
export class ChainSwitchError extends Error {
  constructor() {
    super("Wallet is not on Base");
    this.name = "ChainSwitchError";
  }
}

export type VaultStep = "approving" | "depositing" | "withdrawing";

export function useMorphoUsdcVault() {
  const t = useTranslations();
  const { address } = useAccount();
  const ensureChain = useEnsureChain();
  const client = usePublicClient({ chainId: EARN_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const vault = MORPHO_USDC_VAULT.address;

  const { data, refetch } = useReadContracts({
    contracts: address
      ? [
          { address: USDC_BASE, abi: ERC20_EARN_ABI, functionName: "balanceOf", args: [address], chainId: EARN_CHAIN_ID },
          { address: USDC_BASE, abi: ERC20_EARN_ABI, functionName: "allowance", args: [address, vault], chainId: EARN_CHAIN_ID },
          { address: vault, abi: ERC4626_ABI, functionName: "balanceOf", args: [address], chainId: EARN_CHAIN_ID },
          { address: vault, abi: ERC4626_ABI, functionName: "maxWithdraw", args: [address], chainId: EARN_CHAIN_ID },
        ]
      : [],
    query: { enabled: !!address },
  });
  const usdcBalance = data?.[0]?.result as bigint | undefined;
  const allowance = data?.[1]?.result as bigint | undefined;
  const shares = data?.[2]?.result as bigint | undefined;
  const maxWithdraw = data?.[3]?.result as bigint | undefined;

  /** Approve the exact amount if needed, then deposit. Returns the deposit tx hash. */
  const deposit = useCallback(
    async (assets: bigint, onStep?: (step: VaultStep) => void): Promise<`0x${string}`> => {
      if (!address || !client) throw new Error("Wallet not connected");
      if (!(await ensureChain(EARN_CHAIN_ID))) throw new ChainSwitchError();
      if ((allowance ?? 0n) < assets) {
        onStep?.("approving");
        // Exact amount, never an unlimited approval.
        const approveHash = await writeContractAsync({
          address: USDC_BASE, abi: ERC20_EARN_ABI, functionName: "approve", args: [vault, assets], chainId: EARN_CHAIN_ID,
        });
        await waitForSuccess(client, approveHash, t("wallet.earn.reverted"));
      }
      onStep?.("depositing");
      // A paused vault or a reached supply cap reverts here, before the user signs.
      await preflight(() =>
        client.simulateContract({ address: vault, abi: ERC4626_ABI, functionName: "deposit", args: [assets, address], account: address }),
      );
      const hash = await writeContractAsync({
        address: vault, abi: ERC4626_ABI, functionName: "deposit", args: [assets, address], chainId: EARN_CHAIN_ID,
      });
      await waitForSuccess(client, hash, t("wallet.earn.reverted"));
      return hash;
    },
    [address, client, ensureChain, allowance, writeContractAsync, vault, t],
  );

  /**
   * Withdraw `assets` to the wallet, or redeem every share when `redeemAll`
   * (no dust left; only valid when the vault can pay out the whole position).
   */
  const withdraw = useCallback(
    async (
      assets: bigint,
      options: { redeemAll?: boolean; onStep?: (step: VaultStep) => void } = {},
    ): Promise<`0x${string}`> => {
      if (!address || !client) throw new Error("Wallet not connected");
      if (!(await ensureChain(EARN_CHAIN_ID))) throw new ChainSwitchError();
      options.onStep?.("withdrawing");
      const redeemAll = !!options.redeemAll && !!shares;
      // Missing vault liquidity reverts here, before the user signs.
      await preflight(() =>
        redeemAll
          ? client.simulateContract({ address: vault, abi: ERC4626_ABI, functionName: "redeem", args: [shares!, address, address], account: address })
          : client.simulateContract({ address: vault, abi: ERC4626_ABI, functionName: "withdraw", args: [assets, address, address], account: address }),
      );
      const hash = redeemAll
        ? await writeContractAsync({ address: vault, abi: ERC4626_ABI, functionName: "redeem", args: [shares!, address, address], chainId: EARN_CHAIN_ID })
        : await writeContractAsync({ address: vault, abi: ERC4626_ABI, functionName: "withdraw", args: [assets, address, address], chainId: EARN_CHAIN_ID });
      await waitForSuccess(client, hash, t("wallet.earn.reverted"));
      return hash;
    },
    [address, client, ensureChain, shares, writeContractAsync, vault, t],
  );

  return { address, usdcBalance, allowance, shares, maxWithdraw, refetch, deposit, withdraw };
}
