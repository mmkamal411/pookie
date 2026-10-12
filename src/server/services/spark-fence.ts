// Study-skill fence, stage 1 (deterministic) — pure, dependency-free.
//
// FR-SCHOOL-004: Study Sparks carry study-skills content ONLY. This fence is
// the deterministic first stage; the LLM classifier is the second stage
// (future pipeline). Uncertain ⇒ BLOCKED (fail-closed). Blocked candidates
// are logged with reason codes for fence tuning.
export interface FenceVerdict {
  allowed: boolean;
  reason: string | null;
}

/** Allowlisted study-skill topics (the fence's allowlist). */
const ALLOWLIST_PATTERNS: ReadonlyArray<RegExp> = [
  /spaced repetition/i,
  /retrieval practice/i,
  /interleav\w+/i,
  /elaboration/i,
  /dual coding/i,
  /note[-\s]?taking/i,
  /time management/i,
  /plann\w+ (your|a) (week|day|study)/i,
  /exam[-\s]?day/i,
  /ask (your|a) teacher/i,
  /study (plan|schedule|routine|group)/i,
  /flashcards?/i,
  /practice test/i,
  /pomodoro/i,
  /active recall/i,
];

/** Denylisted content (the fence's denylist — conservative default). */
const DENYLIST: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  // Curriculum CONTENT claims belong to the verified quiz/formula pipeline.
  { pattern: /=|∫|∑|√|π|Δ|x²|formula/i, reason: "curriculum_content:formula" },
  { pattern: /\b\d{4}\b.*\b(war|treaty|election|president|king|empire)\b/i, reason: "curriculum_content:history-fact" },
  { pattern: /\b(mitosis|photosynthesis|newton|quadratic|theorem)\b/i, reason: "curriculum_content:science-fact" },
  // Health / medical / nutrition / body content — never in sparks.
  { pattern: /\b(calorie|diet|weight|bmi|supplement|vitamin|protein|workout|exercise|sleep \d|anxiety|depress\w*|therapy)\b/i, reason: "health_content" },
  // Relationships / social advice.
  { pattern: /\b(boyfriend|girlfriend|crush|dating|friendship drama|bully)\b/i, reason: "social_content" },
  // Named schools, teachers, students.
  { pattern: /\b(walton|high school|mr\.|mrs\.|ms\.|dr\.)\s+[A-Z][a-z]+/i, reason: "named_person_or_school" },
  // Current events.
  { pattern: /\b(election|senate|congress|president|governor|ballot)\b/i, reason: "current_events" },
];

/**
 * Stage-1 deterministic fence. Returns { allowed:false } for anything that is
 * not affirmatively a study-skills topic. Uncertain ⇒ blocked (fail-closed).
 */
export function fenceStudySpark(text: string): FenceVerdict {
  for (const { pattern, reason } of DENYLIST) {
    if (pattern.test(text)) return { allowed: false, reason };
  }
  const allowlisted = ALLOWLIST_PATTERNS.some((p) => p.test(text));
  if (!allowlisted) return { allowed: false, reason: "not_study_skill_confident" };
  return { allowed: true, reason: null };
}
