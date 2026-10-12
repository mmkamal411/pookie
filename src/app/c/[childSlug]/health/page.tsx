import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getHealthContext } from "@/lib/health/actions";
import { HealthHub } from "@/components/health/health-hub";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/health — W2 Health hub.
 * Tier-badged sections, provenance labels, persistent disclaimers.
 * Contract: docs/solutions/sol-health.md section 4.
 */
export default async function HealthPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const ctxRes = await getHealthContext(membership.child_id);
  if (!ctxRes.ok) notFound();

  return <HealthHub childId={membership.child_id} ctx={ctxRes.data} />;
}
