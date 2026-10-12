import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { RestaurantsPanel } from "@/components/travel/restaurants-panel";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel/restaurants — W28 Restaurants (verified Foursquare listings). */
export default async function RestaurantsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <TravelPageShell sigil="🍽️" title="Restaurants" subtitle="Where should we eat tonight — real places, near you." backHref={`/c/${childSlug}/travel`}>
      <RestaurantsPanel isTeen={ctx.band === "teen"} />
    </TravelPageShell>
  );
}
