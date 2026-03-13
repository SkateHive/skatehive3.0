'use client';

import { useCallback, useState } from 'react';
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from 'wagmi';
import { parseEther } from 'viem';
import { POIDH_CONTRACT_ADDRESS } from '@/lib/poidh-abi';
import { POIDH_ABI } from '@/lib/poidh-abi';

type TxStatus = 'idle' | 'switching-chain' | 'pending-approval' | 'pending-tx' | 'confirmed' | 'error';

interface UsePoidhWriteReturn {
  status: TxStatus;
  error: string | null;
  txHash: `0x${string}` | undefined;
  reset: () => void;
  // Bounty creation
  createSoloBounty: (chainId: number, name: string, description: string, ethAmount: string) => Promise<void>;
  createOpenBounty: (chainId: number, name: string, description: string, ethAmount: string) => Promise<void>;
  // Contributions
  joinOpenBounty: (chainId: number, bountyId: bigint, ethAmount: string) => Promise<void>;
  withdrawFromOpenBounty: (chainId: number, bountyId: bigint) => Promise<void>;
  // Claims
  createClaim: (chainId: number, bountyId: bigint, name: string, description: string, uri: string) => Promise<void>;
  // Accept / Vote
  acceptClaim: (chainId: number, bountyId: bigint, claimId: bigint) => Promise<void>;
  submitClaimForVote: (chainId: number, bountyId: bigint, claimId: bigint) => Promise<void>;
  voteClaim: (chainId: number, bountyId: bigint, vote: boolean) => Promise<void>;
  resolveVote: (chainId: number, bountyId: bigint) => Promise<void>;
  resetVotingPeriod: (chainId: number, bountyId: bigint) => Promise<void>;
  // Cancel / Withdraw
  cancelSoloBounty: (chainId: number, bountyId: bigint) => Promise<void>;
  cancelOpenBounty: (chainId: number, bountyId: bigint) => Promise<void>;
  claimRefund: (chainId: number, bountyId: bigint) => Promise<void>;
  withdraw: (chainId: number) => Promise<void>;
}

export function usePoidhWrite(): UsePoidhWriteReturn {
  const { chain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: txHash, reset: resetWrite } = useWriteContract();

  const [status, setStatus] = useState<TxStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Wait for tx confirmation
  useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash && status === 'pending-tx',
    },
  });

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    resetWrite();
  }, [resetWrite]);

  // Ensure we're on the right chain before executing
  const ensureChain = useCallback(async (targetChainId: number) => {
    if (chain?.id !== targetChainId) {
      setStatus('switching-chain');
      await switchChainAsync({ chainId: targetChainId });
    }
  }, [chain?.id, switchChainAsync]);

  // Generic contract write wrapper
  const execute = useCallback(async (
    targetChainId: number,
    functionName: string,
    args: readonly unknown[],
    value?: bigint,
  ) => {
    try {
      setError(null);
      await ensureChain(targetChainId);

      setStatus('pending-approval');
      const hash = await writeContractAsync({
        address: POIDH_CONTRACT_ADDRESS,
        abi: POIDH_ABI,
        functionName,
        args,
        ...(value ? { value } : {}),
      } as any);

      setStatus('pending-tx');

      // Wait for confirmation inline
      if (hash) {
        setStatus('confirmed');
      }
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Transaction failed';
      setError(msg);
      setStatus('error');
      throw err;
    }
  }, [ensureChain, writeContractAsync]);

  // ── Bounty Creation ─────────────────────────────────────────
  const createSoloBounty = useCallback(async (
    chainId: number, name: string, description: string, ethAmount: string,
  ) => {
    await execute(chainId, 'createSoloBounty', [name, description], parseEther(ethAmount));
  }, [execute]);

  const createOpenBounty = useCallback(async (
    chainId: number, name: string, description: string, ethAmount: string,
  ) => {
    await execute(chainId, 'createOpenBounty', [name, description], parseEther(ethAmount));
  }, [execute]);

  // ── Contributions ───────────────────────────────────────────
  const joinOpenBounty = useCallback(async (
    chainId: number, bountyId: bigint, ethAmount: string,
  ) => {
    await execute(chainId, 'joinOpenBounty', [bountyId], parseEther(ethAmount));
  }, [execute]);

  const withdrawFromOpenBounty = useCallback(async (
    chainId: number, bountyId: bigint,
  ) => {
    await execute(chainId, 'withdrawFromOpenBounty', [bountyId]);
  }, [execute]);

  // ── Claims ──────────────────────────────────────────────────
  const createClaim = useCallback(async (
    chainId: number, bountyId: bigint, name: string, description: string, uri: string,
  ) => {
    await execute(chainId, 'createClaim', [bountyId, name, description, uri]);
  }, [execute]);

  // ── Accept / Vote ───────────────────────────────────────────
  const acceptClaim = useCallback(async (
    chainId: number, bountyId: bigint, claimId: bigint,
  ) => {
    await execute(chainId, 'acceptClaim', [bountyId, claimId]);
  }, [execute]);

  const submitClaimForVote = useCallback(async (
    chainId: number, bountyId: bigint, claimId: bigint,
  ) => {
    await execute(chainId, 'submitClaimForVote', [bountyId, claimId]);
  }, [execute]);

  const voteClaim = useCallback(async (
    chainId: number, bountyId: bigint, vote: boolean,
  ) => {
    await execute(chainId, 'voteClaim', [bountyId, vote]);
  }, [execute]);

  const resolveVote = useCallback(async (
    chainId: number, bountyId: bigint,
  ) => {
    await execute(chainId, 'resolveVote', [bountyId]);
  }, [execute]);

  const resetVotingPeriod = useCallback(async (
    chainId: number, bountyId: bigint,
  ) => {
    await execute(chainId, 'resetVotingPeriod', [bountyId]);
  }, [execute]);

  // ── Cancel / Withdraw ───────────────────────────────────────
  const cancelSoloBounty = useCallback(async (
    chainId: number, bountyId: bigint,
  ) => {
    await execute(chainId, 'cancelSoloBounty', [bountyId]);
  }, [execute]);

  const cancelOpenBounty = useCallback(async (
    chainId: number, bountyId: bigint,
  ) => {
    await execute(chainId, 'cancelOpenBounty', [bountyId]);
  }, [execute]);

  const claimRefund = useCallback(async (
    chainId: number, bountyId: bigint,
  ) => {
    await execute(chainId, 'claimRefundFromCancelledOpenBounty', [bountyId]);
  }, [execute]);

  const withdrawFn = useCallback(async (chainId: number) => {
    await execute(chainId, 'withdraw', []);
  }, [execute]);

  return {
    status,
    error,
    txHash,
    reset,
    createSoloBounty,
    createOpenBounty,
    joinOpenBounty,
    withdrawFromOpenBounty,
    createClaim,
    acceptClaim,
    submitClaimForVote,
    voteClaim,
    resolveVote,
    resetVotingPeriod,
    cancelSoloBounty,
    cancelOpenBounty,
    claimRefund,
    withdraw: withdrawFn,
  };
}
