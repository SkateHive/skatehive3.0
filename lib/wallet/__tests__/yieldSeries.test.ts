/**
 * Unit tests for the earnings-chart timelines.
 * Run with tsx: npx tsx lib/wallet/__tests__/yieldSeries.test.ts
 *
 * These pin what the chart claims: "earned" is value minus net principal,
 * withdrawals reduce principal (not earnings), the last point always trusts
 * the live/on-chain value, and a projection never runs below today's value.
 */

import { estimateSavingsInterest, parseHiveTime } from "../../hive/savingsInterest";
import { buildSavingsSeries, buildVaultSeries, downsample, project, summarizeYield, type YieldPoint } from "../yieldSeries";

const tests: Array<() => void> = [];
let hasFailures = false;
const it = (name: string, fn: () => void) =>
  tests.push(() => {
    try {
      fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.error(`  ❌ ${name}\n     ${error}`);
      hasFailures = true;
    }
  });
const near = (a: number, b: number, eps = 1e-6) => {
  if (Math.abs(a - b) > eps) throw new Error(`Expected ${b}, got ${a}`);
};
const ok = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

const DAY = 86_400;
const T0 = 1_790_000_000;

console.log("\n📦 buildVaultSeries");

it("values shares at the share price and ends on the live value", () => {
  const pts = buildVaultSeries(
    [{ t: T0, assets: 1, shares: 0.9 }],
    [{ t: T0 - DAY, price: 1.1 }, { t: T0 + DAY, price: 1.2 }],
    1.0805,
    T0 + 2 * DAY,
  );
  near(pts[0].value, 0.9 * 1.1);
  near(pts[0].invested, 1);
  near(pts[pts.length - 1].value, 1.0805);
});

it("a withdrawal lowers principal, not earnings", () => {
  const pts = buildVaultSeries(
    [{ t: T0, assets: 10, shares: 10 }, { t: T0 + DAY, assets: -4, shares: -4 }],
    [{ t: T0 - DAY, price: 1 }],
    null,
    T0 + 2 * DAY,
  );
  const s = summarizeYield(pts)!;
  near(s.invested, 6);
  near(s.value, 6);
  near(s.earned, 0);
});

it("no events → empty", () => {
  ok(buildVaultSeries([], [], 1, T0).length === 0, "expected no points");
});

console.log("\n📦 buildSavingsSeries");

it("interest raises value but not principal", () => {
  const pts = buildSavingsSeries(
    [
      { t: T0, kind: "deposit", amount: 100 },
      { t: T0 + 30 * DAY, kind: "interest", amount: 0.82 },
    ],
    100.82,
    0,
    0.1,
    T0 + 30 * DAY + 1,
  );
  const s = summarizeYield(pts)!;
  near(s.invested, 100);
  near(s.value, 100.82);
  near(s.earned, 0.82);
});

it("trusts the on-chain balance for the final point", () => {
  // History window can miss old deposits; the chain balance wins at "now".
  const pts = buildSavingsSeries([{ t: T0, kind: "deposit", amount: 5 }], 50, 0.1, 0.1, T0 + DAY);
  near(pts[pts.length - 1].value, 50.1);
});

it("accrues between payments instead of staying flat", () => {
  const pts = buildSavingsSeries([{ t: T0, kind: "deposit", amount: 365 }], 365, 0, 0.1, T0 + 10 * DAY);
  const mid = pts.find((p) => p.t > T0 && p.t < T0 + 10 * DAY)!;
  ok(mid.value > 365, "expected accrued value above principal");
});

