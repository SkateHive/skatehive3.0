"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useAccount, useSignMessage } from "wagmi";
import { useBankActions } from "./useBankActions";
import { ChainSwitchError, useMorphoUsdcVault } from "./useMorphoUsdcVault";
import { friendlyError, isUserRejection } from "@/lib/evm/txErrors";
import { selectOwnJars, toUsdcUnits, type JarCurrency } from "@/lib/cofrinhos/clientState";

/** HBD jars belong to a Hive account; USDC jars to a wallet (Morpho on Base). */
export type { JarCurrency };
export const JAR_CURRENCIES: JarCurrency[] = ["HBD", "USDC"];

export interface SavingsJar {
  id: string;
  hive_account: string | null;
  evm_address: string | null;
  currency: JarCurrency;
  name: string;
  target_hbd: number | null;
  allocated_hbd: number;
  deadline: string | null;
  icon: string;
  color: string;
  is_wishlist: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface JarsSummary {
  allocated_total: number;
  unallocated: number;
  over_allocated: boolean;
}

/** One signed-in currency, reconciled against its own on-chain balance. */
export interface CurrencyBalance {
  owner: string;
  /** HBD savings, or the USDC position in the Morpho vault. */
  savings: number;
  savings_available: boolean;
  summary: JarsSummary;
}

/**
 * A jar's funding progress as a 0–100 percentage, or null when it has no
 * target to measure against (open-ended / wishlist jars).
 */
export function jarProgress(jar: SavingsJar): number | null {
  if (!jar.target_hbd || jar.target_hbd <= 0) return null;
  return Math.min(100, (Number(jar.allocated_hbd) / jar.target_hbd) * 100);
}

export interface JarInput {
  /** Only on create; a jar's currency never changes. */
  currency?: JarCurrency;
  name?: string;
  target_hbd?: number | null;
  deadline?: string | null;
  icon?: string;
  color?: string;
  is_wishlist?: boolean;
  sort_order?: number;
}

export interface JarEvent {
  id: string;
  jar_id: string;
  type: "create" | "fund" | "withdraw";
  amount_hbd: number;
  via: "savings" | "wallet" | null;
  created_at: string;
}

interface OpResult {
  success: boolean;
  error?: string;
}

interface AllocateOptions {
  skipRefresh?: boolean;
  /** Ledger hint: 'wallet' when a real on-chain transfer wraps this move. */
  via?: "savings" | "wallet";
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

const ALLOCATE_RETRY_ATTEMPTS = 3;
const ALLOCATE_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry only the allocate step after a real on-chain transfer already
 * succeeded. A deposit can land on a Hive node the API reads from before it
 * has replicated, so the very next allocate call can transiently fail the
 * savings check — this bridges that window without ever re-broadcasting the
 * transaction (`opFn` is called exactly once by the caller, before this).
 */
async function withAllocateRetry(opFn: () => Promise<OpResult>): Promise<OpResult> {
  let result: OpResult = { success: false, error: "Allocation failed" };
  for (let attempt = 0; attempt < ALLOCATE_RETRY_ATTEMPTS; attempt++) {
    result = await opFn();
    if (result.success) return result;
    if (attempt < ALLOCATE_RETRY_ATTEMPTS - 1) await sleep(ALLOCATE_RETRY_DELAY_MS);
  }
  return result;
}

/** Turn a wallet/vault error into the hook's result. */
function txFailure(e: unknown): OpResult {
  if (e instanceof ChainSwitchError) return { success: false, error: e.message };
  if (isUserRejection(e)) return { success: false, error: "Cancelled in the wallet" };
  return { success: false, error: friendlyError(e) };
}

/**
 * Cofrinhos (savings jars) client hook, for both currencies.
 *
 * Jar metadata lives off-chain (Supabase). Each owner unlocks with a signature:
 * the Hive account (Keychain/aioha) for HBD jars, the wallet for USDC jars.
 * Both sessions can be active at once and the list shows every jar.
 *
 * Real money moves:
 * - HBD: useBankActions (deposit to / withdraw from Hive savings; withdrawals
 *   take Hive's 3 days).
 * - USDC: the Earn Morpho vault on Base (deposit / withdraw, both instant).
 * Moving money between a jar and the free balance is metadata only.
 */
export function useSavingsJars() {
  const { user, aioha } = useAioha();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { depositToSavings, withdrawFromSavings } = useBankActions();
  const {
    usdcBalance: walletUsdc,
    maxWithdraw: vaultMaxWithdraw,
    refetch: refetchVault,
    deposit: vaultDeposit,
    withdraw: vaultWithdraw,
  } = useMorphoUsdcVault();

  const hiveUser = user ? user.toLowerCase() : null;
  const evmAddress = address ? address.toLowerCase() : null;

  // Latest identities, so in-flight requests can tell they became stale after
  // an account/wallet switch and must not write the previous owner's data.
  const identityRef = useRef({ hiveUser, evmAddress });
  identityRef.current = { hiveUser, evmAddress };

  const [jars, setJars] = useState<SavingsJar[]>([]);
  const [balances, setBalances] = useState<Partial<Record<JarCurrency, CurrencyBalance>>>({});
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<JarCurrency | null>(null);

  /** Prove ownership for one currency and set its session cookie. */
  const ensureAuth = useCallback(
    async (currency: JarCurrency): Promise<boolean> => {
      const sessionRes = await fetch("/api/cofrinhos/auth/session");
      const session = sessionRes.ok ? await sessionRes.json() : null;

      if (currency === "HBD") {
        if (!hiveUser) return false;
        if (session?.account === hiveUser) return true;
        const challengeRes = await fetch("/api/cofrinhos/auth/challenge", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ account: hiveUser }),
        });
        if (!challengeRes.ok) return false;
        const { message } = await challengeRes.json();
        const signResult = await aioha.signMessage(message, KeyTypes.Posting);
        if (!signResult?.success) return false;
        const verifyRes = await fetch("/api/cofrinhos/auth/verify", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            account: hiveUser,
            message,
            signature: signResult.result,
            public_key: signResult.publicKey,
          }),
        });
        return verifyRes.ok;
      }

      if (!evmAddress) return false;
      if (session?.evm_address === evmAddress) return true;
      const challengeRes = await fetch("/api/cofrinhos/auth/challenge", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ evm_address: evmAddress }),
      });
      if (!challengeRes.ok) return false;
      const { message } = await challengeRes.json();
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch {
        return false;
      }
      const verifyRes = await fetch("/api/cofrinhos/auth/verify", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ evm_address: evmAddress, message, signature }),
      });
      return verifyRes.ok;
    },
    [hiveUser, evmAddress, aioha, signMessageAsync]
  );

  /** Fetch the latest jars + balances. Silently flags auth state on 401. */
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!hiveUser && !evmAddress) {
      setJars([]);
      setBalances({});
      return false;
    }
    const stale = () =>
      identityRef.current.hiveUser !== hiveUser || identityRef.current.evmAddress !== evmAddress;
    setLoading(true);
    try {
      const res = await fetch("/api/cofrinhos");
      if (stale()) return false;
      if (res.status === 401) {
        setJars([]);
        setBalances({});
        return false;
      }
      if (!res.ok) {
        console.error("Cofrinhos load failed:", await parseError(res, `HTTP ${res.status}`));
        return false;
      }
      const data = await res.json();
      if (stale()) return false;

      // A session cookie can belong to a previously connected account or
      // wallet. Drop that side (cookie included) instead of showing someone
      // else's jars.
      const own = selectOwnJars<SavingsJar, CurrencyBalance>(data, hiveUser, evmAddress);
      if (own.staleHive) {
        await fetch("/api/cofrinhos/auth/session?kind=hive", { method: "DELETE" });
      }
      if (own.staleEvm) {
        await fetch("/api/cofrinhos/auth/session?kind=evm", { method: "DELETE" });
      }
      if (stale()) return false;
      setJars(own.jars);
      setBalances(own.balances);
      return own.hiveOk || own.evmOk;
    } finally {
      setLoading(false);
    }
  }, [hiveUser, evmAddress]);

  // Try a silent load on mount / identity change (uses existing cookies).
  useEffect(() => {
    refresh();
  }, [refresh]);

  /** User-initiated unlock for one currency: sign the challenge, then load. */
  const connect = useCallback(
    async (currency: JarCurrency): Promise<boolean> => {
      setUnlocking(currency);
      try {
        const ok = await ensureAuth(currency);
        if (!ok) return false;
        // Surface load failures too — a signed-in user staring at the locked
        // state with no feedback is how bugs hide.
        return await refresh();
      } finally {
        setUnlocking(null);
      }
    },
    [ensureAuth, refresh]
  );

  /** Fetch that re-authenticates `currency` once on 401. */
  const authedFetch = useCallback(
    async (currency: JarCurrency, path: string, init: RequestInit): Promise<Response> => {
      let res = await fetch(path, init);
      if (res.status === 401 && (await ensureAuth(currency))) {
        res = await fetch(path, init);
      }
      return res;
    },
    [ensureAuth]
  );

  const currencyOf = useCallback(
    (id: string): JarCurrency => jars.find((jar) => jar.id === id)?.currency ?? "HBD",
    [jars]
  );

  const createJar = useCallback(
    async (input: JarInput): Promise<OpResult> => {
      const currency = input.currency ?? "HBD";
      const res = await authedFetch(currency, "/api/cofrinhos", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ ...input, currency }),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to create jar") };
      await refresh();
      return { success: true };
    },
    [authedFetch, refresh]
  );

  const updateJar = useCallback(
    async (id: string, input: JarInput): Promise<OpResult> => {
      // The currency is fixed at creation; never send it on update.
      const { currency: _ignored, ...fields } = input;
      const res = await authedFetch(currencyOf(id), `/api/cofrinhos/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(fields),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to update jar") };
      await refresh();
      return { success: true };
    },
    [authedFetch, currencyOf, refresh]
  );

  const deleteJar = useCallback(
    async (id: string): Promise<OpResult> => {
      const res = await authedFetch(currencyOf(id), `/api/cofrinhos/${id}`, { method: "DELETE" });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to delete jar") };
      await refresh();
      return { success: true };
    },
    [authedFetch, currencyOf, refresh]
  );

  /** Move money between a jar and the free balance (metadata only, no tx). */
  const allocate = useCallback(
    async (id: string, delta: number, options: AllocateOptions = {}): Promise<OpResult> => {
      const res = await authedFetch(currencyOf(id), `/api/cofrinhos/${id}/allocate`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ delta, via: options.via ?? "savings" }),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to allocate") };
      if (!options.skipRefresh) await refresh();
      return { success: true };
    },
    [authedFetch, currencyOf, refresh]
  );

  /**
   * Add wallet money into a jar: a real deposit first (HBD to Hive savings,
   * USDC to the Morpho vault), then allocate. The tx is sent exactly once; if
   * the follow-up allocate keeps failing after retrying, the deposit itself
   * already succeeded and the money is safe — surface that distinctly instead
   * of reading as a failed deposit.
   */
  const fundFromWallet = useCallback(
    async (id: string, amount: number): Promise<OpResult> => {
      const currency = currencyOf(id);
      if (currency === "HBD") {
        const tx = await depositToSavings(amount, "HBD", "SkateHive cofrinho");
        if (!tx.success) return { success: false, error: tx.error };
      } else {
        try {
          await vaultDeposit(toUsdcUnits(amount));
        } catch (e) {
          return txFailure(e);
        } finally {
          refetchVault();
        }
      }

      const result = await withAllocateRetry(() => allocate(id, amount, { via: "wallet" }));
      if (!result.success) {
        return {
          success: false,
          error:
            currency === "HBD"
              ? "Deposit succeeded, but the jar wasn't updated yet. Your HBD is safe in savings — try Save again in a minute."
              : "Deposit succeeded, but the jar wasn't updated yet. Your USDC is safe in Morpho — try Save again in a minute.",
        };
      }
      return result;
    },
    [currencyOf, depositToSavings, vaultDeposit, refetchVault, allocate]
  );

  /**
   * Cash a jar out to the wallet: the real withdrawal first, then de-allocate,
   * so a cancelled signature never empties the jar or logs a phantom event.
   * HBD: `transfer_from_savings` only queues the transfer (Hive's 3 days).
   * USDC: the vault pays out in the same transaction.
   */
  const withdrawToWallet = useCallback(
    async (id: string, amount: number): Promise<OpResult> => {
      const currency = currencyOf(id);
      if (currency === "HBD") {
        const tx = await withdrawFromSavings(amount, "HBD", "SkateHive cofrinho");
        if (!tx.success) return { success: false, error: tx.error };
      } else {
        try {
          await vaultWithdraw(toUsdcUnits(amount));
        } catch (e) {
          return txFailure(e);
        } finally {
          refetchVault();
        }
      }

      const result = await withAllocateRetry(() => allocate(id, -amount, { via: "wallet" }));
      if (!result.success) {
        return {
          success: false,
          error:
            currency === "HBD"
              ? "Withdrawal was submitted, but the jar wasn't updated. It settles in ~3 days — reopen this jar afterward to fix the balance."
              : "The USDC is in your wallet, but the jar wasn't updated. Reopen this jar and withdraw the same amount to free savings to fix it.",
        };
      }
      return result;
    },
    [currencyOf, withdrawFromSavings, vaultWithdraw, refetchVault, allocate]
  );

  /** Load a jar's movement history (newest first). */
  const fetchEvents = useCallback(
    async (id: string): Promise<JarEvent[]> => {
      const res = await authedFetch(currencyOf(id), `/api/cofrinhos/${id}/events`, { method: "GET" });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.events as JarEvent[]) || [];
    },
    [authedFetch, currencyOf]
  );

  /** Currencies this user can hold jars in (has the identity for). */
  const available = useMemo(
    () => JAR_CURRENCIES.filter((c) => (c === "HBD" ? !!hiveUser : !!evmAddress)),
    [hiveUser, evmAddress]
  );
  /** Currencies whose session is unlocked. */
  const authed = useMemo(
    () => JAR_CURRENCIES.filter((c) => !!balances[c]),
    [balances]
  );

  return {
    jars,
    balances,
    available,
    authed,
    loading,
    unlocking,
    isConnected: available.length > 0,
    /** Wallet USDC and how much the vault can pay out now (base units). */
    walletUsdc,
    vaultMaxWithdraw,
    connect,
    refresh,
    createJar,
    updateJar,
    deleteJar,
    allocate,
    fundFromWallet,
    withdrawToWallet,
    fetchEvents,
  };
}
