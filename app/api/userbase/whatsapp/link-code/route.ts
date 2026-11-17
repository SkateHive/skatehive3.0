import { NextRequest } from "next/server";
import { proxyUserbaseHive } from "@/lib/userbase/proxyToApi";

export const runtime = "edge";

// Proxied to api.skatehive.app, which owns WhatsApp linking (codes + bot routes).
export async function POST(request: NextRequest) {
  return proxyUserbaseHive(request, "/api/userbase/apps/whatsapp/link/code");
}
