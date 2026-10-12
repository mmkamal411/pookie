// Unit tests for the Path-to-90 forecast engine (forecast.v1.0).
//
// Run:  node --test src/server/services/forecast.test.ts
// (Node >= 22 type-strips the .ts; no build step, no test runner dependency.)
//
// Gate per sol-school-ai §1.3: golden fixtures (exact inputs → exact outputs
// to 0.01) + property tests (monotonicity, weight-sum invariant, idempotence).
// A version bump requires fixture regeneration review by the math expert.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_ENGINE_VERSION,
  computeForecast,
  hashForecastInputs,
  type ForecastInput,
} from "./forecast.ts";

const CITATIONS = [
  { input: "categories", source: "Gradebook sync Oct 12, 3:05 AM (StudentVUE)", takenAt: "2026-10-12T07:05:00Z" },
  { input: "weights", source: "Weights: from StudentVUE ✓ verified", takenAt: "2026-10-12T07:05:00Z" },
];

function geometryLike(): ForecastInput {
  // Geometry-ish: Tests 40%, Quizzes 25%, Homework 20%, Classwork 15%.
  return {
    categories: [
      { name: "Tests", earned: 165, possible: 300, weight: 0.4 },   // 55%
      { name: "Quizzes", earned: 74, possible: 200, weight: 0.25 },  // 37%
      { name: "Homework", earned: 160, possible: 200, weight: 0.2 },// 80%
      { name: "Classwork", earned: 90, possible: 150, weight: 0.15 },// 60%
    ],
    remaining: [
      { name: "Unit 4 Test", category: "Tests", maxPoints: 100 },
      { name: "Quiz 5", category: "Quizzes", maxPoints: 50 },
    ],
    citations: CITATIONS,
  };
}

test("golden fixture: required average and reachability", async () => {
  const r = await computeForecast(geometryLike());
  assert.equal(r.engineVersion, FORECAST_ENGINE_VERSION);
  // completed = .55*.4 + .37*.25 + .80*.2 + .60*.15 = .22+.0925+.16+.09 = .5625
  // remaining weight = 0 → wait: all categories have graded work, so remaining = 0 → final?
  // No — remainingWeight = 1 - 1.0 = 0 → "final" path. Hmm, that makes the
  // golden fixture trivial. Adjust: drop Homework graded work to simulate
  // mid-term.
  assert.equal(r.reachability, "final");
  assert.equal(r.requiredAvgOnRemaining, null);
});

test("golden fixture: mid-term with ungraded category", async () => {
  const input = geometryLike();
  input.categories = [
    { name: "Tests", earned: 165, possible: 300, weight: 0.4 },
    { name: "Quizzes", earned: 74, possible: 200, weight: 0.25 },
    { name: "Homework", earned: 0, possible: 0, weight: 0.2 }, // nothing graded yet
    { name: "Classwork", earned: 90, possible: 150, weight: 0.15 },
  ];
  const r = await computeForecast(input);
  // completed = .22 + .0925 + .09 = .4025 ; graded weight = .8 ; remaining = .2
  // required = (.90 - .4025)/.2 = 2.4875 → out of reach
  assert.equal(r.reachability, "out-of-reach");
  assert.ok((r.requiredAvgOnRemaining ?? 0) > 1);
  assert.deepEqual(r.excludedCategories, ["Homework"]);
});

test("golden fixture: reachable stretch case (exact numbers)", async () => {
  const input: ForecastInput = {
    categories: [
      { name: "Tests", earned: 270, possible: 300, weight: 0.5 },  // 90%
      { name: "Homework", earned: 0, possible: 0, weight: 0.5 },    // all to come
    ],
    remaining: [{ name: "HW 1-10", category: "Homework", maxPoints: 100 }],
    citations: CITATIONS,
  };
  const r = await computeForecast(input);
  // completed = .9*.5 = .45 ; remaining = .5 ; required = (.9-.45)/.5 = .9
  assert.equal(r.requiredAvgOnRemaining, 0.9);
  assert.equal(r.reachability, "on-track");
  // what-if: 100 on HW → Tests .45 + HW (.9... (0+100)/100=1.0)*.5 = .95
  const row = r.whatIf[0];
  assert.equal(row.assessment, "HW 1-10");
  assert.equal(row.projectedGradeAt.s100, 0.95);
  assert.equal(row.projectedGradeAt.s70, 0.8); // .45 + .7*.5
  assert.equal(r.topLevers.length, 1);
});

test("refuses invalid weights (fail-closed)", async () => {
  const input = geometryLike();
  input.categories[0].weight = 0.5; // sum = 1.1
  const r = await computeForecast(input);
  assert.ok(r.invalidReason?.startsWith("weights_sum_"));
  assert.equal(r.whatIf.length, 0);
});

test("refuses empty categories", async () => {
  const r = await computeForecast({ categories: [], remaining: [], citations: CITATIONS });
  assert.equal(r.invalidReason, "no_categories");
});

test("skips remaining items in unknown categories (never guesses weights)", async () => {
  const input = geometryLike();
  input.remaining = [{ name: "Mystery", category: "Nope", maxPoints: 50 }];
  // shrink graded weight so we are not in the "final" path
  input.categories[3] = { name: "Classwork", earned: 0, possible: 0, weight: 0.15 };
  const r = await computeForecast(input);
  assert.equal(r.whatIf.length, 0);
});

test("property: monotonicity — higher future scores ⇒ higher projected grade", async () => {
  const input: ForecastInput = {
    categories: [
      { name: "Tests", earned: 270, possible: 300, weight: 0.6 },
      { name: "HW", earned: 0, possible: 0, weight: 0.4 },
    ],
    remaining: [{ name: "Final", category: "Tests", maxPoints: 100 }],
    citations: CITATIONS,
  };
  const r = await computeForecast(input);
  const g = r.whatIf[0].projectedGradeAt;
  assert.ok(g.s70 < g.s80 && g.s80 < g.s90 && g.s90 < g.s100, "what-if must be monotone");
});

test("property: idempotence — same input ⇒ same hash and output", async () => {
  const a = geometryLike();
  const h1 = await hashForecastInputs(a);
  const h2 = await hashForecastInputs(JSON.parse(JSON.stringify(a)));
  assert.equal(h1, h2);
  const r1 = await computeForecast(a);
  const r2 = await computeForecast(a);
  assert.equal(r1.inputsHash, r2.inputsHash);
  assert.deepEqual(r1.whatIf, r2.whatIf);
});

test("property: hash distinguishes different inputs", async () => {
  const a = geometryLike();
  const b = geometryLike();
  b.categories[0].earned = 166;
  assert.notEqual(await hashForecastInputs(a), await hashForecastInputs(b));
});

test("assumed remaining weight path (no known remaining items)", async () => {
  const input: ForecastInput = {
    categories: [
      { name: "Tests", earned: 80, possible: 100, weight: 0.8 },
      { name: "Projects", earned: 0, possible: 0, weight: 0.2 },
    ],
    remaining: [],
    assumedRemainingWeight: 0.2,
    citations: CITATIONS,
  };
  const r = await computeForecast(input);
  // completed = .64 ; required = (.9-.64)/.2 = 1.3 → out-of-reach
  assert.equal(r.reachability, "out-of-reach");
});
