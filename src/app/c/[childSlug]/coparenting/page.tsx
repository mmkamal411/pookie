import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { CoparentingBoard } from "@/components/home-money/coparenting-board";

// Tenant-scoped: parallel-parenting logistics (W14).
// Two separate surfaces, no shared thread, no messaging — parent-only.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Co-parenting · Pookie",
};

export default async function CoparentingPage({
  params,
}: {
  params: Promise<{ childSlug: string }>;
}) {
  const { childSlug } = await params;
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  return (
    <CoparentingBoard
      childId={membership.child_id}
      childName={membership.child.nickname ?? membership.child.first_name ?? "your child"}
    />
  );
}
