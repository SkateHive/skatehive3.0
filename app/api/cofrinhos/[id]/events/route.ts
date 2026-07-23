import { NextRequest, NextResponse } from "next/server";
import { getAuthedAccount } from "@/lib/cofrinhos/auth";
import { getCofrinhosSupabase } from "@/lib/cofrinhos/supabase";
import { listJarEvents } from "@/lib/cofrinhos/events";

/**
 * GET /api/cofrinhos/[id]/events
 * The jar's movement history (create / fund / withdraw), newest first.
 * Ownership is enforced by filtering on the authed account.
 */
export async function GET(
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
  const events = await listJarEvents(supabase, id, account);
  if (events === null) {
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }

  return NextResponse.json({ events });
}
