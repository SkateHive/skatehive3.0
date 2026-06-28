"use client";

import { useCallback, useEffect, useState } from "react";
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

export interface JarInput {
  name?: string;
  target_hbd?: number | null;
  deadline?: string | null;
  icon?: string;
  color?: string;
  is_wishlist?: boolean;
  sort_order?: number;
}

interface OpResult {
  success: boolean;
  error?: string;
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
  const refresh = useCallback(async () => {
    if (!user) {
      setJars([]);
      setAuthed(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/cofrinhos");
      if (res.status === 401) {
        setAuthed(false);
        setJars([]);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setJars(data.jars || []);
      setSavingsHbd(data.savings_hbd || 0);
      setSummary(data.summary);
      setAuthed(true);
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
      if (ok) await refresh();
      return ok;
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
    async (id: string, deltaHbd: number, skipRefresh = false): Promise<OpResult> => {
      const res = await authedFetch(`/api/cofrinhos/${id}/allocate`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ delta_hbd: deltaHbd }),
      });
      if (!res.ok) return { success: false, error: await parseError(res, "Failed to allocate") };
      if (!skipRefresh) await refresh();
      return { success: true };
    },
    [authedFetch, refresh]
  );

  /** Add wallet HBD into a jar: deposit to savings (real tx), then allocate. */
  const fundFromWallet = useCallback(
    async (id: string, amount: number): Promise<OpResult> => {
      const tx = await depositToSavings(amount, "HBD", "SkateHive cofrinho");
      if (!tx.success) return { success: false, error: tx.error };
      return allocate(id, amount);
    },
    [depositToSavings, allocate]
  );

  /** Cash a jar out to the liquid wallet: de-allocate, then withdraw (3-day delay). */
  const withdrawToWallet = useCallback(
    async (id: string, amount: number): Promise<OpResult> => {
      const dealloc = await allocate(id, -amount, true);
      if (!dealloc.success) return dealloc;
      const tx = await withdrawFromSavings(amount, "HBD", "SkateHive cofrinho");
      await refresh();
      if (!tx.success) return { success: false, error: tx.error };
      return { success: true };
    },
    [allocate, withdrawFromSavings, refresh]
  );

  /** Move HBD from one jar to another (pure metadata). */
  const moveBetween = useCallback(
    async (fromId: string, toId: string, amount: number): Promise<OpResult> => {
      const out = await allocate(fromId, -amount, true);
      if (!out.success) return out;
      const into = await allocate(toId, amount);
      return into;
    },
    [allocate]
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
    moveBetween,
  };
}
