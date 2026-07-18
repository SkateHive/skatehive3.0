import assert from "assert";
import {
  addHoursIso,
  multiResolutionCriteria,
  participantsToOutcomes,
  sportsMoneyline,
} from "../createShapes";

// --- participantsToOutcomes ----------------------------------------------
{
  const { outcomes, outcomeLabels } = participantsToOutcomes(
    "Spain, France\nBrazil ,, Argentina\n"
  );
  assert.deepStrictEqual(outcomes, ["O1", "O2", "O3", "O4"], "codes O1..On, blanks dropped");
  assert.deepStrictEqual(outcomeLabels, {
    O1: "Spain",
    O2: "France",
    O3: "Brazil",
    O4: "Argentina",
  });
}

// --- multiResolutionCriteria ---------------------------------------------
assert.ok(
  multiResolutionCriteria(["Spain", "France"]).startsWith(
    "Resolve to the single official winner from this field: Spain, France."
  )
);

// --- addHoursIso ----------------------------------------------------------
assert.strictEqual(
  addHoursIso("2026-07-15T19:00:00.000Z", 4),
  "2026-07-15T23:00:00.000Z"
);

// --- sportsMoneyline ------------------------------------------------------
{
  const m = sportsMoneyline({
    id: "ced22494ae0bbb8cc4f7108bf6f493df",
    sportKey: "soccer_fifa_world_cup",
    homeTeam: "England",
    awayTeam: "Argentina",
    commenceTime: "2026-07-15T19:00:00.000Z",
  });
  assert.deepStrictEqual(m.outcomeLabels, {
    YES: "England wins",
    NO: "Argentina wins",
  });
  assert.strictEqual(
    m.resolutionSource,
    "oddsapi:soccer_fifa_world_cup:ced22494ae0bbb8cc4f7108bf6f493df"
  );
  assert.ok(m.resolutionCriteria.startsWith("moneyline:England|Argentina\n"));
  assert.strictEqual(m.bettingClosesAt, "2026-07-15T19:00:00.000Z");
  assert.strictEqual(m.resolvesAt, "2026-07-15T23:00:00.000Z");
}

console.log("✅ predictions/createShapes tests passed");
