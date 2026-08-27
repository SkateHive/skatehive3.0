/**
 * Shape guard for POST /api/farcaster/signer
 * Run with tsx: npx tsx lib/farcaster/__tests__/signerResponseShape.test.ts
 *
 * WHAT THIS IS: a static assertion over the route's source — it parses the
 * file and checks that no response body mentions `signerUuid`.
 *
 * WHY IT IS NOT A RUNTIME TEST: the route builds its Supabase client at module
 * import time from env and every branch reaches the database, so exercising the
 * four responses for real means either a live production Supabase and a live
 * Neynar signer registration, or a mock harness larger than the change it
 * guards. The change is a response-shape change; the proportionate guard is on
 * the shape.
 *
 * The runtime half of the proof is `tsc --noEmit` over the repo: `signerUuid`
 * was removed from `SignerState`, so any consumer — including destructuring
 * with a rename — is a compile error, which grep alone could not establish.
 */

import { readFileSync } from "fs";
import { join } from "path";

// Simple test runner
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

const REPO_ROOT = join(__dirname, "..", "..", "..");

/** Source with comments removed, so prose about signerUuid can't false-positive. */
function sourceWithoutComments(relativePath: string): string {
  const raw = readFileSync(join(REPO_ROOT, relativePath), "utf8");
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every `NextResponse.json({ ... })` argument in the file, brace-matched. */
function responseBodies(source: string): string[] {
  const bodies: string[] = [];
  const marker = "NextResponse.json(";
  let index = source.indexOf(marker);

  while (index !== -1) {
    let depth = 0;
    let cursor = index + marker.length;
    const start = cursor;
    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "(" || char === "{" || char === "[") depth += 1;
      else if (char === ")" || char === "}" || char === "]") {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    bodies.push(source.slice(start, cursor));
    index = source.indexOf(marker, cursor);
  }

  return bodies;
}

describe("POST /api/farcaster/signer — response shape", () => {
  const source = sourceWithoutComments("app/api/farcaster/signer/route.ts");
  const bodies = responseBodies(source);

  it("still has every response site (guard against a silent parse failure)", () => {
    // 11 response sites, counted from the source rather than estimated:
    // 4 auth/config errors in getSessionUserId, 1 "no Farcaster identity",
    // 4 signer responses (approved-from-metadata, approved-after-poll,
    // pending_approval, freshly-registered) and 2 registration failures.
    // If this number changes, a response was added or removed — check the new
    // one by hand before updating it.
    assertEqual(bodies.length, 11, `parsed bodies: ${bodies.length}`);
  });

  it("no response body exposes signerUuid", () => {
    const offenders = bodies.filter((body) => body.includes("signerUuid"));
    assertEqual(
      offenders.length,
      0,
      `these responses still return signerUuid:\n${offenders.join("\n---\n")}`
    );
  });

  it("the route still reads signer_uuid server-side (it needs it for Neynar)", () => {
    // The point is to stop SENDING it, not to stop USING it: the route queries
    // Neynar for the signer's status with exactly this value.
    assertEqual(
      source.includes("metadata.signer_uuid"),
      true,
      "the route should still read signer_uuid from identity metadata"
    );
    assertEqual(
      source.includes("getSignerStatus(signerUuid)"),
      true,
      "the route should still poll Neynar with the signer uuid"
    );
  });
});

describe("GET /api/userbase/identities — metadata redaction is wired", () => {
  const source = sourceWithoutComments("app/api/userbase/identities/route.ts");

  it("returns redacted identity rows, not the raw select", () => {
    assertEqual(
      source.includes("redactIdentityRows(data || [])"),
      true,
      "identities must pass through redactIdentityRows before serialization"
    );
    assertEqual(
      /identities:\s*data\b/.test(source),
      false,
      "the raw `identities: data` shape must be gone"
    );
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All signer response shape tests completed!\n");
  }
})();
