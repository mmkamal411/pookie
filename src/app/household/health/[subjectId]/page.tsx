import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoRequest } from "@/lib/demo";
import { assertHealthSubject } from "@/server/tenant";
import {
  getSubjectMetrics,
  listMetricDefs,
  listOverrides,
  subjectAgeBand,
  WEIGHT_METRIC_KEY,
  type HealthSubject,
} from "@/server/services/health";
import {
  getDemoHealthSubjects,
  getDemoMetricDefs,
  getDemoReadings,
} from "@/lib/health-demo";
import { SubjectDetail } from "@/components/health/subject-detail";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /household/health/[subjectId] — W22 per-person detail: trends, manual
 * logging, and the parent safety-override panel. Teen-role callers never
 * see weight (filtered in the service + the def list here).
 */
export default async function SubjectPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;

  if (await isDemoRequest()) {
    const subject = getDemoHealthSubjects().find((s) => s.id === subjectId);
    if (!subject) notFound();
    return (
      <SubjectDetail
        subject={subject}
        defs={getDemoMetricDefs()}
        readings={getDemoReadings(subjectId)}
        overrides={[]}
        role="parent"
        demo
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const hctx = await assertHealthSubject(subjectId);
  const subject: HealthSubject = {
    id: hctx.subjectRowId,
    child_id: hctx.subjectChildId,
    subject_kind: hctx.subjectKind,
    label: hctx.subjectLabel,
    notes: null,
    age_band: await subjectAgeBand(hctx.subjectRowId),
  };
  // Weight defs never reach teen-role UIs (readings are filtered too).
  const defs = (await listMetricDefs()).filter(
    (d) => hctx.role !== "child" || d.metric_key !== WEIGHT_METRIC_KEY,
  );
  const readings = await getSubjectMetrics(hctx, { limit: 500 });
  const overrides = hctx.role === "parent" ? await listOverrides(hctx) : null;

  return (
    <SubjectDetail
      subject={subject}
      defs={defs}
      readings={readings}
      overrides={overrides}
      role={hctx.role}
    />
  );
}
