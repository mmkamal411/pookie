// Applet registry — every module that opens as a temporary applet, with
// its window-chrome identity (plain-English name, ship readout prefix,
// neon glow) and its lazily-loaded content component.
//
// Chrome rule: applets reuse the SAME window chrome as Home / Today /
// Progress (the modwin-* classes from window-manager.tsx) — one pattern,
// no second invention. Glow colors follow the grove palette already used
// by the window manager.

"use client";

import { lazy, Suspense, type ComponentType } from "react";
import type { AppletParams } from "@/lib/applet-bus";
import { AppletLoading } from "@/components/applet-views-shared";

export interface AppletDef {
  /** Plain-English name — the visually dominant part of the title bar. */
  name: string;
  /** Ship readout prefix, e.g. "BIO". Small, letter-spaced. */
  readout: string;
  /** Neon glow color for the title dot + chip. */
  glow: string;
}

export const APPLETS: Record<string, AppletDef> = {
  // Health grove
  W2: { name: "Health", readout: "Bio", glow: "#6ee7b7" },
  W8: { name: "Wellbeing", readout: "Pulse", glow: "#34d399" },
  W13: { name: "Meals", readout: "Galley", glow: "#a3e635" },
  W22: { name: "Activity", readout: "Kinetic", glow: "#4ade80" },
  W23: { name: "Nutrition", readout: "Fuel", glow: "#bef264" },
  // Home grove
  W21: { name: "Mail", readout: "Post", glow: "#7dd3fc" },
  W20: { name: "Shopping List", readout: "Stores", glow: "#2dd4bf" },
  W11: { name: "Spending", readout: "Ledger", glow: "#fb923c" },
  W7: { name: "Money & Documents", readout: "Vault", glow: "#fbbf24" },
  W24: { name: "Credit", readout: "Credit", glow: "#fcd34d" },
  W14: { name: "Co-parenting", readout: "Crew", glow: "#4ade80" },
  // Safety grove
  W3: { name: "Safety", readout: "Aegis", glow: "#60a5fa" },
  W15: { name: "Screen Time", readout: "Bounds", glow: "#38bdf8" },
  // Travel grove
  W25: { name: "Fuel & Charging", readout: "Prop", glow: "#67e8f9" },
  W30: { name: "Flights", readout: "Flight", glow: "#22d3ee" },
  W31: { name: "Rental Cars", readout: "Wheels", glow: "#06b6d4" },
  W27: { name: "Events", readout: "Events", glow: "#5eead4" },
  W28: { name: "Restaurants", readout: "Mess", glow: "#2dd4bf" },
  W29: { name: "Trails & Parks", readout: "Trails", glow: "#4ade80" },
  W26: { name: "Weather", readout: "Atmo", glow: "#7dd3fc" },
  // Marketplace grove
  W12: { name: "Babysitters", readout: "Trade", glow: "#2dd4bf" },
  W6: { name: "Driving School", readout: "Helm", glow: "#5eead4" },
  // Support grove
  S1: { name: "Help Center & FAQ", readout: "Beacon", glow: "#93c5fd" },
  S2: { name: "AI Support Chat", readout: "Comms", glow: "#ffd88a" },
  S3: { name: "Support Tickets", readout: "Beacon", glow: "#93c5fd" },
  // In-applet sub-views (not in the More menu; reached via interception)
  "faq-article": { name: "Help Center", readout: "Beacon", glow: "#93c5fd" },
  "ticket-new": { name: "Open a Ticket", readout: "Beacon", glow: "#93c5fd" },
  "ticket-detail": { name: "Support Ticket", readout: "Beacon", glow: "#93c5fd" },
};

type AppletViewProps = { params: AppletParams };
type AppletView = ComponentType<AppletViewProps>;

function view<T extends AppletViewProps>(
  importer: () => Promise<{ [K in string]: ComponentType<T> }>,
  name: string,
): AppletView {
  return lazy(() =>
    importer().then((m) => ({ default: m[name] as ComponentType<AppletViewProps> })),
  );
}

// Content stays in per-grove chunks — the cockpit shell never pays for a
// module until the pilot opens it.
const VIEWS: Record<string, AppletView> = {
  W2: view(() => import("./applet-views-health"), "HealthApplet"),
  W8: view(() => import("./applet-views-health"), "WellbeingApplet"),
  W13: view(() => import("./applet-views-health"), "MealsApplet"),
  W22: view(() => import("./applet-views-health"), "ActivityApplet"),
  W23: view(() => import("./applet-views-health"), "NutritionApplet"),
  W21: view(() => import("./applet-views-home"), "MailApplet"),
  W20: view(() => import("./applet-views-home"), "ShoppingApplet"),
  W11: view(() => import("./applet-views-home"), "SpendingApplet"),
  W7: view(() => import("./applet-views-home"), "VaultApplet"),
  W24: view(() => import("./applet-views-home"), "CreditApplet"),
  W14: view(() => import("./applet-views-home"), "CoparentingApplet"),
  W3: view(() => import("./applet-views-home"), "InsuranceApplet"),
  W15: view(() => import("./applet-views-home"), "ScreenTimeApplet"),
  W12: view(() => import("./applet-views-home"), "MarketplaceApplet"),
  W6: view(() => import("./applet-views-home"), "MarketplaceApplet"),
  W26: view(() => import("./applet-views-home"), "WeatherApplet"),
  W25: view(() => import("./applet-views-travel"), "FuelApplet"),
  W30: view(() => import("./applet-views-travel"), "FlightsApplet"),
  W31: view(() => import("./applet-views-travel"), "RentalsApplet"),
  W27: view(() => import("./applet-views-travel"), "EventsApplet"),
  W28: view(() => import("./applet-views-travel"), "RestaurantsApplet"),
  W29: view(() => import("./applet-views-travel"), "TrailsApplet"),
  S1: view(() => import("./applet-views-support"), "FaqApplet"),
  S2: view(() => import("./applet-views-support"), "ChatApplet"),
  S3: view(() => import("./applet-views-support"), "TicketsApplet"),
  "faq-article": view(() => import("./applet-views-support"), "FaqArticleApplet"),
  "ticket-new": view(() => import("./applet-views-support"), "TicketNewApplet"),
  "ticket-detail": view(() => import("./applet-views-support"), "TicketDetailApplet"),
};

/** The applet's content, with a loading state while its chunk resolves. */
export function AppletContent({ id, params }: { id: string; params: AppletParams }) {
  const def = APPLETS[id];
  const View = VIEWS[id];
  if (!def || !View) return null;
  return (
    <Suspense fallback={<AppletLoading label={def.name} />}>
      <View params={params} />
    </Suspense>
  );
}
