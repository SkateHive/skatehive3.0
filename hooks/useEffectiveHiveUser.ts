"use client";

import { useAioha } from "@aioha/react-ui";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

export default function useEffectiveHiveUser() {
  const { user } = useAioha();
  const { user: userbaseUser } = useUserbaseAuth();
  const { isLoading, connections } = useLinkedIdentities();

  const hiveIdentity = connections.hive.identities[0] || null;
  const handle = user || hiveIdentity?.handle || null;
  const isWalletConnected = !!user;
  const isUserbaseLinked = connections.hive.linked && !user;
  const canUseAppFeatures = !!user || connections.hive.linked || !!userbaseUser;

  return {
    handle,
    isWalletConnected,
    isUserbaseLinked,
    isLoading,
    canUseAppFeatures,
  };
}
