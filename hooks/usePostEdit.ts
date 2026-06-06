import { useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { Discussion, Operation } from "@hiveio/dhive";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

export type UpgradeAction = "follow" | "edit" | "delete" | "wallet" | "general";

export const usePostEdit = (discussion: Discussion) => {
    const { aioha, user } = useAioha();
    const { hiveIdentity: userbaseHiveIdentity } = useLinkedIdentities();
    const toast = useToast();

    // The author we'll attempt the edit as. Prefer the active Keychain
    // user, fall back to the userbase-linked Hive handle (which posts via
    // the stored encrypted posting key at /api/userbase/hive/comment).
    const linkedHiveHandle = userbaseHiveIdentity?.handle || null;
    const effectiveAuthor = user || linkedHiveHandle;
    // You can only edit your own post — author must match.
    const canEditThisPost =
        !!effectiveAuthor && effectiveAuthor === discussion.author;

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
            const metadata = JSON.parse(discussion.json_metadata || '{}');
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

    const handleDeleteClick = useCallback(() => {
        // Delete still requires Keychain (active-key-equivalent op). The
        // userbase API doesn't currently expose a delete endpoint, so we
        // keep the previous gate here intentionally.
        if (!user) {
            setUpgradeAction("delete");
            setShowUpgradeModal(true);
            return;
        }
        return true;
    }, [user]);

    const closeUpgradeModal = useCallback(() => {
        setShowUpgradeModal(false);
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditedContent(discussion.body);
        setSelectedThumbnail(null);
        setIsEditing(false);
    }, [discussion.body]);

    const handleSaveEdit = useCallback(async () => {
        if (!canEditThisPost || (editedContent === discussion.body && !selectedThumbnail)) {
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

            // Parse existing metadata
            let parsedMetadata: any = {};
            try {
                parsedMetadata = JSON.parse(discussion.json_metadata || '{}');
            } catch (e) {
                console.warn('Failed to parse existing metadata, using empty object');
            }

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

            const author = effectiveAuthor!;
            const commentPayload = {
                parent_author: discussion.parent_author || "",
                parent_permlink: discussion.parent_permlink || discussion.category || "",
                author,
                permlink: discussion.permlink,
                title: discussion.title || "",
                body: editedContent,
                json_metadata: JSON.stringify(parsedMetadata),
            };

            let success = false;
            let errorMessage = "Failed to update post";

            if (user) {
                // Keychain path — broadcast via aioha.
                const operation: Operation = ["comment", commentPayload];
                const result = await aioha.signAndBroadcastTx(
                    [operation],
                    KeyTypes.Posting
                );
                if (result && result.success) {
                    success = true;
                } else {
                    errorMessage =
                        result?.error?.message || result?.message || errorMessage;
                }
            } else {
                // Userbase path — server decrypts the stored posting key and
                // broadcasts the same comment op. Re-publishing a comment with
                // an existing author+permlink is a Hive-native edit.
                const response = await fetch("/api/userbase/hive/comment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...commentPayload,
                        // `type` is used by the route for soft-post telemetry —
                        // we send "edit" so it can skip soft-post insertion.
                        type: "edit",
                    }),
                });
                const data = await response.json().catch(() => ({}));
                if (response.ok) {
                    success = true;
                } else {
                    errorMessage = data?.error || errorMessage;
                }
            }

            if (success) {
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
            } else {
                throw new Error(errorMessage);
            }
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
    }, [canEditThisPost, effectiveAuthor, user, editedContent, discussion, aioha, toast, selectedThumbnail]);

    return {
        isEditing,
        editedContent,
        isSaving,
        selectedThumbnail,
        setEditedContent,
        setSelectedThumbnail,
        handleEditClick,
        handleDeleteClick,
        handleCancelEdit,
        handleSaveEdit,
        // Upgrade modal state for lite users
        showUpgradeModal,
        upgradeAction,
        closeUpgradeModal,
        // True if the user can post via Hive at all (Keychain OR stored
        // posting key). Callers use this to show/hide the edit affordance.
        isHiveConnected: !!effectiveAuthor,
        // True when the active identity matches the post's author. Use
        // this for the actual "Edit" menu item — owning a post is per-post,
        // while isHiveConnected is per-user.
        canEditThisPost,
    };
};

