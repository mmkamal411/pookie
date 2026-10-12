"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * HouseholdNav — Prism E5 (2026-10-12).
 * The account-level household pages (/household/*) sit outside the tenant
 * scope, so the Command Deck shows only the standby console — no tabs, no
 * More menu. Without this strip those pages were dead ends: the only way
 * out was the browser back button. This gives every household page lateral
 * navigation plus a way back Home ("/" routes to the right home).
 */
const LINKS = [
  { href: "/household/mail", label: "Mail" },
  { href: "/household/shopping", label: "Shopping" },
  { href: "/household/spending", label: "Spending" },
  { href: "/household/vault", label: "Vault" },
  { href: "/household/weather", label: "Weather" },
  { href: "/household/insurance", label: "Insurance" },
  { href: "/household/babysitters", label: "Babysitters" },
];

export function HouseholdNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Household"
      className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 pt-4"
    >
      <Link
        href="/"
        className="rounded-full border border-nova-400/25 bg-nebula-900/60 px-3 py-1.5 text-xs font-medium text-nova-200 transition-colors hover:border-nova-400/60 hover:text-nova-100"
        style={{ boxShadow: "0 0 10px rgb(0 229 255 / 0.12)" }}
      >
        ← Home
      </Link>
      <span aria-hidden="true" className="text-stardust-600">
        ·
      </span>
      {LINKS.map((l) => {
        const active =
          pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-teal-300/60 bg-teal-300/10 text-teal-100"
                : "border-white/10 bg-white/[0.03] text-stardust-300 hover:border-teal-300/40 hover:text-teal-100"
            }`}
            style={
              active
                ? { boxShadow: "0 0 12px rgb(94 234 212 / 0.25)" }
                : undefined
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
