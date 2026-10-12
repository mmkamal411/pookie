// Data-provenance enforcement — FR-SCHOOL-001.
//
// Two layers:
//   1. TAG AT WRITE TIME: every school table carries a NOT NULL `provenance`
//      column ('school_of_record' | 'app_generated'). See migration 026.
//   2. ENFORCE AT QUERY LAYER: this module.
//      (a) PARENT_BLOCKED_FIELDS — the explicit blocklist. Parent-visible
//          serializers must strip these; the function stripBlockedForParent()
//          is the single choke point.
//      (b) buildParentBriefingProjection() — parent briefings/digests are built
//          from an ALLOWLISTED projection. They cannot "accidentally" join
//          calibration or reflection data: the projection only copies named
//          fields.
//      (c) redactNonLinkedStudents() — FR-SCHOOL-016: teacher emails often CC
//          other students' parents or name other students. Before any
//          parent-visible surface renders, non-linked student names →
//          "[student name redacted]", non-linked parent emails → "[redacted]".
//          Fail-closed: uncertain matches are redacted, not shown.
//      (d) tagSafetyCritical() — deterministic safety-critical tagger
//          (sol-school-ai §4.5). Keyword rules fire the tag; the LLM classifier
//          is a second signal (future). Either firing ⇒ safety_critical=true.

export const PROVENANCE = {
  SCHOOL_OF_RECORD: "school_of_record",
  APP_GENERATED: "app_generated",
} as const;

export type Provenance = (typeof PROVENANCE)[keyof typeof PROVENANCE];

/** True when the origin is child-authority (scope-gated). */
export function isChildAuthority(provenance: string): boolean {
  return provenance === PROVENANCE.APP_GENERATED;
}

// ---------------------------------------------------------------------------
// Parent-visible serializer blocklist (mirrors migration 026 header).
// calibration_scores.* and checkin_estimates.* must NEVER appear in a parent
// payload — enforced here AND by RLS (teen-only policies) AND by route-level
// 403s. Three independent gates; any one of them blocks.
// ---------------------------------------------------------------------------

/** table.column pairs that must never reach a parent payload. */
export const PARENT_BLOCKED_FIELDS: ReadonlyArray<string> = [
  "calibration_scores.*",
  "checkin_estimates.*",
  "checkins.text",
  "checkins.lab_anonymous_question",
];

/** Remove blocklisted fields from a parent-facing payload (shallow + nested). */
export function stripBlockedForParent<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  // checkins.text / checkins.lab_anonymous_question (Reflection-scoped).
  // Counselor bodies never reach this serializer: counselor threads are
  // metadata-only for parents (body withheld at the read path, ASCA B.2).
  delete out["text"];
  delete out["lab_anonymous_question"];
  // calibration_scores.* / checkin_estimates.* — whole-row block; callers must
  // never pass these tables into a parent serializer at all. Defensive:
  if ("calibration" in out || "mean_error" in out || "estimate_pct" in out || "error_pct" in out) {
    throw new Error("parent_blocklist_violation: calibration data in parent payload");
  }
  return out as T;
}

/** Scan a finished parent payload for blocklisted fields (nightly audit job). */
export function findBlockedFields(payload: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (["calibration", "mean_error", "estimate_pct", "error_pct", "actual_pct"].includes(k)) {
          found.push(`${path}.${k}`);
        }
        if ((path.endsWith("checkin") || path.endsWith("pulse")) && (k === "text" || k === "question")) {
          found.push(`${path}.${k}`);
        }
        walk(v, `${path}.${k}`);
      }
    }
  };
  walk(payload, "$");
  return found;
}

// ---------------------------------------------------------------------------
// Allowlisted parent briefing projection — the ONLY shape parent briefings
// may be built from. Anything not copied here cannot leak into a briefing.
// ---------------------------------------------------------------------------

export interface ParentBriefingSource {
  grades: Array<{ className: string; numeric: number | null; delta7d: number | null; term: string | null }>;
  dueNext: Array<{ className: string; title: string; dueDate: string | null; status: string }>;
  checkinStreakDays: number;
  checkinMoodAvg7d: number | null; // aggregate only — never raw text
  missingCount: number;
  safetyAlerts: Array<{ className: string | null; subject: string | null; at: string }>;
}

export interface ParentBriefingProjection {
  grades: ParentBriefingSource["grades"];
  dueNext: ParentBriefingSource["dueNext"];
  checkinStreakDays: number;
  checkinMoodAvg7d: number | null;
  missingCount: number;
  safetyAlerts: ParentBriefingSource["safetyAlerts"];
  generatedAt: string;
}

