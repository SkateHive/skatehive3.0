import { useMemo } from "react";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useAioha } from "@aioha/react-ui";

/**
 * Returns the current viewer's active Hive username.
 *
 * Priority:
 *   1. useAioha().user — the account actively connected via Keychain/Aioha
 *      (this is the account that will sign transactions, so it must match)
 *   2. The hive identity stored in the userbase DB (linked account)
 *
 * Using the Aioha user as primary ensures that when someone logs in as
 * steemskate via Keychain, that account is used for signing — not whatever
 * hive username is stored in the userbase DB for their session.
 */
export function useViewerHiveIdentity(): string | null {
  const { user: aiohaUser } = useAioha();
  const { identities } = useLinkedIdentities();

  return useMemo(() => {
    // Prefer the live Keychain/Aioha account
    if (aiohaUser) return aiohaUser;

    // Fall back to the linked hive identity from the userbase DB
    const hiveIdentity = identities.find((id) => id.type === "hive");
    return hiveIdentity?.handle || null;
  }, [aiohaUser, identities]);
}
