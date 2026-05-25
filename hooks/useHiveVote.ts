"use client";

import { useCallback } from "react";
import { useAioha } from "@aioha/react-ui";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { usePostingKeyDialog } from "@/contexts/PostingKeyDialogContext";
import { useTranslations } from "@/contexts/LocaleContext";

export default function useHiveVote() {
  const { user, aioha } = useAioha();
  const { hiveIdentity: identity } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();
  const { openPostingKeyDialog } = usePostingKeyDialog();
  const t = useTranslations();

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
        if (
          data?.code === "POSTING_KEY_NOT_STORED" ||
          data?.code === "POSTING_KEY_DECRYPT_FAILED"
        ) {
          // Surface the posting-key dialog so the user can save (or
          // overwrite) their key and retry, instead of leaving them stuck
          // on a toast. DECRYPT_FAILED covers stored-but-unreadable keys
          // (corrupted payload, encryption secret rotated, etc.).
          openPostingKeyDialog({ hiveHandle: identity?.handle ?? null });
          throw new Error(t("upvoteToast.needsPostingKey"));
        }
        throw new Error(data?.error || "Failed to vote");
      }

      return { success: true, result: data };
    },
    [aioha, user, identity?.handle, openPostingKeyDialog, t]
  );

  return { vote, effectiveUser, isWalletConnected: !!user, canVote };
}