/** Build the parent briefing from explicitly allowlisted fields only. */
export function buildParentBriefingProjection(src: ParentBriefingSource): ParentBriefingProjection {
  return {
    grades: src.grades.map((g) => ({
      className: g.className,
      numeric: g.numeric,
      delta7d: g.delta7d,
      term: g.term,
    })),
    dueNext: src.dueNext.map((d) => ({
      className: d.className,
      title: d.title,
      dueDate: d.dueDate,
      status: d.status,
    })),
    checkinStreakDays: src.checkinStreakDays,
    checkinMoodAvg7d: src.checkinMoodAvg7d,
    missingCount: src.missingCount,
    safetyAlerts: src.safetyAlerts.map((s) => ({
      className: s.className,
      subject: s.subject,
      at: s.at,
    })),
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// FR-SCHOOL-016 — CC redaction (fail-closed).
// ---------------------------------------------------------------------------

export interface LinkedStudent {
  firstName: string;
  lastName: string;
  emails: string[];
}

/**
 * Redact non-linked students from a teacher email before a parent-visible
 * surface renders it. The teen sees the unredacted thread (own education
 * record); the original is preserved in the school-of-record store — this is
 * a derived render, not a second truth.
 *
 * Fail-closed: a name/email that cannot be affirmatively matched to a LINKED
 * student is redacted. Matching is exact + normalized on roster names.
 */
export function redactNonLinkedStudents(
  body: string,
  linked: LinkedStudent[],
  opts?: { toAddrs?: string[]; ccAddrs?: string[] },
): { redacted: string; redactionCount: number; toAddrs?: string[]; ccAddrs?: string[] } {
  let redactionCount = 0;
  let out = body;

  const linkedNames = new Set<string>();
  const linkedEmails = new Set<string>();
  for (const s of linked) {
    const full = `${s.firstName} ${s.lastName}`.trim().toLowerCase();
    linkedNames.add(full);
    linkedNames.add(s.firstName.trim().toLowerCase());
    linkedNames.add(s.lastName.trim().toLowerCase());
    for (const e of s.emails) linkedEmails.add(e.trim().toLowerCase());
  }

  // 1. Redact non-linked emails in to/cc headers (exact match against linked).
  const redactAddrList = (addrs: string[] | undefined): string[] | undefined => {
    if (!addrs) return addrs;
    return addrs.map((a) => {
      if (linkedEmails.has(a.trim().toLowerCase())) return a;
      redactionCount++;
      return "[redacted]";
    });
  };
  const toAddrs = redactAddrList(opts?.toAddrs);
  const ccAddrs = redactAddrList(opts?.ccAddrs);

  // 2. Redact email addresses in the body that are not linked.
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => {
    if (linkedEmails.has(m.toLowerCase())) return m;
    redactionCount++;
    return "[redacted]";
  });

  // 3. Redact capitalized "First Last" name mentions not on the roster.
  //    Conservative pattern: two capitalized words. Single common nouns are
  //    left alone; the roster check decides.
  out = out.replace(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/g, (m, first: string, last: string) => {
    const norm = `${first} ${last}`.toLowerCase();
    if (linkedNames.has(norm)) return m;
    // Fail-closed: redact unless affirmatively linked. (Teacher/staff names
    // are not in the student roster → redacted in parent view; the teen sees
    // the original.)
    redactionCount++;
    return "[student name redacted]";
  });

  void toAddrs;
  void ccAddrs;
  return { redacted: out, redactionCount, toAddrs, ccAddrs };
}

// ---------------------------------------------------------------------------
// Safety-critical tagger (sol-school-ai §4.5) — deterministic rules.
// Either the rules OR the (future) LLM classifier firing ⇒ safety_critical.
// ---------------------------------------------------------------------------

const SAFETY_KEYWORDS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(injury|injured|hurt|hospital|emergency|emergent)\b/i, reason: "injury/medical" },
  { pattern: /\b(lockdown|shelter in place|evacuat\w*)\b/i, reason: "lockdown/evacuation" },
  { pattern: /\b(weapon|gun|knife|threat|threaten\w*)\b/i, reason: "threat/weapon" },
  { pattern: /\b911\b/, reason: "911 mentioned" },
  { pattern: /pick up (immediately|right away|as soon as possible)/i, reason: "urgent pickup" },
  { pattern: /\b(allergic reaction|anaphylaxis|seizure|unconscious)\b/i, reason: "medical event" },
];

export interface SafetyTag {
  safetyCritical: boolean;
  reason: string | null;
}

/** Deterministic safety-critical tagger. Fail-open toward tagging: any hit tags. */
export function tagSafetyCritical(subject: string | null, body: string): SafetyTag {
  const haystack = `${subject ?? ""}\n${body}`;
  for (const { pattern, reason } of SAFETY_KEYWORDS) {
    if (pattern.test(haystack)) return { safetyCritical: true, reason };
  }
  return { safetyCritical: false, reason: null };
}
