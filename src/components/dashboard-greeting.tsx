"use client";

import { useTenant } from "@/components/tenant-provider";
import { PookieOrb } from "@/components/pookie-orb";

export function DashboardGreeting() {
  const { activeChild } = useTenant();
  const name = activeChild?.nickname ?? activeChild?.first_name ?? "there";
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="animate-bloom flex items-center gap-4">
        <PookieOrb size={52} />
        <p className="text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase">
          Today&apos;s garden
        </p>
      </div>
      <h1 className="text-sunlit animate-bloom mt-3 text-3xl font-semibold tracking-tight">
        Here&apos;s how {name} is growing today.
      </h1>
      <p className="animate-bloom mt-3 max-w-lg leading-relaxed text-bark-300" style={{ animationDelay: "0.1s" }}>
        The dashboard is still taking root — grades, check-ins, and the
        tutor will bloom here with the next workstreams.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { title: "School", note: "Grades & assignments", emoji: "📚" },
          { title: "Wellbeing", note: "Health & rest", emoji: "💚" },
          { title: "Dreams", note: "Goals & future", emoji: "🌟" },
        ].map((card, i) => (
          <div
            key={card.title}
            className="card-living animate-bloom rounded-3xl p-5"
            style={{ animationDelay: `${0.15 + i * 0.1}s` }}
          >
            <span className="text-2xl" role="img" aria-label={card.title}>
              {card.emoji}
            </span>
            <p className="mt-3 font-medium text-dew-100">{card.title}</p>
            <p className="text-sm text-bark-300">{card.note}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
