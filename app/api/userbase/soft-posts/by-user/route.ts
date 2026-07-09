import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const limitParam = searchParams.get("limit");
    const limitRaw = limitParam ? Number(limitParam) : 50;
    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 200);

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("userbase_soft_posts")
      .select(
        "id, author, permlink, title, type, status, metadata, created_at, updated_at, userbase_users!inner(moderation_status)"
      )
      .eq("user_id", userId)
      .in("status", ["queued", "broadcasted"])
      .not("userbase_users.moderation_status", "in", "(suspicious,blocked)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to load soft posts:", error);
      return NextResponse.json(
        { error: "Failed to load soft posts" },
        { status: 500 }
      );
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error("Soft posts lookup failed:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
