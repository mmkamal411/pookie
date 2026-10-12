import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { TrailsPanel } from "@/components/travel/trails-panel";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel/trails — W29 Trails & Parks (real NPS data). */
export default async function TrailsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <TravelPageShell sigil="🥾" title="Trails & Parks" subtitle="Where can we go outside — official data, safety first." backHref={`/c/${childSlug}/travel`}>
      <TrailsPanel childAge={ctx.childAge} isTeen={ctx.band === "teen"} />
    </TravelPageShell>
  );
}
