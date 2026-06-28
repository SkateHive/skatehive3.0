import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
