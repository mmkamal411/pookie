// Travel-grove applet content (W25 Fuel & Charging, W30 Flights,
// W31 Rental Cars, W27 Events, W28 Restaurants, W29 Trails & Parks).
// The panels render directly — no TravelPageShell, since the applet's own
// title bar already carries the name (a second header + back link would be
// a full-page navigation remnant).

"use client";

import { FuelPanel } from "@/components/travel/fuel-panel";
import { FlightsPanel } from "@/components/travel/flights-panel";
import { RentalsPanel } from "@/components/travel/rentals-panel";
import { EventsPanel } from "@/components/travel/events-panel";
import { RestaurantsPanel } from "@/components/travel/restaurants-panel";
import { TrailsPanel } from "@/components/travel/trails-panel";
import {
  AppletGate,
  useAppletTenant,
  useSquad5Ctx,
} from "@/components/applet-views-shared";

/** W25 Fuel & Charging — no server context needed. */
export function FuelApplet() {
  return <FuelPanel />;
}

/** W31 Rental Cars — no server context needed. */
export function RentalsApplet() {
  return <RentalsPanel />;
}

function TeenGated({
  label,
  render,
}: {
  label: string;
  render: (isTeen: boolean, childAge: number | null) => React.ReactNode;
}) {
  const t = useAppletTenant();
  const { s5, failed, retry } = useSquad5Ctx(t.childSlug);
  return (
    <AppletGate label={label} loading={!s5 && !failed} failed={failed} onRetry={retry}>
      {s5 ? render(s5.band === "teen", s5.childAge) : null}
    </AppletGate>
  );
}

/** W30 Flights. */
export function FlightsApplet() {
  return (
    <TeenGated label="Flights" render={(isTeen) => <FlightsPanel isTeen={isTeen} />} />
  );
}

/** W27 Events. */
export function EventsApplet() {
  return (
    <TeenGated label="Events" render={(isTeen) => <EventsPanel isTeen={isTeen} />} />
  );
}

/** W28 Restaurants. */
export function RestaurantsApplet() {
  return (
    <TeenGated
      label="Restaurants"
      render={(isTeen) => <RestaurantsPanel isTeen={isTeen} />}
    />
  );
}

/** W29 Trails & Parks. */
export function TrailsApplet() {
  return (
    <TeenGated
      label="Trails & Parks"
      render={(isTeen, childAge) => <TrailsPanel childAge={childAge} isTeen={isTeen} />}
    />
  );
}
