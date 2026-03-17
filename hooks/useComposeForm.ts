import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { generatePermlink, prepareImageArray, insertAtCursor } from "@/lib/markdown/composeUtils";
import { Beneficiary } from "@/components/compose/BeneficiariesInput";
import { validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";
import { HIVE_CONFIG } from "@/config/app.config";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

export const useComposeForm = () => {
    const [markdown, setMarkdown] = useState("");
    const [title, setTitle] = useState("");
    const [hashtagInput, setHashtagInput] = useState("");
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<"edit" | "preview" | "live">("live");
    const [showThumbnailPicker, setShowThumbnailPicker] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { aioha, user } = useAioha();
    const { hiveIdentity: userbaseHiveIdentity } = useLinkedIdentities();
    const { user: userbaseUser } = useUserbaseAuth();
    const toast = useToast();
    const router = useRouter();
    const communityTag = HIVE_CONFIG.COMMUNITY_TAG;

    const placeholders = [
        "Don't forget a title...",
        "Where is your mind?",
        "Write a title here...",
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((current) => (current + 1) % placeholders.length);
        }, 3000); // Change every 3 seconds

        return () => clearInterval(interval);
    }, [placeholders.length]);

    const insertAtCursorWrapper = (content: string) => {
        insertAtCursor(content, markdown, setMarkdown);
    };

    const effectiveUser =
      user || userbaseHiveIdentity?.handle || userbaseUser?.handle || null;

    const handleSubmit = async () => {
        const canSubmit = !!user || !!userbaseHiveIdentity?.handle || !!userbaseUser;

        if (!canSubmit) {
            toast({
                title: "You must be logged in to submit a post.",
                status: "error",
                duration: 4000,
                isClosable: true,
            });
            return;
        }

        if (!title.trim()) {
            toast({
                title: "Please enter a title for your post.",
                status: "error",
                duration: 4000,
                isClosable: true,
            });
            return;
        }

        if (!selectedThumbnail) {
            toast({
                title: "Please select a thumbnail for your post.",
                status: "error",
                duration: 4000,
                isClosable: true,
            });
            return;
        }

        setIsSubmitting(true);

        const imageArray = prepareImageArray(markdown, selectedThumbnail);
        const permlink = generatePermlink(title);

        try {
            if (user) {
                // Show toast indicating we're waiting for keychain confirmation
                toast({
                    title: "Please confirm the transaction in Keychain...",
                    status: "info",
                    duration: 3000,
                    isClosable: true,
                });
            }

            // First, submit the comment
            let result: any = null;

            if (user) {
                result = await aioha.comment(
                    null,
                    communityTag,
                    permlink,
                    title,
                    markdown,
                    {
                        tags: hashtags,
                        app: "Skatehive App 3.0",
                        image: imageArray,
                    }
                );
            } else {
                const response = await fetch("/api/userbase/hive/comment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        parent_author: "",
                        parent_permlink: communityTag,
                        permlink,
                        title,
                        body: markdown,
                        json_metadata: {
                            tags: hashtags,
                            app: "Skatehive App 3.0",
                            image: imageArray,
                        },
                        beneficiaries,
                        type: "post",
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || "Failed to submit post.");
                }
                result = { success: true, author: data?.author, permlink: data?.permlink };
            }

            if (result && result.success) {

                // If beneficiaries are set, submit comment_options operation (keychain only)
                if (beneficiaries.length > 0 && user) {

                    // Validate beneficiaries before submitting
                    const totalWeight = beneficiaries.reduce((sum, b) => sum + b.weight, 0);

                    if (totalWeight > 10000) {
                        throw new Error("Total beneficiary percentage cannot exceed 100%");
                    }

                    // Filter out invalid beneficiaries using centralized validation
                    const validBeneficiaries = beneficiaries.filter(b => {
                        if (!b.account.trim() || b.weight <= 0) {
                            return false;
                        }
                        const validation = validateHiveUsernameFormat(b.account);
                        return validation.isValid;
                    });

                    if (validBeneficiaries.length > 0) {
                        // Submit comment_options operation for beneficiaries
                        const commentOptionsOp = [
                            "comment_options",
                            {
                                author: user,
                                permlink: permlink,
                                max_accepted_payout: "1000000.000 HBD",
                                percent_hbd: 10000,
                                allow_votes: true,
                                allow_curation_rewards: true,
                                extensions: [
                                    [0, {
                                        beneficiaries: validBeneficiaries.map(b => ({
                                            account: b.account,
                                            weight: b.weight
                                        }))
                                    }]
                                ]
                            }
                        ];

                        const optionsResult = await aioha.signAndBroadcastTx([commentOptionsOp], KeyTypes.Posting);
                        
                        if (!optionsResult || !optionsResult.success) {
                            console.warn("⚠️ useComposeForm: Failed to set beneficiaries, but post was created successfully", { optionsResult });
                            toast({
                                title: "Post created, but beneficiaries failed to set",
                                description: "Your post was published but beneficiaries could not be applied.",
                                status: "warning",
                                duration: 5000,
                                isClosable: true,
                            });
                        } else {
                        }
                    } else {
                    }
                } else {
                }
                
                toast({
                    title: "Post submitted successfully!",
                    description: "Redirecting to home page...",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
                setMarkdown("");
                setTitle("");
                setHashtags([]);
                setHashtagInput("");
                setBeneficiaries([]);
                setSelectedThumbnail(null);

                // Wait a moment for the user to see the success message, then redirect
                setTimeout(() => {
                    router.push("/");
                }, 1500);
            } else {
                toast({
                    title: "Failed to submit post.",
                    description: result?.error || "Unknown error.",
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            }
        } catch (error: any) {
            console.error("💥 useComposeForm: Error during submission", {
                error,
                errorMessage: error?.message,
                errorType: typeof error,
                beneficiaries,
                beneficiariesCount: beneficiaries.length
            });

            // Check if the error is due to user cancellation
            if (error?.message?.includes("canceled") || error?.message?.includes("rejected")) {
                toast({
                    title: "Transaction cancelled.",
                    description: "Post submission was cancelled by user.",
                    status: "warning",
                    duration: 4000,
                    isClosable: true,
                });
            } else {
                toast({
                    title: "Failed to submit post.",
                    description: error?.message || String(error),
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        markdown,
        setMarkdown,
        title,
        setTitle,
        hashtagInput,
        setHashtagInput,
        hashtags,
        setHashtags,
        beneficiaries,
        setBeneficiaries,
        placeholderIndex,
        selectedThumbnail,
        setSelectedThumbnail,
        previewMode,
        setPreviewMode,
        showThumbnailPicker,
        setShowThumbnailPicker,
        placeholders,
        user: effectiveUser,
        insertAtCursorWrapper,
        handleSubmit,
        isSubmitting,
    };
};
