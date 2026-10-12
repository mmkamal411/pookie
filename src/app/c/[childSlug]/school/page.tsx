import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getSchoolOverview } from "@/server/services/school";
import { SchoolOverview } from "@/components/school/school-overview";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school — W1 grades dashboard.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function SchoolPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const overview = await getSchoolOverview(membership.child_id);

  return (
    <SchoolOverview
      overview={overview}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
      childId={membership.child_id}
      role={membership.role}
    />
  );
}
