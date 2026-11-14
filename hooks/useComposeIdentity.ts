import { useMemo } from "react";
import { useAioha } from "@aioha/react-ui";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { resolveComposeDraftKeys } from "@/lib/compose/drafts";

export type ComposeIdentity = {
  // Handle the post is authored as: wallet/Keychain user first, then the
  // primary linked Hive identity, then a userbase-only handle.
  handle: string | null;
  // Namespace compose drafts are stored under: the active Hive account, so
  // switching between Hive accounts in one session keeps drafts apart. Lite
  // users without a Hive account fall back to their userbase id, which is
  // stable across handle changes.
  draftKey: string | null;
  // Older namespaces whose drafts belong to this user and get folded into
  // `draftKey` (e.g. drafts written as a lite user before getting a Hive
  // account through sponsorship or linking).
  draftAliasKeys: string[];
  // False while the session is still resolving, so callers don't load the
  // guest bucket first and then swap to the real user's drafts.
  isReady: boolean;
};

export function useComposeIdentity(): ComposeIdentity {
  const { user } = useAioha();
  const { hiveIdentity } = useLinkedIdentities();
  const { user: userbaseUser, isLoading } = useUserbaseAuth();

  const linkedHiveHandle = hiveIdentity?.handle || null;
  const hiveHandle = user || linkedHiveHandle;
  const handle = hiveHandle || userbaseUser?.handle || null;
  const userbaseId = userbaseUser?.id ?? null;

  return useMemo(() => {
    const { draftKey, draftAliasKeys } = resolveComposeDraftKeys({
      activeHiveHandle: hiveHandle,
      linkedHiveHandle,
      userbaseId,
    });

    return { handle, draftKey, draftAliasKeys, isReady: !isLoading };
  }, [handle, hiveHandle, isLoading, linkedHiveHandle, userbaseId]);
}
