import { NextRequest, NextResponse } from "next/server";
import { getAuthedAccount } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase, type SavingsJarRow } from "@/lib/cofrinhos/supabase";
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

  // Load all of the account's jars (small set) for the invariant check.
  const { data: jarsData, error: loadError } = await supabase
    .from("userbase_savings_jars")
    .select("*")
    .eq("hive_account", account);

  if (loadError) {
    console.error("Failed to load jars for allocate:", loadError.message);
    return NextResponse.json({ error: "Failed to load jars" }, { status: 500 });
  }

  const jars = (jarsData as SavingsJarRow[]) || [];
  const jar = jars.find((j) => j.id === id);
  if (!jar) {
    return NextResponse.json({ error: "Jar not found" }, { status: 404 });
  }
  if (jar.is_wishlist) {
    return NextResponse.json(
      { error: "Wishlist jars can't hold funds" },
      { status: 400 }
    );
  }

  const newAllocated = round3(Number(jar.allocated_hbd) + delta);
  if (newAllocated < 0) {
    return NextResponse.json(
      { error: "Cannot remove more than the jar holds" },
      { status: 400 }
    );
  }

  // When adding, make sure there is enough unallocated savings on-chain.
  if (delta > 0) {
    let savings = 0;
    try {
      savings = await getOnChainHbdSavings(account);
    } catch (err: any) {
      console.error("Failed to read savings for allocate:", err?.message || err);
      return NextResponse.json(
        { error: "Could not verify savings balance" },
        { status: 502 }
      );
    }
    const otherAllocated = jars
      .filter((j) => j.id !== jar.id && !j.is_wishlist)
      .reduce((s, j) => s + Number(j.allocated_hbd), 0);
    if (round3(otherAllocated + newAllocated) > savings + 1e-6) {
      return NextResponse.json(
        { error: "Not enough unallocated savings", savings_hbd: savings },
        { status: 400 }
      );
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from("userbase_savings_jars")
    .update({ allocated_hbd: newAllocated })
    .eq("id", jar.id)
    .eq("hive_account", account)
    .select("*")
    .single();

  if (updateError) {
    console.error("Failed to allocate:", updateError.message);
    return NextResponse.json({ error: "Failed to allocate" }, { status: 500 });
  }

  // Recompute the summary with the updated jar.
  const merged = jars.map((j) => (j.id === jar.id ? (updated as SavingsJarRow) : j));
  let savings = 0;
  try {
    savings = await getOnChainHbdSavings(account);
  } catch {
    /* summary best-effort */
  }

  return NextResponse.json({
    jar: updated as SavingsJarRow,
    summary: summarize(merged, savings),
  });
}
