import { notFound } from "next/navigation";
import {
  getDemoMemberships,
  getDemoMinutiae,
  isDemoRequest,
  DEMO_CHILD_ID,
} from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { getMinutiaeCalendar } from "@/server/services/minutiae";
import { MinutiaeCalendar } from "@/components/school/minutiae-calendar";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/minutiae — W16 school minutiae calendar.
 * Demo mode renders the mock reference dataset (demo never calls /api/v1/*).
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function MinutiaePage({
  params,
}: {
  params: Promise<{ childSlug: string }>;
}) {
  const { childSlug } = await params;

  if (await isDemoRequest()) {
    const child = getDemoMemberships()[0].child;
    return (
      <MinutiaeCalendar
        events={getDemoMinutiae()}
        childName={child.nickname ?? child.first_name}
        childId={DEMO_CHILD_ID}
        role="parent"
        demo
      />
    );
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const events = await getMinutiaeCalendar(membership.child_id);

  return (
    <MinutiaeCalendar
      events={events}
      childName={membership.child.nickname ?? membership.child.first_name}
      childId={membership.child_id}
      role={membership.role}
      demo={false}
    />
  );
}
