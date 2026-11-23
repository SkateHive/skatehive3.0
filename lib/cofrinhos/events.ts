import type { SupabaseClient } from "@supabase/supabase-js";
import { ownerColumns, type JarOwner } from "./owner";

export type JarEventType = "create" | "fund" | "withdraw";
export type JarEventVia = "savings" | "wallet";

/** A jar movement as stored in userbase_savings_jar_events. */
export interface SavingsJarEventRow {
  id: string;
  jar_id: string;
  hive_account: string | null;
  evm_address: string | null;
  owner_key: string;
  type: JarEventType;
  /** Amount in the jar currency (column name kept for compatibility). */
  amount_hbd: number;
  via: JarEventVia | null;
  created_at: string;
}

const EVENTS_TABLE = "userbase_savings_jar_events";

/**
 * Record a jar movement. Best-effort: the ledger is display history, so a
 * failed insert logs but never fails the money operation that triggered it.
 */
export async function logJarEvent(
  supabase: SupabaseClient,
  event: {
    jar_id: string;
    owner: JarOwner;
    type: JarEventType;
    amount_hbd?: number;
    via?: JarEventVia | null;
  }
): Promise<void> {
  const { error } = await supabase.from(EVENTS_TABLE).insert({
    jar_id: event.jar_id,
    ...ownerColumns(event.owner),
    type: event.type,
    amount_hbd: event.amount_hbd ?? 0,
    via: event.via ?? null,
  });
  if (error) {
    console.error("Failed to log jar event:", error.message);
  }
}

/** List a jar's recent movements, newest first, scoped to the given owners. */
export async function listJarEvents(
  supabase: SupabaseClient,
  jarId: string,
  ownerKeys: string[],
  limit = 30
): Promise<SavingsJarEventRow[] | null> {
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select("*")
    .eq("jar_id", jarId)
    .in("owner_key", ownerKeys)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to list jar events:", error.message);
    return null;
  }
  return (data as SavingsJarEventRow[]) || [];
}
