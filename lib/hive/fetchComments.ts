import HiveClient from "@/lib/hive/hiveclient";
import { Discussion } from "@hiveio/dhive";
import { filterSoftDeletedPosts } from "@/lib/utils/softDelete";

export async function fetchComments(
    author: string,
    permlink: string,
    recursive: boolean = false
): Promise<Discussion[]> {
    try {
        const comments = (await HiveClient.database.call("get_content_replies", [
            author,
            permlink,
        ])) as Discussion[];
        const visibleComments = await filterSoftDeletedPosts(comments);

        if (recursive) {
            const fetchReplies = async (discussion: Discussion): Promise<Discussion> => {
                if (discussion.children && discussion.children > 0) {
                    discussion.replies = await fetchComments(discussion.author, discussion.permlink, true) as any;
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
