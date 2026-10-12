import { notFound } from "next/navigation";
import { getDemoMemberships, getDemoSchoolOverview, shouldShowDemo } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getSchoolOverview } from "@/server/services/school";
import { PookieChat } from "@/components/pookie/pookie-chat";
import { PookieNudgeHost } from "@/components/pookie/pookie-nudge";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/pookie — the Pookie tab.
 * Full-page AI tutor: warm Pookie by default, Muse's straight-talk voice
 * on keyword triggers ("be straight with me"). Live context comes from the
 * shared SchoolOverview shape — demo and real data alike.
 */
export default async function PookiePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  // Real sessions always win over a stale demo cookie.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (await shouldShowDemo(user)) {
    const child = getDemoMemberships()[0].child;
    const name = child.nickname ?? child.first_name;
    const overview = getDemoSchoolOverview();
    return (
      <>
        <PookieChat overview={overview} childName={name} />
        <PookieNudgeHost overview={overview} childName={name} />
      </>
    );
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const name = membership.child.nickname ?? membership.child.first_name;
  const overview = await getSchoolOverview(membership.child_id);

  return (
    <>
      <PookieChat overview={overview} childName={name} />
      <PookieNudgeHost overview={overview} childName={name} />
    </>
  );
}
