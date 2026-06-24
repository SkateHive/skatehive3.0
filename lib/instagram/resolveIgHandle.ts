import HiveClient from "@/lib/hive/hiveclient";

/**
 * Resolve an Instagram handle for caption-time @-mentions.
 *
 * Sources, in priority order:
 *   1. userbase_identities row (type='instagram') for the given user_id —
 *      whatever they last saved via EditProfile or the cross-post dialog.
 *   2. Hive `posting_json_metadata.profile.instagram` for the given Hive
 *      username — read live from the blockchain.
 *
 * Returns the bare handle (no leading @). Returns null if nothing found.
 *
 * Caller responsibility: when `igHandle` is null, the caption builder falls
 * back to the plain `By {hive_user}` form. When set, the credit line tags
 * the IG account directly.
 */
export async function resolveIgHandleForCaption(args: {
  hiveAuthor: string;
  userId: string | null;
  supabase: any; // service-role @supabase/supabase-js client
}): Promise<string | null> {
  const { hiveAuthor, userId, supabase } = args;

  // 1. userbase_identities (self-claimed via SkateHive UI)
  if (userId && supabase) {
    const { data } = await supabase
      .from("userbase_identities")
      .select("handle")
      .eq("user_id", userId)
      .eq("type", "instagram")
      .limit(1);
    const handle = data?.[0]?.handle;
    if (handle && typeof handle === "string") {
      return sanitize(handle);
    }
  }

  // 2. Hive profile metadata fallback
  const fromHive = await readIgFromHiveProfile(hiveAuthor);
  if (fromHive) return sanitize(fromHive);

  return null;
}

/**
 * Read the `instagram` field out of a Hive account's posting_json_metadata.profile.
 * Defensive against the many shapes Hive frontends use.
 */
async function readIgFromHiveProfile(hiveAuthor: string): Promise<string | null> {
  try {
    const accounts = await HiveClient.database.getAccounts([hiveAuthor]);
    const acc = accounts?.[0];
    if (!acc) return null;
    const meta = parseJson(acc.posting_json_metadata) ?? parseJson(acc.json_metadata);
    const profile = meta?.profile;
    if (!profile || typeof profile !== "object") return null;

    // Direct field — what we'll write.
    if (typeof profile.instagram === "string" && profile.instagram.trim()) {
      return profile.instagram.trim();
    }

    // Nested social field — some frontends use this convention.
    if (
      profile.social &&
      typeof profile.social === "object" &&
      typeof profile.social.instagram === "string" &&
      profile.social.instagram.trim()
    ) {
      return profile.social.instagram.trim();
    }

    // Last resort: an instagram.com/{handle} URL in profile.website.
    if (typeof profile.website === "string") {
      const m = profile.website.match(/instagram\.com\/([A-Za-z0-9._]+)/);
      if (m) return m[1];
    }
  } catch {
    // Hive RPC unavailable — fall through and return null.
  }
  return null;
}

function parseJson(raw: unknown): any | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Strip leading @, lowercase, drop anything that isn't a legal IG handle char.
 * Returns null if the result is empty or exceeds IG's 30-char limit.
 */
export function sanitize(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
  if (!cleaned || cleaned.length > 30) return null;
  return cleaned;
}
