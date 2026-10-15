import { useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { usePostSigner } from "@/hooks/usePostSigner";
import { parseJsonMetadata } from "@/lib/hive/metadata-utils";

export type UpgradeAction = "follow" | "edit" | "delete" | "wallet" | "general";

export const usePostEdit = (
    discussion: Discussion,
    softPostUserId?: string | null
) => {
    const toast = useToast();

    // Keychain, the stored posting key, or (for lite accounts) the shared
    // account — usePostSigner works out which one owns this post.
    const { canManage: canEditThisPost, broadcastComment } = usePostSigner(
        discussion,
        softPostUserId
    );

    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(discussion.body);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradeAction, setUpgradeAction] = useState<UpgradeAction>("edit");

    const handleEditClick = useCallback(() => {
        // No Hive identity at all — prompt to link/upgrade.
        if (!canEditThisPost) {
            setUpgradeAction("edit");
            setShowUpgradeModal(true);
            return;
        }

        setEditedContent(discussion.body);
        
        // Try to get current thumbnail from metadata
        try {
            const metadata = parseJsonMetadata(discussion.json_metadata) || {};
            if (metadata.image && metadata.image.length > 0) {
                setSelectedThumbnail(metadata.image[0]);
            } else {
                setSelectedThumbnail(null);
            }
        } catch (e) {
            setSelectedThumbnail(null);
        }
        
        setIsEditing(true);
    }, [discussion.body, discussion.json_metadata, canEditThisPost]);

    const closeUpgradeModal = useCallback(() => {
        setShowUpgradeModal(false);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditedContent(discussion.body);
        setSelectedThumbnail(null);
        setIsEditing(false);
    }, [discussion.body]);

    const handleSaveEdit = useCallback(async () => {
        if (!canEditThisPost) {
            toast({
                title: "Not allowed",
                description: "You can only edit your own posts.",
                status: "error",
                duration: 4000,
                isClosable: true,
            });
            return;
        }
        if (editedContent === discussion.body && !selectedThumbnail) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);

        try {
            // Check if no changes were made
            const contentChanged = editedContent.trim() !== discussion.body.trim();
            const thumbnailChanged = selectedThumbnail !== null;

            if (!contentChanged && !thumbnailChanged) {
                toast({
                    title: "No changes detected",
                    description: "Please make some changes before saving.",
                    status: "warning",
                    duration: 3000,
                    isClosable: true,
                });
                setIsSaving(false);
                return;
            }

            // Some feeds hand us metadata already parsed; JSON.parse on that
            // threw and the save went out with {}, wiping tags and images.
            const parsedMetadata: any = parseJsonMetadata(discussion.json_metadata) || {};

            // Update thumbnail if selected
            if (selectedThumbnail) {
                if (!parsedMetadata.image) {
                    parsedMetadata.image = [];
                }
                if (Array.isArray(parsedMetadata.image)) {
                    parsedMetadata.image = parsedMetadata.image.filter((img: string) => img !== selectedThumbnail);
                    parsedMetadata.image.unshift(selectedThumbnail);
                } else {
                    parsedMetadata.image = [selectedThumbnail];
                }
            }

            await broadcastComment({
                parent_author: discussion.parent_author || "",
                parent_permlink: discussion.parent_permlink || discussion.category || "",
                author: discussion.author,
                permlink: discussion.permlink,
                title: discussion.title || "",
                body: editedContent,
                json_metadata: JSON.stringify(parsedMetadata),
            });

            toast({
                title: "Post updated on blockchain!",
                description: "Changes may take a few seconds to appear after refresh.",
                status: "success",
                duration: 5000,
                isClosable: true,
            });

            // Update the local discussion body and metadata
            discussion.body = editedContent;
            discussion.json_metadata = JSON.stringify(parsedMetadata);
            setIsEditing(false);
        } catch (error: any) {
            console.error("Error updating post:", error);
            toast({
                title: "Failed to update post",
                description: error.message || "An unknown error occurred",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setIsSaving(false);
        }
    }, [canEditThisPost, broadcastComment, editedContent, discussion, toast, selectedThumbnail]);

    return {
        isEditing,
        editedContent,
        isSaving,
        selectedThumbnail,
        setEditedContent,
        setSelectedThumbnail,
        handleEditClick,
        handleCancelEdit,
        handleSaveEdit,
        // Upgrade modal state for lite users
        showUpgradeModal,
        upgradeAction,
        closeUpgradeModal,
        // True when the viewer owns this post (directly or as the lite
        // author behind a shared-account post). Gates the "Edit" item.
        canEditThisPost,
    };
};

