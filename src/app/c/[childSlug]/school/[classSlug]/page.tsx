import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getClassDetail, hasCheckinToday } from "@/server/services/school";
import { ClassDetailView } from "@/components/school/class-detail";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/[classSlug] — W1 class page.
 * classSlug = classes.class_slug (UNIQUE per child — stable, readable URLs).
 */
export default async function ClassPage({
  params,
}: {
  params: Promise<{ childSlug: string; classSlug: string }>;
}) {
  const { childSlug, classSlug } = await params;

  const supabase = await createClient();

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const { data: cls } = await supabase
    .from("classes")
    .select("id")
    .eq("child_id", membership.child_id)
    .eq("class_slug", classSlug)
    .maybeSingle();
  if (!cls) notFound();

  const [detail, checkinToday] = await Promise.all([
    getClassDetail(membership.child_id, (cls as { id: string }).id),
    hasCheckinToday(membership.child_id),
  ]);

  return (
    <ClassDetailView
      detail={detail}
      childName={membership.child.nickname ?? membership.child.first_name}
      childSlug={childSlug}
      childId={membership.child_id}
      checkinToday={checkinToday}
      role={membership.role}
    />
  );
}
