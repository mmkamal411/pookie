import { notFound } from "next/navigation";
import { isDemoRequest } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { SettingsTabs, ParentOnlyNotice } from "@/components/settings/settings-ui";
import { SyncConsole } from "@/components/settings/sync-console";
import { DEMO_CHILD_ID } from "@/lib/management-demo";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/** /c/[childSlug]/settings/sync/ — sync status console. Parent-only. */
export default async function SyncPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  if (await isDemoRequest()) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
        <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">Sync</h1>
        <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
          <SettingsTabs childSlug={childSlug} />
        </div>
        <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
          <SyncConsole childId={DEMO_CHILD_ID} demo />
        </div>
      </main>
    );
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();
  if (membership.role !== "parent") return <ParentOnlyNotice />;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">Sync</h1>
      <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
        <SettingsTabs childSlug={childSlug} />
      </div>
      <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
        <SyncConsole childId={membership.child_id} demo={false} />
      </div>
    </main>
  );
}
