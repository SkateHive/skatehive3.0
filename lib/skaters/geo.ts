/**
 * Resolves the free-text `profile.location` on a Hive account into a country,
 * an optional city, and map coordinates.
 *
 * Hive stores location as whatever the user typed, so this is a best-effort
 * parser tuned against the real Skatehive dataset. It is deliberately
 * conservative: when it cannot identify a real place it says so rather than
 * inventing a country, which is what the previous "split on comma, take the
 * last piece" approach did (it produced countries named "Rio de Janeiro",
 * "Lagos" and "Moon").
 */

import {
  AMBIGUOUS_ISO_CODES,
  CITIES,
  COUNTRY_ALIASES,
  COUNTRY_CENTROIDS,
  ISO_ALIASES,
  NOWHERE_TOKENS,
  US_STATES,
  type LatLng,
} from "./geoData";

export type { LatLng };

export interface ResolvedLocation {
  /** The original string, trimmed. */
  raw: string;
  /** Canonical country name, or null when we could not identify one. */
  country: string | null;
  /** City or region display name when we recognised one. */
  city: string | null;
  /** Map position: city > US state > country centroid. */
  coords: LatLng | null;
  /** What to print on a card. */
  label: string;
  /** True for "Moon", "Metaverse", "Everywhere" and friends. */
  nowhere: boolean;
}

const EMPTY: ResolvedLocation = {
  raw: "",
  country: null,
  city: null,
  coords: null,
  label: "",
  nowhere: false,
};

const NOWHERE_SET = new Set(NOWHERE_TOKENS);

/**
 * Words that, on their own, mean the person is being playful about location.
 *
 * Matched as WHOLE WORDS. These used to be tested with `includes`, which meant
 * "mars" swallowed Marseille, "moon" swallowed Moonachie, "asia" swallowed
 * Asiago and "earth" swallowed Earth City — real towns filed under 🛸.
 * Variants are spelled out rather than reintroduced as prefixes.
 */
const NOWHERE_HINTS = new Set([
  "earth", "world", "worldwide", "mundo", "universe", "multiverse",
  "galaxy", "galaxie", "galaxia", "planet", "planeta", "mars", "moon", "luna",
  "metaverse", "cyberspace", "blockchain", "hive", "web3", "crypto",
  "somewhere", "wherever", "everywhere", "nowhere", "anywhere",
  "africa", "asia", "nomad", "space", "internet",
]);

/**
 * Lowercase, strip accents and emoji, reduce every separator to a single space.
 * Every lookup key in ./geoData is stored in this form.
 */
export function normalizeKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining marks left by NFD
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drops URLs and handles people paste into the location field. */
function stripNoise(input: string): string {
  return input
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[\w.-]+\.(com|app|io|org|net)\b\S*/gi, " ")
    .trim();
}

/** Splits a location into the comma/slash/dash separated pieces people write. */
function toSegments(input: string): string[] {
  return input
    .split(/[,;|/\n\r·•]+|\s-\s|\s-|-\s/)
    .map((s) => normalizeKey(s))
    .filter(Boolean);
}

/** All 1..maxLen word windows of a segment, longest first. */
function windows(words: string[], maxLen: number): string[] {
  const out: string[] = [];
  const cap = Math.min(maxLen, words.length);
  for (let len = cap; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      out.push(words.slice(i, i + len).join(" "));
    }
  }
  return out;
}

interface CityHit {
  key: string;
  len: number;
}

function findCity(segments: string[]): CityHit | null {
  let best: CityHit | null = null;
  for (const segment of segments) {
    const words = segment.split(" ");
    for (const window of windows(words, 4)) {
      if (!CITIES[window]) continue;
      const len = window.split(" ").length;
      if (best === null || len > best.len) best = { key: window, len };
      break; // windows() is longest-first, so the first hit is this segment's best
    }
  }
  return best;
}

/**
 * A country the person actually spelled out: "brazil", "south africa", "usa".
 *
 * Bare two-letter codes are NOT considered here. They are the ambiguous case —
 * "ca" is both California and Canada — so they get their own passes in
 * {@link findIsoCountry}: one before US states when the code is the entire
 * location, one after them when it is a word inside a longer string.
 */
function findExplicitCountry(segments: string[]): string | null {
  for (const segment of segments) {
    const alias = COUNTRY_ALIASES[segment];
    if (alias) return alias;
  }

  // Then multi-word windows. Restricted to words of 4+ characters so that
  // stopwords like "in" (ISO for India) can't hijack "In Peru".
  for (const segment of segments) {
    const words = segment.split(" ");
    for (const window of windows(words, 3)) {
      if (window.length < 4) continue;
      const alias = COUNTRY_ALIASES[window];
      if (alias) return alias;
    }
    // A trailing token is very often the country: "sp brasil", "south west uk".
    const last = words[words.length - 1];
    if (last && COUNTRY_ALIASES[last]) return COUNTRY_ALIASES[last];
  }

  return null;
}

/**
 * Bare two-letter country codes: "ioannina gr", "sp br".
 *
 * `allowAmbiguous` is set only when the code is the entire location, where it
 * cannot be a stray word picked out of a sentence. See AMBIGUOUS_ISO_CODES.
 */
