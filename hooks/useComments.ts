'use client'
import HiveClient from "@/lib/hive/hiveclient"
import { useCallback, useEffect, useState } from "react"
import { Discussion } from "@hiveio/dhive"
import { filterAutoComments } from '@/lib/utils/postUtils'
import { filterSoftDeletedPosts } from '@/lib/utils/softDelete'


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
        const visibleComments = await filterSoftDeletedPosts(filteredComments);

        if (recursive) {
            const fetchReplies = async (discussion: Discussion): Promise<Discussion> => {
                if (discussion.children && discussion.children > 0) {
                    const replies = await fetchComments(discussion.author, discussion.permlink, true);
                    // Apply filtering to nested replies as well
                    discussion.replies = filterAutoComments(replies) as any;
                }
                return discussion;
            };
            const commentsWithReplies = await Promise.all(visibleComments.map(fetchReplies));
            return commentsWithReplies;
        } else {
            return visibleComments;
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
        try {
            const fetchedComments = await fetchComments(author, permlink, recursive);
            setComments(fetchedComments);
            setIsLoading(false);
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
