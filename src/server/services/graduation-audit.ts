// GA 23-credit graduation audit — pure deterministic core (FR-SCHOOL-013).
// Dependency-free: unit-testable with plain node --test, no @/ alias needed.
export interface BucketAudit {
  subject: string;
  required: number;
  earned: number;
  inProgress: number;
  remaining: number;
  /** on-pace | behind-pace | complete */
  pace: "on-pace" | "behind-pace" | "complete";
  shortfall: number;
}

export interface GraduationAudit {
  requirementsVersion: string;
  totalRequired: number;
  totalEarned: number;
  totalInProgress: number;
  buckets: BucketAudit[];
  /** Fuzzy-mapped completions needing student confirmation. */
  confirmQueue: Array<{ completionId: string; courseName: string; suggestedBucket: string; confidence: number }>;
  onTrack: boolean;
}

export interface SubjectRule {
  subject: string;
  required: number;
}

/** Keyword → subject bucket map for deterministic bucketing. */
const BUCKET_KEYWORDS: Array<{ subject: string; patterns: RegExp[] }> = [
  { subject: "ELA", patterns: [/english|literature|composition|writing|rhetoric/i] },
  { subject: "Math", patterns: [/math|algebra|geometry|calculus|trigonometry|statistics|pre-?calc/i] },
  { subject: "Science", patterns: [/science|biology|chemistry|physics|environmental|earth science|anatomy/i] },
  { subject: "Social Studies", patterns: [/history|government|economics|civics|geography|social studies/i] },
  { subject: "Health/PE", patterns: [/health|physical education|\bpe\b|fitness/i] },
  { subject: "CTAE/FineArts/WorldLang", patterns: [/chinese|spanish|french|latin|german|art|music|band|chorus|theatre|drama|computer|engineering|ctae|culinary/i] },
];

export function bucketForCourse(courseName: string, rules: SubjectRule[]): { subject: string; confidence: number } {
  const matches: Array<{ subject: string; confidence: number }> = [];
  for (const rule of rules) {
    const entry = BUCKET_KEYWORDS.find((b) => b.subject === rule.subject);
    if (!entry) continue;
    const hits = entry.patterns.filter((p) => p.test(courseName)).length;
    if (hits > 0) matches.push({ subject: rule.subject, confidence: Math.min(0.6 + hits * 0.3, 1) });
  }
  if (matches.length === 0) return { subject: "Electives", confidence: 0.4 };
  matches.sort((a, b) => b.confidence - a.confidence);
  return matches[0];
}

/** Pure audit over completions + requirement rules (unit-testable). */
export function auditGraduation(
  rules: SubjectRule[],
  requirementsVersion: string,
  completions: Array<{
    id: string;
    course_name: string;
    subject_area: string | null;
    credits_earned: number;
    in_progress: boolean;
    counts_toward: string | null;
  }>,
): GraduationAudit {
  const buckets: BucketAudit[] = rules.map((r) => ({
    subject: r.subject,
    required: r.required,
    earned: 0,
    inProgress: 0,
    remaining: r.required,
    pace: "behind-pace" as const,
    shortfall: r.required,
  }));
  const bySubject = new Map(buckets.map((b) => [b.subject, b]));
  const confirmQueue: GraduationAudit["confirmQueue"] = [];

  for (const c of completions) {
    let bucketName = c.counts_toward ?? c.subject_area;
    if (!bucketName || !bySubject.has(bucketName)) {
      const { subject, confidence } = bucketForCourse(c.course_name, rules);
      if (confidence < 0.85) {
        confirmQueue.push({
          completionId: c.id,
          courseName: c.course_name,
          suggestedBucket: subject,
          confidence,
        });
        continue; // never auto-align on a guess
      }
      bucketName = subject;
    }
    const bucket = bySubject.get(bucketName);
    if (!bucket) continue;
    if (c.in_progress) bucket.inProgress += c.credits_earned;
    else bucket.earned += c.credits_earned;
  }

  for (const b of buckets) {
    b.remaining = Math.max(0, b.required - b.earned - b.inProgress);
    b.shortfall = Math.max(0, b.required - b.earned);
    b.pace = b.shortfall === 0 ? "complete" : b.remaining === 0 ? "on-pace" : "behind-pace";
  }

  const totalRequired = rules.reduce((s, r) => s + r.required, 0);
  const totalEarned = buckets.reduce((s, b) => s + b.earned, 0);
  const totalInProgress = buckets.reduce((s, b) => s + b.inProgress, 0);

  return {
    requirementsVersion,
    totalRequired,
    totalEarned,
    totalInProgress,
    buckets,
    confirmQueue,
    onTrack: buckets.every((b) => b.pace !== "behind-pace"),
  };
}

