import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { SettingsTabs, ParentOnlyNotice } from "@/components/settings/settings-ui";
import { LoginsView } from "@/components/sync/logins-view";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/** /c/[childSlug]/settings/credentials/ — school login management. Parent-only. */
export default async function CredentialsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();
  if (membership.role !== "parent") return <ParentOnlyNotice />;

  const name = membership.child.nickname ?? membership.child.first_name;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-8">
      <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">School logins</h1>
      <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
        <SettingsTabs childSlug={childSlug} role="parent" />
      </div>
      <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
        <LoginsView childId={membership.child_id} childName={name} />
      </div>
    </main>
  );
}
