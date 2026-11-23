import { NextRequest, NextResponse } from "next/server";
import { getAuthedOwners } from "@/lib/cofrinhos/auth";
import { ownerKey } from "@/lib/cofrinhos/owner";
import { getCofrinhosSupabase } from "@/lib/cofrinhos/supabase";
import { listJarEvents } from "@/lib/cofrinhos/events";

/**
 * GET /api/cofrinhos/[id]/events
 * The jar's movement history (create / fund / withdraw), newest first.
 * Ownership is enforced by filtering on the signed-in owners.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ownerKeys = getAuthedOwners(request).map(ownerKey);
  if (ownerKeys.length === 0) {
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
  const events = await listJarEvents(supabase, id, ownerKeys);
  if (events === null) {
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }

  return NextResponse.json({ events });
}
