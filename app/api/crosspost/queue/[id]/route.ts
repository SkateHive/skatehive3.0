import { NextRequest, NextResponse } from "next/server";
import { CROSSPOST_QUEUE_TABLE } from "@/lib/crosspost/queue";
import { getServiceSupabase } from "@/lib/supabase/serviceClient";
import { requireCurator } from "@/lib/crosspost/queueAuth";

/**
 * GET /api/crosspost/queue/[id]
 *
 * Full detail for one queue item — the payload the curator is reviewing plus
 * the requester's profile. Used by the portal's review screen.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }

  const auth = await requireCurator(request, supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .select("*")
    .eq("id", id)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const item = data?.[0];
  if (!item) {
    return NextResponse.json({ error: "Queue item not found." }, { status: 404 });
  }

  let requester = null;
  if (item.user_id) {
    const { data: users } = await supabase
      .from("userbase_users")
      .select("id, handle, display_name, avatar_url")
      .eq("id", item.user_id)
      .limit(1);
    requester = users?.[0] ?? null;
  }

  return NextResponse.json({ success: true, item: { ...item, requester } });
}
