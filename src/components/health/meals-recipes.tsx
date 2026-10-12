"use client";

// W13 elevate — Recipe library. Saved recipes with structured ingredients,
// tags, favorites, and search. Ingredients power the smart shopping list.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getMealRecipes,
  saveMealRecipe,
  deleteMealRecipe,
} from "@/lib/health/actions";
import type { MealIngredient, MealRecipe } from "@/lib/health/types";
import { ActionError, BackendNotReady } from "./ui";

const MAX_INGREDIENT_ROWS = 20;

function emptyIngredient(): MealIngredient {
  return { name: "", quantity: 1, unit: "" };
}

function RecipeForm({
  childId,
  initial,
  onDone,
  onError,
}: {
  childId: string;
  initial: MealRecipe | null;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [ingredients, setIngredients] = useState<MealIngredient[]>(
    initial?.ingredients.length ? initial.ingredients : [emptyIngredient()],
  );
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(", "));
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [saving, setSaving] = useState(false);

  function setIng(i: number, patch: Partial<MealIngredient>) {
    setIngredients((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    if (name.trim().length === 0 || saving) return;
    setSaving(true);
    const cleaned = ingredients
      .map((i) => ({ ...i, name: i.name.trim(), unit: i.unit.trim() }))
      .filter((i) => i.name.length > 0);
    const res = await saveMealRecipe(childId, {
      id: initial?.id,
        name: name.trim(),
        ingredients: cleaned,
        instructions,
        photoUrl: initial?.photoUrl ?? null,
        tags: tagsText
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 12),
        favorite,
      });
    setSaving(false);
    if (!res.ok) {
      onError(res.message);
      return;
    }
    onDone();
  }

  return (
    <div className="card-living rounded-3xl p-5">
      <h3 className="text-base font-semibold text-star-100">
        {initial ? "Edit Recipe" : "New Recipe"}
      </h3>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs text-stardust-500">Recipe name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="Sheet-Pan Chicken and Veggies"
          className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
        />
      </label>

      <div className="mt-4">
        <span className="mb-1 block text-xs text-stardust-500">
          Ingredients (quantities feed the shopping list)
        </span>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={ing.name}
                onChange={(e) => setIng(i, { name: e.target.value })}
                maxLength={80}
                placeholder="Chicken breast"
                aria-label={`Ingredient ${i + 1} name`}
                className="input-rooted min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-star-100"
              />
              <input
                value={Number.isFinite(ing.quantity) ? String(ing.quantity) : ""}
                onChange={(e) =>
                  setIng(i, { quantity: Number(e.target.value) > 0 ? Number(e.target.value) : 1 })
                }
                inputMode="decimal"
                aria-label={`Ingredient ${i + 1} quantity`}
                className="input-rooted w-16 rounded-xl px-2 py-2 text-sm text-star-100"
              />
              <input
                value={ing.unit}
                onChange={(e) => setIng(i, { unit: e.target.value })}
                maxLength={20}
                placeholder="lb"
                aria-label={`Ingredient ${i + 1} unit`}
                className="input-rooted w-16 rounded-xl px-2 py-2 text-sm text-star-100"
              />
              <button
                type="button"
                onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={ingredients.length === 1}
                aria-label={`Remove ingredient ${i + 1}`}
                className="rounded-xl px-2 text-sm text-stardust-500 hover:text-star-100 disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {ingredients.length < MAX_INGREDIENT_ROWS && (
          <button
            type="button"
            onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
            className="mt-2 text-xs text-nova-300 underline decoration-dotted underline-offset-2 hover:text-nova-200"
          >
            Add an ingredient
          </button>
        )}
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs text-stardust-500">How to make it</span>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Season, roast at 425 for 25 minutes, rest 5."
          className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
        />
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-stardust-500">Tags (comma separated)</span>
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            maxLength={200}
            placeholder="weeknight, chicken, one-pan"
            className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
          />
        </label>
        <label className="flex items-center gap-2 self-end rounded-xl border border-nova-400/15 bg-nebula-900/60 px-3 py-2.5">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => setFavorite(e.target.checked)}
            className="h-4 w-4 accent-pink-400"
          />
          <span className="text-sm text-star-100">Family favorite</span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || name.trim().length === 0}
          className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {saving ? "Saving." : initial ? "Save changes" : "Save recipe"}
        </button>
      </div>
    </div>
  );
}

