"use client";

// W13 elevate — Weekly planner. 7-day grid (breakfast / lunch / dinner),
// tap a slot to assign a recipe or an idea, Surprise Me, copy last week,
// smart shopping-list generation, and allergen warnings from preferences.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  getMealPlans,
  getMealRecipes,
  getMealPreferences,
  getMealAllergenContext,
  saveMealPlan,
} from "@/lib/health/actions";
import type {
  MealIngredient,
  MealPlan,
  MealPlanDay,
  MealPreference,
  MealRecipe,
} from "@/lib/health/types";
import { ActionError, BackendNotReady } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;
type MealSlot = (typeof MEALS)[number];

const MEAL_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

const IDEA_KEYS: Record<MealSlot, "breakfastIdea" | "lunchIdea" | "dinnerIdea"> = {
  breakfast: "breakfastIdea",
  lunch: "lunchIdea",
  dinner: "dinnerIdea",
};

const RECIPE_KEYS: Record<MealSlot, "breakfastRecipeId" | "lunchRecipeId" | "dinnerRecipeId"> = {
  breakfast: "breakfastRecipeId",
  lunch: "lunchRecipeId",
  dinner: "dinnerRecipeId",
};

function emptyDays(): MealPlanDay[] {
  return DAYS.map((day) => ({ day, breakfastIdea: "", lunchIdea: "", dinnerIdea: "", notes: "" }));
}

