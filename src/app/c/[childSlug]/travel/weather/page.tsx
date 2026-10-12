import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { WeatherPanel } from "@/components/travel/weather-panel";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel/weather — W26 Weather (live NWS). */
export default async function WeatherPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <TravelPageShell sigil="🌤️" title="Weather" subtitle="The sky over your day — from the National Weather Service." backHref={`/c/${childSlug}/travel`}>
      <WeatherPanel isTeen={ctx.band === "teen"} />
    </TravelPageShell>
  );
}