export function RecipeLibrary({
  childId,
  schemaReady,
}: {
  childId: string;
  schemaReady: boolean;
}) {
  const [recipes, setRecipes] = useState<MealRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<MealRecipe | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getMealRecipes(childId);
    setLoading(false);
    if (!res.ok) {
      if (res.code !== "backend_not_ready") setError(res.message);
      return;
    }
    setRecipes(res.data.recipes);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (tagFilter && !r.tags.includes(tagFilter)) return false;
      if (!q) return true;
      const hay = `${r.name} ${r.tags.join(" ")} ${r.ingredients.map((i) => i.name).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [recipes, search, tagFilter]);

  async function remove(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    const res = await deleteMealRecipe(childId, id);
    setDeletingId(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  if (!schemaReady && !loading) {
    return (
      <div className="mt-6">
        <BackendNotReady feature="Recipe Library" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {error && <ActionError message={error} onDismiss={() => setError(null)} />}

      {(creating || editing) && (
        <>
          <RecipeForm
            childId={childId}
            initial={editing}
            onDone={() => {
              setCreating(false);
              setEditing(null);
              load();
            }}
            onError={setError}
          />
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setEditing(null);
            }}
            className="text-sm text-stardust-300 underline decoration-dotted underline-offset-2 hover:text-star-100"
          >
            Back to recipes
          </button>
        </>
      )}

      {!creating && !editing && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={80}
              placeholder="Search recipes, ingredients, tags"
              className="input-rooted min-w-0 flex-1 rounded-xl px-3 py-2 text-sm text-star-100"
            />
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-xl bg-nova-500 px-4 py-2 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02]"
            >
              Add recipe
            </button>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tagFilter && (
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className="rounded-full border border-nova-400/40 bg-nova-400/10 px-3 py-1 text-xs text-nova-200"
                >
                  × {tagFilter}
                </button>
              )}
              {!tagFilter &&
                allTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagFilter(tag)}
                    className="rounded-full border border-nova-400/15 bg-nebula-900/60 px-3 py-1 text-xs text-stardust-300 hover:text-star-100"
                  >
                    {tag} · {count}
                  </button>
                ))}
            </div>
          )}

          {loading && <p className="text-xs text-stardust-500">Loading recipes.</p>}
          {!loading && filtered.length === 0 && (
            <div className="card-living rounded-3xl p-6 text-center">
              <p className="text-sm font-semibold text-star-100">
                {recipes.length === 0 ? "No recipes saved yet." : "Nothing matches that search."}
              </p>
              <p className="mt-1 text-xs text-stardust-300">
                {recipes.length === 0
                  ? "Save the meals your family actually eats. The shopping list builds itself from here."
                  : "Try a different word, or clear the tag filter."}
              </p>
              {recipes.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-4 rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02]"
                >
                  Save your first recipe
                </button>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {filtered.map((r) => (
              <div key={r.id} className="card-living rounded-3xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-star-100">
                    {r.favorite && <span aria-label="favorite" className="mr-1">✦</span>}
                    {r.name}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="rounded-lg px-2 py-1 text-xs text-stardust-300 hover:text-star-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={deletingId === r.id}
                      className="rounded-lg px-2 py-1 text-xs text-stardust-500 hover:text-red-300 disabled:opacity-50"
                    >
                      {deletingId === r.id ? "Removing." : "Remove"}
                    </button>
                  </div>
                </div>
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-nova-400/15 bg-nebula-900/60 px-2 py-0.5 text-[11px] text-stardust-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-stardust-300">
                  {r.ingredients.length === 0
                    ? "No ingredients listed."
                    : r.ingredients
                        .slice(0, 6)
                        .map((i) => i.name)
                        .join(", ") + (r.ingredients.length > 6 ? "…" : "")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
