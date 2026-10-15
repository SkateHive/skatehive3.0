/**
 * Unit tests for the location resolver.
 * Run with tsx: npx tsx lib/skaters/__tests__/geo.test.ts
 *
 * Every case below is a real `profile.location` string taken from a Skatehive
 * account, which is the point: the resolver only has to survive what people
 * actually write.
 */

import assert from "node:assert";
import { countryFromSlug, countrySlug, normalizeKey, resolveLocation } from "../geo";
import {
  AMBIGUOUS_ISO_CODES,
  COUNTRY_ALIASES,
  COUNTRY_CENTROIDS,
  ISO_ALIASES,
} from "../geoData";
import { ISO_TO_NAME } from "@/lib/utils/countryData";

const tests: Array<() => void> = [];
let hasFailures = false;

function it(name: string, fn: () => void) {
  tests.push(() => {
    try {
      fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      hasFailures = true;
      console.error(`  ❌ ${name}`);
      console.error(`     ${error}`);
    }
  });
}

console.log("\n📦 resolveLocation");

it("empty and whitespace locations resolve to nothing", () => {
  for (const input of ["", "   ", undefined, null]) {
    const result = resolveLocation(input as string);
    assert.strictEqual(result.country, null);
    assert.strictEqual(result.city, null);
    assert.strictEqual(result.nowhere, false);
  }
});

it("normalizes ISO codes, names and native spellings to one country", () => {
  const brazil = ["BR", "Brazil", "brazil", "BRAZIL", "Brasil", "sc, Brasil", "Brasil Sp"];
  for (const input of brazil) {
    assert.strictEqual(resolveLocation(input).country, "Brazil", input);
  }
  const venezuela = ["Venezuela", "venezuela", "VENEZUELA", "Vzla", "veneziela", "Venezuela."];
  for (const input of venezuela) {
    assert.strictEqual(resolveLocation(input).country, "Venezuela", input);
  }
});

it("this is the bug the old grouping had: a city is not a country", () => {
  // The previous implementation split on "," and called the last piece the
  // country, which produced countries named "Rio de Janeiro" and "Lagos".
  const rio = resolveLocation("Rio de Janeiro");
  assert.strictEqual(rio.country, "Brazil");
  assert.strictEqual(rio.city, "Rio de Janeiro");

  const lagos = resolveLocation("Lagos");
  assert.strictEqual(lagos.country, "Nigeria");
  assert.strictEqual(lagos.city, "Lagos");
});

it("reads city and country out of the separators people actually use", () => {
  const cases: Array<[string, string, string]> = [
    ["Caracas, Venezuela", "Caracas", "Venezuela"],
    ["Caracas - Venezuela", "Caracas", "Venezuela"],
    ["Caracas Venezuela", "Caracas", "Venezuela"],
    ["CUMANÁ-VENEZUELA", "Cumaná", "Venezuela"],
    ["sao paulo brazil", "São Paulo", "Brazil"],
    ["Rio de Janeiro, BR", "Rio de Janeiro", "Brazil"],
    ["Thessaloniki Greece", "Thessaloniki", "Greece"],
    ["Los Angeles, CA, USA", "Los Angeles", "United States"],
    ["Muizenberg,Cape Town, South Africa", "Cape Town", "South Africa"],
    ["Belo Horizonte, MG - Brazil", "Belo Horizonte", "Brazil"],
  ];
  for (const [input, city, country] of cases) {
    const result = resolveLocation(input);
    assert.strictEqual(result.city, city, input);
    assert.strictEqual(result.country, country, input);
    assert.ok(result.coords, `${input} should be mappable`);
  }
});

it("picks the longest city match, not the first", () => {
  // "Santa Cruz" is in Bolivia; "Santa Cruz do Sul" is in Brazil.
  assert.strictEqual(resolveLocation("Santa Cruz - Bolivia").city, "Santa Cruz");
  assert.strictEqual(resolveLocation("Santa Cruz - Bolivia").country, "Bolivia");
  assert.strictEqual(resolveLocation("Santa Cruz do Sul, RS - Brasil").country, "Brazil");
});

