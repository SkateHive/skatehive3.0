/**
 * Unit tests for resolveChannelKey / limitCastEmbeds
 * Run with tsx: npx tsx lib/farcaster/__tests__/channels.test.ts
 *
 * These two functions are the ONLY guard on the miniapp path. When the app
 * composes through `sdk.actions.composeCast`, `channelKey` and the embed list
 * go straight from the browser to the Farcaster host — the server-side
 * ALLOWED_CHANNELS check in /api/farcaster/cast never runs, because the cast
 * never reaches our server. So the rules are pinned here.
 */

import {
  DEFAULT_FARCASTER_CHANNEL,
  MAX_CAST_EMBEDS,
  limitCastEmbeds,
  parseCastEmbeds,
  resolveChannelKey,
} from "../channels";

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

function describe(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.error(`  ❌ ${name}`);
      console.error(`     ${error}`);
      hasFailures = true;
    }
  });
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(message || `Expected ${b}, but got ${a}`);
}

describe("resolveChannelKey", () => {
  it("accepts the three allowed channels", () => {
    assertEqual(resolveChannelKey("skateboard"), "skateboard");
    assertEqual(resolveChannelKey("gnars"), "gnars");
    assertEqual(resolveChannelKey("higher"), "higher");
  });

  it("normalizes the way the cast route does: slash, case, whitespace", () => {
    assertEqual(resolveChannelKey("/skateboard"), "skateboard");
    assertEqual(resolveChannelKey("//skateboard"), "skateboard");
    assertEqual(resolveChannelKey("  SkateBoard  "), "skateboard");
    assertEqual(resolveChannelKey("/GNARS"), "gnars");
  });

  it("rejects anything not on the allowlist", () => {
    // Falls back to the user's own feed rather than failing the share — but it
    // must never pass an arbitrary channel through to the host.
    assertEqual(resolveChannelKey("memes"), undefined);
    assertEqual(resolveChannelKey("skateboarding"), undefined);
    assertEqual(resolveChannelKey("skate"), undefined);
  });

  it("handles empty and missing input", () => {
    assertEqual(resolveChannelKey(null), undefined);
    assertEqual(resolveChannelKey(undefined), undefined);
    assertEqual(resolveChannelKey(""), undefined);
    assertEqual(resolveChannelKey("   "), undefined);
    assertEqual(resolveChannelKey("/"), undefined);
  });

  it("the default channel is itself allowed", () => {
    // Guards against the default drifting off the allowlist.
    assertEqual(
      resolveChannelKey(DEFAULT_FARCASTER_CHANNEL),
      DEFAULT_FARCASTER_CHANNEL
    );
  });
});

describe("limitCastEmbeds", () => {
  it("caps at the protocol limit of two", () => {
    assertEqual(MAX_CAST_EMBEDS, 2);
    assertDeepEqual(
      limitCastEmbeds(["https://a.test/1", "https://b.test/2", "https://c.test/3"]),
      ["https://a.test/1", "https://b.test/2"]
    );
  });

  it("preserves the caller's order", () => {
    assertDeepEqual(limitCastEmbeds(["https://b.test/", "https://a.test/"]), [
      "https://b.test/",
      "https://a.test/",
    ]);
  });

  it("collapses trailing-slash variants so one link never burns both slots", () => {
    assertDeepEqual(
      limitCastEmbeds(["https://skatehive.app/post/x", "https://skatehive.app/post/x/"]),
      ["https://skatehive.app/post/x"]
    );
  });

  it("keeps the root slash — those are the same URL, not different paths", () => {
    assertDeepEqual(limitCastEmbeds(["https://a.test", "https://a.test/"]), [
      "https://a.test",
    ]);
  });

  it("does not collapse different paths on the same host", () => {
    assertDeepEqual(limitCastEmbeds(["https://a.test/x", "https://a.test/y"]), [
      "https://a.test/x",
      "https://a.test/y",
    ]);
  });

  it("drops empties, nulls and whitespace-only entries", () => {
    assertDeepEqual(
      limitCastEmbeds(["", null, undefined, "   ", "https://a.test/x"]),
      ["https://a.test/x"]
    );
  });

  it("returns the URL the caller passed, not the normalized form", () => {
    // Normalization is for comparison only; the trailing slash can matter to
    // the crawler and to what the user sees.
    assertDeepEqual(limitCastEmbeds(["https://a.test/x/"]), ["https://a.test/x/"]);
  });

  it("trims surrounding whitespace off the returned URL", () => {
    assertDeepEqual(limitCastEmbeds(["  https://a.test/x  "]), ["https://a.test/x"]);
  });

  it("handles a non-URL string without throwing", () => {
    assertDeepEqual(limitCastEmbeds(["not a url", "not a url"]), ["not a url"]);
  });

  it("handles an empty list", () => {
    assertDeepEqual(limitCastEmbeds([]), []);
  });

  it("stops at two even when later entries are duplicates", () => {
    assertDeepEqual(
      limitCastEmbeds(["https://a.test/1", "https://a.test/1/", "https://b.test/2", "https://c.test/3"]),
      ["https://a.test/1", "https://b.test/2"]
    );
  });
});

describe("parseCastEmbeds", () => {
  it("keeps well-formed { url } entries in order", () => {
    assertDeepEqual(
      parseCastEmbeds([{ url: "https://a.test/1" }, { url: "https://b.test/2" }]),
      [{ url: "https://a.test/1" }, { url: "https://b.test/2" }]
    );
  });

  it("returns nothing for a body that has no embeds", () => {
    assertDeepEqual(parseCastEmbeds(undefined), []);
    assertDeepEqual(parseCastEmbeds(null), []);
    assertDeepEqual(parseCastEmbeds("https://a.test/1"), []);
    assertDeepEqual(parseCastEmbeds({ url: "https://a.test/1" }), []);
  });

  it("drops entries that are not an object with a string url", () => {
    // Includes the cast_id embed variant: we accept URL embeds only.
    assertDeepEqual(
      parseCastEmbeds([
        null,
        "https://a.test/bare-string",
        { url: 42 },
        { cast_id: { fid: 1, hash: "0xdead" } },
        { url: "https://a.test/ok" },
      ]),
      [{ url: "https://a.test/ok" }]
    );
  });

  it("applies the same cap and dedupe the composer applies", () => {
    assertDeepEqual(
      parseCastEmbeds([
        { url: "https://a.test/1" },
        { url: "https://a.test/1/" },
        { url: "https://b.test/2" },
        { url: "https://c.test/3" },
      ]),
      [{ url: "https://a.test/1" }, { url: "https://b.test/2" }]
    );
  });
});

(async () => {
  for (const test of tests) await test();
  if (hasFailures) {
    console.log("\n❌ Some tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All Farcaster channel tests completed!\n");
  }
})();
