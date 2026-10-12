"use client";

// W23 — Nutrition. Under 18: descriptive meal check-ins only, weight-neutral
// copy, no calorie/protein/weight fields anywhere (schema-enforced). 18+:
// full food diary with mandatory uncertainty ranges.
// Contract: docs/solutions/sol-health.md section 6.

import { useCallback, useEffect, useState } from "react";
import {
  getNutritionState,
  logMealCheckin,
  logFoodDiary,
} from "@/lib/health/actions";
import type {
  HealthContext,
  MealKind,
  NutritionState,
} from "@/lib/health/types";
import {
  HealthPageHeader,
  MedicalDisclaimerFooter,
  NedaCard,
  TierBadge,
  BackendNotReady,
  ActionError,
} from "./ui";

const MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealKind, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};
const FOOD_GROUPS = ["Grains", "Vegetables", "Fruits", "Protein", "Dairy", "Water"];

function ScalePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-wide text-stardust-300 uppercase">{label}</p>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-10 w-10 rounded-xl border text-sm font-semibold transition-colors ${
              value === n
                ? "border-nova-400/60 bg-nova-400/15 text-nova-200"
                : "border-nova-400/15 text-stardust-300 hover:border-nova-400/35"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function MinorCheckinForm({ childId, onSaved }: { childId: string; onSaved: () => void }) {
  const [meal, setMeal] = useState<MealKind>("breakfast");
  const [groups, setGroups] = useState<string[]>([]);
  const [hunger, setHunger] = useState<number | null>(null);
  const [fullness, setFullness] = useState<number | null>(null);
  const [energy, setEnergy] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleGroup(g: string) {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await logMealCheckin(childId, {
      meal,
      foodGroups: groups,
      hungerBefore: hunger ?? undefined,
      fullnessAfter: fullness ?? undefined,
      energyNote: energy.trim() ? energy.trim() : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDone(true);
    setGroups([]);
    setHunger(null);
    setFullness(null);
    setEnergy("");
    onSaved();
  }

  return (
    <section className="card-living rounded-3xl p-5">
      <h2 className="text-base font-semibold text-star-100">Did you eat regularly today?</h2>
      <p className="mt-1 text-xs text-stardust-300">
        This is about rhythm and energy. Not numbers. There are no wrong answers here.
      </p>
      {error && (
        <div className="mt-3">
          <ActionError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      {done && (
        <p className="animate-rise mt-3 rounded-xl border border-comet-400/20 bg-comet-400/5 px-4 py-3 text-sm text-comet-200">
          Logged. Regular meals are fuel for your day.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Meal">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={meal === m}
            onClick={() => setMeal(m)}
            className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
              meal === m
                ? "border-nova-400/60 bg-nova-400/15 text-nova-200"
                : "border-nova-400/15 text-stardust-300 hover:border-nova-400/35"
            }`}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium tracking-wide text-stardust-300 uppercase">
          What food groups were on the plate?
        </p>
        <div className="flex flex-wrap gap-2">
          {FOOD_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={groups.includes(g)}
              onClick={() => toggleGroup(g)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                groups.includes(g)
                  ? "border-comet-400/50 bg-comet-400/10 text-comet-200"
                  : "border-nova-400/15 text-stardust-300 hover:border-nova-400/35"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ScalePicker label="Hunger before (1 starving, 5 full)" value={hunger} onChange={setHunger} />
        <ScalePicker label="Fullness after (1 still hungry, 5 satisfied)" value={fullness} onChange={setFullness} />
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 uppercase">
          How is your energy? (optional)
        </span>
        <input
          value={energy}
          onChange={(e) => setEnergy(e.target.value)}
          maxLength={280}
          placeholder="Steady, dragging, wired."
          className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4 rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
      >
        {saving ? "Saving." : "Log this meal"}
      </button>
    </section>
  );
}

function AdultDiaryForm({ childId, onSaved }: { childId: string; onSaved: () => void }) {
  const [description, setDescription] = useState("");
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await logFoodDiary(childId, {
      description: description.trim(),
      caloriesLow: Number(low),
      caloriesHigh: Number(high),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setDescription("");
    setLow("");
    setHigh("");
    onSaved();
  }

  return (
    <section className="card-living rounded-3xl p-5">
      <h2 className="text-base font-semibold text-star-100">Food diary</h2>
      <p className="mt-1 text-xs text-stardust-300">
        Calorie ranges, not exact numbers. Labels are estimates, so Pookie keeps the honest range.
      </p>
      {error && (
        <div className="mt-3">
          <ActionError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 uppercase">
          What did you eat?
        </span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={280}
          placeholder="Lunch: rice, chicken, greens"
          className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 uppercase">
            Calories, low end
          </span>
          <input
            value={low}
            onChange={(e) => setLow(e.target.value)}
            inputMode="numeric"
            placeholder="400"
            className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 uppercase">
            Calories, high end
          </span>
          <input
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            inputMode="numeric"
            placeholder="650"
            className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || !description.trim() || !low || !high}
        className="mt-4 rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
      >
        {saving ? "Saving." : "Add entry"}
      </button>
    </section>
  );
}

export function NutritionView({ childId, ctx }: { childId: string; ctx: HealthContext }) {
  const [state, setState] = useState<NutritionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getNutritionState(childId);
    setLoading(false);
    if (!res.ok) {
      if (res.code !== "backend_not_ready") setError(res.message);
      return;
    }
    setState(res.data);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwnerView = state?.view === "own";
  const minor = ctx.isMinor;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
      <HealthPageHeader
        eyebrow="W23 · Nutrition"
        title={minor ? "Food and fuel" : "Nutrition"}
        sub={
          minor
            ? "Did you eat regularly today? How was your energy?"
            : "Your food diary. Private to you."
        }
      />
      <div className="animate-bloom mt-3" style={{ animationDelay: "0.08s" }}>
        <TierBadge tier="H2" />
      </div>

      {!ctx.schemaReady && !loading ? (
        <div className="mt-6">
          <BackendNotReady feature="Nutrition" />
        </div>
      ) : (
        <div className="animate-bloom mt-6 space-y-5" style={{ animationDelay: "0.14s" }}>
          {error && <ActionError message={error} onDismiss={() => setError(null)} />}

          {state?.view === "engagement" && (
            <section className="card-living rounded-3xl p-5">
              <h2 className="text-base font-semibold text-star-100">Meal logging activity</h2>
              <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                For teens, Pookie shares how often meals get logged. Never what was eaten, never
                calories. That part stays private.
              </p>
              {state.engagement ? (
                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-nova-400/15 bg-nebula-900/60 p-3 text-center">
                    <dt className="text-xs text-stardust-500">Days logged</dt>
                    <dd className="text-xl font-semibold text-star-100">{state.engagement.daysLogged}</dd>
                  </div>
                  <div className="rounded-2xl border border-nova-400/15 bg-nebula-900/60 p-3 text-center">
                    <dt className="text-xs text-stardust-500">Meals recorded</dt>
                    <dd className="text-xl font-semibold text-star-100">{state.engagement.mealsRecorded}</dd>
                  </div>
                  <div className="rounded-2xl border border-nova-400/15 bg-nebula-900/60 p-3 text-center">
                    <dt className="text-xs text-stardust-500">Week of</dt>
                    <dd className="text-sm font-semibold text-star-100">{state.engagement.weekStart || "—"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-xs text-stardust-500">No logging activity this week.</p>
              )}
            </section>
          )}

          {state?.view === "locked" && (
            <section className="card-living rounded-3xl p-5 text-center">
              <p className="text-sm font-medium text-star-100">A private space.</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-stardust-300">
                The food diary stays private to the adult. It opens only with their explicit choice
                in Sharing.
              </p>
            </section>
          )}

          {isOwnerView && minor && <MinorCheckinForm childId={childId} onSaved={load} />}
          {isOwnerView && !minor && <AdultDiaryForm childId={childId} onSaved={load} />}

          {isOwnerView && state && state.checkins.length > 0 && (
            <section className="card-living rounded-3xl p-5">
              <h2 className="text-base font-semibold text-star-100">Recent check-ins</h2>
              <ul className="mt-3 divide-y divide-nova-400/10">
                {state.checkins.slice(0, 10).map((c) => (
                  <li key={c.id} className="py-2.5">
                    <p className="text-sm text-star-100">
                      {MEAL_LABELS[c.meal]}
                      {c.foodGroups.length > 0 && (
                        <span className="ml-2 text-xs text-stardust-300">{c.foodGroups.join(", ")}</span>
                      )}
                    </p>
                    {(c.energyNote || c.hungerBefore != null) && (
                      <p className="mt-0.5 text-xs text-stardust-500">
                        {c.hungerBefore != null && `Hunger ${c.hungerBefore}/5. `}
                        {c.fullnessAfter != null && `Fullness ${c.fullnessAfter}/5. `}
                        {c.energyNote}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {isOwnerView && state && state.diary.length > 0 && (
            <section className="card-living rounded-3xl p-5">
              <h2 className="text-base font-semibold text-star-100">Recent diary entries</h2>
              <ul className="mt-3 divide-y divide-nova-400/10">
                {state.diary.slice(0, 10).map((d) => (
                  <li key={d.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="text-sm text-star-100">{d.description}</span>
                    <span className="shrink-0 text-xs text-stardust-500">
                      {d.caloriesLow}–{d.caloriesHigh} cal range
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <NedaCard />
        </div>
      )}

      <MedicalDisclaimerFooter />
    </div>
  );
}
