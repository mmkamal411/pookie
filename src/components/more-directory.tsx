"use client";

import { useState } from "react";
import Link from "next/link";
import { GROVES, MODULE_COUNT, type LifeModule } from "@/lib/modules";

function ModuleTile({ mod, childSlug, index }: { mod: LifeModule; childSlug: string; index: number }) {
  const [open, setOpen] = useState(false);

  if (mod.status === "live" && mod.route) {
    return (
      <Link
        href={`/c/${childSlug}${mod.route}`}
        className="card-living animate-bloom block rounded-2xl border border-nova-400/25 p-4"
        style={{ animationDelay: `${0.05 + index * 0.03}s`, boxShadow: "0 0 14px rgb(244 114 182 / 0.18)" }}
      >
        <p className="text-sm font-medium text-star-100">{mod.name}</p>
        <p className="mt-1 text-xs leading-relaxed text-stardust-300">{mod.watchOver}</p>
        <p className="mt-2 inline-block rounded-full border border-nova-400/40 px-2 py-0.5 text-[11px] font-semibold text-nova-300">
          Live
        </p>
      </Link>
    );
  }

  return (
    <div
      className="card-living animate-bloom rounded-2xl p-4"
      style={{ animationDelay: `${0.05 + index * 0.03}s` }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-2 text-left"
      >
        <div>
          <p className="text-sm font-medium text-star-100">
            <span aria-hidden="true" className="mr-1.5 text-xs">🌱</span>
            {mod.name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stardust-300">{mod.watchOver}</p>
        </div>
        <span aria-hidden="true" className={`shrink-0 text-xs text-nova-300 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && (
        <div className="animate-rise mt-3 border-t border-nova-400/10 pt-3">
          <p className="text-xs text-stardust-300">
            Taking root — the first step is small and real:
          </p>
          <p className="mt-1 text-sm font-medium text-aurum-300">{mod.seedAction}</p>
          {mod.teenPrivate && (
            <p className="mt-1 text-[11px] text-stardust-500">Teen-private space</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * More tab — the full 31-module directory in 6 life groves.
 * Live modules link out; the rest are seedlings (taking root), expandable
 * for their one seed-it-now action — never a dead "coming soon" tile.
 */
export function MoreDirectory({ childSlug }: { childSlug: string }) {
  let tileIndex = 0;
  return (
    <div className="space-y-10">
      {GROVES.map((grove, gi) => (
        <section key={grove.name} className="animate-bloom" style={{ animationDelay: `${0.1 + gi * 0.05}s` }}>
          <div className="flex items-baseline gap-3">
            <span aria-hidden="true" className="text-xl">{grove.sigil}</span>
            <h2 className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">{grove.name}</h2>
          </div>
          <p className="mt-1 text-xs text-stardust-500 italic">{grove.subtitle}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {grove.modules.map((mod) => (
              <ModuleTile key={mod.id} mod={mod} childSlug={childSlug} index={tileIndex++} />
            ))}
          </div>
        </section>
      ))}
      <p className="text-center text-xs text-stardust-500">
        {MODULE_COUNT} modules · growing one grove at a time
      </p>
    </div>
  );
}
