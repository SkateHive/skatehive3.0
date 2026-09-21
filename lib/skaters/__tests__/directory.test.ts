/**
 * Unit tests for the directory's filtering, sorting and activity rules.
 * Run with tsx: npx tsx lib/skaters/__tests__/directory.test.ts
 */

import assert from "node:assert";
import {
  DAY_MS,
  NEAR_SORT_KEY,
  activityTier,
  daysSince,
  distanceFrom,
  filterSkaters,
  getSortOption,
  groupByPlace,
  matchesQuery,
  sortSkaters,
} from "../directory";
import type { Skater } from "../types";

const tests: Array<() => void> = [];
let hasFailures = false;

function it(name: string, fn: () => void) {
  tests.push(() => {
    try {
      fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      hasFailures = true;
      console.error(`  ❌ ${name}`);
      console.error(`     ${error}`);
    }
  });
}

const NOW = Date.parse("2026-09-14T12:00:00Z");
/** Epoch seconds, matching the Skater payload's `lastPost`. */
const daysAgo = (days: number) => Math.floor((NOW - days * DAY_MS) / 1000);

function skater(overrides: Partial<Skater> = {}): Skater {
  return { username: "rider", ...overrides };
}

console.log("\n📦 activity tiers");

it("buckets by how long ago someone last posted", () => {
  assert.strictEqual(activityTier(skater({ lastPost: daysAgo(0) }), NOW), "active");
  assert.strictEqual(activityTier(skater({ lastPost: daysAgo(7) }), NOW), "active");
  assert.strictEqual(activityTier(skater({ lastPost: daysAgo(8) }), NOW), "recent");
  assert.strictEqual(activityTier(skater({ lastPost: daysAgo(30) }), NOW), "recent");
  assert.strictEqual(activityTier(skater({ lastPost: daysAgo(90) }), NOW), "quiet");
  assert.strictEqual(activityTier(skater({ lastPost: daysAgo(400) }), NOW), "dormant");
});

it("treats a skater who has never posted as dormant, not as brand new", () => {
  assert.strictEqual(activityTier(skater({}), NOW), "dormant");
  assert.strictEqual(daysSince(undefined, NOW), null);
  // NaN is falsy, so an unparseable upstream timestamp still reads as "none"
  // rather than poisoning the sort with NaN comparisons.
  assert.strictEqual(daysSince(Number.NaN, NOW), null);
  assert.strictEqual(daysSince(0, NOW), null);
});

it("never reports a negative age for a future timestamp", () => {
  assert.strictEqual(daysSince(Math.floor((NOW + 5 * DAY_MS) / 1000), NOW), 0);
});

console.log("\n📦 search");

it("matches handle, display name, location and bio", () => {
  const person = skater({
    username: "xvlad",
    displayName: "Vladimir",
    city: "Rio de Janeiro",
    country: "Brazil",
    rawLocation: "Rio de Janeiro, Brasil",
    about: "filming lines in Lapa",
  });
  for (const term of ["xvlad", "VLADIMIR", "rio", "brazil", "brasil", "lapa"]) {
    assert.strictEqual(matchesQuery(person, term), true, term);
  }
  assert.strictEqual(matchesQuery(person, "berlin"), false);
});

it("an empty query matches everyone", () => {
  assert.strictEqual(matchesQuery(skater(), ""), true);
  assert.strictEqual(matchesQuery(skater(), "   "), true);
});

console.log("\n📦 filtering");

it("combines country, activity and query filters", () => {
  const list = [
    skater({ username: "a", country: "Brazil", lastPost: daysAgo(1) }),
    skater({ username: "b", country: "Brazil", lastPost: daysAgo(200) }),
    skater({ username: "c", country: "Nigeria", lastPost: daysAgo(1) }),
  ];
  assert.deepStrictEqual(
    filterSkaters(list, { country: "Brazil" }, NOW).map((s) => s.username),
    ["a", "b"]
  );
  assert.deepStrictEqual(
    filterSkaters(list, { tier: "active" }, NOW).map((s) => s.username),
    ["a", "c"]
  );
  assert.deepStrictEqual(
    filterSkaters(list, { country: "Brazil", tier: "active" }, NOW).map((s) => s.username),
    ["a"]
  );
  assert.deepStrictEqual(
    filterSkaters(list, { query: "c" }, NOW).map((s) => s.username),
    ["c"]
  );
});

it("a skater with no country is only hidden by an explicit country filter", () => {
  const list = [skater({ username: "nomad", nowhere: true, lastPost: daysAgo(2) })];
  assert.strictEqual(filterSkaters(list, {}, NOW).length, 1);
  assert.strictEqual(filterSkaters(list, { country: "Brazil" }, NOW).length, 0);
});

console.log("\n📦 sorting");

it("defaults to most recently active", () => {
  const list = [
    skater({ username: "old", lastPost: daysAgo(100) }),
    skater({ username: "fresh", lastPost: daysAgo(1) }),
    skater({ username: "never" }),
  ];
  assert.deepStrictEqual(
    sortSkaters(list, "active").map((s) => s.username),
    ["fresh", "old", "never"]
  );
});

