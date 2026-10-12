import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelHub } from "@/components/travel/travel-hub";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel — W25–W31 Travel hub (Squad 5). */
export default async function TravelPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return <TravelHub childSlug={childSlug} />;
}
