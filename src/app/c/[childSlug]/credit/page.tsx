import { notFound } from "next/navigation";
import { getMemberships } from "@/lib/tenant/actions";
import { CreditBoard } from "@/components/home-money/credit-board";

// Tenant-scoped: per-child credit freeze management (W24).
// Parent-only — the API enforces it server-side (assertParent).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Credit Freezes · Pookie",
};

export default async function CreditPage({
  params,
}: {
  params: Promise<{ childSlug: string }>;
}) {
  const { childSlug } = await params;
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  return (
    <CreditBoard
      childId={membership.child_id}
      childName={membership.child.nickname ?? membership.child.first_name ?? "Your child"}
    />
  );
}
