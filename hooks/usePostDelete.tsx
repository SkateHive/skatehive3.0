import { useCallback, useState } from "react";
import { Button, HStack, Text, useToast } from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { usePostSigner, PostSignerCancelled } from "@/hooks/usePostSigner";
import { canDeleteOnChain } from "@/lib/hive/postDeletion";
import { parseJsonMetadata } from "@/lib/hive/metadata-utils";

const UNDO_WINDOW_MS = 10000;

interface UsePostDeleteOptions {
  // Soft-post owner (lite accounts), from the overlay.
  softPostUserId?: string | null;
  // Fires as soon as the delete lands — hide the post here.
  onDeleted?: () => void;
  // Fires when the author hits "Undo" and the post is back.
  onRestored?: () => void;
  // Fires once the undo window closes without an undo — anything that
  // can't be reversed (dropping the post from a parent list) goes here.
  onDeleteSettled?: () => void;
}

export const usePostDelete = (
  discussion: Discussion,
  {
    softPostUserId,
    onDeleted,
    onRestored,
    onDeleteSettled,
  }: UsePostDeleteOptions = {}
) => {
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const { mode, canManage, broadcastComment, deleteComment } = usePostSigner(
    discussion,
    softPostUserId
  );

  // Deleting is a Hive-account feature. Lite accounts (email, wallet,
  // Farcaster without a Hive identity) still see the action on their own
  // posts, but get the upgrade prompt instead — a nudge to get a Hive account.
  const requiresHiveAccount = mode === "lite";

  const requestDelete = useCallback(() => {
    if (requiresHiveAccount) {
      setIsUpgradeOpen(true);
    } else {
      setIsConfirmOpen(true);
    }
  }, [requiresHiveAccount]);

  const closeConfirm = useCallback(() => setIsConfirmOpen(false), []);
  const closeUpgrade = useCallback(() => setIsUpgradeOpen(false), []);

  const publishBody = useCallback(
    (body: string, title: string, jsonMetadata: string) =>
      broadcastComment({
        parent_author: discussion.parent_author || "",
        parent_permlink:
          discussion.parent_permlink || discussion.category || "",
        author: discussion.author,
        permlink: discussion.permlink,
        title,
        body,
        json_metadata: jsonMetadata,
      }),
    [broadcastComment, discussion]
  );

  const deletePost = useCallback(async () => {
    if (requiresHiveAccount) {
      setIsConfirmOpen(false);
      setIsUpgradeOpen(true);
      return;
    }
    if (!canManage) {
      toast({
        title: "Not allowed",
        description: "You can only delete your own posts.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    // Kept only for the undo window below; nothing is persisted.
    const original = {
      title: discussion.title || "",
      body: discussion.body,
      // Some feeds hand us metadata already parsed; the op needs a string.
      jsonMetadata: JSON.stringify(parseJsonMetadata(discussion.json_metadata) ?? {}),
    };

    setIsDeleting(true);
    try {
      let deletedOnChain = false;
      if (mode === "keychain" && canDeleteOnChain(discussion)) {
        try {
          await deleteComment();
          deletedOnChain = true;
        } catch (error) {
          if (error instanceof PostSignerCancelled) throw error;
          // The feed data can be stale (a vote or reply landed since it was
          // fetched), so a refused delete still falls through to the soft one.
          console.warn("delete_comment refused, soft deleting instead:", error);
        }
      }
      if (!deletedOnChain) {
        await publishBody("deleted", original.title, original.jsonMetadata);
      }

      setIsConfirmOpen(false);
      onDeleted?.();

      let undone = false;
      const undo = async (closeToast: () => void) => {
        undone = true;
        closeToast();
        try {
          // Same author + permlink: an edit back for a soft delete, a fresh
          // publish for an on-chain delete (Hive frees the permlink).
          await publishBody(original.body, original.title, original.jsonMetadata);
          onRestored?.();
          toast({
            title: "Post restored",
            status: "success",
            duration: 4000,
            isClosable: true,
          });
        } catch (error: any) {
          onDeleteSettled?.();
          if (error instanceof PostSignerCancelled) {
            toast({
              title: "Restore cancelled",
              description: "The post stays deleted.",
              status: "info",
              duration: 4000,
              isClosable: true,
            });
            return;
          }
          console.error("Error restoring post:", error);
          toast({
            title: "Couldn't restore the post",
            description: `${(error?.message || "Unknown error").replace(/\.$/, "")}. Open the post link and paste the text back with Edit, or ask the team for help.`,
            status: "error",
            duration: 8000,
            isClosable: true,
          });
        }
      };

      const toastId = toast({
        status: "success",
        duration: UNDO_WINDOW_MS,
        isClosable: true,
        title: "Post deleted",
        description: (
          <HStack justify="space-between" align="center" spacing={3}>
            <Text fontSize="sm">
              {deletedOnChain
                ? "Removed from the Hive blockchain."
                : "Hive keeps posts with votes or replies, so it was cleared and hidden from Skatehive."}
            </Text>
            <Button
              size="xs"
              variant="outline"
              flexShrink={0}
              onClick={() => undo(() => toast.close(toastId))}
            >
              Undo
            </Button>
          </HStack>
        ),
        onCloseComplete: () => {
          if (!undone) onDeleteSettled?.();
        },
      });
    } catch (error: any) {
      if (error instanceof PostSignerCancelled) {
        toast({
          title: "Delete cancelled",
          status: "info",
          duration: 3000,
          isClosable: true,
        });
        return;
      }
      console.error("Error deleting post:", error);
      toast({
        title: "Failed to delete post",
        description: error?.message || "An unknown error occurred",
        status: "error",
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [requiresHiveAccount, canManage, mode, discussion, deleteComment, publishBody, onDeleted, onRestored, onDeleteSettled, toast]);

  return {
    isDeleting,
    // Owners see the action; lite owners get the upgrade prompt on click.
    canDeleteThisPost: canManage,
    requestDelete,
    deletePost,
    isConfirmOpen,
    closeConfirm,
    isUpgradeOpen,
    closeUpgrade,
  };
};

export type PostDeleteState = ReturnType<typeof usePostDelete>;
