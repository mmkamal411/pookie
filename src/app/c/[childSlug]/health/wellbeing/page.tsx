import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getHealthContext } from "@/lib/health/actions";
import { WellbeingView } from "@/components/health/wellbeing-view";
import { TeenPrivateNotice } from "@/components/health/ui";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/health/wellbeing — W8 Wellbeing.
 * Teen-private: the route denies parents outright (no aggregates, ever —
 * sol-health section 5.1). Steward parents of under-13s are the one
 * exception (COPPA stewardship, sol-health section 1.3).
 */
export default async function WellbeingPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const ctxRes = await getHealthContext(membership.child_id);
  if (!ctxRes.ok) notFound();
  const ctx = ctxRes.data;

  const allowed = ctx.isSubject || (ctx.band === "under13" && ctx.role === "parent");
  if (!allowed) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-16 pb-8">
        <TeenPrivateNotice teenName={ctx.displayName} />
      </main>
    );
  }

  return <WellbeingView childId={membership.child_id} ctx={ctx} />;
}
