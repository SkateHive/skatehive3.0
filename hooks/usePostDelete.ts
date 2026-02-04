import { useCallback, useState } from "react";
import { useToast } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { Discussion, Operation } from "@hiveio/dhive";
import { useAccount } from "wagmi";
import { parseJsonMetadata } from "@/lib/hive/metadata-utils";
import { softDeletePostByApi } from "@/lib/utils/softDelete";

export const usePostDelete = (
  discussion: Discussion,
  onDeleted?: () => void
) => {
  const { aioha, user } = useAioha();
  const { address, isConnected } = useAccount();
  const toast = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const metadata = parseJsonMetadata(discussion.json_metadata);
  const litePostOwnerAddress = String(
    metadata?.creator_ethereum_address || ""
  ).toLowerCase();
  const isLitePost = metadata?.created_via === "ethereum_wallet" && !!litePostOwnerAddress;
  const isHiveOwner = !!user && user === discussion.author;
  const isLiteOwner =
    isLitePost &&
    !!address &&
    isConnected &&
    address.toLowerCase() === litePostOwnerAddress;
  const canDelete = isHiveOwner || isLiteOwner;

  const handleDelete = useCallback(async () => {
    if (!user) {
      toast({
        title: "Connect your Hive account",
        description: "You need to be logged in to delete a snap.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    if (user !== discussion.author) {
      toast({
        title: "Not allowed",
        description: "You can only delete your own snap.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    setIsDeleting(true);

    try {
      const operation: Operation = [
        "delete_comment",
        {
          author: discussion.author,
          permlink: discussion.permlink,
        },
      ];

      const result = await aioha.signAndBroadcastTx(
        [operation],
        KeyTypes.Posting
      );

      if (result && !result.error) {
        onDeleted?.();
      } else {
        const errorMessage =
          result?.error?.message || result?.message || "Failed to delete snap";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Error deleting post:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [aioha, discussion.author, discussion.permlink, onDeleted, toast, user]);

  const handleLiteSoftDelete = useCallback(async () => {
    if (!isLiteOwner || !address) {
      toast({
        title: "Not allowed",
        description: "You can only delete your own lite account post.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    setIsDeleting(true);
    try {
      await softDeletePostByApi(discussion.author, discussion.permlink, address);
      onDeleted?.();
    } catch (error: any) {
      console.error("Error soft deleting lite post:", error);
      toast({
        title: "Delete failed",
        description: error?.message || "Failed to delete post.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [address, discussion.author, discussion.permlink, isLiteOwner, onDeleted, toast]);

  const handleSoftDelete = useCallback(async () => {
    if (!user) {
      toast({
        title: "Connect your Hive account",
        description: "You need to be logged in to delete a snap.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    if (user !== discussion.author) {
      toast({
        title: "Not allowed",
        description: "You can only delete your own snap.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    setIsDeleting(true);

    try {
      const operation: Operation = [
        "comment",
        {
          parent_author: discussion.parent_author || "",
          parent_permlink: discussion.parent_permlink || "",
          author: user,
          permlink: discussion.permlink,
          title: discussion.title || "",
          body: "deleted",
          json_metadata: discussion.json_metadata || "{}",
        },
      ];

      const result = await aioha.signAndBroadcastTx(
        [operation],
        KeyTypes.Posting
      );

      if (result && !result.error) {
        onDeleted?.();
      } else {
        const errorMessage =
          result?.error?.message || result?.message || "Failed to delete snap";
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      console.error("Error soft deleting post:", error);
    } finally {
      setIsDeleting(false);
    }
  }, [aioha, discussion.author, discussion.permlink, discussion.parent_author, discussion.parent_permlink, discussion.title, discussion.json_metadata, onDeleted, toast, user]);

  return {
    canDelete,
    isHiveOwner,
    isLiteOwner,
    isDeleting,
    handleDelete,
    handleSoftDelete,
    handleLiteSoftDelete,
  };
};
