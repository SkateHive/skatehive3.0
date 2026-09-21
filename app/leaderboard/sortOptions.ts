import { SkaterData } from "@/types/leaderboard";
import { ETH_ADDRESSES } from "@/config/app.config";

export type SortOption =
  | "points"
  | "power"
  | "posts"
  | "nfts"
  | "gnars"
  | "donations"
  | "hive"
  | "eth"
  | "gnars_balance"
  | "witness"
  | "last_updated";

/** Which shelf of the dropdown an option sits on. */
export type SortGroup = "ranking" | "holdings" | "checks" | "data";

/**
 * How the helper line under the dropdown counts the skaters an option is
 * actually about:
 *   - "hasValue"  -> "18 of 1860 skaters have a value here"
 *   - "pending"   -> "1656 skaters still pending"
 *   - "none"      -> no count (the option ranks everyone)
 */
export type SortCoverage = "hasValue" | "pending" | "none";

export interface SortOptionConfig {
  value: SortOption;
  group: SortGroup;
  /** i18n key for the dropdown label, under `leaderboard.` */
  labelKey: string;
  /** i18n key for the one-line explanation shown under the dropdown. */
  descriptionKey: string;
  coverage: SortCoverage;
  /** Counts the skaters the helper line reports on. */
  countsSkater?: (skater: SkaterData) => boolean;
}

const hasEthAddress = (skater: SkaterData) =>
  Boolean(skater.eth_address && skater.eth_address !== ETH_ADDRESSES.ZERO);

export const SORT_OPTIONS: SortOptionConfig[] = [
  {
    value: "points",
    group: "ranking",
    labelKey: "points",
    descriptionKey: "descPoints",
    coverage: "hasValue",
    countsSkater: (s) => s.points > 0,
  },
  {
    value: "power",
    group: "ranking",
    labelKey: "power",
    descriptionKey: "descPower",
    coverage: "hasValue",
    countsSkater: (s) => s.hp_balance + s.max_voting_power_usd > 0,
  },
  {
    value: "posts",
    group: "ranking",
    labelKey: "postScore",
    descriptionKey: "descPosts",
    coverage: "hasValue",
    countsSkater: (s) => s.posts_score > 0,
  },
  {
    value: "nfts",
    group: "holdings",
    labelKey: "skatehiveNfts",
    descriptionKey: "descNfts",
    coverage: "hasValue",
    countsSkater: (s) => s.skatehive_nft_balance > 0,
  },
  {
    value: "gnars_balance",
    group: "holdings",
    labelKey: "gnarsNfts",
    descriptionKey: "descGnarsNfts",
    coverage: "hasValue",
    countsSkater: (s) => s.gnars_balance > 0,
  },
  {
    value: "gnars",
    group: "holdings",
    labelKey: "gnarsVoters",
    descriptionKey: "descGnarsVotes",
    coverage: "hasValue",
    countsSkater: (s) => s.gnars_votes > 0,
  },
  {
    value: "donations",
    group: "holdings",
    labelKey: "donationsDollar",
    descriptionKey: "descDonations",
    coverage: "hasValue",
    countsSkater: (s) => s.giveth_donations_usd > 0,
  },
  {
    value: "hive",
    group: "holdings",
    labelKey: "hive",
    descriptionKey: "descHive",
    coverage: "hasValue",
    countsSkater: (s) => s.hive_balance > 0,
  },
  {
    value: "eth",
    group: "checks",
    labelKey: "missingEth",
    descriptionKey: "descMissingEth",
    coverage: "pending",
    countsSkater: (s) => !hasEthAddress(s),
  },
  {
    value: "witness",
    group: "checks",
    labelKey: "missingWitness",
    descriptionKey: "descMissingWitness",
    coverage: "pending",
    countsSkater: (s) => !s.has_voted_in_witness,
  },
  {
    value: "last_updated",
    group: "data",
    labelKey: "lastUpdated",
    descriptionKey: "descLastUpdated",
    coverage: "none",
  },
];

/** Dropdown shelves, in display order, with their i18n label keys. */
export const SORT_GROUPS: { group: SortGroup; labelKey: string }[] = [
  { group: "ranking", labelKey: "groupRanking" },
  { group: "holdings", labelKey: "groupHoldings" },
  { group: "checks", labelKey: "groupChecks" },
  { group: "data", labelKey: "groupData" },
];

export const getSortConfig = (value: SortOption): SortOptionConfig =>
  SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

/** The two "who is still missing X" views show ✅/❌ instead of a position. */
export const isCheckSort = (value: SortOption): boolean =>
  getSortConfig(value).group === "checks";
