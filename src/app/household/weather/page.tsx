import { WeatherHub } from "@/components/weather/weather-hub";

// Household namespace — NOT under /c/[childSlug]. Weather is per-household
// (owner-anchored coarse ZIP), so a child-scoped URL would imply per-child
// scoping that doesn't exist. force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Weather · Pookie",
};

export default async function WeatherPage() {
  return <WeatherHub />;
}
