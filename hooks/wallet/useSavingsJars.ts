"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useBankActions } from "./useBankActions";

export interface SavingsJar {
  id: string;
  hive_account: string;
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

/**
 * A jar's funding progress as a 0–100 percentage, or null when it has no
 * target to measure against (open-ended / wishlist jars).
 */
export function jarProgress(jar: SavingsJar): number | null {
  if (!jar.target_hbd || jar.target_hbd <= 0) return null;
  return Math.min(100, (Number(jar.allocated_hbd) / jar.target_hbd) * 100);
}

export interface JarInput {
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

/**
 * Cofrinhos (savings jars) client hook.
 *
 * Jar metadata lives off-chain (Supabase) and is authed with a Hive signature
 * (one Keychain/aioha popup per ~7 days). Real money moves reuse useBankActions:
 * funding from the wallet deposits to savings first, withdrawing to the wallet
 * cashes out of savings after, and moving between jars is pure metadata.
 */
export function useSavingsJars() {
  const { user, aioha } = useAioha();
  const { depositToSavings, withdrawFromSavings } = useBankActions();

  // Latest Aioha user, so in-flight requests can tell they became stale after
  // an account switch and must not write the previous account's data to state.
  const userRef = useRef(user);
  userRef.current = user;

  const [jars, setJars] = useState<SavingsJar[]>([]);
  const [savingsHbd, setSavingsHbd] = useState(0);
  const [summary, setSummary] = useState<JarsSummary>({
    allocated_total: 0,
    unallocated: 0,
    over_allocated: false,
  });
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  /** Prove Hive account ownership and set the cofrinhos session cookie. */
  const ensureAuth = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const sessionRes = await fetch("/api/cofrinhos/auth/session");
    if (sessionRes.ok) {
      const data = await sessionRes.json();
      if (data?.account === user.toLowerCase()) return true;
    }

    const challengeRes = await fetch("/api/cofrinhos/auth/challenge", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ account: user }),
    });
    if (!challengeRes.ok) return false;
    const { message } = await challengeRes.json();

    const signResult = await aioha.signMessage(message, KeyTypes.Posting);
    if (!signResult?.success) return false;

    const verifyRes = await fetch("/api/cofrinhos/auth/verify", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        account: user,
        message,
        signature: signResult.result,
        public_key: signResult.publicKey,
      }),
    });
    return verifyRes.ok;
  }, [user, aioha]);

  /** Fetch the latest jars + summary. Silently flags auth state on 401. */
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setJars([]);
      setAuthed(false);
      return false;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cofrinhos");
      // Account switched while this request was in flight — drop the response.
      if (userRef.current !== user) return false;
      if (res.status === 401) {
        setAuthed(false);
        setJars([]);
        return false;
      }
      if (!res.ok) {
        console.error("Cofrinhos load failed:", await parseError(res, `HTTP ${res.status}`));
        return false;
      }
      const data = await res.json();
      if (userRef.current !== user) return false;
      if (data.account !== user.toLowerCase()) {
        // The session cookie belongs to a previously connected account. Kill
        // it and show the locked state instead of another account's jars.
        await fetch("/api/cofrinhos/auth/session", { method: "DELETE" });
        setJars([]);
        setAuthed(false);
        return false;
      }
      setJars(data.jars || []);
      setSavingsHbd(data.savings_hbd || 0);
      setSummary(data.summary);
      setAuthed(true);
      return true;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Try a silent load on mount / account change (uses existing cookie if any).
  useEffect(() => {
    refresh();
  }, [refresh]);

  /** User-initiated unlock: sign the challenge, then load. */
  const connect = useCallback(async (): Promise<boolean> => {
    setUnlocking(true);
    try {
      const ok = await ensureAuth();
      if (!ok) return false;
      // Surface load failures too — a signed-in user staring at the locked
      // state with no feedback is how bugs hide.
      return await refresh();
    } finally {
      setUnlocking(false);
    }
  }, [ensureAuth, refresh]);

  /** Fetch that re-authenticates once on 401. */
  const authedFetch = useCallback(
    async (path: string, init: RequestInit): Promise<Response> => {
      let res = await fetch(path, init);
      if (res.status === 401 && (await ensureAuth())) {
        res = await fetch(path, init);
      }
      return res;
    },
    [ensureAuth]
  );

  const createJar = useCallback(
    async (input: JarInput): Promise<OpResult> => {
      const res = await authedFetch("/api/cofrinhos", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to create jar") };
      await refresh();
      return { success: true };
    },
    [authedFetch, refresh]
  );

  const updateJar = useCallback(
    async (id: string, input: JarInput): Promise<OpResult> => {
      const res = await authedFetch(`/api/cofrinhos/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to update jar") };
      await refresh();
      return { success: true };
    },
    [authedFetch, refresh]
  );

  const deleteJar = useCallback(
    async (id: string): Promise<OpResult> => {
      const res = await authedFetch(`/api/cofrinhos/${id}`, { method: "DELETE" });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to delete jar") };
      await refresh();
      return { success: true };
    },
    [authedFetch, refresh]
  );

  /** Move HBD between a jar and unallocated savings (metadata only, no tx). */
  const allocate = useCallback(
    async (id: string, deltaHbd: number, options: AllocateOptions = {}): Promise<OpResult> => {
      const res = await authedFetch(`/api/cofrinhos/${id}/allocate`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ delta_hbd: deltaHbd, via: options.via ?? "savings" }),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to allocate") };
      if (!options.skipRefresh) await refresh();
      return { success: true };
    },
    [authedFetch, refresh]
  );

  /** Add wallet HBD into a jar: deposit to savings (real tx), then allocate. */
  const fundFromWallet = useCallback(
    async (id: string, amount: number): Promise<OpResult> => {
      const tx = await depositToSavings(amount, "HBD", "SkateHive cofrinho");
      if (!tx.success) return { success: false, error: tx.error };
      return allocate(id, amount, { via: "wallet" });
    },
    [depositToSavings, allocate]
  );

  /** Cash a jar out to the liquid wallet: withdraw on-chain first, then de-allocate. */
  const withdrawToWallet = useCallback(
    async (id: string, amount: number): Promise<OpResult> => {
      // Mirror fundFromWallet: do the real on-chain move first, and only touch
      // the jar (and its ledger) once it succeeds. Doing it the other way round
      // would empty the jar and log a phantom "withdrew to wallet" event even
      // when the user cancels the Keychain popup.
      const tx = await withdrawFromSavings(amount, "HBD", "SkateHive cofrinho");
      if (!tx.success) return { success: false, error: tx.error };
      return allocate(id, -amount, { via: "wallet" });
    },
    [withdrawFromSavings, allocate]
  );

  /** Load a jar's movement history (newest first). */
  const fetchEvents = useCallback(
    async (id: string): Promise<JarEvent[]> => {
      const res = await authedFetch(`/api/cofrinhos/${id}/events`, { method: "GET" });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.events as JarEvent[]) || [];
    },
    [authedFetch]
  );

  return {
    jars,
    savingsHbd,
    summary,
    authed,
    loading,
    unlocking,
    isConnected: !!user,
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
