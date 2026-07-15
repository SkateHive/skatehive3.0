// Single source of truth for which markets Skatehive surfaces.
//
// Today: sports markets in the "core" group (good for testing — Skatehive-
// specific markets don't exist yet). Later: flip to a title/tags filter for
// anything containing "skate" by setting `titleFilter` (and optionally
// clearing/relaxing `upstreamQuery`). Changing this one object re-scopes the
// whole feature; no other file needs to change.

export interface PredictionsConfig {
  // Query params forwarded to the hivepredict /markets endpoint.
  upstreamQuery: Record<string, string>;
  // Optional client-side title filter applied after fetch. null = no filter.
  titleFilter: RegExp | null;
}

export const PREDICTIONS_CONFIG: PredictionsConfig = {
  upstreamQuery: {
    category: "sports",
    marketGroup: "core",
  },
  // To scope to Skatehive markets once they exist:
  //   titleFilter: /skate/i,
  titleFilter: null,
};

// Apply the optional client-side title filter.
export function applyTitleFilter<T extends { title: string }>(items: T[]): T[] {
  const { titleFilter } = PREDICTIONS_CONFIG;
  if (!titleFilter) return items;
  return items.filter((m) => titleFilter.test(m.title));
}
