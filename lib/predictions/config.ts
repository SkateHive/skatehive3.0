// Single source of truth for which markets Skatehive surfaces.
//
// Scoped to hivepredict's dedicated "skate" category (API id `skate`).
// Changing this one object re-scopes the whole feature; no other file needs
// to change (e.g. add a titleFilter, or widen upstreamQuery for testing).

export interface PredictionsConfig {
  // Query params forwarded to the hivepredict /markets endpoint.
  upstreamQuery: Record<string, string>;
  // Optional client-side title filter applied after fetch. null = no filter.
  titleFilter: RegExp | null;
}

export const PREDICTIONS_CONFIG: PredictionsConfig = {
  upstreamQuery: {
    category: "skate",
  },
  titleFilter: null,
};

// The "Sports match" create shape (Odds API auto-resolve) is fully built but
// hidden for now — the create wizard shows only Yes/No and Multiple options.
// Flip to true to expose it again.
export const PREDICTIONS_SPORTS_SHAPE_ENABLED = false;

// Apply the optional client-side title filter.
export function applyTitleFilter<T extends { title: string }>(items: T[]): T[] {
  const { titleFilter } = PREDICTIONS_CONFIG;
  if (!titleFilter) return items;
  return items.filter((m) => titleFilter.test(m.title));
}
