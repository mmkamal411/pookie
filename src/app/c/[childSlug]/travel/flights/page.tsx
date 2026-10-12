import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { FlightsPanel } from "@/components/travel/flights-panel";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel/flights — W30 Flights (rules + planning, never teen booking). */
export default async function FlightsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <TravelPageShell sigil="✈️" title="Flights" subtitle="Plan the trip — a grown-up books it." backHref={`/c/${childSlug}/travel`}>
      <FlightsPanel isTeen={ctx.band === "teen"} />
    </TravelPageShell>
  );
}
