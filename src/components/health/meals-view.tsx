"use client";

// W13 — Meals. Meal planning, not food logging. Balanced plates, family
// favorites, grocery lists. No calorie budgets, no moralizing language,
// no fasting schedules (sol-health section 6.3). Meal plans never link to
// food-log calorie data.

import { useState } from "react";
import type { HealthContext } from "@/lib/health/types";
import { HealthPageHeader, MedicalDisclaimerFooter, TierBadge } from "./ui";
import { WeekPlanner } from "./meals-week-grid";
import { RecipeLibrary } from "./meals-recipes";
import { FamilyPreferences } from "./meals-preferences";

const TABS = ["Planner", "Recipes", "Preferences"] as const;
type Tab = (typeof TABS)[number];

const TAB_COPY: Record<Tab, string> = {
  Planner: "The week, planned. Tap a slot to assign a meal.",
  Recipes: "The meals your family actually eats.",
  Preferences: "Who is at the table. Likes, skips, allergies.",
};

export function MealsView({ childId, ctx }: { childId: string; ctx: HealthContext }) {
  const [tab, setTab] = useState<Tab>("Planner");

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
      <HealthPageHeader
        eyebrow="W13 · Meals"
        title="Meals"
        sub="What is for dinner. Planned, not panicked."
        back
      />
      <div className="animate-bloom mt-3" style={{ animationDelay: "0.08s" }}>
        <TierBadge tier="H1" />
      </div>

      <div className="animate-bloom mt-5" style={{ animationDelay: "0.12s" }}>
        <div role="tablist" aria-label="Meals sections" className="flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                tab === t
                  ? "bg-nova-500 text-nebula-950 shadow-glow-sm"
                  : "border border-nova-400/15 bg-nebula-900/60 text-stardust-300 hover:text-star-100"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-stardust-300">{TAB_COPY[tab]}</p>
      </div>

      <div className="animate-bloom" style={{ animationDelay: "0.16s" }}>
        {tab === "Planner" && <WeekPlanner childId={childId} schemaReady={ctx.schemaReady} />}
        {tab === "Recipes" && <RecipeLibrary childId={childId} schemaReady={ctx.schemaReady} />}
        {tab === "Preferences" && <FamilyPreferences childId={childId} schemaReady={ctx.schemaReady} />}
      </div>

      <MedicalDisclaimerFooter />
    </div>
  );
}
