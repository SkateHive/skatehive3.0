/** Hive retains zeroed votes in active_votes; only positive votes claim a bounty. */
export function isActiveBountyClaim(vote: { voter?: string; percent?: number }, author: string): boolean {
  return !!vote.voter && vote.voter.toLowerCase() !== author.toLowerCase() &&
    typeof vote.percent === "number" && vote.percent > 0;
}
