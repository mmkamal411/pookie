// Unit tests for school-track enforcement primitives.
// Run: node --test src/server/services/school-track.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  redactNonLinkedStudents,
  tagSafetyCritical,
  stripBlockedForParent,
  findBlockedFields,
  buildParentBriefingProjection,
} from "./provenance.ts";
import { fenceStudySpark } from "./spark-fence.ts";
import { auditGraduation } from "./graduation-audit.ts";
import { detectCrisisLanguage } from "./crisis.ts";

const LINKED = [
  { firstName: "Dawson", lastName: "Kamal", emails: ["mehedi@example.com"] },
];

test("redaction: non-linked student names are redacted (fail-closed)", () => {
  const { redacted, redactionCount } = redactNonLinkedStudents(
    "Hi Mr. Smith, Dawson Kamal and Jayden Rivera were both absent. Please email jayden.mom@example.com.",
    LINKED,
  );
  assert.ok(redacted.includes("Dawson Kamal"), "linked student name stays");
  assert.ok(redacted.includes("[student name redacted]"), "non-linked name redacted");
  assert.ok(redacted.includes("[redacted]"), "non-linked email redacted");
  assert.ok(!redacted.includes("Jayden Rivera"), "no leak of non-linked name");
  assert.ok(!redacted.includes("jayden.mom@example.com"), "no leak of non-linked email");
  assert.ok(redactionCount >= 3);
});

test("redaction: linked parent emails in CC are preserved", () => {
  const { redacted, toAddrs, ccAddrs } = redactNonLinkedStudents("Hi", LINKED, {
    toAddrs: ["teacher@school.org"],
    ccAddrs: ["mehedi@example.com", "stranger@example.com"],
  });
  assert.deepEqual(toAddrs, ["[redacted]"], "unknown teacher addr redacted fail-closed");
  assert.deepEqual(ccAddrs, ["mehedi@example.com", "[redacted]"]);
  assert.equal(redacted, "Hi");
});

test("safety tagger: keywords tag, benign text does not", () => {
  const hit = tagSafetyCritical("Field trip", "There was an injury on the bus, student taken to hospital.");
  assert.equal(hit.safetyCritical, true);
  assert.ok(hit.reason);

  const lockdown = tagSafetyCritical(null, "The school is in lockdown until further notice.");
  assert.equal(lockdown.safetyCritical, true);

  const benign = tagSafetyCritical("Homework", "Please complete chapter 4 by Friday.");
  assert.equal(benign.safetyCritical, false);
  assert.equal(benign.reason, null);
});

test("parent blocklist: stripBlockedForParent removes text/body/question", () => {
  const out = stripBlockedForParent({ id: "1", mood: 3, text: "private", checkin_date: "2026-10-12" });
  assert.equal(out.mood, 3);
  assert.ok(!("text" in (out as Record<string, unknown>)));
});

test("parent blocklist: calibration fields throw loudly", () => {
  assert.throws(
    () => stripBlockedForParent({ id: "1", calibration: 0.8, mean_error: 12 } as never),
    /parent_blocklist_violation/,
  );
});

test("parent blocklist: findBlockedFields detects leaks in nested payloads", () => {
  const payload = {
    briefing: {
      grades: [{ className: "Math", numeric: 85 }],
      calibration: { mean_error: 5, calibration: 0.95 },
    },
  };
  const found = findBlockedFields(payload);
  assert.ok(found.some((f) => f.includes("calibration")));
});

test("parent briefing projection: only allowlisted fields survive", () => {
  const proj = buildParentBriefingProjection({
    grades: [{ className: "Math", numeric: 85, delta7d: 2, term: "GP2" }],
    dueNext: [{ className: "Math", title: "HW 5", dueDate: null, status: "upcoming" }],
    checkinStreakDays: 4,
    checkinMoodAvg7d: 3.5,
    missingCount: 1,
    safetyAlerts: [],
  });
  assert.equal(proj.checkinStreakDays, 4);
  assert.equal(proj.checkinMoodAvg7d, 3.5);
  assert.ok(!("checkinText" in proj));
  assert.ok(proj.generatedAt);
});

test("spark fence: study-skills content passes", () => {
  const v = fenceStudySpark("Try spaced repetition: review your flashcards 10 minutes a day for a week.");
  assert.equal(v.allowed, true);
});

test("spark fence: health content blocked", () => {
  const v = fenceStudySpark("Track your calories and cut carbs to lose weight before the test.");
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "health_content");
});

test("spark fence: curriculum facts blocked (belong to verified pipeline)", () => {
  const v = fenceStudySpark("Remember the quadratic formula: x = (-b ± √(b²-4ac)) / 2a.");
  assert.equal(v.allowed, false);
});

test("spark fence: uncertain content blocked (fail-closed)", () => {
  const v = fenceStudySpark("You got this! Believe in yourself today.");
  assert.equal(v.allowed, false);
  assert.equal(v.reason, "not_study_skill_confident");
});

test("spark fence: named teachers blocked", () => {
  const v = fenceStudySpark("Ask Mr. Smith about spaced repetition after class.");
  assert.equal(v.allowed, false);
});

test("graduation audit: deterministic bucketing and shortfall flags", () => {
  const rules = [
    { subject: "ELA", required: 4 },
    { subject: "Math", required: 4 },
    { subject: "Science", required: 4 },
    { subject: "Social Studies", required: 3 },
    { subject: "Health/PE", required: 1 },
    { subject: "CTAE/FineArts/WorldLang", required: 3 },
    { subject: "Electives", required: 4 },
  ];
  const audit = auditGraduation(rules, "ga-2026.1", [
    { id: "1", course_name: "Algebra II", subject_area: null, credits_earned: 1, in_progress: false, counts_toward: null },
    { id: "2", course_name: "Geometry", subject_area: null, credits_earned: 1, in_progress: true, counts_toward: null },
    { id: "3", course_name: "Underwater Basket Weaving", subject_area: null, credits_earned: 1, in_progress: false, counts_toward: null },
  ]);
  const math = audit.buckets.find((b) => b.subject === "Math")!;
  assert.equal(math.earned, 1);
  assert.equal(math.inProgress, 1);
  assert.equal(math.remaining, 2);
  assert.equal(math.pace, "behind-pace");
  assert.equal(audit.requirementsVersion, "ga-2026.1");
  assert.equal(audit.onTrack, false);
  // "Underwater Basket Weaving" → Electives at low confidence → confirm queue
  assert.ok(audit.confirmQueue.some((q) => q.courseName === "Underwater Basket Weaving"));
});

test("crisis detection: self-harm language detected, benign text clean", () => {
  assert.equal(detectCrisisLanguage("I want to kill myself tonight"), "self_harm_plan");
  assert.equal(detectCrisisLanguage("Someone is hurting me at home"), "abuse_disclosure");
  assert.equal(detectCrisisLanguage("I have a math test tomorrow, wish me luck"), null);
});
