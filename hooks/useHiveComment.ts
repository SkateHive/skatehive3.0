"use client";

import { useCallback } from "react";
import { useAioha } from "@aioha/react-ui";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

interface PostComment {
  parentAuthor: string;
  parentPermlink: string;
  body: string;
}

/**
 * Publishes a reply to a Hive post through whichever authority the viewer has.
 *
 * Mirrors useHiveVote: Keychain/Aioha users sign locally, everyone else goes
 * through the userbase route handler, which falls back to the shared account
 * and records attribution. Commenting only needs POSTING authority, so this
 * works for lite accounts too.
 */
export default function useHiveComment() {
  const { user, aioha } = useAioha();
  const { hiveIdentity: identity } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();

  const canComment = !!user || !!identity?.handle || !!userbaseUser;

  const comment = useCallback(
    async ({ parentAuthor, parentPermlink, body }: PostComment) => {
      const permlink = `re-${parentAuthor}-${parentPermlink}-${Date.now()}`;
      const jsonMetadata = {
        app: "Skatehive App 3.0",
        format: "markdown",
        tags: ["skatehive"],
      };

      if (user) {
        const result = await aioha.comment(
          parentAuthor,
          parentPermlink,
          permlink,
          "",
          body,
          jsonMetadata
        );
        if (result && typeof result === "object" && result.success === false) {
          throw new Error(result.error || "Failed to publish the comment");
        }
        return { success: true as const, permlink };
      }

      const response = await fetch("/api/userbase/hive/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_author: parentAuthor,
          parent_permlink: parentPermlink,
          permlink,
          title: "",
          body,
          json_metadata: jsonMetadata,
          type: "comment",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to publish the comment");
      }

      return { success: true as const, permlink };
    },
    [user, aioha]
  );

  return { comment, canComment };
}
