import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getSchoolOverview } from "@/server/services/school";
import {
  getCalibration,
  getLabToday,
  getTodayCheckin,
} from "@/server/services/school-track";
import { SchoolOverview } from "@/components/school/school-overview";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school — W1 grades dashboard.
 * The [childSlug] layout already runs the tenant firewall.
 *
 * Teen-scoped data (calibration, today's check-in, lab pulse) is fetched ONLY
 * for the child role — the services enforce requireChildRole, so a parent can
 * never receive this data, even by direct request.
 */
export default async function SchoolPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const isTeen = membership.role === "child";
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const [overview, teenData] = await Promise.all([
    getSchoolOverview(membership.child_id),
    isTeen
      ? Promise.all([
          getCalibration(membership.child_id).catch(() => null),
          getLabToday(membership.child_id).catch(() => null),
          getTodayCheckin(membership.child_id, today).catch(() => null),
        ])
      : Promise.resolve([null, null, null] as const),
  ]);
  const [calibration, labToday, todayCheckin] = teenData;

  return (
    <SchoolOverview
      overview={overview}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
      childId={membership.child_id}
      role={membership.role}
      calibration={calibration}
      labToday={labToday}
      todayCheckin={todayCheckin}
    />
  );
}
