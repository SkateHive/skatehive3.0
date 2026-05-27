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

function isNegativeVote(vote: any): boolean {
    return (
        (vote.weight || 0) < 0 ||
        (vote.percent || 0) < 0 ||
        (vote.rshares || 0) < 0
    );
}

/**
 * Filter discussions/posts based on reputation and moderation rules.
 *
 * Moderation hierarchy (Skatehive-specific):
 * - **Primary admins** (NEXT_PUBLIC_PRIMARY_ADMIN_USERS) can hide a
 *   post solo — one downvote from any primary admin = hidden.
 * - **Regular admins** (NEXT_PUBLIC_ADMIN_USERS) need quorum — 2+
 *   downvotes from this group are required to hide a post.
 *   (Primary admins are excluded from this count, since they already
 *   have solo authority.)
 *
 * Also filters out:
 * - Posts with 2 or more total downvotes (broad community disapproval,
 *   independent of who voted)
 * - Posts from accounts with reputation less than 0
 * - Posts from @hivebuzz (auto-comments)
 * - Posts where Bridge has marked `stats.hide = true` (community mute —
 *   explicit, rare, and worth honoring even though it's set by the
 *   on-chain Skatehive moderator list rather than this env var)
 *
 * Bridge's `stats.gray` and `stats.flag_weight` are NOT respected here
 * because they can be set by accounts outside our local admin list and
 * would otherwise hide posts via authorities we haven't sanctioned.
 */
export function filterAutoComments(discussions: any[]): any[] {
    // Import getReputation from client-functions to avoid duplication
    const { getReputation } = require('@/lib/hive/client-functions');

    const splitEnvList = (raw: string | undefined): string[] =>
        raw?.split(",").map((u) => u.trim().toLowerCase()).filter(Boolean) || [];

    const primaryAdmins = splitEnvList(process.env.NEXT_PUBLIC_PRIMARY_ADMIN_USERS);
    const allAdmins = splitEnvList(process.env.NEXT_PUBLIC_ADMIN_USERS);
    const primarySet = new Set(primaryAdmins);
    // Regular admins are those in the full admin list but not in the
    // primary list. Falls back to `allAdmins` itself when no primary
    // set is configured (preserving the old "1 admin downvote = hide"
    // behavior unless the env intentionally introduces a hierarchy).
    const regularAdmins = primaryAdmins.length > 0
        ? allAdmins.filter((u) => !primarySet.has(u))
        : allAdmins;
    const regularSet = new Set(regularAdmins);

    return discussions.filter((discussion: any) => {
        // Deduplicate votes first to ensure accurate counting
        const deduplicatedVotes = deduplicateVotes(discussion.active_votes || []);
        const downvoteCount = countDownvotes(deduplicatedVotes);

        const negativeAdminVotes = deduplicatedVotes.filter(
            (v) => isNegativeVote(v) && typeof v.voter === "string",
        );

        // Solo-authority primary admin downvote.
        const hasPrimaryAdminDownvote =
            primarySet.size > 0 &&
            negativeAdminVotes.some((v) =>
                primarySet.has(String(v.voter).toLowerCase()),
            );

        // Quorum (2+) of regular admin downvotes.
        const regularAdminDownvoteCount = regularSet.size > 0
            ? negativeAdminVotes.filter((v) =>
                regularSet.has(String(v.voter).toLowerCase()),
            ).length
            : 0;
        const hasRegularAdminQuorum = regularAdminDownvoteCount >= 2;

        const hasAdminMod = hasPrimaryAdminDownvote || hasRegularAdminQuorum;

        // Bridge "hide" is a hard mute set by the on-chain Skatehive
        // community moderators. Worth honoring even outside our env list.
        const isBridgeHidden = discussion.stats?.hide === true;

        // Get author reputation and convert to readable format
        const rawReputation = discussion.author_reputation || 0;

        // Bridge API returns reputation already calculated (e.g., 67.94)
        // Old condenser API returns raw large numbers (e.g., 288278181484)
        // If the value is already between -100 and 100, it's already calculated
        let authorReputation: number;
        if (rawReputation > -100 && rawReputation < 100) {
            authorReputation = rawReputation;
        } else {
            authorReputation = getReputation(rawReputation);
        }

        const hasAcceptableDownvotes = downvoteCount < 2;
        const hasAcceptableReputation = authorReputation >= 0;
        const isNotHiveBuzz = discussion.author.toLowerCase() !== "hivebuzz";

        return (
            hasAcceptableDownvotes &&
            hasAcceptableReputation &&
            isNotHiveBuzz &&
            !hasAdminMod &&
            !isBridgeHidden
        );
    });
}

