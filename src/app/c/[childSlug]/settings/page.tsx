import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { SettingsTabs } from "@/components/settings/settings-ui";
import { SettingsView } from "@/components/settings/settings-view";
import { ChildSettingsView } from "@/components/settings/child-settings-view";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/settings/ — settings home.
 * Parent role → full panel (profile, children, notifications, theme, sign out).
 * Child role (13–17) → scoped panel: own profile, appearance, check-in
 * reminders, Pookie AI tone, session. Family/billing/deletion stay parent-only.
 * (18+ children graduate via the independence flow → parent role → full panel.)
 */
export default async function SettingsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const isParent = membership.role === "parent";

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      {isParent ? (
        <>
          <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">Ship Systems</h1>
          <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
            <SettingsTabs childSlug={childSlug} role="parent" />
          </div>
          <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
            <SettingsView />
          </div>
        </>
      ) : (
        <>
          <p className="instrument-label animate-bloom">Ship Systems // personal console</p>
          <h1 className="text-sunlit animate-bloom mt-2 text-3xl font-semibold tracking-tight">
            My Controls
          </h1>
          <p className="animate-bloom mt-1 text-sm text-stardust-300" style={{ animationDelay: "0.05s" }}>
            Your profile, your look, your Pookie.
          </p>
          <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
            <ChildSettingsView
              childId={membership.child_id}
              firstName={membership.child.first_name}
              initialNickname={membership.child.nickname}
              schoolName={membership.child.school_name}
              gradeLevel={membership.child.grade_level}
            />
          </div>
        </>
      )}
    </main>
  );
}
