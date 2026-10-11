import { DashboardGreeting } from "@/components/dashboard-greeting";
import { DemoDashboard } from "@/components/demo-dashboard";
import { isDemoRequest } from "@/lib/demo";

/**
 * Dashboard home. Demo mode renders mock grades so the founder can
 * click through; the real dashboard workstream replaces the skeleton.
 */
export default async function DashboardPage() {
  if (await isDemoRequest()) return <DemoDashboard />;
  return <DashboardGreeting />;
}
