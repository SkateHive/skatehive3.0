import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { JarCurrency } from "./owner";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client for the cofrinhos (savings jars) routes.
 * Returns null when Supabase env vars are missing so callers can short-circuit.
 */
export function getCofrinhosSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A savings jar row as stored in userbase_savings_jars. */
export interface SavingsJarRow {
  id: string;
  /** Owner of an HBD jar; null for USDC jars. */
  hive_account: string | null;
  /** Owner of a USDC jar (lowercase 0x address); null for HBD jars. */
  evm_address: string | null;
  /** 'hive:<account>' | 'evm:<address>' (generated column). */
  owner_key: string;
  currency: JarCurrency;
  name: string;
  /** Goal, in the jar currency (column name kept for compatibility). */
  target_hbd: number | null;
  /** Allocation, in the jar currency (column name kept for compatibility). */
  allocated_hbd: number;
  deadline: string | null;
  icon: string;
  color: string;
  is_wishlist: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Fields a client may set when creating or updating a jar. */
export interface SavingsJarInput {
  name?: string;
  target_hbd?: number | null;
  deadline?: string | null;
  icon?: string;
  color?: string;
  is_wishlist?: boolean;
  sort_order?: number;
}
