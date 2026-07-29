/**
 * Unit tests for localizing a cross-post notification.
 * Run with: npx tsx lib/notifications/__tests__/localizeNotification.test.ts
 *
 * The notification's title/body are written server-side in English and stored
 * as plain text, so they can't follow the reader's language. `localize()`
 * rebuilds the copy from the row's `type` + `metadata` instead, keeping the
 * stored text as a fallback.
 *
 * The fallback detection is the fragile part: a missing key resolves to the key
 * PATH (see LocaleContext.getNestedValue), so the only way to tell "translated"
 * from "missing" is comparing against that path. Get it wrong and the UI
 * silently renders "notificationsPage.crosspost.approvedTitleInstagram" to
 * users. These tests pin that down.
 */

import {
  CROSSPOST_NOTIF_NS,
  localizeCrossPostNotification as localize,
} from "../localizeCrossPost";
import type { AppNotification } from "../../../contexts/NotificationContext";

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

/** Stand-in for a locale that HAS the keys. */
const translated = (key: string) => `[${key}]`;

/** Stand-in for a locale missing every key — mirrors LocaleContext, which
 *  returns the full key path when a lookup fails. */
const untranslated = (key: string) => `${CROSSPOST_NOTIF_NS}.${key}`;

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    type: "crosspost_approved",
    title: "Your snap is live on Instagram 🎉",
    body: "The curation team approved your cross-post to @skatehive.",
    link: null,
    metadata: { target: "instagram", queue_id: "q1" },
    read_at: null,
    created_at: "2026-07-28T10:00:00Z",
    ...overrides,
  };
}

describe("platform selection", () => {
  it("uses the Instagram keys when metadata.target is instagram", () => {
    const { title, body } = localize(notification(), translated);
    assertEqual(title, "[approvedTitleInstagram]");
    assertEqual(body, "[approvedBodyInstagram]");
  });

  it("uses the Farcaster keys when metadata.target is farcaster", () => {
    const { title } = localize(
      notification({ metadata: { target: "farcaster" } }),
      translated
    );
    assertEqual(title, "[approvedTitleFarcaster]");
  });

  it("defaults to Instagram when metadata has no target", () => {
    const { title } = localize(notification({ metadata: {} }), translated);
    assertEqual(
      title,
      "[approvedTitleInstagram]",
      "Instagram is the main case — an unknown target shouldn't render blank"
    );
  });
});

describe("rejection copy", () => {
  it("quotes the curator's note when there is one", () => {
    const { body } = localize(
      notification({
        type: "crosspost_rejected",
        metadata: { target: "instagram", note: "clip is too dark" },
      }),
      translated
    );
    assertTrue(
      (body || "").includes("clip is too dark"),
      "the author needs to see WHY it was passed on"
    );
    assertTrue(
      (body || "").includes("[rejectedNoteLabel]"),
      "only the label around the note is localizable"
    );
  });

  it("uses the neutral line when no note was given", () => {
    const { body } = localize(
      notification({ type: "crosspost_rejected", metadata: { target: "instagram" } }),
      translated
    );
    assertEqual(body, "[rejectedBodyNoNote]");
    assertTrue(
      !(body || "").includes('"'),
      "must not imply a reason the curator never gave"
    );
  });
});

describe("failed publishes", () => {
  it("localizes the title but keeps the platform's raw error as the body", () => {
    const stored = "The author's Farcaster signer is no longer approved";
    const { title, body } = localize(
      notification({
        type: "crosspost_failed",
        body: stored,
        metadata: { target: "farcaster" },
      }),
      translated
    );
    assertEqual(title, "[failedTitleFarcaster]");
    assertEqual(body, stored, "a paraphrased platform error is less useful than the real one");
  });
});

describe("fallback when the locale is missing the keys", () => {
  it("falls back to the stored English title and body", () => {
    const n = notification();
    const { title, body } = localize(n, untranslated);
    assertEqual(title, n.title, "must never render the raw key path");
    assertEqual(body, n.body);
  });

  it("falls back on a rejection without a note", () => {
    const n = notification({
      type: "crosspost_rejected",
      title: "stored title",
      body: "stored body",
      metadata: { target: "instagram" },
    });
    const { title, body } = localize(n, untranslated);
    assertEqual(title, "stored title");
    assertEqual(body, "stored body");
  });

  it("still shows the curator's note even with no translations", () => {
    const { body } = localize(
      notification({
        type: "crosspost_rejected",
        metadata: { target: "instagram", note: "muito escuro" },
      }),
      untranslated
    );
    assertTrue(
      (body || "").includes("muito escuro"),
      "the reason matters more than the label around it"
    );
    assertTrue(
      !(body || "").includes(CROSSPOST_NOTIF_NS),
      "the unresolved label key must not leak into the UI"
    );
  });

  it("passes an unknown notification type straight through", () => {
    const n = notification({ type: "something_new", title: "T", body: "B" });
    const { title, body } = localize(n, translated);
    assertEqual(title, "T");
    assertEqual(body, "B");
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some notification localization tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All notification localization tests completed!\n");
  }
})();
