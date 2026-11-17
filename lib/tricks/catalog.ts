export interface Trick {
  name: string;
  slug: string;
  /** Hive tags used to look up community clips of this trick. */
  tags: string[];
}

export interface TrickCategory {
  name: string;
  tricks: Trick[];
}

// Trick categories with their tags for Hive lookup
export const TRICK_CATEGORIES: TrickCategory[] = [
  {
    name: "Flip Tricks",
    tricks: [
      { name: "Kickflip", slug: "kickflip", tags: ["kickflip"] },
      { name: "Heelflip", slug: "heelflip", tags: ["heelflip"] },
      { name: "Varial Kickflip", slug: "varial-kickflip", tags: ["varial", "varialkickflip"] },
      { name: "Tre Flip (360 Flip)", slug: "tre-flip", tags: ["treflip", "360flip"] },
      { name: "Hardflip", slug: "hardflip", tags: ["hardflip"] },
      { name: "Frontside Flip", slug: "frontside-flip", tags: ["frontsideflip", "fsflip"] },
      { name: "Backside Flip", slug: "backside-flip", tags: ["backsideflip", "bsflip"] },
      { name: "Varial Heelflip", slug: "varial-heelflip", tags: ["varialheel", "varialheelflip"] },
      { name: "Laser Flip", slug: "laser-flip", tags: ["laserflip"] },
    ],
  },
  {
    name: "Flatground",
    tricks: [
      { name: "Ollie", slug: "ollie", tags: ["ollie"] },
      { name: "Nollie", slug: "nollie", tags: ["nollie"] },
      { name: "Pop Shove-it", slug: "pop-shove-it", tags: ["shove", "shoveit", "popshove"] },
      { name: "Frontside Shuvit", slug: "frontside-shuvit", tags: ["frontsideshove", "fsshoveit"] },
      { name: "Backside 180", slug: "backside-180", tags: ["backside180", "bs180"] },
      { name: "Frontside 180", slug: "frontside-180", tags: ["frontside180", "fs180"] },
      { name: "360 Pop Shuvit", slug: "360-pop-shuvit", tags: ["360shove", "3shove"] },
      { name: "One-Foot Ollie", slug: "one-foot-ollie", tags: ["onefootollie", "onefoot"] },
      { name: "Backside Bigspin", slug: "backside-bigspin", tags: ["backsidebigspin", "bsbigspin", "bigspin"] },
      { name: "Manual", slug: "manual", tags: ["manual"] },
      { name: "No Comply", slug: "no-comply", tags: ["nocomply"] },
      { name: "Boneless", slug: "boneless", tags: ["boneless"] },
    ],
  },
  {
    name: "Grinds & Slides",
    tricks: [
      { name: "50-50 Grind", slug: "50-50", tags: ["5050", "grind"] },
      { name: "Boardslide", slug: "boardslide", tags: ["boardslide"] },
      { name: "Nosegrind", slug: "nosegrind", tags: ["nosegrind"] },
      { name: "Smith Grind", slug: "smith-grind", tags: ["smithgrind"] },
      { name: "Feeble Grind", slug: "feeble", tags: ["feeble", "feeblegrind"] },
      { name: "Crooked Grind", slug: "crooked-grind", tags: ["crooks", "crookedgrind"] },
      { name: "Blunt to Fakie", slug: "blunt-to-fakie", tags: ["blunttofakie", "blunt", "bluntfakie"] },
      { name: "Wallride", slug: "wallride", tags: ["wallride"] },
    ],
  },
  {
    name: "Transition",
    tricks: [
      { name: "Drop In", slug: "drop-in", tags: ["dropin"] },
      { name: "Rock to Fakie", slug: "rock-to-fakie", tags: ["rocktofakie", "rock"] },
      { name: "Axle Stall", slug: "axle-stall", tags: ["axlestall"] },
      { name: "Frontside Air", slug: "frontside-air", tags: ["frontsideair"] },
      { name: "Backside Air", slug: "backside-air", tags: ["backsideair"] },
    ],
  },
];

export interface TrickSearchResult extends Trick {
  category: string;
}

export const ALL_TRICKS: TrickSearchResult[] = TRICK_CATEGORIES.flatMap((category) =>
  category.tricks.map((trick) => ({ ...trick, category: category.name }))
);

/**
 * "Tre Flip (360 Flip)" → "treflip360flip"; spacing, case, dashes and accents
 * don't matter ("Tré Flip" still finds it).
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Names a user would type for this trick on its own: the slug, the display
 * name, and each half of names like "Tre Flip (360 Flip)". Hive tags are left
 * out on purpose: some are generic ("grind", "rock") and would hijack a search
 * meant for posts.
 */
function exactNames(trick: Trick): string[] {
  const names = [trick.slug, trick.name];
  const paren = trick.name.match(/^(.*)\((.*)\)\s*$/);
  if (paren) names.push(paren[1], paren[2]);
  return names.map(normalize).filter(Boolean);
}

/**
 * Tricks whose name, slug or tags contain the query, best matches first:
 * names that start with the query, then names that contain it, then tag-only
 * matches ("fs flip" finds Frontside Flip through its `fsflip` tag).
 */
export function searchTricks(query: string, limit = 8): TrickSearchResult[] {
  const term = normalize(query);
  if (!term) return [];

  const ranked: Array<{ trick: TrickSearchResult; rank: number; index: number }> = [];

  ALL_TRICKS.forEach((trick, index) => {
    const names = exactNames(trick);
    let rank: number | null = null;
    if (names.some((name) => name.startsWith(term))) rank = 0;
    else if (names.some((name) => name.includes(term))) rank = 1;
    else if (trick.tags.some((tag) => normalize(tag).includes(term))) rank = 2;
    if (rank !== null) ranked.push({ trick, rank, index });
  });

  return ranked
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.trick);
}

/** The trick a query names exactly ("kickflip", "Tre Flip", "360 flip"), if any. */
export function findTrickByName(query: string): TrickSearchResult | undefined {
  const term = normalize(query);
  if (!term) return undefined;
  return ALL_TRICKS.find((trick) => exactNames(trick).includes(term));
}
