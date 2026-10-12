import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { MarketplaceHub } from "@/components/marketplace/marketplace-hub";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/marketplace — W12 Babysitters + W6 Driving School hub (Squad 5). */
export default async function MarketplacePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return <MarketplaceHub childSlug={childSlug} childId={ctx.childId} childAge={ctx.childAge} />;
}
