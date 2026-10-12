import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { SettingsTabs, ParentOnlyNotice } from "@/components/settings/settings-ui";
import { WorkersView } from "@/components/sync/workers-view";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/** /c/[childSlug]/settings/health/ — agent heartbeat cards. Parent-only. */
export default async function HealthPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();
  if (membership.role !== "parent") return <ParentOnlyNotice />;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-8">
      <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">Workers</h1>
      <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
        <SettingsTabs childSlug={childSlug} role="parent" />
      </div>
      <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
        <WorkersView childId={membership.child.id} />
      </div>
    </main>
  );
}
