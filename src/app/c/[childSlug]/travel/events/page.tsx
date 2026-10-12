import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { EventsPanel } from "@/components/travel/events-panel";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel/events — W27 Events (vetted listings only). */
export default async function EventsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <TravelPageShell sigil="🎭" title="Events" subtitle="What's happening near you — vetted, age-tagged." backHref={`/c/${childSlug}/travel`}>
      <EventsPanel isTeen={ctx.band === "teen"} />
    </TravelPageShell>
  );
}
