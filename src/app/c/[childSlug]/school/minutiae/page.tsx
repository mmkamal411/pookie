import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getMinutiaeCalendar } from "@/server/services/minutiae";
import { MinutiaeCalendar } from "@/components/school/minutiae-calendar";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/minutiae — W16 school minutiae calendar.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function MinutiaePage({
  params,
}: {
  params: Promise<{ childSlug: string }>;
}) {
  const { childSlug } = await params;

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
    />
  );
}
