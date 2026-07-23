'use client'
import HiveClient from "@/lib/hive/hiveclient"
import { useCallback, useEffect, useState } from "react"
import { Discussion } from "@hiveio/dhive"
import { filterAutoComments } from '@/lib/utils/postUtils'


export interface ListCommentsParams {
    start: []
    limit: number
    order: string
}

async function fetchComments(
    author: string,
    permlink: string,
    recursive: boolean = false
): Promise<Discussion[]> {
    try {

        const comments = (await HiveClient.database.call("get_content_replies", [
            author,
            permlink,
        ])) as Discussion[];

        // Apply quality filtering to all comments
        const filteredComments = filterAutoComments(comments);

        if (recursive) {
            const fetchReplies = async (discussion: Discussion): Promise<Discussion> => {
                if (discussion.children && discussion.children > 0) {
                    const replies = await fetchComments(discussion.author, discussion.permlink, true);
                    // Apply filtering to nested replies as well
                    discussion.replies = filterAutoComments(replies) as any;
                }
                return discussion;
            };
            const commentsWithReplies = await Promise.all(filteredComments.map(fetchReplies));
            return commentsWithReplies;
        } else {
            return filteredComments;
        }
    } catch (error) {
        console.error("Failed to fetch comments:", error);
        return [];
    }
}

export function useComments(
    author: string,
    permlink: string,
    recursive: boolean = false
) {
    const [comments, setComments] = useState<Discussion[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAndUpdateComments = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch the top level first and render it immediately — when
            // recursive, nested replies are filled in per top-level comment
            // below without blocking this initial render.
            const topLevel = await fetchComments(author, permlink, false);
            setComments(topLevel);
            setIsLoading(false);

            if (recursive) {
                await Promise.all(
                    topLevel.map(async (comment) => {
                        if (!comment.children || comment.children <= 0) return;
                        const replies = await fetchComments(comment.author, comment.permlink, true);
                        const filteredReplies = filterAutoComments(replies);
                        setComments((prev) =>
                            prev.map((c) =>
                                c.author === comment.author && c.permlink === comment.permlink
                                    ? { ...c, replies: filteredReplies as any }
                                    : c
                            )
                        );
                    })
                );
            }
        } catch (err: any) {
            setError(err.message ? err.message : "Error loading comments");
            console.error(err);
            setIsLoading(false);
        }
    }, [author, permlink, recursive]);

    useEffect(() => {
        fetchAndUpdateComments();
    }, [fetchAndUpdateComments]);

    const addComment = useCallback((newComment: Discussion) => {
        setComments((existingComments) => [...existingComments, newComment]);
    }, []);

    const updateComments = useCallback(async () => {
        await fetchAndUpdateComments();
    }, [fetchAndUpdateComments]);

    return {
        comments,
        error,
        isLoading,
        addComment,
        updateComments,
    };
}