it("sorts by points, posts and hive power on request", () => {
  const list = [
    skater({ username: "a", points: 10, postCount: 1, snapsCount: 0, hp: 5 }),
    skater({ username: "b", points: 50, postCount: 0, snapsCount: 9, hp: 1 }),
    skater({ username: "c", points: 0, postCount: 4, snapsCount: 0, hp: 99 }),
  ];
  assert.strictEqual(sortSkaters(list, "points")[0].username, "b");
  assert.strictEqual(sortSkaters(list, "posts")[0].username, "b"); // posts + snaps
  assert.strictEqual(sortSkaters(list, "hp")[0].username, "c");
  assert.strictEqual(sortSkaters(list, "alpha")[0].username, "a");
});

it("an unknown sort key falls back to the default instead of throwing", () => {
  assert.strictEqual(getSortOption("nonsense").key, "active");
  assert.strictEqual(getSortOption(null).key, "active");
});

it("does not mutate the list it is given", () => {
  const list = [skater({ username: "b" }), skater({ username: "a" })];
  sortSkaters(list, "alpha");
  assert.deepStrictEqual(list.map((s) => s.username), ["b", "a"]);
});

it("ties break deterministically so the grid does not shuffle between renders", () => {
  const list = [
    skater({ username: "zed", points: 5, lastPost: daysAgo(3) }),
    skater({ username: "amy", points: 5, lastPost: daysAgo(3) }),
  ];
  const first = sortSkaters(list, "points").map((s) => s.username);
  const second = sortSkaters([...list].reverse(), "points").map((s) => s.username);
  assert.deepStrictEqual(first, second);
  assert.deepStrictEqual(first, ["amy", "zed"]);
});

console.log("\n📦 map grouping");

it("groups skaters by their finest resolved place", () => {
  const list = [
    skater({ username: "a", country: "Brazil", city: "Rio de Janeiro", coords: [-22.91, -43.17] }),
    skater({ username: "b", country: "Brazil", city: "Rio de Janeiro", coords: [-22.91, -43.17] }),
    skater({ username: "c", country: "Brazil", coords: [-14.24, -51.93] }),
    skater({ username: "d", nowhere: true }),
  ];
  const groups = groupByPlace(list);
  assert.strictEqual(groups.length, 2);
  assert.strictEqual(groups[0].label, "Rio de Janeiro, Brazil");
  assert.strictEqual(groups[0].skaters.length, 2);
  assert.strictEqual(groups[1].label, "Brazil");
});

it("leaves people with no coordinates off the map entirely", () => {
  assert.strictEqual(groupByPlace([skater({ country: "Brazil" })]).length, 0);
});


console.log("\n📦 distance & nearest");

const SAO_PAULO: [number, number] = [-23.55, -46.63];
const RIO: [number, number] = [-22.91, -43.17];
const LISBON: [number, number] = [38.72, -9.14];

it("measures a real distance between two cities", () => {
  const km = distanceFrom(SAO_PAULO, skater({ coords: RIO }));
  assert.ok(km !== null, "expected a distance");
  // São Paulo to Rio is ~355 km great-circle.
  assert.ok(km! > 330 && km! < 380, `expected ~355km, got ${km}`);
});

it("has no distance for a skater with no coordinates", () => {
  assert.strictEqual(distanceFrom(SAO_PAULO, skater({ coords: undefined })), null);
});

it("has no distance when the viewer has not shared a position", () => {
  assert.strictEqual(distanceFrom(null, skater({ coords: RIO })), null);
});

it("sorts the closest skater first", () => {
  const list = [
    skater({ username: "lisbon", coords: LISBON }),
    skater({ username: "rio", coords: RIO }),
  ];
  const sorted = sortSkaters(list, NEAR_SORT_KEY, SAO_PAULO);
  assert.deepStrictEqual(sorted.map((entry) => entry.username), ["rio", "lisbon"]);
});

it("puts skaters with no location last instead of first", () => {
  const list = [
    skater({ username: "nowhere", coords: undefined }),
    skater({ username: "lisbon", coords: LISBON }),
  ];
  const sorted = sortSkaters(list, NEAR_SORT_KEY, SAO_PAULO);
  assert.deepStrictEqual(sorted.map((entry) => entry.username), ["lisbon", "nowhere"]);
});

it("falls back to the default order when no position was shared", () => {
  const recent = skater({ username: "recent", lastPost: daysAgo(1), coords: LISBON });
  const old = skater({ username: "old", lastPost: daysAgo(200), coords: RIO });
  // Without an origin, "near" must not silently reorder by distance.
  const sorted = sortSkaters([old, recent], NEAR_SORT_KEY, null);
  assert.deepStrictEqual(sorted.map((entry) => entry.username), ["recent", "old"]);
});

(async () => {
  for (const run of tests) run();
  if (hasFailures) {
    console.error("\n❌ directory tests failed\n");
    process.exit(1);
  }
  console.log("\n✅ directory tests passed\n");
})();
