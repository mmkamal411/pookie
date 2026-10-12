import { notFound } from "next/navigation";
import Link from "next/link";
import { getMemberships } from "@/lib/tenant/actions";
import { getHealthContext, getReconsentState } from "@/lib/health/actions";
import { Review18View } from "@/components/health/review-18-view";
import { MedicalDisclaimerFooter } from "@/components/health/ui";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/health/review-18 — the 18th-birthday health review.
 * Blocking interstitial per sol-health section 2.2: per-tier grant cards
 * (defaults OFF), review-correct-seal, transition-summary export,
 * emergency-contact re-designation, confirm / skip-private.
 *
 * The subject is the adult (child-role login). Parents are not the audience.
 * Login-time enforcement (first login >= 18 lands here) is a Platform Team 2
 * dependency; this route is the screen itself.
 */
export default async function Review18Page({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const ctxRes = await getHealthContext(membership.child_id);
  if (!ctxRes.ok) notFound();
  const ctx = ctxRes.data;

  if (!ctx.isSubject) {
    return (
      <main className="mx-auto max-w-2xl px-4 pt-16 pb-8 text-center">
        {/* Prism E5 2026-10-12: this was a visual dead end for parents. */}
        <Link
          href={`/c/${childSlug}/health`}
          className="mb-6 inline-block text-sm font-medium text-nova-300 transition-all hover:text-nova-200"
          style={{ textShadow: "0 0 10px rgb(167 139 250 / 0.35)" }}
        >
          ← Back to Health
        </Link>
        <h1 className="text-sunlit text-2xl font-semibold">A private review.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stardust-300">
          The 18th-birthday health review belongs to {ctx.displayName}. Parents do not see this
          screen.
        </p>
        <MedicalDisclaimerFooter />
      </main>
    );
  }

  const stateRes = await getReconsentState(membership.child_id);
  const status = stateRes.ok ? stateRes.data.status : "unknown";

  return (
    <Review18View
      childId={membership.child_id}
      ctx={ctx}
      initialStatus={status}
      childSlug={childSlug}
    />
  );
}
