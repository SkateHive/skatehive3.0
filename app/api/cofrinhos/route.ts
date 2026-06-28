import { NextRequest, NextResponse } from "next/server";
import { getAuthedAccount } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase, type SavingsJarRow } from "@/lib/cofrinhos/supabase";
import {
  getOnChainHbdSavings,
  summarize,
  validateJarInput,
} from "@/lib/cofrinhos/service";

const MAX_JARS = 20;

/**
 * GET /api/cofrinhos
 * Returns the authed account's jars plus an allocation summary reconciled
 * against the on-chain HBD savings balance.
 */
export async function GET(request: NextRequest) {
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

  const { data: jars, error } = await supabase
    .from("userbase_savings_jars")
    .select("*")
    .eq("hive_account", account)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load jars:", error.message);
    return NextResponse.json({ error: "Failed to load jars" }, { status: 500 });
  }

  let savings = 0;
  try {
    savings = await getOnChainHbdSavings(account);
  } catch (err: any) {
    console.error("Failed to read on-chain savings:", err?.message || err);
  }

  return NextResponse.json({
    jars: (jars as SavingsJarRow[]) || [],
    savings_hbd: savings,
    summary: summarize((jars as SavingsJarRow[]) || [], savings),
  });
}

/**
 * POST /api/cofrinhos
 * Create a new jar (allocated starts at 0; fund it via the allocate endpoint).
 */
export async function POST(request: NextRequest) {
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateJarInput(body, false);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { count } = await supabase
    .from("userbase_savings_jars")
    .select("id", { count: "exact", head: true })
    .eq("hive_account", account);

  if ((count ?? 0) >= MAX_JARS) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_JARS} jars` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("userbase_savings_jars")
    .insert({
      hive_account: account,
      name: validation.value.name,
      target_hbd: validation.value.target_hbd ?? null,
      deadline: validation.value.deadline ?? null,
      icon: validation.value.icon ?? "🐷",
      color: validation.value.color ?? "#34d399",
      is_wishlist: validation.value.is_wishlist ?? false,
      sort_order: validation.value.sort_order ?? count ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create jar:", error.message);
    return NextResponse.json({ error: "Failed to create jar" }, { status: 500 });
  }

  return NextResponse.json({ jar: data as SavingsJarRow }, { status: 201 });
}
