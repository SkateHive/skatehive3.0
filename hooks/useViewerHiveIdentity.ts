import { useMemo } from "react";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

/**
 * Hook to get the current viewer's Hive username.
 * Reads from LinkedIdentityContext (single fetch) instead of making per-component API calls.
 */
export function useViewerHiveIdentity(): string | null {
  const { identities } = useLinkedIdentities();

  return useMemo(() => {
    const hiveIdentity = identities.find((id) => id.type === "hive");
    return hiveIdentity?.handle || null;
  }, [identities]);
}
