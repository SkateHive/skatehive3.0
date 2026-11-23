import { mediaMimeType, mediaKind, withMediaType } from "../mediaType";

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

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

describe("mediaMimeType", () => {
  it("keeps the type the browser reported", () => {
    assertEqual(mediaMimeType({ name: "clip.mov", type: "video/mp4" }), "video/mp4");
  });
  it("infers an iPhone .MOV with an empty type", () => {
    assertEqual(mediaMimeType({ name: "IMG_0001.MOV", type: "" }), "video/quicktime");
  });
  it("infers from the extension when the type is application/octet-stream", () => {
    assertEqual(mediaMimeType({ name: "line.mp4", type: "application/octet-stream" }), "video/mp4");
  });
  it("reads only the last extension", () => {
    assertEqual(mediaMimeType({ name: "my.trick.final.webm", type: "" }), "video/webm");
  });
  it("leaves unknown files as they came", () => {
    assertEqual(mediaMimeType({ name: "notes.txt", type: "" }), "");
    assertEqual(mediaMimeType({ name: "noextension", type: "" }), "");
  });
});

describe("mediaKind", () => {
  it("classifies videos, images and the rest", () => {
    assertEqual(mediaKind({ name: "a.MOV", type: "" }), "video");
    assertEqual(mediaKind({ name: "a.jpg", type: "image/jpeg" }), "image");
    assertEqual(mediaKind({ name: "a.pdf", type: "application/pdf" }), null);
  });
});

describe("withMediaType", () => {
  it("re-wraps a file with an empty type, keeping name and bytes", async () => {
    const original = new File([new Uint8Array([1, 2, 3])], "IMG_0001.MOV", { type: "" });
    const fixed = withMediaType(original);
    assertEqual(fixed.type, "video/quicktime");
    assertEqual(fixed.name, "IMG_0001.MOV");
    assertEqual(fixed.size, 3);
  });
  it("returns the same file when the type is already set", () => {
    const original = new File(["x"], "a.mp4", { type: "video/mp4" });
    assertEqual(withMediaType(original), original);
  });
});

(async () => {
  for (const test of tests) await test();
  if (hasFailures) process.exit(1);
  console.log("\nAll mediaType tests passed");
})();
