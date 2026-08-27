/**
 * Unit tests for the Farcaster cast payload builders.
 * Run with: npx tsx lib/crosspost/__tests__/snapCast.test.ts
 *
 * These were untested before the curation queue landed, and they matter more
 * now: the text and embeds they produce are FROZEN into the queue row at
 * request time and published verbatim days later. A truncation bug here is no
 * longer something the user sees immediately — it reaches Farcaster through a
 * curator who assumed the preview was accurate.
 */

import {
  buildSnapCastEmbeds,
  buildSnapCastText,
  planSnapCastEmbeds,
  CAST_MAX_BYTES,
} from "../snapCast";
import { castByteLength } from "@/lib/farcaster/castText";

// Simple test runner (same pattern as lib/utils/__tests__)
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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) throw new Error(message || "Expected condition to be true");
}

const SNAP_URL = "https://skatehive.app/post/skater/kickflip";

describe("buildSnapCastText", () => {
  it("appends the snap URL on its own line", () => {
    const text = buildSnapCastText("landed it first try", SNAP_URL);
    assertEqual(text, `landed it first try\n\n${SNAP_URL}`);
  });

  it("trims the body before building", () => {
    const text = buildSnapCastText("   spacey   ", SNAP_URL);
    assertEqual(text, `spacey\n\n${SNAP_URL}`);
  });

  it("returns just the body when there is no URL", () => {
    assertEqual(buildSnapCastText("no link here", null), "no link here");
  });

  it("never exceeds the cast limit, URL included", () => {
    const long = "x".repeat(CAST_MAX_BYTES * 2);
    const text = buildSnapCastText(long, SNAP_URL);
    assertTrue(
      castByteLength(text) <= CAST_MAX_BYTES,
      `expected <= ${CAST_MAX_BYTES} bytes, got ${castByteLength(text)}`
    );
    assertTrue(text.endsWith(SNAP_URL), "the URL must survive truncation");
    assertTrue(text.includes("…"), "truncation should be visible to the reader");
  });

  it("never exceeds the cast limit without a URL either", () => {
    const long = "y".repeat(CAST_MAX_BYTES * 2);
    const text = buildSnapCastText(long, null);
    assertTrue(
      castByteLength(text) <= CAST_MAX_BYTES,
      `got ${castByteLength(text)}`
    );
    assertTrue(text.endsWith("…"));
  });

  it("leaves a body that exactly fits alone", () => {
    const urlLine = `\n\n${SNAP_URL}`;
    const exact = "z".repeat(CAST_MAX_BYTES - castByteLength(urlLine));
    const text = buildSnapCastText(exact, SNAP_URL);
    assertEqual(castByteLength(text), CAST_MAX_BYTES);
    assertTrue(!text.includes("…"), "an exact fit must not be truncated");
  });
});

describe("buildSnapCastText — the limit is BYTES, not characters", () => {
  it("counts a Portuguese body at its real size", () => {
    // 1024 chars, 2048 bytes. Under the old `.length` check this passed
    // untouched and Farcaster refused it. Our community writes like this.
    const accented = "á".repeat(1024);
    assertEqual(accented.length, 1024, "precondition: 1024 JS characters");
    assertEqual(castByteLength(accented), 2048, "precondition: 2048 UTF-8 bytes");

    const text = buildSnapCastText(accented, SNAP_URL);
    assertTrue(
      castByteLength(text) <= CAST_MAX_BYTES,
      `expected <= ${CAST_MAX_BYTES} bytes, got ${castByteLength(text)}`
    );
    assertTrue(text.endsWith(SNAP_URL), "the URL must survive truncation");
    assertTrue(text.includes("…"), "truncation should be visible to the reader");
  });

  it("counts emoji at their real size too", () => {
    const boards = "🛹".repeat(512); // 1024 chars, 2048 bytes
    assertEqual(castByteLength(boards), 2048);
    const text = buildSnapCastText(boards, null);
    assertTrue(castByteLength(text) <= CAST_MAX_BYTES, `got ${castByteLength(text)}`);
  });

  it("never cuts a surrogate pair in half", () => {
    // Every offset around the budget: whatever lands on the cut point, the
    // output must still be well-formed UTF-16. A split pair survives
    // encode/decode as U+FFFD, so a round-trip catches it.
    for (let pad = 0; pad < 8; pad++) {
      const text = buildSnapCastText("a".repeat(pad) + "🛹".repeat(700), null);
      assertTrue(
        !text.includes("\uFFFD"),
        `pad=${pad}: output contains a replacement character`
      );
      const roundTripped = Buffer.from(text, "utf8").toString("utf8");
      assertEqual(roundTripped, text, `pad=${pad}: not round-trip safe`);
      assertTrue(
        castByteLength(text) <= CAST_MAX_BYTES,
        `pad=${pad}: ${castByteLength(text)} bytes`
      );
    }
  });

  it("never cuts a multi-codepoint emoji into its pieces", () => {
    // A ZWJ family is 5 code points / 25 bytes. Landing the cut inside one
    // would leave a stray person and a stray zero-width joiner in the cast.
    const family = "👨‍👩‍👧‍👦";
    assertEqual(castByteLength(family), 25, "precondition");
    for (let pad = 0; pad < 8; pad++) {
      const text = buildSnapCastText("a".repeat(pad) + family.repeat(60), null);
      assertTrue(!text.includes("\uFFFD"), `pad=${pad}: replacement character`);
      const body = text.replace(/…$/, "");
      const strays = body.replace(new RegExp(family, "g"), "").replace(/^a*/, "");
      assertEqual(strays, "", `pad=${pad}: left a partial emoji behind: ${JSON.stringify(strays)}`);
    }
  });

  it("keeps a body that exactly fills the byte budget intact", () => {
    const urlLine = `\n\n${SNAP_URL}`;
    const budget = CAST_MAX_BYTES - castByteLength(urlLine);
    // 2 bytes each, so half as many characters as bytes.
    const exact = "á".repeat(budget / 2);
    const text = buildSnapCastText(exact, SNAP_URL);
    assertEqual(castByteLength(text), CAST_MAX_BYTES);
    assertTrue(!text.includes("…"), "an exact fit must not be truncated");
  });

  it("ships the link when the URL alone eats the whole budget", () => {
    const monsterUrl = "https://skatehive.app/" + "x".repeat(CAST_MAX_BYTES);
    const text = buildSnapCastText("some body", monsterUrl);
    assertTrue(
      castByteLength(text) <= CAST_MAX_BYTES,
      `got ${castByteLength(text)}`
    );
  });
});

