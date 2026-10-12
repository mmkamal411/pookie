import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getClassDetail } from "@/server/services/school";
import { getTodayCheckin } from "@/server/services/school-track";
import { matchClassSlug, classMetaFor } from "@/lib/school/study-resources";
import { ClassDetailView } from "@/components/school/class-detail";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/[classSlug] — W1 class page.
 * classSlug = classes.class_slug (UNIQUE per child — stable, readable URLs).
 *
 * curatedSlug maps the pookie class to the curated library (apcsp, envsci…)
 * for Drive materials, peer tips, and study resources. Room + current unit
 * prefer the live classes columns (E4 066); curated metadata is the fallback.
 */
export default async function ClassPage({
  params,
}: {
  params: Promise<{ childSlug: string; classSlug: string }>;
}) {
  const { childSlug, classSlug } = await params;

  const supabase = await createClient();

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("child_id", membership.child_id)
    .eq("class_slug", classSlug)
    .maybeSingle();
  if (!cls) notFound();
  const classRow = cls as { id: string; name: string };
  const classId = classRow.id;

  // Room + current unit + grade weights: live columns when migrated, curated fallback.
  let room: string | null = null;
  let currentUnit: string | null = null;
  let gradeWeights: Record<string, number> | null = null;
  try {
    const { data: meta, error } = await supabase
      .from("classes")
      .select("room, current_unit, grade_weights")
      .eq("id", classId)
      .maybeSingle();
    if (!error && meta) {
      room = (meta as { room: string | null }).room ?? null;
      currentUnit = (meta as { current_unit: string | null }).current_unit ?? null;
      const gw = (meta as { grade_weights: unknown }).grade_weights;
      if (gw && typeof gw === "object" && !Array.isArray(gw)) {
        gradeWeights = gw as Record<string, number>;
      }
    }
  } catch {
    // columns not yet migrated — curated fallback below
  }
  const curatedSlug = matchClassSlug(classRow.name);
  const curated = curatedSlug ? classMetaFor(curatedSlug) : null;
  if (!room) room = curated?.room ?? null;
  if (!currentUnit) currentUnit = curated?.currentTopic ?? null;

  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [detail, todayCheckin] = await Promise.all([
    getClassDetail(membership.child_id, classId),
    membership.role === "child"
      ? getTodayCheckin(membership.child_id, today).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <ClassDetailView
      detail={detail}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
      childId={membership.child_id}
      checkinId={todayCheckin?.id ?? null}
      role={membership.role}
      curatedSlug={curatedSlug}
      room={room}
      currentUnit={currentUnit}
      gradeWeights={gradeWeights}
    />
  );
}
