import { resolveSearchPath } from "../resolveSearchPath";

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

describe("resolveSearchPath", () => {
  it("sends an empty query to the blog", () => {
    assertEqual(resolveSearchPath(""), "/blog");
    assertEqual(resolveSearchPath("   "), "/blog");
    assertEqual(resolveSearchPath(null), "/blog");
  });

  it("keeps blog sort queries on /blog", () => {
    assertEqual(resolveSearchPath("trending"), "/blog?query=trending");
    assertEqual(resolveSearchPath("created"), "/blog?query=created");
  });

  it("sends a free-text query to the tag listing", () => {
    assertEqual(resolveSearchPath("skate"), "/blog/tag/skate");
    assertEqual(resolveSearchPath("#Skate"), "/blog/tag/skate");
    assertEqual(resolveSearchPath("skate hive"), "/blog/tag/skate-hive");
  });

  it("drops characters that would escape the path", () => {
    assertEqual(resolveSearchPath("../admin"), "/blog/tag/admin");
    assertEqual(resolveSearchPath("skate?x=1"), "/blog/tag/skatex1");
  });
});

(async () => {
  for (const test of tests) {
    await test();
  }
  if (hasFailures) process.exit(1);
})();