describe("buildSnapCastEmbeds", () => {
  it("embeds up to 2 images, in caption order", () => {
    const embeds = buildSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: ["https://img/1", "https://img/2", "https://img/3"],
      videoUrl: null,
    });
    assertEqual(embeds.length, 2, "Farcaster only renders two");
    assertEqual(embeds[0].url, "https://img/1");
    assertEqual(embeds[1].url, "https://img/2");
  });

  it("uses the free slot for the snap URL when there is only one image", () => {
    // BEHAVIOUR CHANGE. This used to assert `length === 1`: ranking by type
    // short-circuited on "has images" and threw the snap URL away, so a
    // one-image snap shipped with a spare slot and no link back to SkateHive.
    // Under the canonical rule (one ordered candidate list, capped at two) the
    // image keeps its slot and the link takes the one that was going spare.
    const embeds = buildSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: ["https://img/1"],
      videoUrl: null,
    });
    assertEqual(embeds.length, 2);
    assertEqual(embeds[0].url, "https://img/1", "the attachment keeps its slot");
    assertEqual(embeds[1].url, SNAP_URL, "the text URL takes the free one");
  });

  it("reports what the two-slot cap left behind instead of dropping it silently", () => {
    const plan = planSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: ["https://img/1", "https://img/2"],
      videoUrl: null,
    });
    assertEqual(plan.embeds.length, 2);
    assertEqual(plan.embeds[0].url, "https://img/1");
    assertEqual(plan.embeds[1].url, "https://img/2");
    // The snap URL is still in the cast TEXT — it just could not also be an
    // embed. The caller gets told rather than having to infer it.
    assertEqual(plan.dropped.length, 1);
    assertEqual(plan.dropped[0], SNAP_URL);
  });

  it("does not report a deduped twin as dropped", () => {
    // A trailing-slash variant of a kept URL was collapsed, not lost.
    const plan = planSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: [SNAP_URL + "/"],
      videoUrl: null,
    });
    assertEqual(plan.embeds.length, 1);
    assertEqual(plan.dropped.length, 0, "a dedupe is not a loss");
  });

  it("reports nothing dropped when everything fits", () => {
    const plan = planSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: [],
      videoUrl: null,
    });
    assertEqual(plan.embeds.length, 1);
    assertEqual(plan.dropped.length, 0);
  });

  it("uses the snap URL alone for a video, not the raw IPFS file", () => {
    const embeds = buildSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: [],
      videoUrl: "https://ipfs.skatehive.app/ipfs/bafyvideo",
    });
    assertEqual(embeds.length, 1);
    assertEqual(
      embeds[0].url,
      SNAP_URL,
      "an IPFS video URL renders as a broken card on Warpcast"
    );
  });

  it("falls back to the snap URL for a text-only snap", () => {
    const embeds = buildSnapCastEmbeds({ snapUrl: SNAP_URL, imageUrls: [], videoUrl: null });
    assertEqual(embeds.length, 1);
    assertEqual(embeds[0].url, SNAP_URL);
  });

  it("prefers images over video when a snap somehow has both", () => {
    const embeds = buildSnapCastEmbeds({
      snapUrl: SNAP_URL,
      imageUrls: ["https://img/1"],
      videoUrl: "https://ipfs.skatehive.app/ipfs/bafyvideo",
    });
    assertEqual(embeds[0].url, "https://img/1");
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some snapCast tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All snapCast tests completed!\n");
  }
})();
