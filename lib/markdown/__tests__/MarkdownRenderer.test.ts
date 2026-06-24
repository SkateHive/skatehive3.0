import { processMediaContent } from "../MarkdownRenderer";

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
});

Promise.all(tests.map((test) => test())).then(() => {
  if (hasFailures) {
    process.exit(1);
  }
});
