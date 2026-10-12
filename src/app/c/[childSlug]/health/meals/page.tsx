import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getHealthContext } from "@/lib/health/actions";
import { MealsView } from "@/components/health/meals-view";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/health/meals — W13 Meals.
 * Meal planning, never food logging. No calorie budgets, no moralizing.
 * Contract: docs/solutions/sol-health.md section 6.3.
 */
export default async function MealsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const ctxRes = await getHealthContext(membership.child_id);
  if (!ctxRes.ok) notFound();

  return <MealsView childId={membership.child_id} ctx={ctxRes.data} />;
}
