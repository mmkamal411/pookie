import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoRequest } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { assertHealthSubject } from "@/server/tenant";
import {
  getSubjectMetrics,
  listMetricDefs,
  listSubjects,
} from "@/server/services/health";
import {
  formatHealthValue,
  latestPerMetric,
} from "@/lib/health-format";
import {
  getDemoHealthSubjects,
  getDemoMetricDefs,
  getDemoReadings,
} from "@/lib/health-demo";
import {
  HealthHub,
  type LatestMetric,
} from "@/components/health/health-hub";

// Household namespace — NOT under /c/[childSlug]: subjects include adults.
// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /household/health — W22 family health hub. Per-person cards show only
 * visibility-allowed summaries (RLS + the service shape the data).
 * Demo mode renders the static reference dataset (demo never calls /api/v1/*).
 */
export default async function HealthHubPage() {
  if (await isDemoRequest()) {
    const subjects = getDemoHealthSubjects();
    const defs = getDemoMetricDefs();
    const defByKey = new Map(defs.map((d) => [d.metric_key, d]));
    const latestBySubject: Record<string, LatestMetric[]> = {};
    for (const s of subjects) {
      latestBySubject[s.id] = [...latestPerMetric(getDemoReadings(s.id)).values()].map(
        (r) => ({
          metric_key: r.metric_key,
          display_name: defByKey.get(r.metric_key)?.display_name ?? r.metric_key,
          unit: defByKey.get(r.metric_key)?.unit ?? null,
          value: formatHealthValue(r, defByKey.get(r.metric_key)),
          recorded_at: r.recorded_at,
        }),
      );
    }
    return (
      <HealthHub
        subjects={subjects}
        latestBySubject={latestBySubject}
        role="parent"
        childOptions={[]}
        demo
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { household, subjects } = await listSubjects();
  const defs = await listMetricDefs();
  const defByKey = new Map(defs.map((d) => [d.metric_key, d]));
  const memberships = await getMemberships();
  const children = memberships.map((m) => ({
    id: m.child_id,
    label: m.child.nickname ?? m.child.first_name,
  }));

  const latestBySubject: Record<string, LatestMetric[]> = {};
  for (const s of subjects) {
    const hctx = await assertHealthSubject(s.id);
    const readings = await getSubjectMetrics(hctx, { limit: 500 });
    latestBySubject[s.id] = [...latestPerMetric(readings).values()].map((r) => ({
      metric_key: r.metric_key,
      display_name: defByKey.get(r.metric_key)?.display_name ?? r.metric_key,
      unit: defByKey.get(r.metric_key)?.unit ?? null,
      value: formatHealthValue(r, defByKey.get(r.metric_key)),
      recorded_at: r.recorded_at,
    }));
  }

  return (
    <HealthHub
      subjects={subjects}
      latestBySubject={latestBySubject}
      role={household.role}
      childOptions={children}
    />
  );
}
