import { NextRequest, NextResponse } from "next/server";
import { getAuthedAccount } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase, type SavingsJarRow } from "@/lib/cofrinhos/supabase";
import { logJarEvent, type JarEventVia } from "@/lib/cofrinhos/events";
import {
  getOnChainHbdSavings,
  round3,
  summarize,
} from "@/lib/cofrinhos/service";

/**
 * POST /api/cofrinhos/[id]/allocate
 * Body: { delta_hbd: number }  (positive = move unallocated savings into the jar,
 *                               negative = return savings from the jar)
 *
 * This only re-labels money that already sits in the single on-chain HBD savings
 * balance — no blockchain transaction happens here. Adding real money to savings
 * (transfer_to_savings) or cashing out (transfer_from_savings) is done client-side
 * around this call. The invariant Σ(allocated) <= on-chain savings is enforced.
 *
 * The read + check + write is delegated to the cofrinhos_allocate Postgres
 * function (sql/migrations/0028_cofrinhos_allocate_rpc.sql), which runs in one
 * transaction with the account's jar rows locked — two concurrent allocate
 * calls for the same account can no longer race past the same stale snapshot.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const account = getAuthedAccount(request);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getCofrinhosSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing Supabase configuration" },
      { status: 500 }
    );
  }

  const { id } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const delta = round3(Number(body?.delta_hbd));
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json(
      { error: "delta_hbd must be a non-zero number" },
      { status: 400 }
    );
  }

  // Where the money came from / went to, for the history ledger. Optional and
  // display-only: 'savings' = metadata move against free savings (default),
  // 'wallet' = the client wrapped this call in a real on-chain transfer.
  const via: JarEventVia = body?.via === "wallet" ? "wallet" : "savings";

  // Only funding needs the on-chain balance, to bound the invariant check
  // inside the RPC. Read it before calling in — Postgres can't reach Hive.
  let savings = 0;
  if (delta > 0) {
    try {
      savings = await getOnChainHbdSavings(account);
    } catch (err: any) {
      console.error("Failed to read savings for allocate:", err?.message || err);
      return NextResponse.json(
        { error: "Could not verify savings balance" },
        { status: 502 }
      );
    }
  }

  const { data, error } = await supabase.rpc("cofrinhos_allocate", {
    p_account: account,
    p_jar_id: id,
    p_delta: delta,
    p_on_chain_savings: savings,
    p_check_savings: delta > 0,
  });

  if (error) {
    const message = error.message || "";
    if (message.includes("Jar not found")) {
      return NextResponse.json({ error: "Jar not found" }, { status: 404 });
    }
    if (message.includes("Wishlist jars")) {
      return NextResponse.json(
        { error: "Wishlist jars can't hold funds" },
        { status: 400 }
      );
    }
    if (message.includes("Cannot remove more")) {
      return NextResponse.json(
        { error: "Cannot remove more than the jar holds" },
        { status: 400 }
      );
    }
    if (message.includes("Not enough unallocated")) {
      return NextResponse.json(
        { error: "Not enough unallocated savings", savings_hbd: savings },
        { status: 400 }
      );
    }
    console.error("Failed to allocate:", message);
    return NextResponse.json({ error: "Failed to allocate" }, { status: 500 });
  }

  const jar = data as SavingsJarRow;

  await logJarEvent(supabase, {
    jar_id: jar.id,
    hive_account: account,
    type: delta > 0 ? "fund" : "withdraw",
    amount_hbd: Math.abs(delta),
    via,
  });

  // Recompute the summary against the post-write state.
  const { data: jarsData } = await supabase
    .from("userbase_savings_jars")
    .select("*")
    .eq("hive_account", account);
  const jars = (jarsData as SavingsJarRow[]) || [jar];

  // Funding already read a fresh balance for the invariant check above —
  // reuse it. Withdrawals skipped that read, so fetch best-effort here.
  let savingsForSummary = savings;
  let savingsAvailable = true;
  if (delta <= 0) {
    try {
      savingsForSummary = await getOnChainHbdSavings(account);
    } catch (err: any) {
      console.error("Failed to read savings for allocate summary:", err?.message || err);
      savingsAvailable = false;
    }
  }

  const summary = summarize(jars, savingsForSummary);
  if (!savingsAvailable) {
    // A transient RPC failure reads as savings = 0, which would fabricate an
    // over-allocated state. Don't cry wolf: report the reconciliation as
    // unknown instead (mirrors GET /api/cofrinhos).
    summary.over_allocated = false;
    summary.unallocated = 0;
  }

  return NextResponse.json({
    jar,
    savings_available: savingsAvailable,
    summary,
  });
}
