// GA 23-credit graduation audit — FR-SCHOOL-013 (G21). Deterministic.
//
// Maps each course completion to a subject bucket (fuzzy matches go to a
// student-confirm queue — never auto-aligned on a guess), computes earned /
// in-progress / remaining per bucket, flags shortfalls, and projects the
// completion term from the 4-year plan. Every audit stamps
// requirements_version; requirement changes re-run the audit and diff.
import { createClient } from "@/lib/supabase/server";
import { ApiError, mapDbError } from "@/server/errors";

import {
  auditGraduation,
  bucketForCourse,
  type BucketAudit,
  type GraduationAudit,
  type SubjectRule,
} from "./graduation-audit.ts";

export type { BucketAudit, GraduationAudit, SubjectRule };
export { auditGraduation, bucketForCourse };

/** Latest GA requirements + the child's completions → audit. */
export async function getGraduationAudit(childId: string): Promise<{ audit: GraduationAudit }> {
  const supabase = await createClient();
  const { data: reqRow, error: reqErr } = await supabase
    .from("graduation_requirements")
    .select("version, total_credits, subject_rules")
    .eq("state", "GA")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reqErr) throw new ApiError(mapDbError(reqErr, crypto.randomUUID()));
  if (!reqRow) {
    return {
      audit: {
        requirementsVersion: "none",
        totalRequired: 23,
        totalEarned: 0,
        totalInProgress: 0,
        buckets: [],
        confirmQueue: [],
        onTrack: false,
      },
    };
  }
  const req = reqRow as { version: string; subject_rules: SubjectRule[] };
  const { data: completions, error: compErr } = await supabase
    .from("course_completions")
    .select("id, course_name, subject_area, credits_earned, in_progress, counts_toward")
    .eq("child_id", childId);
  if (compErr) throw new ApiError(mapDbError(compErr, crypto.randomUUID()));
  const audit = auditGraduation(
    req.subject_rules,
    req.version,
    ((completions ?? []) as Array<{
      id: string;
      course_name: string;
      subject_area: string | null;
      credits_earned: number;
      in_progress: boolean;
      counts_toward: string | null;
    }>).map((c) => ({ ...c, credits_earned: Number(c.credits_earned) })),
  );
  return { audit };
}