it("falls back to US states when no city is recognised", () => {
  for (const input of ["Nevada", "west virginia", "ColoRADo", "Arizona, USA", "FL"]) {
    assert.strictEqual(resolveLocation(input).country, "United States", input);
  }
});

it("does not let a two-letter word inside a phrase hijack the country", () => {
  // "in" is the ISO code for India — "In Peru" is Peru, not India.
  assert.strictEqual(resolveLocation("In Peru").country, "Peru");
  assert.strictEqual(resolveLocation("American in Korea").country, "South Korea");
});

it("buckets jokes and non-places instead of inventing a country", () => {
  for (const input of ["Moon", "Universe", "Metaverse", "Earth", "Mordor", "Everywhere", "Worldwide"]) {
    const result = resolveLocation(input);
    assert.strictEqual(result.country, null, input);
    assert.strictEqual(result.nowhere, true, input);
    assert.strictEqual(result.coords, null, input);
  }
});

it("keeps genuinely unreadable locations out of both buckets", () => {
  for (const input of ["A=432hz", "2048", "Jugirgofa"]) {
    const result = resolveLocation(input);
    assert.strictEqual(result.country, null, input);
    assert.strictEqual(result.nowhere, false, input);
    assert.strictEqual(result.label, input, input);
  }
});

it("ignores URLs pasted into the location field", () => {
  const result = resolveLocation("https://images.ecency.com/p/5Z");
  assert.strictEqual(result.country, null);
  assert.strictEqual(result.city, null);
});

it("strips emoji and accents before matching", () => {
  assert.strictEqual(resolveLocation("🇻🇪Venezuela🇻🇪").country, "Venezuela");
  assert.strictEqual(resolveLocation("Ghana 🇬🇭").country, "Ghana");
  assert.strictEqual(resolveLocation("México").country, "Mexico");
  assert.strictEqual(normalizeKey("São Paulo"), "sao paulo");
});

it("every resolved country carries coordinates we can pin", () => {
  for (const input of ["Brazil", "Nigeria", "Greece", "Lagos", "Nevada", "Caracas, Venezuela"]) {
    assert.ok(resolveLocation(input).coords, input);
  }
});

it("reads a US state code that is also an ISO country code as the state", () => {
  // Regression: findCountry used to take any 2-letter ISO match first, so
  // "Nashville, TN" resolved to Tunisia and "Sacramento, CA" to Canada.
  const cases: [string, string][] = [
    ["Sacramento, CA", "California"],
    ["Denver, CO", "Colorado"],
    ["Springfield, IL", "Illinois"],
    ["Nashville, TN", "Tennessee"],
    ["Worcester, MA", "Massachusetts"],
    ["Boise, ID", "Idaho"],
    ["Wilmington, DE", "Delaware"],
    ["Little Rock, AR", "Arkansas"],
    ["Brooklyn, NY", "New York"],
  ];
  for (const [input, state] of cases) {
    const place = resolveLocation(input);
    assert.strictEqual(place.country, "United States", input);
    assert.strictEqual(place.city, state, input);
  }
});

it("still reads a bare two-letter code that is not a US state as a country", () => {
  assert.strictEqual(resolveLocation("Ioannina, GR").country, "Greece");
  assert.strictEqual(resolveLocation("sp br").country, "Brazil");
  assert.strictEqual(resolveLocation("south west uk").country, "United Kingdom");
});

it("does not let a city outrank a country written in the same string", () => {
  // Lagos is in the city table as Nigeria, but this person said Portugal.
  assert.strictEqual(resolveLocation("Lagos, Portugal").country, "Portugal");
  assert.strictEqual(resolveLocation("Leon, Spain").country, "Spain");
  assert.strictEqual(resolveLocation("Vancouver, WA").country, "United States");
  assert.strictEqual(resolveLocation("Ontario, California").city, "California");
});

it("keeps the city when it agrees with the country in the string", () => {
  const place = resolveLocation("Sao Paulo, Brazil");
  assert.strictEqual(place.country, "Brazil");
  assert.strictEqual(place.city, "São Paulo");
});

