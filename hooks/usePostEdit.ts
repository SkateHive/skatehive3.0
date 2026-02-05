import { useState, useCallback } from "react";
import { useToast } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { Discussion, Operation } from "@hiveio/dhive";
import { editPostWithKeychain } from "@/lib/hive/client-functions";

export const usePostEdit = (discussion: Discussion) => {
    const { aioha, user } = useAioha();
    const toast = useToast();

    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(discussion.body);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);

    const handleEditClick = useCallback(() => {
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
    }, [discussion.body, discussion.json_metadata]);

    const handleCancelEdit = useCallback(() => {
        setEditedContent(discussion.body);
        setSelectedThumbnail(null);
        setIsEditing(false);
    }, [discussion.body]);

    const handleSaveEdit = useCallback(async () => {
        if (!user || (editedContent === discussion.body && !selectedThumbnail)) {
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
                // Ensure the selected thumbnail is the first in the array
                if (Array.isArray(parsedMetadata.image)) {
                    // Remove the thumbnail if it already exists in the array
                    parsedMetadata.image = parsedMetadata.image.filter((img: string) => img !== selectedThumbnail);
                    // Add it to the beginning
                    parsedMetadata.image.unshift(selectedThumbnail);
                } else {
                    parsedMetadata.image = [selectedThumbnail];
                }
            }

            const operation: Operation = [
                "comment",
                {
                    parent_author: discussion.parent_author || "",
                    parent_permlink: discussion.parent_permlink || "",
                    author: user,
                    permlink: discussion.permlink,
                    title: discussion.title || "",
                    body: editedContent,
                    json_metadata: JSON.stringify(parsedMetadata),
                },
            ];


            // If Hive Keychain is available in the browser, use it for the edit
            const isKeychainAvailable = typeof window !== 'undefined' && ((window as any).hive_keychain || (window as any).hiveKeychain || (window as any).keychain);

            let result: any;
            if (isKeychainAvailable) {
                // Use Keychain SDK to edit post
                try {
                    const jsonMeta = JSON.parse(operation[1].json_metadata || '{}');
                    result = await editPostWithKeychain(user as string, discussion.author, discussion.permlink, discussion.title || undefined, editedContent, jsonMeta);
                } catch (e) {
                    throw e;
                }
            } else {
                // Use aioha to broadcast the edit
                result = await aioha.signAndBroadcastTx([operation], KeyTypes.Posting);
            }


            if (result && !result.error) {
                toast({
                    title: "Post updated successfully!",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });

                // Update the local discussion body and metadata
                discussion.body = editedContent;
                if (selectedThumbnail) {
                    try {
                        const updatedMetadata = JSON.parse(discussion.json_metadata || '{}');
                        if (!updatedMetadata.image) {
                            updatedMetadata.image = [];
                        }
                        if (Array.isArray(updatedMetadata.image)) {
                            updatedMetadata.image = updatedMetadata.image.filter((img: string) => img !== selectedThumbnail);
                            updatedMetadata.image.unshift(selectedThumbnail);
                        } else {
                            updatedMetadata.image = [selectedThumbnail];
                        }
                        discussion.json_metadata = JSON.stringify(updatedMetadata);
                    } catch (e) {
                        console.warn('Failed to update local metadata');
                    }
                }
                setIsEditing(false);
            } else {
                const errorMessage = result?.error?.message || result?.message || "Failed to update post";
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
    }, [user, editedContent, discussion, aioha, toast, selectedThumbnail]);

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
    };
};
