import { notFound } from "next/navigation";
import { getDemoMemberships, getDemoSchoolOverview, shouldShowDemo, DEMO_CHILD_ID } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getSchoolOverview } from "@/server/services/school";
import { SchoolOverview } from "@/components/school/school-overview";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school — W1 grades dashboard.
 * Demo mode renders the mock reference dataset (demo never calls /api/v1/*).
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function SchoolPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  // Real sessions always win over a stale demo cookie.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (await shouldShowDemo(user)) {
    const child = getDemoMemberships()[0].child;
    return (
      <SchoolOverview
        overview={getDemoSchoolOverview()}
        childName={child.nickname ?? child.first_name}
        childSlug={childSlug}
        childId={DEMO_CHILD_ID}
        role="parent"
        demo
      />
    );
  }

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
      demo={false}
    />
  );
}
