import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getSyncHealth } from "@/server/services/school-sync-health";
import { SyncHealthDashboard } from "@/components/school/sync-health-dashboard";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/health — pull-health mission control.
 * Mehedi's end goal: a school data system so reliable he never has to
 * think about whether the data is fresh — it just is. This is how he SEES it.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function SchoolHealthPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const health = await getSyncHealth(membership.child_id);

  return (
    <SyncHealthDashboard
      initial={health}
      childSlug={childSlug}
      childName={membership.child.nickname ?? membership.child.first_name}
    />
  );
}
