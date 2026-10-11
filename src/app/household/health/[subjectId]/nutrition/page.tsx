import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDemoRequest } from "@/lib/demo";
import { assertHealthSubject } from "@/server/tenant";
import { TARGET_KIND_COPY } from "@/server/health/copy";
import {
  isTeenPrivateBand,
  subjectAgeBand,
  type HealthSubject,
} from "@/server/services/health";
import {
  getDayCloseout,
  getDaySummary,
  getFoodLogs,
  getNutritionTargets,
  getWeeklyPatterns,
  type DayCloseout,
  type DaySummary,
  type WeeklyPatterns,
} from "@/server/services/nutrition";
import {
  getDemoFoodLogs,
  getDemoHealthSubjects,
  getDemoNutritionTarget,
  getDemoWeeklyPatterns,
} from "@/lib/health-demo";
import { NutritionTabs } from "@/components/health/nutrition-tabs";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /household/health/[subjectId]/nutrition — W23. Role-shaped server-side:
 * a parent opening a teen's page gets Patterns, never the Diary.
 */
export default async function NutritionPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { subjectId } = await params;
  const sp = await searchParams;
  const date =
    sp?.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date)
      ? sp.date
      : new Date().toISOString().slice(0, 10);

  if (await isDemoRequest()) {
    const subject = getDemoHealthSubjects().find((s) => s.id === subjectId);
    if (!subject) notFound();
    const diary = getDemoFoodLogs(subjectId);
    const target = getDemoNutritionTarget();
    return (
      <NutritionTabs
        subject={subject}
        role="parent"
        canSeeDiary
        date={date}
        diary={diary}
        day={null}
        closeout={null}
        patterns={getDemoWeeklyPatterns()}
        target={target}
        targetKindCopy={TARGET_KIND_COPY[target.target_kind] ?? null}
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
  const band = await subjectAgeBand(hctx.subjectRowId);
  const subject: HealthSubject = {
    id: hctx.subjectRowId,
    child_id: hctx.subjectChildId,
    subject_kind: hctx.subjectKind,
    label: hctx.subjectLabel,
    notes: null,
    age_band: band,
  };
  // Diary holders: the teen themselves, or tenant members for
  // under-13/adult/household_member subjects. Parents of teen-band
  // subjects get the patterns tab instead — never the diary.
  const canSeeDiary =
    hctx.role === "child" ||
    hctx.subjectKind !== "child" ||
    !isTeenPrivateBand(band);

  const diary = canSeeDiary ? await getFoodLogs(hctx, date) : [];
  let day: DaySummary | null = null;
  let closeout: DayCloseout | null = null;
  if (canSeeDiary) {
    day = await getDaySummary(hctx, date);
    closeout = await getDayCloseout(hctx, date);
  }
  let patterns: WeeklyPatterns | null = null;
  try {
    patterns = await getWeeklyPatterns(hctx);
  } catch {
    patterns = null;
  }
  const target = await getNutritionTargets(hctx);

  return (
    <NutritionTabs
      subject={subject}
      role={hctx.role}
      canSeeDiary={canSeeDiary}
      date={date}
      diary={diary}
      day={day}
      closeout={closeout}
      patterns={patterns}
      target={target}
      targetKindCopy={target ? (TARGET_KIND_COPY[target.target_kind] ?? null) : null}
    />
  );
}
