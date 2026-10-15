import { useCallback } from "react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { Discussion, Operation } from "@hiveio/dhive";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { usePostingKeyDialog } from "@/contexts/PostingKeyDialogContext";

// How the current viewer can sign changes to a given post:
// - "keychain": the active Keychain/aioha account is the author.
// - "stored-key": the userbase-linked Hive handle is the author; the server
//   signs with the encrypted posting key stored for that user.
// - "lite": the post went out through the shared account and the soft-post
//   overlay says it belongs to the current userbase user; the server signs
//   with the shared key.
export type PostSignerMode = "keychain" | "stored-key" | "lite";

export interface CommentPayload {
  parent_author: string;
  parent_permlink: string;
  author: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: string;
}

export class PostSignerError extends Error {}

// The author dismissed the Keychain prompt. Callers should stop quietly
// instead of retrying another way (which would just pop Keychain again).
export class PostSignerCancelled extends Error {
  constructor() {
    super("Cancelled in Keychain.");
  }
}

// aioha maps Keychain's "user_cancel" to 4001.
const KEYCHAIN_USER_CANCEL = 4001;

// aioha's OperationError carries `error` as a string; keep the real reason
// (e.g. "missing required posting authority") instead of a generic one.
const aiohaErrorMessage = (result: any, fallback: string): string =>
  (typeof result?.error === "string" && result.error) ||
  result?.error?.message ||
  result?.message ||
  fallback;

export const usePostSigner = (
  discussion: Discussion,
  softPostUserId?: string | null
) => {
  const { aioha, user } = useAioha();
  const { hiveIdentity } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();
  const { openPostingKeyDialog } = usePostingKeyDialog();

  const linkedHiveHandle = hiveIdentity?.handle || null;

  let mode: PostSignerMode | null = null;
  if (user && user === discussion.author) {
    mode = "keychain";
  } else if (!user && linkedHiveHandle === discussion.author) {
    mode = "stored-key";
  } else if (
    softPostUserId &&
    userbaseUser?.id &&
    softPostUserId === userbaseUser.id
  ) {
    mode = "lite";
  }

  // The userbase comment route signs with whatever key the server resolves
  // for the session: the stored key if there is one, the shared account
  // otherwise. It ignores the `author` we send, so we have to make sure the
  // key it will pick is the one that owns this post, or the "edit" lands as
  // a brand new post on the wrong account.
  const assertServerSignerMatches = useCallback(async () => {
    let response: Response;
    try {
      response = await fetch("/api/userbase/keys/posting", {
        cache: "no-store",
      });
    } catch {
      throw new PostSignerError(
        "Couldn't reach Skatehive. Check your connection and try again."
      );
    }
    if (response.status === 401) {
      throw new PostSignerError("Your session expired. Log in again and retry.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data.stored !== "boolean") {
      throw new PostSignerError(
        "Couldn't check which key signs your posts. Try again in a moment."
      );
    }
    const stored = data.stored;

    if (mode === "stored-key" && !stored) {
      openPostingKeyDialog({ hiveHandle: linkedHiveHandle });
      throw new PostSignerError(
        "Save your posting key to change this post without Keychain."
      );
    }
    if (mode === "lite" && stored) {
      throw new PostSignerError(
        "This post was published before your Hive account was set up, so it can't be changed from here."
      );
    }
  }, [mode, linkedHiveHandle, openPostingKeyDialog]);

  const broadcastComment = useCallback(
    async (payload: CommentPayload) => {
      if (!mode) throw new PostSignerError("You can only change your own posts.");

      if (mode === "keychain") {
        const operation: Operation = ["comment", payload];
        const result = await aioha.signAndBroadcastTx(
          [operation],
          KeyTypes.Posting
        );
        if (result?.errorCode === KEYCHAIN_USER_CANCEL) {
          throw new PostSignerCancelled();
        }
        if (!result?.success) {
          throw new Error(aiohaErrorMessage(result, "Broadcast failed"));
        }
        return;
      }

      await assertServerSignerMatches();
      const response = await fetch("/api/userbase/hive/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `type: "edit"` keeps the route from treating this as a new soft post.
        body: JSON.stringify({ ...payload, type: "edit" }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new PostSignerError("Your session expired. Log in again and retry.");
      }
      // api.skatehive.app reports some failures as { success: false } with
      // a 2xx, so the status alone isn't enough.
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || `Broadcast failed (${response.status})`);
      }
    },
    [mode, aioha, assertServerSignerMatches]
  );

  // delete_comment is only reachable through Keychain for now; the userbase
  // API has no delete route, so the other modes fall back to a soft delete.
  const deleteComment = useCallback(async () => {
    if (mode !== "keychain") {
      throw new PostSignerError("On-chain delete needs Keychain.");
    }
    const operation: Operation = [
      "delete_comment",
      { author: discussion.author, permlink: discussion.permlink },
    ];
    const result = await aioha.signAndBroadcastTx(
      [operation],
      KeyTypes.Posting
    );
    if (result?.errorCode === KEYCHAIN_USER_CANCEL) {
      throw new PostSignerCancelled();
    }
    if (!result?.success) {
      throw new Error(aiohaErrorMessage(result, "Delete failed"));
    }
  }, [mode, aioha, discussion.author, discussion.permlink]);

  return {
    mode,
    canManage: mode !== null,
    broadcastComment,
    deleteComment,
  };
};