function findIsoCountry(segments: string[], allowAmbiguous: boolean): string | null {
  const read = (code: string): string | null => {
    if (code.length !== 2) return null;
    if (!allowAmbiguous && AMBIGUOUS_ISO_CODES.has(code)) return null;
    return ISO_ALIASES[code] ?? null;
  };

  for (const segment of segments) {
    const hit = read(segment);
    if (hit) return hit;
  }
  for (const segment of segments) {
    const words = segment.split(" ");
    const hit = read(words[words.length - 1] ?? "");
    if (hit) return hit;
  }
  return null;
}

function findUsState(segments: string[]): { name: string; coords: LatLng } | null {
  for (const segment of segments) {
    const exact = US_STATES[segment];
    if (exact) return exact;
    const words = segment.split(" ");
    for (const window of windows(words, 2)) {
      const hit = US_STATES[window];
      // Two-letter codes only count as a suffix ("phoenix az"), never mid-string.
      if (hit && (window.length > 2 || window === words[words.length - 1])) return hit;
    }
  }
  return null;
}

function isNowhere(normalized: string, segments: string[]): boolean {
  if (NOWHERE_SET.has(normalized)) return true;
  if (segments.some((s) => NOWHERE_SET.has(s))) return true;
  return normalized.split(" ").some((word) => NOWHERE_HINTS.has(word));
}

/**
 * Turns a raw Hive `profile.location` into a structured place.
 *
 * Resolution order: a location that is only an ISO code (what the profile editor
 * writes), then most-specific-first — city, country, US state — and finally the
 * "somewhere out there" bucket.
 */
export function resolveLocation(raw: string | undefined | null): ResolvedLocation {
  const trimmed = (raw || "").trim();
  if (!trimmed) return EMPTY;

  const cleaned = stripNoise(trimmed);
  const normalized = normalizeKey(cleaned);
  if (!normalized) return { ...EMPTY, raw: trimmed, label: trimmed };

  const segments = toSegments(cleaned);

  // A location that is nothing but a two-letter code comes from our own profile
  // editor, whose country <Select> stores the ISO code and nothing else. Read it
  // as that country before the US-state pass below can claim it: 26 of the
  // editor's 249 options are also USPS state codes, so picking Canada filed the
  // skater under California, Germany under Delaware and India under Indiana.
  //
  // The reverse case ("Nashville, TN") is why states otherwise run first, and it
  // still does: it has a city in front of the code, so it is not bare. The 25
  // state codes that are not ISO countries ("FL", "TX", "NY") fall through to
  // the state pass either way.
  if (segments.length === 1 && segments[0].length === 2) {
    const bare = findIsoCountry(segments, true);
    if (bare) {
      return {
        raw: trimmed,
        country: bare,
        city: null,
        coords: COUNTRY_CENTROIDS[bare] ?? null,
        label: bare,
        nowhere: false,
      };
    }
  }

  // Everything is gathered before anything is chosen, because the pieces
  // disambiguate each other: a US state tells us "CA" is California and not
  // Canada, and a spelled-out country tells us "Lagos, Portugal" is not Nigeria.
  const cityHit = findCity(segments);
  const city = cityHit ? CITIES[cityHit.key] : null;
  const explicitCountry = findExplicitCountry(segments);
  const state = findUsState(segments);

  // A state is itself a claim about the country, so it counts when deciding
  // whether a city from the table agrees with the rest of the string.
  const statedCountry = explicitCountry ?? (state ? "United States" : null);

  // Trust the city only when nothing else contradicts it.
  if (city && (!statedCountry || city.country === statedCountry)) {
    return {
      raw: trimmed,
      country: city.country,
      city: city.name,
      coords: city.coords,
      label: `${city.name}, ${city.country}`,
      nowhere: false,
    };
  }

  if (state && (!explicitCountry || explicitCountry === "United States")) {
    return {
      raw: trimmed,
      country: "United States",
      city: state.name,
      coords: state.coords,
      label: `${state.name}, United States`,
      nowhere: false,
    };
  }

  if (explicitCountry) {
    return {
      raw: trimmed,
      country: explicitCountry,
      city: null,
      coords: COUNTRY_CENTROIDS[explicitCountry] ?? null,
      label: explicitCountry,
      nowhere: false,
    };
  }

  // Bare ISO codes come last: by here no state and no spelled-out country
  // claimed the string, so "gr" really is Greece.
  const isoCountry = findIsoCountry(segments, false);
  if (isoCountry) {
    return {
      raw: trimmed,
      country: isoCountry,
      city: null,
      coords: COUNTRY_CENTROIDS[isoCountry] ?? null,
      label: isoCountry,
      nowhere: false,
    };
  }

  if (isNowhere(normalized, segments)) {
    return { raw: trimmed, country: null, city: null, coords: null, label: trimmed, nowhere: true };
  }

  return { raw: trimmed, country: null, city: null, coords: null, label: trimmed, nowhere: false };
}

/** Mean Earth radius, km. */
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in kilometres.
 *
 * Good enough for "who skates near me": the coordinates it compares are city
 * centroids resolved from a free-text profile field, so the input is already
 * far coarser than any error this introduces.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** URL-safe slug for a country name: "United States" -> "united-states". */
export function countrySlug(country: string): string {
  return normalizeKey(country).replace(/\s+/g, "-");
}

/** Reverse of {@link countrySlug}, against the countries we know about. */
export function countryFromSlug(slug: string): string | null {
  const target = slug.toLowerCase();
  for (const country of Object.keys(COUNTRY_CENTROIDS)) {
    if (countrySlug(country) === target) return country;
  }
  return null;
}

