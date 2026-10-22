/**
 * Turning an email address into a Skatehive account.
 *
 * These were private to the magic-link route until invites needed exactly the
 * same behaviour — a handle derived from the address, checked against Hive, and
 * inserted under a unique name. Two copies of that logic would drift, and the
 * one place they must not drift is the handle a skater is stuck with.
 */
import crypto from "crypto";
import {
  checkHiveAccountExists,
  validateHiveUsernameFormat,
} from "@/lib/utils/hiveAccountUtils";

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function toHiveSafeBaseHandle(value: string) {
  const sanitized = slugify(value) || "skater";
  return sanitized.slice(0, 16).replace(/(^-|-$)+/g, "") || "skater";
}

export function deriveDisplayName(identifier: string) {
  const local = identifier.split("@")[0] || "";
  const words = local
    .replace(/[_\-.]+/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (words.length === 0) {
    return "Skater";
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getAvatarUrl(seed: string) {
  const safeSeed = encodeURIComponent(seed || "skatehive");
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${safeSeed}`;
}

/**
 * Insert a user under a handle nobody else holds — not in userbase, and not on
 * Hive either, since the handle is what the account is eventually created under
 * when someone sponsors it.
 *
 * `extraColumns` rides along on the insert so a caller can stamp its own fields
 * (invited_by, say) without a second write that could be lost on a crash.
 */
export async function createUserWithUniqueHandle(
  supabase: any,
  baseHandle: string,
  displayName: string,
  avatarUrl: string,
  extraColumns: Record<string, any> = {},
  maxAttempts = 7
): Promise<{ id: string; handle: string } | null> {
  const sanitized = toHiveSafeBaseHandle(baseHandle);

  const row = (handle: string) => ({
    handle,
    display_name: displayName,
    avatar_url: avatarUrl,
    status: "active",
    onboarding_step: 0,
    ...extraColumns,
  });

  if (
    validateHiveUsernameFormat(sanitized).isValid &&
    !(await checkHiveAccountExists(sanitized))
  ) {
    // First attempt: try the sanitized handle directly
    const { data: firstAttempt, error: firstError } = await supabase
      .from("userbase_users")
      .insert(row(sanitized))
      .select("id, handle")
      .single();

    if (firstAttempt && !firstError) {
      return firstAttempt;
    }

    // If error is not a unique constraint violation, surface it
    if (firstError?.code !== "23505") {
      console.error("Failed to create user (non-unique error):", firstError);
      return null;
    }
  }

  // Retry with random suffixes
  for (let attempt = 0; attempt < maxAttempts - 1; attempt++) {
    const suffix = crypto.randomBytes(2).toString("hex");
    const candidate = `${sanitized.slice(0, 11).replace(/-$/g, "")}-${suffix}`;

    if (
      !validateHiveUsernameFormat(candidate).isValid ||
      (await checkHiveAccountExists(candidate))
    ) {
      continue;
    }

    const { data, error } = await supabase
      .from("userbase_users")
      .insert(row(candidate))
      .select("id, handle")
      .single();

    if (data && !error) {
      return data;
    }

    // If it's a unique constraint error, continue retrying
    if (error?.code === "23505") {
      continue;
    }

    // Non-unique error, bail out
    console.error("Failed to create user (non-unique error):", error);
    return null;
  }

  // All attempts exhausted
  console.error("Failed to create user: all handle attempts exhausted");
  return null;
}
