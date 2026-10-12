import { notFound } from "next/navigation";
import { getDemoMemberships, getDemoSchoolOverview, shouldShowDemo } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getSchoolOverview } from "@/server/services/school";
import { OverviewDashboard } from "@/components/overview/overview-dashboard";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/ — the Home tab.
 * Demo mode renders the mock reference dataset (demo never calls /api/v1/*);
 * real sessions render the same component over the Supabase-backed overview.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function HomePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  // Real sessions always win over a stale demo cookie.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (await shouldShowDemo(user)) {
    const child = getDemoMemberships()[0].child;
    return (
      <OverviewDashboard
        overview={getDemoSchoolOverview()}
        childName={child.nickname ?? child.first_name}
        childSlug={childSlug}
        schoolName={child.school_name}
        gradeLevel={child.grade_level}
        role="parent"
      />
    );
  }

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
