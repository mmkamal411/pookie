import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { ScreenTimeCoSet } from "@/components/safety/ScreenTimeCoSet";
import type { SafetyActions } from "@/components/safety/types";
import {
  getScreenTimeState,
  proposeScreenTime,
  reviewScreenTime,
  appealScreenTime,
  respondToAppeal,
  listScreenTimeAppeals,
} from "@/lib/safety/actions";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/safety/screen-time — W15 Screen Time co-set.
 * Teen proposes, parent approves. No secret limits, no parent-only dashboard.
 */
export default async function ScreenTimePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const isTeen = membership.role === "child";
  const teenName = membership.child.nickname || membership.child.first_name || "Your teen";

  // ScreenTimeCoSet only calls the six screen-time methods; the rest of
  // SafetyActions is unused on this page.
  const actions = {
    getScreenTimeState,
    proposeScreenTime,
    reviewScreenTime,
    appealScreenTime,
    respondToAppeal,
    listScreenTimeAppeals,
  } as SafetyActions;

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <ScreenTimeCoSet
        childProfileId={membership.child_id}
        viewerRole={isTeen ? "teen" : "parent"}
        teenName={teenName}
        parentName="Parent"
        actions={actions}
      />
    </main>
  );
}
