/**
 * Unit tests for resolveSiweConfig
 * Run with tsx: npx tsx lib/farcaster/__tests__/siweConfig.test.ts
 *
 * These cover the environment matrix behind issue #94: the old config
 * hardcoded skatehive.app for everything except the literal hostname
 * "localhost", so SIWE rejected the signature anywhere else. Those
 * environments (a LAN IP, a preview deployment) cannot be reproduced by hand
 * on a dev machine, which is exactly why they are pinned here.
 */

import { resolveSiweConfig } from "../siweConfig";

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

const FALLBACK = {
  origin: "https://skatehive.app",
  domain: "skatehive.app",
};

/** Stand-in for window.location — only origin and host are read. */
function locationOf(url: string) {
  const parsed = new URL(url);
  return { origin: parsed.origin, host: parsed.host };
}

describe("resolveSiweConfig — production", () => {
  it("uses the served origin and bare host on the apex domain", () => {
    const config = resolveSiweConfig(
      locationOf("https://skatehive.app/settings"),
      FALLBACK
    );
    assertEqual(config.siweUri, "https://skatehive.app");
    assertEqual(config.domain, "skatehive.app");
  });

  it("keeps the www subdomain instead of collapsing it to the apex", () => {
    // Signing "skatehive.app" while served from www is a domain mismatch.
    const config = resolveSiweConfig(
      locationOf("https://www.skatehive.app/"),
      FALLBACK
    );
    assertEqual(config.siweUri, "https://www.skatehive.app");
    assertEqual(config.domain, "www.skatehive.app");
  });

  it("omits the port when it is the scheme default", () => {
    const config = resolveSiweConfig(
      locationOf("https://skatehive.app:443/"),
      FALLBACK
    );
    assertEqual(config.domain, "skatehive.app");
  });
});

describe("resolveSiweConfig — environments the old config broke", () => {
  it("uses the preview deployment's own domain, not skatehive.app", () => {
    const config = resolveSiweConfig(
      locationOf("https://skatehive-git-fix-farcaster.vercel.app/"),
      FALLBACK
    );
    assertEqual(config.siweUri, "https://skatehive-git-fix-farcaster.vercel.app");
    assertEqual(config.domain, "skatehive-git-fix-farcaster.vercel.app");
  });

  it("uses a LAN IP when a phone reaches the dev server over the network", () => {
    const config = resolveSiweConfig(
      locationOf("http://192.168.1.42:3000/"),
      FALLBACK
    );
    assertEqual(config.siweUri, "http://192.168.1.42:3000");
    assertEqual(config.domain, "192.168.1.42:3000");
  });

  it("treats 127.0.0.1 as its own origin rather than production", () => {
    const config = resolveSiweConfig(
      locationOf("http://127.0.0.1:3000/"),
      FALLBACK
    );
    assertEqual(config.siweUri, "http://127.0.0.1:3000");
    assertEqual(config.domain, "127.0.0.1:3000");
  });

  it("never falls back to the hardcoded domain while a location exists", () => {
    for (const url of [
      "http://127.0.0.1:3000/",
      "http://192.168.1.42:3000/",
      "https://skatehive-git-fix-farcaster.vercel.app/",
      "http://localhost:3111/",
    ]) {
      const config = resolveSiweConfig(locationOf(url), FALLBACK);
      if (config.domain === FALLBACK.domain) {
        throw new Error(`${url} wrongly resolved to the fallback domain`);
      }
    }
  });
});

describe("resolveSiweConfig — localhost", () => {
  it("includes the dev port in the domain", () => {
    // The SIWE authority carries a non-default port; the message and the
    // serving origin have to agree on it.
    const config = resolveSiweConfig(
      locationOf("http://localhost:3000/"),
      FALLBACK
    );
    assertEqual(config.siweUri, "http://localhost:3000");
    assertEqual(config.domain, "localhost:3000");
  });

  it("tracks a non-default dev port", () => {
    const config = resolveSiweConfig(
      locationOf("http://localhost:3111/"),
      FALLBACK
    );
    assertEqual(config.domain, "localhost:3111");
  });
});

describe("resolveSiweConfig — no browser location", () => {
  it("falls back to app config when location is null", () => {
    const config = resolveSiweConfig(null, FALLBACK);
    assertEqual(config.siweUri, FALLBACK.origin);
    assertEqual(config.domain, FALLBACK.domain);
  });

  it("falls back when location is undefined", () => {
    const config = resolveSiweConfig(undefined, FALLBACK);
    assertEqual(config.domain, FALLBACK.domain);
  });

  it("falls back when location is present but empty", () => {
    // jsdom and some test shims hand back a location with blank fields.
    const config = resolveSiweConfig({ origin: "", host: "" }, FALLBACK);
    assertEqual(config.siweUri, FALLBACK.origin);
    assertEqual(config.domain, FALLBACK.domain);
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
    console.log("\n✨ All SIWE config tests completed!\n");
  }
})();
