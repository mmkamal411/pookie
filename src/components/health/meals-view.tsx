"use client";

// W13 — Meals. Meal planning, not food logging. Balanced plates, family
// favorites, grocery lists. No calorie budgets, no moralizing language,
// no fasting schedules (sol-health section 6.3). Meal plans never link to
// food-log calorie data.

import { useCallback, useEffect, useState } from "react";
import { getMealPlans, saveMealPlan } from "@/lib/health/actions";
import type { HealthContext, MealPlan, MealPlanDay } from "@/lib/health/types";
import {
  HealthPageHeader,
  MedicalDisclaimerFooter,
  TierBadge,
  BackendNotReady,
  ActionError,
} from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function emptyDays(): MealPlanDay[] {
  return DAYS.map((day) => ({ day, breakfastIdea: "", lunchIdea: "", dinnerIdea: "", notes: "" }));
}

function weekStartMonday(): string {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function PlanEditor({
  childId,
  initial,
  onSaved,
}: {
  childId: string;
  initial: MealPlan | null;
  onSaved: () => void;
}) {
  const [weekStart] = useState(initial?.weekStart ?? weekStartMonday());
  const [days, setDays] = useState<MealPlanDay[]>(initial?.days?.length === 7 ? initial.days : emptyDays());
  const [groceryText, setGroceryText] = useState((initial?.groceryList ?? []).join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setDay(i: number, patch: Partial<MealPlanDay>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await saveMealPlan(childId, {
      weekStart,
      days,
      groceryList: groceryText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSaved(true);
    onSaved();
  }

  return (
    <section className="card-living rounded-3xl p-5">
      <h2 className="text-base font-semibold text-star-100">
        {initial ? "This week's plan" : "Plan this week"}
      </h2>
      <p className="mt-1 text-xs text-stardust-300">
        Dinner ideas, balanced plates, family favorites. No budgets. No scores.
      </p>
      {error && (
        <div className="mt-3">
          <ActionError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      {saved && (
        <p className="animate-rise mt-3 rounded-xl border border-comet-400/20 bg-comet-400/5 px-4 py-3 text-sm text-comet-200">
          Saved. One less thing to figure out at 6pm.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {days.map((d, i) => (
          <details
            key={d.day}
            className="group rounded-2xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3"
          >
            <summary className="cursor-pointer list-none text-sm font-medium text-star-100">
              <span className="flex items-center justify-between">
                {d.day}
                {d.dinnerIdea && (
                  <span className="max-w-[60%] truncate text-xs font-normal text-stardust-300">
                    {d.dinnerIdea}
                  </span>
                )}
              </span>
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["breakfastIdea", "Breakfast idea"],
                  ["lunchIdea", "Lunch idea"],
                  ["dinnerIdea", "Dinner idea"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs text-stardust-500">{label}</span>
                  <input
                    value={d[key]}
                    onChange={(e) => setDay(i, { [key]: e.target.value })}
                    maxLength={120}
                    placeholder="Tacos, but make it Tuesday"
                    className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                  />
                </label>
              ))}
            </div>
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-stardust-500">Notes</span>
              <input
                value={d.notes}
                onChange={(e) => setDay(i, { notes: e.target.value })}
                maxLength={280}
                placeholder="Leftovers from Sunday. Soccer at 6."
                className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
              />
            </label>
          </details>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 uppercase">
          Grocery list (one item per line)
        </span>
        <textarea
          value={groceryText}
          onChange={(e) => setGroceryText(e.target.value)}
          rows={5}
          placeholder={"Tortillas\nBlack beans\nLimes\nCilantro"}
          className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
      >
        {saving ? "Saving." : "Save this week's plan"}
      </button>
    </section>
  );
}

export function MealsView({ childId, ctx }: { childId: string; ctx: HealthContext }) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<MealPlan | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getMealPlans(childId);
    setLoading(false);
    if (!res.ok) {
      if (res.code !== "backend_not_ready") setError(res.message);
      return;
    }
    setPlans(res.data.plans);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
      <HealthPageHeader
        eyebrow="W13 · Meals"
        title="Meals"
        sub="What is for dinner. Planned, not panicked."
      />
      <div className="animate-bloom mt-3" style={{ animationDelay: "0.08s" }}>
        <TierBadge tier="H1" />
      </div>

      {!ctx.schemaReady && !loading ? (
        <div className="mt-6">
          <BackendNotReady feature="Meals" />
        </div>
      ) : (
        <div className="animate-bloom mt-6 space-y-5" style={{ animationDelay: "0.14s" }}>
          {error && <ActionError message={error} onDismiss={() => setError(null)} />}

          {creating || editingPlan ? (
            <>
              <PlanEditor
                childId={childId}
                initial={editingPlan}
                onSaved={() => {
                  setCreating(false);
                  setEditingPlan(null);
                  load();
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditingPlan(null);
                }}
                className="text-sm text-stardust-300 underline decoration-dotted underline-offset-2 hover:text-star-100"
              >
                Back to saved plans
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="card-living w-full rounded-3xl p-5 text-left transition-transform hover:scale-[1.01]"
              >
                <p className="text-base font-semibold text-star-100">Plan this week's meals</p>
                <p className="mt-1 text-xs text-stardust-300">
                  Seven dinners, one grocery list, zero weeknight panic.
                </p>
              </button>

              {loading && <p className="text-xs text-stardust-500">Loading.</p>}
              {!loading && plans.length === 0 && (
                <p className="text-xs text-stardust-500">No saved plans yet.</p>
              )}
              {plans.map((p) => (
                <button
                  key={p.id ?? p.weekStart}
                  type="button"
                  onClick={() => setEditingPlan(p)}
                  className="card-living w-full rounded-3xl p-5 text-left transition-transform hover:scale-[1.01]"
                >
                  <p className="text-sm font-semibold text-star-100">Week of {p.weekStart}</p>
                  <p className="mt-1 text-xs text-stardust-300">
                    {p.days.filter((d) => d.dinnerIdea).length} dinners planned
                    {p.groceryList.length > 0 && `, ${p.groceryList.length} groceries listed`}.
                  </p>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <MedicalDisclaimerFooter />
    </div>
  );
}
