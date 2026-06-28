import { NextRequest, NextResponse } from "next/server";
import { getAuthedAccount } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase, type SavingsJarRow } from "@/lib/cofrinhos/supabase";
import { validateJarInput } from "@/lib/cofrinhos/service";

/**
 * PATCH /api/cofrinhos/[id]
 * Update jar metadata (name, target, deadline, icon, color, wishlist, order).
 * Allocation (allocated_hbd) is changed only via the allocate endpoint.
 */
export async function PATCH(
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

  const validation = validateJarInput(body, true);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  if (Object.keys(validation.value).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Scope the update to the owning account so one user can't edit another's jar.
  const { data, error } = await supabase
    .from("userbase_savings_jars")
    .update(validation.value)
    .eq("id", id)
    .eq("hive_account", account)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Failed to update jar:", error.message);
    return NextResponse.json({ error: "Failed to update jar" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Jar not found" }, { status: 404 });
  }

  return NextResponse.json({ jar: data as SavingsJarRow });
}

/**
 * DELETE /api/cofrinhos/[id]
 * Removes the jar. Its allocation simply becomes unallocated savings again
 * (the money never moved on-chain).
 */
export async function DELETE(
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

  const { data, error } = await supabase
    .from("userbase_savings_jars")
    .delete()
    .eq("id", id)
    .eq("hive_account", account)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to delete jar:", error.message);
    return NextResponse.json({ error: "Failed to delete jar" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Jar not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
