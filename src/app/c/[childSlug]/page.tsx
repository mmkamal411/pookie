import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getSchoolOverview } from "@/server/services/school";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/ — the Home tab.
 * Real sessions render the Supabase-backed overview.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function HomePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const overview = await getSchoolOverview(membership.child_id);

  return (
    <OverviewDashboard
      overview={overview}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
      schoolName={membership.child.school_name}
      gradeLevel={membership.child.grade_level}
      role={membership.role}
    />
  );
}
