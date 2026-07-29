"use client";

import { useEffect, useState } from "react";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

// Cap the Hive account lookup so a stalled RPC node never leaves the hook
// stuck at null (which would silently prevent onboarding from showing).
const REQUEST_TIMEOUT_MS = 5000;

export interface HiveProfileSummary {
  /** The account has on-chain activity (posts or comments). */
  hasPosts: boolean;
  /** The account's Hive profile has a `profile_image` set. */
  hasProfileImage: boolean;
  /** The account's Hive profile has an `about` text set. */
  hasAbout: boolean;
}

const EMPTY_SUMMARY: HiveProfileSummary = {
  hasPosts: false,
  hasProfileImage: false,
  hasAbout: false,
};

function parseMetadata(raw: unknown): Record<string, any> {
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw);
    // Accounts in the wild carry things like "null" or a bare string here, and
    // both would blow up on the `.profile` lookup.
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Reads the profile data the viewer's linked Hive account already carries
 * on-chain, so onboarding can skip steps the user effectively already did
 * elsewhere.
 *
 * Each signal maps to one onboarding step:
 *   hasPosts        → intro post step (they've already posted to Hive)
 *   hasProfileImage → photo step (their Hive avatar is a real image, and the
 *                     `images.hive.blog/u/{handle}/avatar` proxy stored on the
 *                     Skatehive profile resolves to it)
 *   hasAbout        → bio step (Skatehive never copies the Hive `about` into
 *                     userbase_users.bio, so this is the only way to see it)
 *
 * Return value:
 *   null   → still resolving (a Hive account is linked but hasn't been fetched
 *            yet). Callers should not show onboarding while the value is null,
 *            to avoid flashing a step that's about to be filtered out.
 *   object → no linked Hive account (all false), or the resolved signals.
 */
export function useHiveProfileSummary(): HiveProfileSummary | null {
  const { hiveIdentity } = useLinkedIdentities();
  const handle = hiveIdentity?.handle ?? null;
  const [summary, setSummary] = useState<HiveProfileSummary | null>(null);

  useEffect(() => {
    // No linked Hive account → nothing to skip, resolve immediately.
    if (!handle) {
      setSummary(EMPTY_SUMMARY);
      return;
    }

    let cancelled = false;
    setSummary(null);

    // Abort the request if it stalls, so the summary never stays stuck at null
    // (which would silently block onboarding from ever appearing).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    (async () => {
      try {
        const res = await fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_accounts",
            params: [[handle]],
            id: 1,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        const account = data?.result?.[0];

        // Hive keeps the profile in posting_json_metadata; json_metadata is the
        // legacy location still used by older accounts.
        const profile =
          parseMetadata(account?.posting_json_metadata).profile ??
          parseMetadata(account?.json_metadata).profile ??
          {};

        if (!cancelled) {
          setSummary({
            hasPosts: (account?.post_count ?? 0) > 0,
            hasProfileImage: !!String(profile.profile_image ?? "").trim(),
            hasAbout: !!String(profile.about ?? "").trim(),
          });
        }
      } catch {
        // On failure/timeout/abort, fail open by resolving to all-false:
        // showing extra (skippable) steps is better than blocking onboarding.
        if (!cancelled) setSummary(EMPTY_SUMMARY);
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [handle]);

  return summary;
}

export default useHiveProfileSummary;
