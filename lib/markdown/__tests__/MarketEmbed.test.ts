import assert from "assert";
import { MarkdownProcessor } from "@/lib/markdown/MarkdownProcessor";

// Shared prediction-market links must become [[PREDICTIONMARKET:id]] tokens so
// the feed renders them as embedded market cards (MarketPreview).

const body = [
  "Check my bet! 🎯",
  "https://skatehive.app/prediction-markets/0e10e215-d97e-4de8-a9e1-b3833649a47c",
  "https://hivepredict.app/markets/fdd92ff4-e28e-4e2e-9963-5a24e2aafed7",
  "http://localhost:3000/prediction-markets/auto-nrl-1ae0cf6c922a22a04066dcb480951336",
].join("\n");

const out = MarkdownProcessor.process(body);
const tokens = out.videoPlaceholders
  .filter((p) => p.type === "PREDICTIONMARKET")
  .map((p) => p.id);

assert.deepStrictEqual(
  tokens,
  [
    "0e10e215-d97e-4de8-a9e1-b3833649a47c",
    "fdd92ff4-e28e-4e2e-9963-5a24e2aafed7",
    "auto-nrl-1ae0cf6c922a22a04066dcb480951336",
  ],
  "internal, hivepredict, and localhost market links all tokenize"
);
assert.ok(
  !out.contentWithPlaceholders.includes("prediction-markets/0e10e215"),
  "raw internal URL replaced by token"
);

// Unrelated links must be left alone.
const untouched = MarkdownProcessor.process(
  "see https://skatehive.app/bounties and https://hivepredict.app/leaderboard"
);
assert.strictEqual(
  untouched.videoPlaceholders.filter((p) => p.type === "PREDICTIONMARKET").length,
  0,
  "non-market links are not tokenized"
);

console.log("✅ markdown/MarketEmbed tests passed");
