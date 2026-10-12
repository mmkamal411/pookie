// W31 Rental Cars (REDESIGNED) — adult-only planning surface.
// Hidden from teen accounts entirely (menu, route, and API — the page
// server-gates with notFound()). No transaction path is rendered at all:
// planning mode only, with under-21 / under-25 callouts. The company
// age-rule catalog (rental_age_rules, PENDING) shows an honest
// "connecting" state until verified company policies land.

"use client";

import { useEffect, useState } from "react";
import { Card, InfoLine } from "@/components/ui";
import { api } from "./travel-shared";

interface GateResult {
  allowed: boolean;
  planning_mode_only?: boolean;
  requires_adult?: boolean;
}

export function RentalsPanel() {
  const [gate, setGate] = useState<GateResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<GateResult>("/api/v1/travel/purchase/check", {
      method: "POST",
      body: JSON.stringify({ flow: "rental_car" }),
    })
      .then((g) => {
        if (!cancelled) setGate(g);
      })
      .catch(() => {
        if (!cancelled) setGate(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <InfoLine tone="amber" icon="🚗">
        <strong>Planning mode.</strong> Most rental companies rent at 21+, and many add a daily
        under-25 surcharge. Pookie shows the real total so there are no surprises — and never
        renders a booking path here.
      </InfoLine>

      {gate?.planning_mode_only && (
        <InfoLine icon="📋">
          Gate check passed: your account is 18+, so you can plan here. Most companies still
          require 21+ to rent — the company rulebook below calls out each one.
        </InfoLine>
      )}

      <Card>
        <p className="text-sm font-semibold text-star-100">What to know before you price a rental</p>
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-stardust-300">
          <li>· <strong className="text-star-100">21+ to rent</strong> at most major companies; a few rent at 18+ in select states.</li>
          <li>· <strong className="text-star-100">Under-25 surcharge</strong> is real — often $25–$35/day — and must be in the total.</li>
          <li>· <strong className="text-star-100">Full license required</strong> — permits and provisional licenses don&apos;t count.</li>
          <li>· The cheapest-looking daily rate is never the real total. Always price with taxes, fees, and surcharges.</li>
        </ul>
      </Card>

      <Card>
        <p className="text-sm font-semibold text-star-100">Company age rules</p>
        <p className="mt-1 text-[13px] leading-relaxed text-stardust-300">
          The verified company rulebook (minimum age × state × license requirement × under-25
          surcharge, from published company policies) is still being compiled. Until it lands,
          confirm the minimum age and young-driver fee directly with the rental company — Pookie
          won&apos;t guess at their policies.
        </p>
      </Card>

      <p className="text-[11px] text-stardust-500">
        Rental Cars is hidden from teen accounts at the menu, route, and API layers (FR-MOD-W31).
      </p>
    </div>
  );
}
