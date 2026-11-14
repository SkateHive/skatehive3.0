"use client";

import { useCallback } from "react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { Discussion, Operation } from "@hiveio/dhive";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { usePostingKeyDialog } from "@/contexts/PostingKeyDialogContext";

export interface PostUpdatePayload {
  title: string;
  body: string;
  json_metadata: string;
}

// The author dismissed the Keychain prompt. Callers stop quietly instead of
// retrying another way (which would just pop Keychain again).
export class KeychainCancelledError extends Error {
  constructor() {
    super("Cancelled in Keychain.");
  }
}

// aioha maps Keychain's "user_cancel" to 4001.
const KEYCHAIN_USER_CANCEL = 4001;

/**
 * Republishes an existing post (same author + permlink), which is how Hive
 * edits. Mirrors useHiveComment: Keychain/Aioha users sign locally, everyone
 * else goes through the userbase route with their stored posting key.
 */
export default function useHivePostUpdate(discussion: Discussion) {
  const { user, aioha } = useAioha();
  const { hiveIdentity: identity } = useLinkedIdentities();
  const { openPostingKeyDialog } = usePostingKeyDialog();

  const effectiveAuthor = user || identity?.handle || null;
  const canUpdate = !!effectiveAuthor && effectiveAuthor === discussion.author;

  const updatePost = useCallback(
    async ({ title, body, json_metadata }: PostUpdatePayload) => {
      const commentPayload = {
        parent_author: discussion.parent_author || "",
        parent_permlink: discussion.parent_permlink || discussion.category || "",
        author: discussion.author,
        permlink: discussion.permlink,
        title,
        body,
        json_metadata,
      };

      if (user) {
        const operation: Operation = ["comment", commentPayload];
        const result = await aioha.signAndBroadcastTx(
          [operation],
          KeyTypes.Posting
        );
        if (result?.errorCode === KEYCHAIN_USER_CANCEL) {
          throw new KeychainCancelledError();
        }
        if (!result?.success) {
          throw new Error(result?.error || "Failed to update post");
        }
        return;
      }

      // Without a stored key the route signs with the shared account and
      // ignores `author`, so the "edit" would land as a new @skateuser post.
      const keyResponse = await fetch("/api/userbase/keys/posting", {
        cache: "no-store",
      });
      const keyData = await keyResponse.json().catch(() => null);
      if (!keyResponse.ok) {
        throw new Error(keyData?.error || "Couldn't check your posting key");
      }
      if (!keyData?.stored) {
        openPostingKeyDialog({ hiveHandle: identity?.handle ?? null });
        throw new Error("Save your posting key to change this post without Keychain.");
      }

      const response = await fetch("/api/userbase/hive/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `type: "edit"` keeps the route from recording a new soft post.
        body: JSON.stringify({ ...commentPayload, type: "edit" }),
      });
      const data = await response.json().catch(() => ({}));
      // api.skatehive.app reports some failures as { success: false } with
      // a 2xx, so the status alone isn't enough.
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || "Failed to update post");
      }
    },
    [user, aioha, discussion, identity?.handle, openPostingKeyDialog]
  );

  return { updatePost, canUpdate, isWalletConnected: !!user };
}
