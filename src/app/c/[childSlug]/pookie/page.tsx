import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { getSchoolOverview } from "@/server/services/school";
import { createClient } from "@/lib/supabase/server";
import { PookieChat } from "@/components/pookie/pookie-chat";
import { PookieNudgeHost } from "@/components/pookie/pookie-nudge";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/** Full years between a YYYY-MM-DD date and today. Null when unknown. */
function ageYears(iso: string | null): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const now = new Date();
  let age = now.getFullYear() - Number(m[1]);
  if (now.getMonth() + 1 < Number(m[2]) || (now.getMonth() + 1 === Number(m[2]) && now.getDate() < Number(m[3]))) {
    age -= 1;
  }
  return age;
}

/**
 * /c/[childSlug]/pookie — the Pookie tab.
 * Full-page AI assistant: warm Pookie by default. Direct mode (Muse's
 * straight-talk voice) is 18+ only — the viewer's age is computed server-side
 * from the verified DOB; unknown age fails closed (FR-AI-002).
 */
export default async function PookiePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const name = membership.child.nickname ?? membership.child.first_name;
  const overview = await getSchoolOverview(membership.child_id);

  // FR-AI-002: the viewer's own age gates Direct mode. Parents viewing a
  // child's Pookie tab are adults via their profile DOB; the teen's own age
  // comes from the child's date_of_birth.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerAge: number | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("date_of_birth")
      .eq("user_id", user.id)
      .maybeSingle();
    viewerAge = ageYears((profile as { date_of_birth?: string | null } | null)?.date_of_birth ?? null);
  }
  if (viewerAge === null && membership.role === "child") {
    const { data: child } = await supabase
      .from("children")
      .select("date_of_birth")
      .eq("id", membership.child_id)
      .maybeSingle();
    viewerAge = ageYears((child as { date_of_birth?: string | null } | null)?.date_of_birth ?? null);
  }

  return (
    <>
      <PookieChat overview={overview} childName={name} viewerAge={viewerAge} />
      <PookieNudgeHost overview={overview} childName={name} />
    </>
  );
}
