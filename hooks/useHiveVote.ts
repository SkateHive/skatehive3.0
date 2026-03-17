"use client";

import { useCallback } from "react";
import { useAioha } from "@aioha/react-ui";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

export default function useHiveVote() {
  const { user, aioha } = useAioha();
  const { hiveIdentity: identity } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();

  const effectiveUser = user || identity?.handle || null;
  const canVote = !!user || !!identity?.handle || !!userbaseUser;

  const vote = useCallback(
    async (author: string, permlink: string, weight: number) => {
      if (user) {
        try {
          const result = await aioha.vote(author, permlink, weight);
          if (result?.success === false) {
            throw new Error(result?.error || "Wallet vote failed");
          }
          return { success: true, result };
        } catch (error) {
          throw error instanceof Error ? error : new Error("Wallet vote failed");
        }
      }

      const response = await fetch("/api/userbase/hive/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, permlink, weight }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.code === "POSTING_KEY_NOT_STORED" && identity?.handle) {
          throw new Error(
            `Connect your Hive wallet (@${identity.handle}) or add a posting key to vote.`
          );
        }
        throw new Error(data?.error || "Failed to vote");
      }

      return { success: true, result: data };
    },
    [aioha, user]
  );

  return { vote, effectiveUser, isWalletConnected: !!user, canVote };
}
