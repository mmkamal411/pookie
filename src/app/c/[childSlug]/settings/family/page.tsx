import { notFound } from "next/navigation";
import { shouldShowDemo } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { SettingsTabs } from "@/components/settings/settings-ui";
import { FamilyView } from "@/components/settings/family-view";
import { IndependenceView } from "@/components/settings/independence-view";
import { demoFamilyMembers, demoPendingInvites } from "@/lib/management-demo";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/settings/family/ — child account management.
 * Parent role → family members, invite form, pending invites.
 * Child role  → independence ("take ownership") flow, 18+ gated.
 * Demo mode   → fixtures, never the backend.
 */
export default async function FamilyPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  // Real sessions always win over a stale demo cookie.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (await shouldShowDemo(user)) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
        <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">Family</h1>
        <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
          <SettingsTabs childSlug={childSlug} />
        </div>
        <div className="animate-bloom mt-6 space-y-4" style={{ animationDelay: "0.16s" }}>
          <FamilyView demo demoMembers={demoFamilyMembers} demoInvites={demoPendingInvites} />
        </div>
      </main>
    );
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const isParent = membership.role === "parent";

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      <h1 className="text-sunlit animate-bloom text-3xl font-semibold tracking-tight">Family</h1>
      <p className="animate-bloom mt-1 text-sm text-stardust-300" style={{ animationDelay: "0.05s" }}>
        {isParent
          ? "Who can log in to each child's account."
          : "Your account, your future."}
      </p>
      {isParent && (
        <div className="animate-bloom mt-4" style={{ animationDelay: "0.1s" }}>
          <SettingsTabs childSlug={childSlug} />
        </div>
      )}
      <div className="animate-bloom mt-6" style={{ animationDelay: "0.16s" }}>
        {isParent ? <FamilyView /> : <IndependenceView />}
      </div>
    </main>
  );
}
