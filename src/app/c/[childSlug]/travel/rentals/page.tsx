import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { RentalsPanel } from "@/components/travel/rentals-panel";

export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/travel/rentals — W31 Rental Cars (adult-only planning).
 * Hidden from teen/child accounts entirely: menu, route, and API
 * (FR-MOD-W31). Teens get notFound() — no placeholder, no lock tile.
 */
export default async function RentalsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  if (ctx.band !== "adult") notFound();
  return (
    <TravelPageShell sigil="🚗" title="Rental Cars" subtitle="The real total cost — no $29/day traps." backHref={`/c/${childSlug}/travel`}>
      <RentalsPanel />
    </TravelPageShell>
  );
}
