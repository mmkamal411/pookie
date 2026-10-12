import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getHealthContext } from "@/lib/health/actions";
import { SettingsTabs } from "@/components/settings/settings-ui";
import { SharingHealthView } from "@/components/health/sharing-health-view";
import { MedicalDisclaimerFooter } from "@/components/health/ui";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/settings/sharing — Sharing screen.
 * The Health section is fully implemented here (per-tier, per-parent
 * toggles; hide-past lever; sharing-history audit). Other domains
 * (school, location, social) are owned by sibling teams and render as
 * collapsed honest states, not fake controls.
 *
 * Open to both roles: grant authority is enforced in the actions
 * (sol-health sections 1.3, 2.3) — the teen manages their own sharing,
 * the steward parent manages under-13 sharing, the 18+ adult manages
 * their re-consent. A parent of a teen sees the honest "managed by the
 * teen" state rather than a dead page.
 */
export default async function SharingPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const ctxRes = await getHealthContext(membership.child_id);
  if (!ctxRes.ok) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">
        Who can see my stuff?
      </h1>
      <p className="animate-bloom mt-1 max-w-xl text-sm text-stardust-300" style={{ animationDelay: "0.06s" }}>
        You decide. Change anything, anytime. Pookie never tells anyone when you change a setting
        here.
      </p>
      <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
        <SettingsTabs childSlug={childSlug} />
      </div>
      <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
        <SharingHealthView childId={membership.child_id} ctx={ctxRes.data} />
      </div>
      <div className="animate-bloom mt-6" style={{ animationDelay: "0.2s" }}>
        <details className="card-living rounded-3xl px-5 py-4">
          <summary className="cursor-pointer list-none text-sm font-semibold text-star-100">
            School, location, and more
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-stardust-300">
            Sharing controls for grades, messages, and location are being built by their teams.
            Health sharing above is live now.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-stardust-500">
            Heads up: your school shares grades and attendance with your parents directly. Pookie
            settings only control what Pookie shares. Not what the school shares.
          </p>
        </details>
      </div>
      <MedicalDisclaimerFooter />
    </main>
  );
}
