import { useAioha } from "@aioha/react-ui";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

// The handle compose drafts are namespaced under: wallet/Keychain user first,
// then the primary linked Hive identity, then a userbase-only handle. Shared
// between the composer and the drafts list so both resolve the same bucket.
export function useComposeIdentity(): string | null {
  const { user } = useAioha();
  const { hiveIdentity } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();

  return user || hiveIdentity?.handle || userbaseUser?.handle || null;
}
