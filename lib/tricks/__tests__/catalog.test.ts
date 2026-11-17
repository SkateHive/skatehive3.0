import { searchTricks, findTrickByName } from "../catalog";

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`  ok ${name}`);
    } catch (error) {
      console.error(`  fail ${name}`);
      console.error(`     ${error}`);
      hasFailures = true;
    }
  });
}

function assertEqual(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error(`Expected "${expected}" but got "${actual}"`);
  }
}


function slugs(query: string, limit?: number) {
  return searchTricks(query, limit).map((trick) => trick.slug);
}

describe("searchTricks", () => {
  it("returns nothing for an empty query", () => {
    assertEqual(slugs("").join(","), "");
    assertEqual(slugs("  -  ").join(","), "");
  });

  it("ignores case, spaces and dashes", () => {
    assertEqual(slugs("KICKFLIP")[0], "kickflip");
    assertEqual(slugs("tre flip")[0], "tre-flip");
    assertEqual(slugs("treflip")[0], "tre-flip");
    assertEqual(slugs("pop shove it")[0], "pop-shove-it");
    assertEqual(slugs("50 50")[0], "50-50");
    assertEqual(slugs("Tré Flip")[0], "tre-flip");
  });

  it("ranks names that start with the query first", () => {
    // "Heelflip" starts with "heel", "Varial Heelflip" contains it.
    assertEqual(slugs("heel").join(","), "heelflip,varial-heelflip");
    // "Pop Shove-it" starts with "pop"; "360 Pop Shuvit" only contains it.
    assertEqual(slugs("pop")[0], "pop-shove-it");
    // "Backside Bigspin" matches "spin" by name; nothing else does.
    assertEqual(slugs("spin").join(","), "backside-bigspin");
  });

  it("finds tricks through their Hive tags", () => {
    assertEqual(slugs("fs flip")[0], "frontside-flip");
    assertEqual(slugs("bs180")[0], "backside-180");
  });

  it("respects the limit", () => {
    assertEqual(String(slugs("i", 3).length), "3");
  });

  it("tags each result with its category", () => {
    assertEqual(searchTricks("boardslide")[0].category, "Grinds & Slides");
  });
});

describe("findTrickByName", () => {
  it("matches slug, display name and either half of a parenthesised name", () => {
    assertEqual(findTrickByName("tre-flip")?.slug ?? "", "tre-flip");
    assertEqual(findTrickByName("Tre Flip (360 Flip)")?.slug ?? "", "tre-flip");
    assertEqual(findTrickByName("360 flip")?.slug ?? "", "tre-flip");
    assertEqual(findTrickByName("Feeble Grind")?.slug ?? "", "feeble");
  });

  it("does not treat partial names or generic tags as a trick", () => {
    assertEqual(findTrickByName("kick")?.slug ?? "", "");
    assertEqual(findTrickByName("grind")?.slug ?? "", "");
  });
});

(async () => {
  for (const test of tests) {
    await test();
  }
  if (hasFailures) process.exit(1);
})();
