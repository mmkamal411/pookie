import { notFound } from "next/navigation";
import { getDemoClassDetail, getDemoMemberships, isDemoRequest, DEMO_CHILD_ID } from "@/lib/demo";
import { getMemberships } from "@/lib/tenant/actions";
import { createClient } from "@/lib/supabase/server";
import { getClassDetail, hasCheckinToday } from "@/server/services/school";
import { ClassDetailView } from "@/components/school/class-detail";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/[classSlug] — W1 class page.
 * classSlug = classes.class_slug (UNIQUE per child — stable, readable URLs).
 * Demo mode renders mock detail; the demo never calls /api/v1/*.
 */
export default async function ClassPage({
  params,
}: {
  params: Promise<{ childSlug: string; classSlug: string }>;
}) {
  const { childSlug, classSlug } = await params;

  if (await isDemoRequest()) {
    const detail = getDemoClassDetail(classSlug);
    if (!detail) notFound();
    const child = getDemoMemberships()[0].child;
    return (
      <ClassDetailView
        detail={detail}
        childName={child.nickname ?? child.first_name}
        childSlug={childSlug}
        childId={DEMO_CHILD_ID}
        checkinToday={false}
        role="parent"
        demo
      />
    );
  }

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const supabase = await createClient();
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
      demo={false}
    />
  );
}
