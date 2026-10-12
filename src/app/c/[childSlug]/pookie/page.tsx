import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getSchoolOverview } from "@/server/services/school";
import { PookieChat } from "@/components/pookie/pookie-chat";
import { PookieNudgeHost } from "@/components/pookie/pookie-nudge";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/pookie — the Pookie tab.
 * Full-page AI tutor: warm Pookie by default, Muse's straight-talk voice
 * on keyword triggers ("be straight with me"). Live context comes from the
 * shared SchoolOverview shape.
 */
export default async function PookiePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

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