it("does not call a real town a joke because a hint is a substring of it", () => {
  // "mars" in Marseille, "moon" in Moonachie, "asia" in Asiago, "earth" in
  // Earth City — all were bucketed as "somewhere out there".
  for (const input of ["Marseille", "Moonachie", "Asiago", "Marsala", "Marsden"]) {
    assert.strictEqual(resolveLocation(input).nowhere, false, input);
  }
  // The whole-word cases must still be caught.
  for (const input of ["Moon", "Mars", "the metaverse", "Earth"]) {
    assert.strictEqual(resolveLocation(input).nowhere, true, input);
  }
});

console.log("\n📦 country slugs");

it("round-trips a country through its slug", () => {
  for (const country of ["Brazil", "United States", "South Africa", "United Arab Emirates"]) {
    assert.strictEqual(countrySlug(country).includes(" "), false);
    assert.strictEqual(countryFromSlug(countrySlug(country)), country);
  }
});

it("returns null for a slug that is not a country", () => {
  assert.strictEqual(countryFromSlug("mordor"), null);
  assert.strictEqual(countryFromSlug(""), null);
});

it("reads a bare code from the profile editor as the country, not a US state", () => {
  // The country <Select> in EditProfile stores the ISO code alone, and 26 of its
  // options collide with a USPS state code. Before this, every one of them was
  // filed under the wrong flag on the wrong continent.
  const cases: [string, string][] = [
    ["CA", "Canada"],
    ["DE", "Germany"],
    ["IN", "India"],
    ["CO", "Colombia"],
    ["AR", "Argentina"],
    ["MA", "Morocco"],
    ["PA", "Panama"],
    ["ID", "Indonesia"],
    ["IL", "Israel"],
    ["LA", "Laos"],
    ["ME", "Montenegro"],
    ["MT", "Malta"],
    ["NE", "Niger"],
    ["SC", "Seychelles"],
    ["TN", "Tunisia"],
    ["VA", "Vatican City"],
  ];
  for (const [input, country] of cases) {
    const place = resolveLocation(input);
    assert.strictEqual(place.country, country, input);
    assert.ok(place.coords, input);
  }
});

it("keeps reading a bare US-only state code as the state", () => {
  // These are not ISO countries, so nothing above should have claimed them.
  for (const [input, state] of [["FL", "Florida"], ["TX", "Texas"], ["NY", "New York"]]) {
    const place = resolveLocation(input);
    assert.strictEqual(place.country, "United States", input);
    assert.strictEqual(place.city, state, input);
  }
});

it("resolves every country the profile editor can store", () => {
  // Regression: ISO_ALIASES was a hand-written subset, so 157 of the editor's
  // 249 options resolved to no country at all.
  for (const [code, name] of Object.entries(ISO_TO_NAME)) {
    const place = resolveLocation(code);
    assert.strictEqual(place.country, name, code);
    assert.ok(place.coords, `${code} has no centroid`);
    // The country pills link straight at this URL, so it has to resolve back.
    assert.strictEqual(countryFromSlug(countrySlug(name)), name, name);
  }
});

it("every country name we can resolve has a centroid to pin", () => {
  for (const name of Object.values(ISO_TO_NAME)) {
    assert.ok(COUNTRY_CENTROIDS[name], name);
  }
});

it("trusts a word-like code alone but not inside a phrase", () => {
  // "is" is Iceland and "la" is Laos, but "skate life is" is neither. A code
  // that is also a US state ("la", "pa") still reads as the state at the end of
  // a phrase, which is what makes "phoenix az" work — the rule being tested is
  // only that the phrase never comes back as the ISO country.
  for (const code of AMBIGUOUS_ISO_CODES) {
    const country = ISO_ALIASES[code];
    assert.strictEqual(resolveLocation(code).country, country, `bare ${code}`);
    // "us" is also in COUNTRY_ALIASES, where a trailing match is deliberate
    // ("skating in the us"), so the ISO guard is not what decides it.
    if (COUNTRY_ALIASES[code]) continue;
    assert.notStrictEqual(
      resolveLocation(`skate life ${code}`).country,
      country,
      `phrase ${code}`
    );
  }
});

(async () => {
  for (const run of tests) run();
  if (hasFailures) {
    console.error("\n❌ geo tests failed\n");
    process.exit(1);
  }
  console.log("\n✅ geo tests passed\n");
})();