it("accrues each segment at the balance it had (no back-dating deposits)", () => {
  // 100 HBD for 20 days, then 200 HBD: day 21 ≈ 100×20d + 200×1d of interest.
  const pts = buildSavingsSeries(
    [
      { t: T0, kind: "deposit", amount: 100 },
      { t: T0 + 20 * DAY, kind: "deposit", amount: 100 },
    ],
    200,
    0,
    0.1,
    T0 + 30 * DAY,
  );
  const day21 = pts.find((p) => p.t >= T0 + 21 * DAY && p.t < T0 + 22 * DAY)!;
  const expected = 200 + (100 * 0.1 * (20 * DAY)) / (365 * DAY) + (200 * 0.1 * (day21.t - (T0 + 20 * DAY))) / (365 * DAY);
  near(day21.value, expected, 1e-9);
});

it("balance only, no history → one point", () => {
  const pts = buildSavingsSeries([], 20, 0.5, 0.1, T0);
  ok(pts.length === 1, "expected one point");
  near(pts[0].value, 20.5);
});

console.log("\n📦 project / downsample");

it("projects 12 monthly points that only grow", () => {
  const base: YieldPoint[] = [{ t: T0, invested: 1, value: 1 }];
  const p = project(base, 0.05, 12);
  ok(p.length === 12, "expected 12 points");
  ok(p.every((x) => x.projected), "all projected");
  ok(p[11].value > p[0].value && p[0].value > 1, "monotonic growth");
  near(p[11].value, Math.pow(1.05, 360 / 365), 1e-9);
});

it("zero rate → no projection", () => {
  ok(project([{ t: T0, invested: 1, value: 1 }], 0).length === 0, "expected none");
});

it("downsample keeps both ends", () => {
  const pts = Array.from({ length: 500 }, (_, i) => ({ t: T0 + i * DAY, invested: 1, value: 1 + i }));
  const d = downsample(pts, 50);
  ok(d.length === 50, "expected 50");
  ok(d[0] === pts[0] && d[49] === pts[499], "ends kept");
});

console.log("\n📦 estimateSavingsInterest");

it("never-paid account (1970 timestamp) accrues only since its deposit", () => {
  // The bug: 0.103 HBD × 15% × 20,740 days showed 0.878 HBD "claimable".
  const now = parseHiveTime("2026-10-14T18:00:00")!;
  const est = estimateSavingsInterest(
    {
      savings_hbd_balance: "0.103 HBD",
      savings_hbd_seconds: "0",
      savings_hbd_seconds_last_update: "2026-10-14T17:00:00",
      savings_hbd_last_interest_payment: "1970-01-01T00:00:00",
    },
    0.1,
    now,
  );
  near(est.accrued, (0.103 * 3600 * 0.1) / (365 * DAY), 1e-12);
  ok(est.lastPayment === null, "1970 means never paid");
});

it("matches a real monthly payment (~30 days on 280 HBD at 10%)", () => {
  const now = parseHiveTime("2026-11-03T04:19:36")!;
  const est = estimateSavingsInterest(
    { savings_hbd_balance: "280.363 HBD", savings_hbd_seconds: "0", savings_hbd_seconds_last_update: "2026-10-04T04:19:36", savings_hbd_last_interest_payment: "2026-10-04T04:19:36" },
    0.1,
    now,
  );
  near(est.accrued, 2.304, 0.001);
  ok(est.daysUntilClaim === 0, "30 days passed → claimable");
});

it("counts stored hbd-seconds (milli-HBD × s)", () => {
  const now = parseHiveTime("2026-10-14T00:00:00")!;
  const est = estimateSavingsInterest(
    { savings_hbd_balance: "0", savings_hbd_seconds: String(1000 * 365 * DAY), savings_hbd_seconds_last_update: "2026-10-14T00:00:00", savings_hbd_last_interest_payment: "2026-10-01T00:00:00" },
    0.1,
    now,
  );
  near(est.accrued, 0.1);
  ok(est.daysUntilClaim === 17, `expected 17 days, got ${est.daysUntilClaim}`);
});

for (const run of tests) run();
if (hasFailures) {
  console.error("\n❌ Some tests failed");
  process.exit(1);
}
console.log("\n✅ All tests passed");
