"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

/**
 * HealthModuleNav — Prism E5 (2026-10-12).
 * The Health hub had no in-hub links to its own subpages (wellbeing, meals,
 * activity, nutrition) — they were discoverable only through the More popup
 * registry. This strip gives every health page lateral navigation plus a
 * visible back path to the hub. Hidden on the review-18 interstitial, which
 * is a blocking flow with its own terminal CTAs.
 */
const TABS = [
  { suffix: "", label: "Health" },
  { suffix: "/wellbeing", label: "Wellbeing" },
  { suffix: "/meals", label: "Meals" },
  { suffix: "/activity", label: "Activity" },
  { suffix: "/nutrition", label: "Nutrition" },
];

export function HealthModuleNav() {
  const params = useParams<{ childSlug: string }>();
  const pathname = usePathname();
  const childSlug = params?.childSlug;

  if (!childSlug) return null;
  // Blocking interstitial — leave it alone.
  if (pathname.endsWith("/health/review-18")) return null;

  const base = `/c/${childSlug}/health`;
  return (
    <nav
      aria-label="Health sections"
      className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 pt-4"
    >
      {TABS.map((t) => {
        const href = `${base}${t.suffix}`;
        const active = pathname === href;
        return (
          <Link
            key={t.suffix}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-teal-300/60 bg-teal-300/10 text-teal-100"
                : "border-white/10 bg-white/[0.03] text-stardust-300 hover:border-teal-300/40 hover:text-teal-100"
            }`}
            style={
              active ? { boxShadow: "0 0 12px rgb(94 234 212 / 0.25)" } : undefined
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
