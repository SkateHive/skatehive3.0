import { NextRequest, NextResponse } from "next/server";
import { getAuthedOwners } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase, type SavingsJarRow } from "@/lib/cofrinhos/supabase";
import { logJarEvent } from "@/lib/cofrinhos/events";
import {
  getOnChainSavings,
  summarize,
  validateJarInput,
  type JarsSummary,
} from "@/lib/cofrinhos/service";
import {
  ownerColumns,
  ownerCurrency,
  ownerForCurrency,
  ownerKey,
  parseCurrency,
  type JarCurrency,
  type JarOwner,
} from "@/lib/cofrinhos/owner";

const MAX_JARS = 20;

interface CurrencyBalance {
  owner: string;
  savings: number;
  savings_available: boolean;
  summary: JarsSummary;
}

/** Reconcile one owner's jars against that owner's on-chain balance. */
async function balanceFor(owner: JarOwner, rows: SavingsJarRow[]): Promise<CurrencyBalance> {
  const key = ownerKey(owner);
  const own = rows.filter((j) => j.owner_key === key);
  let savings = 0;
  let savingsAvailable = true;
  try {
    savings = await getOnChainSavings(owner);
  } catch (err: any) {
    console.error(`Failed to read on-chain savings for ${key}:`, err?.message || err);
    savingsAvailable = false;
  }
  const summary = summarize(own, savings);
  // A transient RPC failure reads savings as 0, which would fabricate an
  // over-allocated state and a negative "free savings". Don't cry wolf: report
  // the reconciliation as unknown so the client can skip the warning.
  if (!savingsAvailable) {
    summary.over_allocated = false;
    summary.unallocated = 0;
  }
  return {
    owner: owner.kind === "hive" ? owner.account : owner.address,
    savings,
    savings_available: savingsAvailable,
    summary,
  };
}

/**
 * GET /api/cofrinhos
 * Returns the jars of every owner this session is signed in as (Hive account
 * and/or wallet), each currency reconciled against its own on-chain balance:
 * HBD savings for HBD jars, the Morpho USDC position for USDC jars.
 *
 * `account`, `savings_hbd`, `savings_available` and `summary` describe the HBD
 * side exactly as before, for the current wallet UI. `balances` has one entry
 * per signed-in currency.
 */
export async function GET(request: NextRequest) {
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

  const { data: jars, error } = await supabase
    .from("userbase_savings_jars")
    .select("*")
    .in("owner_key", owners.map(ownerKey))
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load jars:", error.message);
    return NextResponse.json({ error: "Failed to load jars" }, { status: 500 });
  }

  const rows = (jars as SavingsJarRow[]) || [];
  const entries = await Promise.all(
    owners.map(async (o) => [ownerCurrency(o), await balanceFor(o, rows)] as const)
  );
  const balances: Partial<Record<JarCurrency, CurrencyBalance>> = Object.fromEntries(entries);

  const hive = ownerForCurrency(owners, "HBD");
  const evm = ownerForCurrency(owners, "USDC");
  const hbd = balances.HBD;

  return NextResponse.json({
    // Echo the session's owners so the client can detect a cookie left over
    // from a previously connected account or wallet (see useSavingsJars.refresh).
    account: hive?.kind === "hive" ? hive.account : null,
    evm_address: evm?.kind === "evm" ? evm.address : null,
    jars: rows,
    savings_hbd: hbd?.savings ?? 0,
    savings_available: hbd?.savings_available ?? false,
    summary: hbd?.summary ?? summarize([], 0),
    balances,
  });
}

/**
 * POST /api/cofrinhos
 * Body: jar fields + optional currency ('HBD' default | 'USDC').
 * Create a new jar (allocated starts at 0; fund it via the allocate endpoint).
 * The jar belongs to the signed-in owner of that currency: the Hive account
 * for HBD, the wallet for USDC.
 */
export async function POST(request: NextRequest) {
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currency = parseCurrency(body?.currency);
  if (!currency) {
    return NextResponse.json({ error: "Currency must be HBD or USDC" }, { status: 400 });
  }
  const owner = ownerForCurrency(owners, currency);
  if (!owner) {
    return NextResponse.json(
      {
        error:
          currency === "USDC"
            ? "Sign in with your wallet to create a USDC jar"
            : "Sign in with your Hive account to create an HBD jar",
      },
      { status: 401 }
    );
  }

  const validation = validateJarInput(body, false);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const key = ownerKey(owner);
  const { count } = await supabase
    .from("userbase_savings_jars")
    .select("id", { count: "exact", head: true })
    .eq("owner_key", key);

  if ((count ?? 0) >= MAX_JARS) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_JARS} jars` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("userbase_savings_jars")
    .insert({
      ...ownerColumns(owner),
      currency,
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

  const jar = data as SavingsJarRow;
  await logJarEvent(supabase, {
    jar_id: jar.id,
    owner,
    type: "create",
  });

  return NextResponse.json({ jar }, { status: 201 });
}
