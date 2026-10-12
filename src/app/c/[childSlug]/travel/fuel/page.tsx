import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TravelPageShell } from "@/components/travel/travel-shared";
import { FuelPanel } from "@/components/travel/fuel-panel";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/travel/fuel — W25 Fuel & Charging (EIA + OpenChargeMap). */
export default async function FuelPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <TravelPageShell sigil="⛽" title="Fuel & Charging" subtitle="Real prices, real chargers — for your area." backHref={`/c/${childSlug}/travel`}>
      <FuelPanel />
    </TravelPageShell>
  );
}
