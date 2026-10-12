// Marketplace hub — two large working cards (W12 Babysitters, W6 Driving
// School), each with a live data line. W6 carries minAge 15 in modules.ts —
// hidden below 15 via resolveModuleVisibility (hidden, never locked).

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card, InfoLine } from "@/components/ui";
import { GROVES } from "@/lib/modules";
import { resolveModuleVisibility } from "@/lib/menu-access";
import { useViewerProfile } from "@/lib/use-viewer-profile";
import { api } from "@/components/travel/travel-shared";
import { BabysittersPanel } from "./babysitters-panel";
import { DrivingSchoolPanel } from "./driving-school-panel";

export function MarketplaceHub({
  childSlug,
  childId,
  childAge,
}: {
  childSlug: string;
  childId: string;
  childAge: number | null;
}) {
  const viewer = useViewerProfile();
  const [sitterCount, setSitterCount] = useState<number | null>(null);
  const [driveHours, setDriveHours] = useState<string | null>(null);

  const modules = useMemo(() => {
    const grove = GROVES.find((g) => g.name === "Marketplace");
    return (grove?.modules ?? []).filter((m) => resolveModuleVisibility(m, viewer) === "visible");
  }, [viewer]);

  useEffect(() => {
    let cancelled = false;
    api<{ sitters: unknown[] }>("/api/v1/household/babysitters")
      .then((d) => {
        if (!cancelled) setSitterCount(d.sitters.length);
      })
      .catch(() => {
        if (!cancelled) setSitterCount(null);
      });
    api<{ status: string; total_minutes?: number; total_target?: number }>(
      `/api/v1/marketplace/driving/log?child_id=${childId}&state=GA`,
    )
      .then((d) => {
        if (cancelled) return;
        if (d.status === "ok" && d.total_minutes != null && d.total_target) {
          const h = Math.floor(d.total_minutes / 60);
          const t = Math.floor(d.total_target / 60);
          setDriveHours(`${h} of ${t} hours logged`);
        }
      })
      .catch(() => {
        if (!cancelled) setDriveHours(null);
      });
    return () => {
      cancelled = true;
    };
  }, [childId]);

  const w6Stage =
    childAge == null
      ? "Your Georgia license timeline"
      : childAge < 15
        ? "Getting ready — permit journey starts at 15"
        : childAge < 16
          ? "Permit stage — supervised driving"
          : childAge < 18
            ? "Provisional Class D stage"
            : "Full license stage";

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">
          🤝
        </span>
        <div>
          <h1 className="text-xl font-semibold text-star-100">Marketplace</h1>
          <p className="text-sm text-stardust-300">trusted services, found</p>
        </div>
      </div>

      <div className="mt-4">
        <InfoLine>
          These are directories and guides — Pookie helps you find and vet, but every booking
          happens with the real provider.
        </InfoLine>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={`/c/${childSlug}/marketplace#${m.id === "W12" ? "babysitters" : "driving"}`}
            className="block"
          >
            <Card padding="lg" className="h-full transition-transform hover:-translate-y-0.5">
              <span aria-hidden="true" className="text-3xl">
                {m.id === "W12" ? "👶" : "🚗"}
              </span>
              <p className="mt-2 text-base font-semibold text-star-100">{m.name}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-stardust-300">{m.watchOver}</p>
              <p className="mt-2 text-xs text-emerald-300">
                {m.id === "W12"
                  ? sitterCount == null
                    ? "Checking your directory…"
                    : sitterCount === 0
                      ? "No sitters yet — add your first."
                      : `${sitterCount} trusted sitter${sitterCount === 1 ? "" : "s"}`
                  : driveHours ?? w6Stage}
              </p>
              {m.id === "W6" && driveHours && (
                <p className="mt-0.5 text-xs text-stardust-400">{w6Stage}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {modules.some((m) => m.id === "W12") && (
          <section id="babysitters" aria-label="Babysitters" className="scroll-mt-24">
            <BabysittersPanel childId={childId} role={viewer.role} />
          </section>
        )}
        {modules.some((m) => m.id === "W6") && (
          <section id="driving" aria-label="Driving School" className="scroll-mt-24">
            <DrivingSchoolPanel childId={childId} childAge={childAge} role={viewer.role} />
          </section>
        )}
      </div>
    </main>
  );
}
