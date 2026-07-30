/**
 * Service-role Supabase client for API routes.
 *
 * Returns null when the server is missing config so callers can 500 with a
 * clear message instead of throwing at import time — which in Next would take
 * down the whole route module, not just the request.
 *
 * NEVER import this from a client component: the service-role key bypasses
 * RLS entirely.
 */
import { createClient } from "@supabase/supabase-js";

export function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
