import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { ActivityHub } from "@/components/activity/activity-hub";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/health/activity — W22 Activity.
 * Fitness as training for the mission: quick workout logging, this-week
 * view with streaks, manual step goal, history. Device sync is a later phase.
 */
export default async function ActivityPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const childName =
    membership.child.nickname || membership.child.first_name || "Your child";

  return <ActivityHub childId={membership.child_id} childName={childName} />;
}
