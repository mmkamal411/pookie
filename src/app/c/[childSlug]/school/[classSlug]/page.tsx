import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getClassDetail } from "@/server/services/school";
import {
  getCalibration,
  getLabToday,
  getTodayCheckin,
  listStudySparks,
} from "@/server/services/school-track";
import { ClassDetailView } from "@/components/school/class-detail";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/[classSlug] — W1 class page.
 * classSlug = classes.class_slug (UNIQUE per child — stable, readable URLs).
 *
 * Teen-scoped data (calibration, today's check-in, lab pulse) is fetched ONLY
 * for the child role — the services enforce requireChildRole.
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
    .select("id")
    .eq("child_id", membership.child_id)
    .eq("class_slug", classSlug)
    .maybeSingle();
  if (!cls) notFound();
  const classId = (cls as { id: string }).id;

  const isTeen = membership.role === "child";
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [detail, teenData, sparks] = await Promise.all([
    getClassDetail(membership.child_id, classId),
    isTeen
      ? Promise.all([
          getCalibration(membership.child_id).catch(() => null),
          getLabToday(membership.child_id).catch(() => null),
          getTodayCheckin(membership.child_id, today).catch(() => null),
        ])
      : Promise.resolve([null, null, null] as const),
    listStudySparks(membership.child_id, classId).catch(() => ({ sparks: [] })),
  ]);
  const [calibration, labToday, todayCheckin] = teenData;

  return (
    <ClassDetailView
      detail={detail}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
      childId={membership.child_id}
      checkinToday={!!todayCheckin}
      role={membership.role}
      sparks={sparks.sparks}
      calibration={calibration}
      labToday={labToday}
      todayCheckin={todayCheckin}
    />
  );
}
