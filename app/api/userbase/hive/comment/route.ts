import { NextRequest } from "next/server";
import { proxyUserbaseHive } from "@/lib/userbase/proxyToApi";

export const runtime = "edge";

// Proxied to api.skatehive.app — the single owner of the comment broadcast +
// soft-post (Phase 2 userbase unification). The full body (parent_author/permlink,
// body, title, permlink, type, beneficiaries) is forwarded; api now supports
// beneficiaries (comment_options).
//
// json_metadata is normalized to an OBJECT here because some web callers send it
// as a JSON string while api only merges objects — without this, string metadata
// (tags, images, app) would be dropped. We also pin app to the web tag so api
// doesn't default web comments to "skatehive-mobile".
export async function POST(request: NextRequest) {
  return proxyUserbaseHive(request, "/api/userbase/hive/comment", (b) => {
    let jm: any = b?.json_metadata;
    if (typeof jm === "string") {
      try {
        jm = JSON.parse(jm);
      } catch {
        jm = {};
      }
    }
    if (!jm || typeof jm !== "object") jm = {};
    return {
      ...b,
      json_metadata: { ...jm, app: typeof jm.app === "string" ? jm.app : "skatehive" },
    };
  });
}
