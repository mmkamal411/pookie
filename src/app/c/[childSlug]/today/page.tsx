import { notFound } from "next/navigation";
import { getDemoMemberships, getDemoSchoolOverview, isDemoRequest } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { getSchoolOverview } from "@/server/services/school";
import { TodayView } from "@/components/today-view";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/today — the Today tab.
 * The day's schedule and tasks: due today, tonight's top 3, check-in nudge.
 */
export default async function TodayPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  if (await isDemoRequest()) {
    const child = getDemoMemberships()[0].child;
    return (
      <TodayView
        overview={getDemoSchoolOverview()}
        childName={child.nickname ?? child.first_name}
        childSlug={childSlug}
      />
    );
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const overview = await getSchoolOverview(membership.child_id);

  return (
    <TodayView
      overview={overview}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
    />
  );
}