function mondayOf(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function prettyWeek(weekStart: string): string {
  const d = new Date(`${weekStart}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function matchesTerm(haystack: string, term: string): boolean {
  const h = norm(haystack);
  const t = norm(term);
  return t.length > 0 && (h.includes(t) || t.includes(h));
}

interface SlotWarning {
  label: string;
  who: string;
  strong: boolean;
}

/** Advisory allergen warnings for one recipe. Never blocks. */
function warningsForRecipe(
  recipe: MealRecipe,
  preferences: MealPreference[],
  recorded: Array<{ allergen: string; severity: string }>,
): SlotWarning[] {
  const out: SlotWarning[] = [];
  const seen = new Set<string>();
  const ingredientText = recipe.ingredients.map((i) => norm(i.name)).join(" ");
  const hay = `${norm(recipe.name)} ${ingredientText}`;
  if (!hay.trim()) return out;

  for (const p of preferences) {
    for (const flag of p.allergenFlags) {
      if (matchesTerm(hay, flag)) {
        const key = `pref:${norm(flag)}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ label: flag, who: p.personLabel, strong: false });
        }
      }
    }
  }
  for (const a of recorded) {
    if (matchesTerm(hay, a.allergen)) {
      const key = `rec:${norm(a.allergen)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          label: a.allergen,
          who: "on file",
          strong: a.severity === "anaphylaxis",
        });
      }
    }
  }
  return out;
}

/** Weighted-random recipe pick for Surprise Me. Skips allergen hits. */
function surprisePick(
  candidates: MealRecipe[],
  preferences: MealPreference[],
  recorded: Array<{ allergen: string; severity: string }>,
  usedIds: Set<string>,
): MealRecipe | null {
  const likes = preferences.flatMap((p) => p.likes);
  const dislikes = preferences.flatMap((p) => p.dislikes);
  const scored: Array<{ recipe: MealRecipe; weight: number }> = [];

  for (const r of candidates) {
    if (usedIds.has(r.id)) continue;
    if (warningsForRecipe(r, preferences, recorded).length > 0) continue;
    let w = 1;
    if (r.favorite) w += 3;
    const hay = `${r.name} ${r.tags.join(" ")} ${r.ingredients.map((i) => i.name).join(" ")}`;
    for (const like of likes) if (matchesTerm(hay, like)) w += 1;
    for (const dislike of dislikes) if (matchesTerm(hay, dislike)) w -= 2;
    if (w > 0) scored.push({ recipe: r, weight: w });
  }
  if (scored.length === 0) return null;
  const total = scored.reduce((s, x) => s + x.weight, 0);
  let roll = Math.random() * total;
  for (const s of scored) {
    roll -= s.weight;
    if (roll <= 0) return s.recipe;
  }
  return scored[scored.length - 1].recipe;
}

// ---------------------------------------------------------------------------
// Smart shopping list: consolidate ingredients across the week.
// ---------------------------------------------------------------------------

const UNIT_ALIASES: Record<string, string> = {
  c: "cup",
  cup: "cup",
  cups: "cup",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  pinch: "pinch",
  pinches: "pinch",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  can: "can",
  cans: "can",
  package: "package",
  packages: "package",
  bunch: "bunch",
  bunches: "bunch",
};

function normalizeUnit(unit: string): string {
  const u = norm(unit);
  return UNIT_ALIASES[u] ?? u;
}

function normalizeName(name: string): string {
  const n = norm(name);
  // Crude plural folding so "tomatoes" and "tomato" merge.
  if (n.length > 4 && n.endsWith("s") && !n.endsWith("ss")) return n.slice(0, -1);
  return n;
}

export interface ShoppingItemDraft {
  name: string;
  quantity: number;
  unit: string;
}

export function consolidateIngredients(
  ingredients: MealIngredient[],
): ShoppingItemDraft[] {
  const groups = new Map<string, ShoppingItemDraft>();
  for (const ing of ingredients) {
    if (!norm(ing.name)) continue;
    const key = `${normalizeName(ing.name)}||${normalizeUnit(ing.unit)}`;
    const cur = groups.get(key);
    const qty = Number.isFinite(ing.quantity) && ing.quantity > 0 ? ing.quantity : 1;
    if (cur) {
      cur.quantity = Math.round((cur.quantity + qty) * 100) / 100;
    } else {
      groups.set(key, {
        name: ing.name.trim(),
        quantity: Math.round(qty * 100) / 100,
        unit: normalizeUnit(ing.unit),
      });
    }
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Slot picker modal
// ---------------------------------------------------------------------------

function SlotPicker({
  meal,
  recipes,
  preferences,
  recorded,
  currentName,
  onAssign,
  onSurprise,
  onClear,
  onClose,
}: {
  meal: MealSlot;
  recipes: MealRecipe[];
  preferences: MealPreference[];
  recorded: Array<{ allergen: string; severity: string }>;
  currentName: string;
  onAssign: (recipe: MealRecipe | null, text: string) => void;
  onSurprise: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [customText, setCustomText] = useState("");

  const filtered = useMemo(() => {
    const query = norm(q);
    if (!query) return recipes;
    return recipes.filter((r) => {
      const hay = norm(`${r.name} ${r.tags.join(" ")} ${r.ingredients.map((i) => i.name).join(" ")}`);
      return hay.includes(query);
    });
  }, [recipes, q]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-nebula-950/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Pick a ${MEAL_LABELS[meal]}`}
    >
      <div
        className="card-living max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-star-100">
            {MEAL_LABELS[meal]}
            {currentName && <span className="ml-2 text-xs font-normal text-stardust-300">· {currentName}</span>}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-lg text-stardust-300 hover:text-star-100"
          >
            ×
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={80}
            placeholder="Search your recipes"
            className="input-rooted min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-star-100"
          />
          <button
            type="button"
            onClick={onSurprise}
            disabled={recipes.length === 0}
            className="shrink-0 rounded-xl border border-nova-500/40 px-4 py-2 text-sm font-semibold text-nova-300 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            Surprise Me
          </button>
        </div>

        {recipes.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-nova-400/15 bg-nebula-900/60 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-star-100">No recipes yet.</p>
            <p className="mt-1 text-xs text-stardust-300">
              Save recipes in the Recipes tab and Surprise Me will pick from them.
              Or type an idea below.
            </p>
          </div>
        ) : (
          <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
            {filtered.map((r) => {
              const warns = warningsForRecipe(r, preferences, recorded);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onAssign(r, r.name)}
                  className="w-full rounded-xl border border-nova-400/15 bg-nebula-900/60 px-3 py-2.5 text-left transition-colors hover:border-nova-400/40"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-star-100">
                      {r.favorite && <span className="mr-1 text-pink-300">✦</span>}
                      {r.name}
                    </span>
                    {r.tags[0] && (
                      <span className="shrink-0 rounded-full bg-nebula-800 px-2 py-0.5 text-[11px] text-stardust-300">
                        {r.tags[0]}
                      </span>
                    )}
                  </span>
                  {warns.length > 0 && (
                    <span className="mt-1 block text-xs text-amber-300">
                      ⚠ {warns.map((w) => `${w.label} · ${w.who}`).join(", ")}
                    </span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="py-4 text-center text-xs text-stardust-500">Nothing matches that search.</p>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-nova-400/10 pt-4">
          <span className="mb-1 block text-xs text-stardust-500">Or type an idea</span>
          <div className="flex gap-2">
            <input
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              maxLength={120}
              placeholder="Tacos, but make it Tuesday"
              className="input-rooted min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-star-100"
            />
            <button
              type="button"
              onClick={() => onAssign(null, customText.trim())}
              disabled={customText.trim().length === 0}
              className="shrink-0 rounded-xl bg-nova-500 px-4 py-2 text-sm font-semibold text-nebula-950 transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              Use It
            </button>
          </div>
          {currentName && (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 text-xs text-stardust-500 underline decoration-dotted underline-offset-2 hover:text-red-300"
            >
              Clear this slot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shopping preview modal
// ---------------------------------------------------------------------------

function ShoppingPreview({
  items,
  skippedCount,
  extras,
  onExtrasChange,
  onSend,
  sending,
  sentCount,
  error,
  onClose,
}: {
  items: ShoppingItemDraft[];
  skippedCount: number;
  extras: string;
  onExtrasChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  sentCount: number | null;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-nebula-950/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Shopping list preview"
    >
      <div
        className="card-living max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-star-100">This Week's Groceries</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-lg text-stardust-300 hover:text-star-100"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-xs text-stardust-300">
          Consolidated from your planned recipes. Duplicates merged, quantities summed.
        </p>

        {items.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-nova-400/15 bg-nebula-900/60 px-4 py-5 text-center text-sm text-stardust-300">
            Nothing to buy yet. Assign recipes with ingredients to fill this list.
          </p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {items.map((item, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between gap-2 rounded-xl border border-nova-400/10 bg-nebula-900/60 px-3 py-2"
              >
                <span className="text-sm text-star-100">{item.name}</span>
                <span className="shrink-0 text-xs text-stardust-300">
                  {item.quantity}
                  {item.unit ? ` ${item.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        {skippedCount > 0 && (
          <p className="mt-3 text-xs text-stardust-500">
            {skippedCount} planned {skippedCount === 1 ? "meal has" : "meals have"} no
            recipe, so they add no ingredients. Use extras for those.
          </p>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs text-stardust-500">
            Extras (one per line: milk, paper towels, snacks)
          </span>
          <textarea
            value={extras}
            onChange={(e) => onExtrasChange(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={"Milk\nPaper towels"}
            className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSend}
            disabled={sending || (items.length === 0 && extras.trim().length === 0)}
            className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {sending ? "Sending." : sentCount != null ? `✓ ${sentCount} Sent` : "Send to Shopping List"}
          </button>
          {sentCount != null && (
            <p className="text-sm text-comet-200">Check the Shopping module. Happy cooking.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week planner
// ---------------------------------------------------------------------------

export function WeekPlanner({ childId, schemaReady }: { childId: string; schemaReady: boolean }) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date().toISOString().slice(0, 10)));
  const [days, setDays] = useState<MealPlanDay[]>(emptyDays());
  const [recipes, setRecipes] = useState<MealRecipe[]>([]);
  const [preferences, setPreferences] = useState<MealPreference[]>([]);
  const [recorded, setRecorded] = useState<Array<{ allergen: string; severity: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<{ day: number; meal: MealSlot } | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [extras, setExtras] = useState("");
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);

  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [planRes, recipeRes, prefRes, ctxRes] = await Promise.all([
      getMealPlans(childId),
      getMealRecipes(childId),
      getMealPreferences(childId),
      getMealAllergenContext(childId),
    ]);
    setLoading(false);
    if (!planRes.ok) {
      if (planRes.code !== "backend_not_ready") setError(planRes.message);
      return;
    }
    setPlans(planRes.data.plans);
    if (recipeRes.ok) setRecipes(recipeRes.data.recipes);
    if (prefRes.ok) setPreferences(prefRes.data.preferences);
    if (ctxRes.ok) setRecorded(ctxRes.data.allergens);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  // Resolve the editable days whenever the week or the plan list changes.
  useEffect(() => {
    const plan = plans.find((p) => p.weekStart === weekStart);
    if (plan && plan.days.length === 7) {
      setDays(plan.days);
    } else {
      setDays(emptyDays());
    }
    setSaved(false);
    setSentCount(null);
    setExtras("");
  }, [plans, weekStart]);

  function setSlot(dayIdx: number, meal: MealSlot, recipe: MealRecipe | null, text: string) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIdx
          ? {
              ...d,
              [IDEA_KEYS[meal]]: recipe ? recipe.name : text,
              [RECIPE_KEYS[meal]]: recipe ? recipe.id : null,
            }
          : d,
      ),
    );
    setSaved(false);
    setPicker(null);
  }

  function usedIds(): Set<string> {
    const ids = new Set<string>();
    for (const d of days) {
      for (const m of MEALS) {
        const id = d[RECIPE_KEYS[m]];
        if (id) ids.add(id);
      }
    }
    return ids;
  }

  function surpriseSlot(dayIdx: number, meal: MealSlot) {
    const pick = surprisePick(recipes, preferences, recorded, usedIds());
    if (!pick) {
      setError(
        recipes.length === 0
          ? "Save a few recipes first. Surprise Me picks from your library."
          : "Everything in the library is already on this week, or conflicts with an allergy. You pick this one.",
      );
      setPicker(null);
      return;
    }
    setSlot(dayIdx, meal, pick, "");
  }

  function surpriseAll() {
    const ids = usedIds();
    let changed = 0;
    const next = days.map((d) => {
      const row = { ...d };
      for (const meal of MEALS) {
        if (row[IDEA_KEYS[meal]]) continue;
        const pick = surprisePick(recipes, preferences, recorded, ids);
        if (pick) {
          row[IDEA_KEYS[meal]] = pick.name;
          row[RECIPE_KEYS[meal]] = pick.id;
          ids.add(pick.id);
          changed += 1;
        }
      }
      return row;
    });
    setDays(next);
    setSaved(false);
    if (changed === 0) {
      setError(
        recipes.length === 0
          ? "Save a few recipes first. Surprise Me picks from your library."
          : "No empty slots left, or the rest conflict with allergies.",
      );
    } else {
      setError(null);
    }
  }

  function copyLastWeek() {
    const prev = plans.find((p) => p.weekStart === addDays(weekStart, -7));
    if (!prev || prev.days.length !== 7) {
      setError("No saved plan from last week to copy.");
      return;
    }
    setDays(prev.days.map((d) => ({ ...d })));
    setSaved(false);
    setError(null);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const res = await saveMealPlan(childId, { weekStart, days, groceryList: [] });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSaved(true);
    load();
  }

  const shoppingItems = useMemo(() => {
    const ingredients: MealIngredient[] = [];
    for (const d of days) {
      for (const m of MEALS) {
        const id = d[RECIPE_KEYS[m]];
        const recipe = id ? recipeById.get(id) : undefined;
        if (recipe) ingredients.push(...recipe.ingredients);
      }
    }
    return consolidateIngredients(ingredients);
  }, [days, recipeById]);

  const skippedNoRecipe = useMemo(() => {
    let n = 0;
    for (const d of days) {
      for (const m of MEALS) {
        if (d[IDEA_KEYS[m]] && !d[RECIPE_KEYS[m]]) n += 1;
      }
    }
    return n;
  }, [days]);

  const filledCount = useMemo(() => {
    let n = 0;
    for (const d of days) for (const m of MEALS) if (d[IDEA_KEYS[m]]) n += 1;
    return n;
  }, [days]);

  async function sendToShoppingList() {
    const extraItems = extras
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((name) => ({ name }));
    const items = [
      ...shoppingItems.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
      ...extraItems.map((e) => ({ name: e.name })),
    ].slice(0, 50);
    if (items.length === 0 || sending) return;
    setSending(true);
    setShopError(null);
    setSentCount(null);
    try {
      const res = await fetch("/api/v1/household/shopping/items/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items,
          source: "meal-plan",
          source_ref: { weekStart },
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        const msg = String(json.error?.message ?? "");
        throw new Error(
          msg.includes("PARENT_ROLE_REQUIRED")
            ? "Only a parent can send a meal-plan list. Ask a parent to tap send."
            : msg || "Could not send to the shopping list.",
        );
      }
      setSentCount(json.data.items.length);
    } catch (e) {
      setShopError(e instanceof Error ? e.message : "Could not send to the shopping list.");
    } finally {
      setSending(false);
    }
  }

  function dayDate(i: number): string {
    return new Date(`${addDays(weekStart, i)}T12:00:00`).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
  }

  if (!schemaReady && !loading) {
    return (
      <div className="mt-6">
        <BackendNotReady feature="Week Planner" />
      </div>
    );
  }

  const gridCols = "88px repeat(7, minmax(104px, 1fr))";

  return (
    <div className="mt-6 space-y-5">
      {error && <ActionError message={error} onDismiss={() => setError(null)} />}

      <section className="card-living rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Previous week"
              className="rounded-xl border border-nova-400/15 bg-nebula-900/60 px-3 py-1.5 text-sm text-stardust-300 hover:text-star-100"
            >
              ‹
            </button>
            <h2 className="text-base font-semibold text-star-100">
              Week of {prettyWeek(weekStart)}
            </h2>
            <button
              type="button"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Next week"
              className="rounded-xl border border-nova-400/15 bg-nebula-900/60 px-3 py-1.5 text-sm text-stardust-300 hover:text-star-100"
            >
              ›
            </button>
          </div>
          <p className="text-xs text-stardust-300">
            {filledCount} of 21 meals planned
          </p>
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-stardust-500">Loading the week.</p>
        ) : (
          <div className="mt-4 overflow-x-auto pb-1">
            <div className="grid min-w-[820px] gap-1.5" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {DAYS.map((day, i) => (
                <div key={day} className="px-1 text-center">
                  <p className="text-xs font-semibold text-star-100">{day.slice(0, 3)}</p>
                  <p className="text-[11px] text-stardust-500">{dayDate(i)}</p>
                </div>
              ))}

              {MEALS.map((meal) => (
                <Fragment key={meal}>
                  <div key={`${meal}-label`} className="flex items-center px-1">
                    <span className="text-xs font-medium text-stardust-300">{MEAL_LABELS[meal]}</span>
                  </div>
                  {days.map((d, dayIdx) => {
                    const name = d[IDEA_KEYS[meal]];
                    const recipeId = d[RECIPE_KEYS[meal]];
                    const recipe = recipeId ? recipeById.get(recipeId) : undefined;
                    const warns = recipe ? warningsForRecipe(recipe, preferences, recorded) : [];
                    return (
                      <button
                        key={`${meal}-${dayIdx}`}
                        type="button"
                        onClick={() => setPicker({ day: dayIdx, meal })}
                        className={`min-h-[64px] rounded-xl border px-2 py-1.5 text-left transition-all hover:scale-[1.02] ${
                          name
                            ? "border-nova-400/25 bg-nebula-900/70"
                            : "border-dashed border-nova-400/20 bg-nebula-950/40 hover:border-nova-400/40"
                        }`}
                      >
                        {name ? (
                          <>
                            <span className="block truncate text-xs font-medium text-star-100">
                              {recipe && <span className="mr-1 text-nova-300">◦</span>}
                              {name}
                            </span>
                            {warns.length > 0 && (
                              <span
                                className={`mt-1 block text-[11px] leading-tight ${
                                  warns.some((w) => w.strong) ? "text-red-300" : "text-amber-300"
                                }`}
                              >
                                ⚠ {warns.map((w) => `${w.label} · ${w.who}`).join(", ")}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="block text-center text-lg text-stardust-500">+</span>
                        )}
                      </button>
                    );
                  })}
                </Fragment>
              ))}

              <div className="flex items-center px-1">
                <span className="text-xs font-medium text-stardust-300">Notes</span>
              </div>
              {days.map((d, dayIdx) => (
                <input
                  key={`notes-${dayIdx}`}
                  value={d.notes}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDays((prev) => prev.map((row, i) => (i === dayIdx ? { ...row, notes: v } : row)));
                    setSaved(false);
                  }}
                  maxLength={280}
                  placeholder="Leftovers, soccer at 6"
                  aria-label={`${DAYS[dayIdx]} notes`}
                  className="input-rooted rounded-xl px-2 py-1.5 text-xs text-star-100"
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {saving ? "Saving." : saved ? "Saved ✓" : "Save this week"}
          </button>
          <button
            type="button"
            onClick={surpriseAll}
            className="rounded-xl border border-nova-500/40 px-4 py-2.5 text-sm font-semibold text-nova-300 transition-all hover:scale-[1.02]"
          >
            Surprise Me: Fill Empty
          </button>
          <button
            type="button"
            onClick={copyLastWeek}
            className="rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-2.5 text-sm font-medium text-stardust-300 transition-all hover:scale-[1.02] hover:text-star-100"
          >
            Copy Last Week
          </button>
          <button
            type="button"
            onClick={() => {
              setSentCount(null);
              setShopError(null);
              setShoppingOpen(true);
            }}
            className="rounded-xl border border-comet-400/40 px-4 py-2.5 text-sm font-semibold text-comet-200 transition-all hover:scale-[1.02]"
          >
            Generate Shopping List
          </button>
        </div>
        {saved && (
          <p className="mt-2 text-xs text-comet-200">Saved. One less thing to figure out at 6pm.</p>
        )}
      </section>

      {picker && (
        <SlotPicker
          meal={picker.meal}
          recipes={recipes}
          preferences={preferences}
          recorded={recorded}
          currentName={days[picker.day][IDEA_KEYS[picker.meal]]}
          onAssign={(recipe, text) => setSlot(picker.day, picker.meal, recipe, text)}
          onSurprise={() => surpriseSlot(picker.day, picker.meal)}
          onClear={() => setSlot(picker.day, picker.meal, null, "")}
          onClose={() => setPicker(null)}
        />
      )}

      {shoppingOpen && (
        <ShoppingPreview
          items={shoppingItems}
          skippedCount={skippedNoRecipe}
          extras={extras}
          onExtrasChange={setExtras}
          onSend={sendToShoppingList}
          sending={sending}
          sentCount={sentCount}
          error={shopError}
          onClose={() => setShoppingOpen(false)}
        />
      )}
    </div>
  );
}
