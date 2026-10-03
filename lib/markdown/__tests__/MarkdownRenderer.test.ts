import {
  mentionIsInsideMarkup,
  processMediaContent,
  promoteSafeAnchors,
} from "../MarkdownRenderer";

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

function assertIncludes(actual: string, expected: string, message?: string) {
  if (!actual.includes(expected)) {
    throw new Error(message || `Expected "${actual}" to include "${expected}"`);
  }
}

function assertNotIncludes(actual: string, expected: string, message?: string) {
  if (actual.includes(expected)) {
    throw new Error(message || `Expected "${actual}" not to include "${expected}"`);
  }
}

describe("processMediaContent YouTube autoembed", () => {
  it("converts standalone YouTube watch URLs", () => {
    const result = processMediaContent("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    assertIncludes(result, "[[YOUTUBE:dQw4w9WgXcQ]]");
  });

  it("converts markdown links that point to YouTube", () => {
    const result = processMediaContent("[watch this](https://youtu.be/dQw4w9WgXcQ)");

    assertIncludes(result, "[[YOUTUBE:dQw4w9WgXcQ]]");
    assertNotIncludes(result, "[watch this]");
  });

  it("converts formatted standalone YouTube links", () => {
    const result = processMediaContent("**https://youtu.be/dQw4w9WgXcQ**");

    assertIncludes(result, "[[YOUTUBE:dQw4w9WgXcQ]]");
  });

  it("converts formatted YouTube links with underscore IDs", () => {
    const result = processMediaContent("__https://youtu.be/dQw4w9W_XcQ__");

    assertIncludes(result, "[[YOUTUBE:dQw4w9W_XcQ]]");
  });

  it("converts watch URLs with query params before the video ID", () => {
    const result = processMediaContent(
      "*https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ*"
    );

    assertIncludes(result, "[[YOUTUBE:dQw4w9WgXcQ]]");
  });

  it("preserves quote and list prefixes around autoembedded links", () => {
    const result = processMediaContent("> - https://youtu.be/dQw4w9WgXcQ");

    assertIncludes(result, "> - [[YOUTUBE:dQw4w9WgXcQ]]");
  });

  it("keeps shorts tagged for vertical rendering", () => {
    const result = processMediaContent("https://www.youtube.com/shorts/dQw4w9WgXcQ");

    assertIncludes(result, "[[YOUTUBE:s:dQw4w9WgXcQ]]");
  });

  it("keeps markdown-linked shorts tagged for vertical rendering", () => {
    const result = processMediaContent(
      "[short](https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share)"
    );

    assertIncludes(result, "[[YOUTUBE:s:dQw4w9WgXcQ]]");
    assertNotIncludes(result, "[short]");
  });
});

describe("curated-by HTML anchors", () => {
  it("turns a safe profile anchor into a markdown link", () => {
    const input =
      '<center><b>Curated by <a href="/@brumest">brumest</a></b></center>';
    const result = promoteSafeAnchors(input);

    assertIncludes(result, "[brumest](/@brumest)");
    assertNotIncludes(result, "<a");
    assertNotIncludes(result, "href=");
  });

  it("strips javascript anchors down to their text", () => {
    const result = promoteSafeAnchors('<a href="javascript:alert(1)">click</a>');

    assertIncludes(result, "click");
    assertNotIncludes(result, "javascript:");
    assertNotIncludes(result, "<a");
  });

  it("does not rewrite @mentions that are already inside a link target", () => {
    const href = 'Curated by <a href="/@brumest">brumest</a>';
    const at = href.indexOf("@brumest");
    if (!mentionIsInsideMarkup(href, at)) {
      throw new Error("expected the href mention to be left alone");
    }

    const plain = "thanks @brumest";
    const plainAt = plain.indexOf("@brumest");
    if (mentionIsInsideMarkup(plain, plainAt)) {
      throw new Error("expected a plain mention to stay rewritable");
    }
  });

  it("keeps the curated-by anchor out of processMediaContent as a raw tag", () => {
    const result = processMediaContent(
      '<b>Curated by <a href="/@brumest">brumest</a></b>'
    );

    assertIncludes(result, "[brumest](/@brumest)");
    assertNotIncludes(result, "<a href");
  });
});

Promise.all(tests.map((test) => test())).then(() => {
  if (hasFailures) {
    process.exit(1);
  }
});
