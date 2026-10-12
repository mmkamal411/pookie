"use client";

// W13 elevate — Family preferences. Per-person likes, dislikes, and allergen
// flags. Explicit entry only. Allergens raise warnings on the week planner,
// never hard blocks.

import { useCallback, useEffect, useState } from "react";
import {
  getMealPreferences,
  getMealAllergenContext,
  saveMealPreferences,
} from "@/lib/health/actions";
import type { MealPreference } from "@/lib/health/types";
import { ActionError, BackendNotReady } from "./ui";

interface PersonDraft {
  personLabel: string;
  likes: string;
  dislikes: string;
  allergenFlags: string;
}

function toDraft(p: MealPreference): PersonDraft {
  return {
    personLabel: p.personLabel,
    likes: p.likes.join(", "),
    dislikes: p.dislikes.join(", "),
    allergenFlags: p.allergenFlags.join(", "),
  };
}

const emptyDraft: PersonDraft = {
  personLabel: "",
  likes: "",
  dislikes: "",
  allergenFlags: "",
};

function splitList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function FamilyPreferences({
  childId,
  schemaReady,
}: {
  childId: string;
  schemaReady: boolean;
}) {
  const [people, setPeople] = useState<PersonDraft[]>([]);
  const [savedEmpty, setSavedEmpty] = useState(false);
  const [recordedAllergens, setRecordedAllergens] = useState<
    Array<{ allergen: string; severity: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [prefRes, ctxRes] = await Promise.all([
      getMealPreferences(childId),
      getMealAllergenContext(childId),
    ]);
    setLoading(false);
    if (!prefRes.ok) {
      if (prefRes.code !== "backend_not_ready") setError(prefRes.message);
      return;
    }
    setPeople(prefRes.data.preferences.map(toDraft));
    setSavedEmpty(prefRes.data.preferences.length === 0);
    if (ctxRes.ok) setRecordedAllergens(ctxRes.data.allergens);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  function setPerson(i: number, patch: Partial<PersonDraft>) {
    setPeople((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const payload = people
      .map((p) => ({
        personLabel: p.personLabel.trim(),
        likes: splitList(p.likes),
        dislikes: splitList(p.dislikes),
        allergenFlags: splitList(p.allergenFlags),
      }))
      .filter((p) => p.personLabel.length > 0);
    const res = await saveMealPreferences(childId, payload);
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSaved(true);
    setSavedEmpty(payload.length === 0);
  }

  if (!schemaReady && !loading) {
    return (
      <div className="mt-6">
        <BackendNotReady feature="Family Preferences" />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {error && <ActionError message={error} onDismiss={() => setError(null)} />}

      <section className="card-living rounded-3xl p-5">
        <h2 className="text-base font-semibold text-star-100">Family Preferences</h2>
        <p className="mt-1 text-xs text-stardust-300">
          Who is at the table. Likes and dislikes guide Surprise Me. Allergen
          flags warn you while planning the week.
        </p>

        {recordedAllergens.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
            <p className="text-xs font-semibold text-amber-200">On file with health records</p>
            <p className="mt-1 text-xs text-stardust-300">
              {recordedAllergens
                .map((a) => `${a.allergen}${a.severity ? ` (${a.severity})` : ""}`)
                .join(", ")}
              . These warn you on the planner too.
            </p>
          </div>
        )}

        {loading && <p className="mt-4 text-xs text-stardust-500">Loading.</p>}

        {!loading && people.length === 0 && savedEmpty && (
          <div className="mt-4 rounded-2xl border border-nova-400/15 bg-nebula-900/60 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-star-100">No one added yet.</p>
            <p className="mt-1 text-xs text-stardust-300">
              Add the people you cook for, and Pookie will keep their tastes and
              allergies in mind.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {people.map((p, i) => (
            <details
              key={i}
              open={i === 0}
              className="rounded-2xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3"
            >
              <summary className="cursor-pointer list-none">
                <span className="flex items-center justify-between">
                  <span className="text-sm font-medium text-star-100">
                    {p.personLabel.trim() || "New person"}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setPeople((prev) => prev.filter((_, idx) => idx !== i));
                      setSaved(false);
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-stardust-500 hover:text-red-300"
                  >
                    Remove
                  </button>
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs text-stardust-500">Name</span>
                  <input
                    value={p.personLabel}
                    onChange={(e) => setPerson(i, { personLabel: e.target.value })}
                    maxLength={60}
                    placeholder="Mom"
                    className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-stardust-500">
                    Loves (comma separated)
                  </span>
                  <input
                    value={p.likes}
                    onChange={(e) => setPerson(i, { likes: e.target.value })}
                    maxLength={600}
                    placeholder="tacos, berries, anything crunchy"
                    className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-stardust-500">
                    Skips (comma separated)
                  </span>
                  <input
                    value={p.dislikes}
                    onChange={(e) => setPerson(i, { dislikes: e.target.value })}
                    maxLength={600}
                    placeholder="mushrooms, olives"
                    className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-stardust-500">
                    Allergies and sensitivities (comma separated)
                  </span>
                  <input
                    value={p.allergenFlags}
                    onChange={(e) => setPerson(i, { allergenFlags: e.target.value })}
                    maxLength={600}
                    placeholder="peanuts, shellfish"
                    className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                  />
                </label>
              </div>
            </details>
          ))}
        </div>

        {people.length < 12 && (
          <button
            type="button"
            onClick={() => {
              setPeople((prev) => [...prev, { ...emptyDraft }]);
              setSaved(false);
            }}
            className="mt-4 text-xs text-nova-300 underline decoration-dotted underline-offset-2 hover:text-nova-200"
          >
            Add a person
          </button>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {saving ? "Saving." : "Save preferences"}
          </button>
          {saved && (
            <p className="text-sm text-comet-200">
              Saved. The planner will keep these in mind.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
