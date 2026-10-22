// Hive only accepts delete_comment while the post has no replies, no net
// positive votes and hasn't paid out yet. Anything else gets the convention
// every Hive front end uses: edit the body to "deleted", which our feed
// filters (lib/utils/postUtils.ts) already hide.
export const PAID_OUT_CASHOUT = "1969-12-31T23:59:59";

export interface DeletablePost {
  children?: number;
  cashout_time?: string;
  net_rshares?: string | number | null;
  active_votes?: Array<{ rshares?: string | number; percent?: number; weight?: number }>;
}

export function canDeleteOnChain(post: DeletablePost): boolean {
  if ((post.children ?? 0) > 0) return false;
  if (post.cashout_time === PAID_OUT_CASHOUT) return false;
  if (post.net_rshares !== undefined && post.net_rshares !== null) {
    return Number(post.net_rshares) <= 0;
  }
  // Some feeds don't carry net_rshares; any upvote blocks the delete.
  return !(post.active_votes || []).some(
    (v) => Number(v?.rshares ?? v?.percent ?? v?.weight ?? 0) > 0
  );
}
