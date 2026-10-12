import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getHealthContext } from "@/lib/health/actions";
import { NutritionView } from "@/components/health/nutrition-view";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/health/nutrition — W23 Nutrition.
 * Under 18: descriptive check-ins, weight-neutral, no numeric fields.
 * 18+: full diary with uncertainty ranges.
 * Contract: docs/solutions/sol-health.md section 6.
 */
export default async function NutritionPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const ctxRes = await getHealthContext(membership.child_id);
  if (!ctxRes.ok) notFound();

  return <NutritionView childId={membership.child_id} ctx={ctxRes.data} />;
}
