import { NextRequest, NextResponse } from "next/server";
import { getAuthedOwners } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase, type SavingsJarRow } from "@/lib/cofrinhos/supabase";
import { logJarEvent, type JarEventVia } from "@/lib/cofrinhos/events";
import { getOnChainSavings, round3, summarize } from "@/lib/cofrinhos/service";
import { ownerKey, type JarOwner } from "@/lib/cofrinhos/owner";

/**
 * POST /api/cofrinhos/[id]/allocate
 * Body: { delta: number }  (positive = move unallocated savings into the jar,
 *                           negative = return savings from the jar)
 *       `delta_hbd` is accepted as an alias (current wallet UI).
 *
 * This only re-labels money that already sits in the owner's single on-chain
 * balance — HBD savings for HBD jars, the Morpho USDC position for USDC jars.
 * No blockchain transaction happens here; real deposits/withdrawals happen
 * client-side around this call. The invariant Σ(allocated) <= on-chain balance
 * is enforced per owner.
 *
 * The jar's owner (and so its currency) comes from the jar row, looked up
 * within the signed-in owners — never from the request body. The read + check
 * + write runs in the cofrinhos_allocate_owner Postgres function
 * (sql/migrations/0045), in one transaction with the owner's jar rows locked.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const owners = getAuthedOwners(request);
  if (owners.length === 0) {
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

  const delta = round3(Number(body?.delta ?? body?.delta_hbd));
  if (!Number.isFinite(delta) || delta === 0) {
    return NextResponse.json(
      { error: "delta must be a non-zero number" },
      { status: 400 }
    );
  }

  // Where the money came from / went to, for the history ledger. Optional and
  // display-only: 'savings' = metadata move against free savings (default),
  // 'wallet' = the client wrapped this call in a real on-chain transfer.
  const via: JarEventVia = body?.via === "wallet" ? "wallet" : "savings";

  const { data: found, error: findError } = await supabase
    .from("userbase_savings_jars")
    .select("owner_key")
    .eq("id", id)
    .in("owner_key", owners.map(ownerKey))
    .maybeSingle();
  if (findError) {
    console.error("Failed to load jar for allocate:", findError.message);
    return NextResponse.json({ error: "Failed to allocate" }, { status: 500 });
  }
  const owner: JarOwner | undefined = found
    ? owners.find((o) => ownerKey(o) === found.owner_key)
    : undefined;
  if (!owner) {
    return NextResponse.json({ error: "Jar not found" }, { status: 404 });
  }
  const key = ownerKey(owner);

  // Only funding needs the on-chain balance, to bound the invariant check
  // inside the RPC. Read it before calling in — Postgres can't reach the chain.
  let savings = 0;
  if (delta > 0) {
    try {
      savings = await getOnChainSavings(owner);
    } catch (err: any) {
      console.error("Failed to read savings for allocate:", err?.message || err);
      return NextResponse.json(
        { error: "Could not verify savings balance" },
        { status: 502 }
      );
    }
  }

  const { data, error } = await supabase.rpc("cofrinhos_allocate_owner", {
    p_owner_key: key,
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
        { error: "Not enough unallocated savings", savings, savings_hbd: savings },
        { status: 400 }
      );
    }
    console.error("Failed to allocate:", message);
    return NextResponse.json({ error: "Failed to allocate" }, { status: 500 });
  }

  const jar = data as SavingsJarRow;
  await logJarEvent(supabase, {
    jar_id: jar.id,
    owner,
    type: delta > 0 ? "fund" : "withdraw",
    amount_hbd: Math.abs(delta),
    via,
  });

  // Recompute this owner's summary against the post-write state.
  const { data: jarsData } = await supabase
    .from("userbase_savings_jars")
    .select("*")
    .eq("owner_key", key);
  const jars = (jarsData as SavingsJarRow[]) || [jar];

  // Funding already read a fresh balance for the invariant check above —
  // reuse it. Withdrawals skipped that read, so fetch best-effort here.
  let savingsForSummary = savings;
  let savingsAvailable = true;
  if (delta <= 0) {
    try {
      savingsForSummary = await getOnChainSavings(owner);
    } catch (err: any) {
      console.error("Failed to read savings for allocate summary:", err?.message || err);
      savingsAvailable = false;
    }
  }

  const summary = summarize(jars, savingsForSummary);
  if (!savingsAvailable) {
    // A transient RPC failure reads as savings = 0, which would fabricate an
    // over-allocated state. Report the reconciliation as unknown instead.
    summary.over_allocated = false;
    summary.unallocated = 0;
  }

  return NextResponse.json({
    jar,
    currency: jar.currency,
    savings_available: savingsAvailable,
    summary,
  });
}
