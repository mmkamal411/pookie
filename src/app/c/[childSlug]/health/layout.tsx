import { HealthModuleNav } from "@/components/health/health-module-nav";

/**
 * Health section layout — Prism E5 (2026-10-12).
 * Lateral navigation across the Health hub + subpages (wellbeing, meals,
 * activity, nutrition). The tenant layout already provides the page
 * transition, glass pane, and tenant firewall; this adds only the nav strip.
 */
export default function HealthSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <HealthModuleNav />
      {children}
    </>
  );
}
