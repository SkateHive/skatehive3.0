"use client";

import { useEffect, useMemo, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

export interface FollowActor {
  /** The Hive account a follow would actually be broadcast as, or null. */
  actor: string | null;
  /**
   * Who to read follow state for. Same as `actor`: someone with no signing
   * method cannot follow anyway, so reading their follow list would only paint
   * buttons that refuse to work.
   */
  statusActor: string | null;
  /** Userbase account with no Hive account behind it: clicking prompts an upgrade. */
  isLiteUser: boolean;
  /** Broadcast server-side with the stored posting key instead of via Keychain. */
  useStoredPostingKey: boolean;
}

/**
 * Resolves who the viewer is for the purposes of following someone.
 *
 * ProfilePage does this inline for one profile and also consults
 * `useViewerHiveIdentity`. That hook is deliberately NOT used here: it reaches
 * LinkedIdentityContext, which pulls wagmi and the Farcaster hooks, and on a
 * page that renders 30 cards that chain cost ~149KB of first-load JS. The two
 * sources it adds beyond Keychain are a linked identity that cannot sign, so
 * skipping it loses no follow anyone could actually perform.
 */
export default function useFollowActor(): FollowActor {
  const { user } = useAioha();
  const { user: userbaseUser } = useUserbaseAuth();
  const [storedKeyUser, setStoredKeyUser] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStoredPostingKeyStatus() {
      // Keychain wins when it is present, so there is nothing to look up.
      if (!userbaseUser || user) {
        setStoredKeyUser(null);
        return;
      }
      try {
        const response = await fetch("/api/userbase/keys/hive-info", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!cancelled) {
          setStoredKeyUser(
            response.ok && data?.has_key && data?.hive_username ? data.hive_username : null
          );
        }
      } catch {
        if (!cancelled) setStoredKeyUser(null);
      }
    }

    loadStoredPostingKeyStatus();
    return () => {
      cancelled = true;
    };
  }, [userbaseUser, user]);

  return useMemo(() => {
    const actor = user || storedKeyUser;
    return {
      actor,
      statusActor: actor,
      isLiteUser: Boolean(userbaseUser && !actor),
      useStoredPostingKey: Boolean(!user && storedKeyUser),
    };
  }, [user, storedKeyUser, userbaseUser]);
}
