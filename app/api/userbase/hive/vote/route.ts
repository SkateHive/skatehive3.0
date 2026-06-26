import { NextRequest } from "next/server";
import { proxyUserbaseHive } from "@/lib/userbase/proxyToApi";

export const runtime = "nodejs";

// Proxied to api.skatehive.app — the single owner of the vote broadcast +
// soft-vote attribution (Phase 2 userbase unification). The web client keeps
// calling this same relative path; only the broadcast moved.
export async function POST(request: NextRequest) {
  return proxyUserbaseHive(request, "/api/userbase/hive/vote");
}
