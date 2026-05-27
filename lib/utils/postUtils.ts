/**
 * Helper function to convert Asset or string to string
 */
export function assetToString(val: string | { toString: () => string }): string {
    return typeof val === "string" ? val : val.toString();
}

/**
 * Helper function to parse payout strings like "1.234 HBD"
 */
export function parsePayout(
    val: string | { toString: () => string } | undefined
): number {
    if (!val) return 0;
    const str = assetToString(val);
    return parseFloat(str.replace(" HBD", "").replace(",", ""));
}

/**
 * Calculate days remaining for pending payout
 */
export function calculatePayoutDays(createdDate: string): {
    daysRemaining: number;
    isPending: boolean;
} {
    const created = new Date(createdDate);
    const now = new Date();
    const timeDifferenceInMs = now.getTime() - created.getTime();
    const timeDifferenceInDays = timeDifferenceInMs / (1000 * 60 * 60 * 24);
    const daysRemaining = Math.max(0, 7 - Math.floor(timeDifferenceInDays));
    const isPending = timeDifferenceInDays < 7;

    return { daysRemaining, isPending };
}

/**
 * Deduplicate votes by voter (keep the last occurrence)
 */
export function deduplicateVotes(votes: any[]): any[] {
    const uniqueVotesMap = new Map();
    votes.forEach((vote) => {
        uniqueVotesMap.set(vote.voter, vote);
    });
    return Array.from(uniqueVotesMap.values());
}

/**
 * Count downvotes (negative votes) from active_votes array
 */
export function countDownvotes(activeVotes: any[]): number {
    if (!activeVotes || !Array.isArray(activeVotes)) return 0;
    const downvotes = activeVotes.filter(vote => {
        // Check for negative weight, percent, or rshares indicating a downvote
        const weight = vote.weight || 0;
        const percent = vote.percent || 0;
        const rshares = vote.rshares || 0;
        
        // In the Hive blockchain:
        // - weight and rshares are the primary indicators
        // - percent might be 0 due to API conversion (see useSnaps.ts)
        // - negative values indicate downvotes
        const isDownvote = weight < 0 || percent < 0 || rshares < 0;
        
        // if (isDownvote && process.env.NODE_ENV === 'development') {
        //     console.log(`📊 Downvote detected: voter=${vote.voter}, weight=${weight}, percent=${percent}, rshares=${rshares}`);
        // }

        return isDownvote;
    });
    
    // if (downvotes.length > 0 && process.env.NODE_ENV === 'development') {
    //     console.log(`📊 countDownvotes: Found ${downvotes.length} downvotes out of ${activeVotes.length} total votes`);
    // }
    
    return downvotes.length;
}

/**
 * Filter discussions/posts based on reputation, downvote criteria, and specific authors.
 *
 * Filters out:
 * - Posts from accounts with reputation less than 0
 * - Posts with 2 or more downvotes
 * - Posts from hiveBuzz account
 * - Posts downvoted by admins (NEXT_PUBLIC_ADMIN_USERS env var)
 * - Posts marked `stats.gray` or `stats.hide` by Hive's Bridge API
 * - Posts with `stats.flag_weight > 0` (any community-mod flag contributes)
 *
 * The Bridge signals (`gray`, `hide`, `flag_weight`) are first-class: the
 * Bridge API already does the math for community moderation, so we
 * respect those flags directly even when no admin from our local list
 * has voted yet.
 */
export function filterAutoComments(discussions: any[]): any[] {
    // Import getReputation from client-functions to avoid duplication
    const { getReputation } = require('@/lib/hive/client-functions');
    const adminUsers = process.env.NEXT_PUBLIC_ADMIN_USERS?.split(",")
        .map((user) => user.trim().toLowerCase())
        .filter(Boolean) || [];

    return discussions.filter((discussion: any) => {
        // Deduplicate votes first to ensure accurate counting
        const deduplicatedVotes = deduplicateVotes(discussion.active_votes || []);
        const downvoteCount = countDownvotes(deduplicatedVotes);

        const hasAdminDownvote = adminUsers.length > 0
            ? deduplicatedVotes.some((vote) =>
                adminUsers.includes(String(vote.voter || "").toLowerCase()) &&
                ((vote.weight || 0) < 0 || (vote.percent || 0) < 0 || (vote.rshares || 0) < 0)
            )
            : false;

        // Bridge API moderation signals — respect what the community
        // mods have already decided via Hive's native flagging system.
        const stats = discussion.stats || {};
        const isBridgeFlagged =
            stats.gray === true ||
            stats.hide === true ||
            (typeof stats.flag_weight === "number" && stats.flag_weight > 0);

        // Get author reputation and convert to readable format
        const rawReputation = discussion.author_reputation || 0;

        // Bridge API returns reputation already calculated (e.g., 67.94)
        // Old condenser API returns raw large numbers (e.g., 288278181484)
        // If the value is already between -100 and 100, it's already calculated
        let authorReputation: number;
        if (rawReputation > -100 && rawReputation < 100) {
            // Already calculated reputation from Bridge API
            authorReputation = rawReputation;
        } else {
            // Raw reputation that needs calculation
            authorReputation = getReputation(rawReputation);
        }

        const hasAcceptableDownvotes = downvoteCount < 2;
        const hasAcceptableReputation = authorReputation >= 0;
        const isNotHiveBuzz = discussion.author.toLowerCase() !== 'hivebuzz';

        const shouldShow =
            hasAcceptableDownvotes &&
            hasAcceptableReputation &&
            isNotHiveBuzz &&
            !hasAdminDownvote &&
            !isBridgeFlagged;

        return shouldShow;
    });
}

