/**
 * Instagram token diagnostic.
 *
 * Usage (token is NOT printed back; only metadata is shown):
 *   INSTAGRAM_PAGE_ACCESS_TOKEN='paste-token-here' \
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID='123...' \
 *   node scripts/ig-token-check.mjs
 *
 * It checks the token shape, then calls /me on BOTH graph hosts to discover
 * which one (if any) accepts it, and surfaces Meta's exact error message.
 */

const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || "";
const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "";
const version = process.env.INSTAGRAM_GRAPH_API_VERSION || "v23.0";

function shape(t) {
  const trimmed = t.trim();
  return {
    length: t.length,
    trimmedLength: trimmed.length,
    hasLeadingTrailingWhitespace: t !== trimmed,
    hasNewline: /[\r\n]/.test(t),
    hasSpace: /\s/.test(trimmed),
    hasPipe: trimmed.includes("|"), // app token format APPID|SECRET -> "cannot parse"
    prefix6: trimmed.slice(0, 6),
    looksLikeIGLogin: trimmed.startsWith("IGAA"), // graph.instagram.com
    looksLikeFBPage: trimmed.startsWith("EAA"), // graph.facebook.com
    tokenCharsOnly: /^[A-Za-z0-9_.-]+$/.test(trimmed),
  };
}

async function callMe(host) {
  const url = new URL(`https://${host}/${version}/me`);
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", token.trim());
  try {
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    return { host, status: res.status, ok: res.ok, data };
  } catch (e) {
    return { host, error: String(e) };
  }
}

(async () => {
  if (!token) {
    console.error("No INSTAGRAM_PAGE_ACCESS_TOKEN provided in env. Aborting.");
    process.exit(1);
  }
  console.log("=== Token shape (no secret printed) ===");
  console.log(JSON.stringify(shape(token), null, 2));
  console.log(`\nINSTAGRAM_BUSINESS_ACCOUNT_ID present: ${Boolean(igUserId)} (numeric: ${/^\d+$/.test(igUserId)})`);

  console.log("\n=== /me on graph.instagram.com (IG Login token expected) ===");
  console.log(JSON.stringify(await callMe("graph.instagram.com"), null, 2));

  console.log("\n=== /me on graph.facebook.com (FB Page token expected) ===");
  console.log(JSON.stringify(await callMe("graph.facebook.com"), null, 2));

  console.log(
    "\nInterpretation:\n" +
      " - 'Cannot parse access token'  -> value is malformed / wrong type / has a pipe or whitespace.\n" +
      " - 'Session has expired'        -> token was valid but expired; re-issue a long-lived token.\n" +
      " - 200 on instagram.com only    -> correct host; check INSTAGRAM_BUSINESS_ACCOUNT_ID matches the returned id.\n" +
      " - 200 on facebook.com only     -> wrong host: set INSTAGRAM_GRAPH_HOST=https://graph.facebook.com or use an IG Login token."
  );
})();
