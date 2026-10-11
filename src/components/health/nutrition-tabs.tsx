"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PookieOrb } from "@/components/pookie-orb";
import {
  DOCTOR_RAIL,
  ESTIMATE_BADGE,
  REAL_FOOD_FIRST,
  WHATIF_FRAMING,
} from "@/server/health/copy";
import {
  formatCalorieRange,
  formatShortDate,
} from "@/lib/health-format";
import type {
  DayCloseout,
  DaySummary,
  FoodLogEntry,
  NutritionTarget,
  WeeklyPatterns,
} from "@/server/services/nutrition";
import type { HealthSubject } from "@/server/services/health";

type Tab = "diary" | "day" | "closeout" | "patterns" | "whatif";

/**
 * /household/health/[subjectId]/nutrition — role-shaped tabs.
 * Diary: subject-self (or under-13 parent) only. Patterns: the parent-safe
 * aggregates view. What-if: stubbed until the food-database key lands.
 */
export function NutritionTabs({
  subject,
  role,
  canSeeDiary,
  date,
  diary,
  day,
  closeout,
  patterns,
  target,
  targetKindCopy,
  demo = false,
}: {
  subject: HealthSubject;
  role: "parent" | "child";
  canSeeDiary: boolean;
  date: string;
  diary: FoodLogEntry[];
  day: DaySummary | null;
  closeout: DayCloseout | null;
  patterns: WeeklyPatterns | null;
  target: NutritionTarget | null;
  targetKindCopy: string | null;
  demo?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(canSeeDiary ? "diary" : "patterns");
  const tabs: { key: Tab; label: string; enabled: boolean }[] = [
    { key: "diary", label: "Diary", enabled: canSeeDiary },
    { key: "day", label: "Today", enabled: canSeeDiary },
    { key: "closeout", label: "Closeout", enabled: canSeeDiary },
    { key: "patterns", label: "Patterns", enabled: true },
    { key: "whatif", label: "What-if", enabled: true },
  ];

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "22%", left: "86%", animationDelay: "1.4s" }} />

      <Link href={`/household/health/${subject.id}`} className="text-sm text-leaf-400 hover:text-leaf-300">
        ← {subject.label}&apos;s health
      </Link>

      <div className="animate-bloom mt-4 flex items-center gap-4">
        <PookieOrb size={56} />
        <p className="text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase">
          Nutrition · {subject.label}
        </p>
      </div>

      <h1 className="text-sunlit animate-bloom mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Eating well, without the math anxiety
      </h1>
      <p className="animate-bloom mt-3 max-w-xl leading-relaxed text-bark-300" style={{ animationDelay: "0.08s" }}>
        Nourishment and energy — fuel for the game, protein for growing.
        {target && targetKindCopy && (
          <> Right now: <span className="font-medium text-dew-100">{targetKindCopy}</span></>
        )}
      </p>

      <div className="animate-bloom mt-6 flex flex-wrap gap-2" style={{ animationDelay: "0.12s" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => t.enabled && setTab(t.key)}
            disabled={!t.enabled}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "bg-leaf-500 text-canopy-950 shadow-glow-sm"
                : t.enabled
                  ? "border border-leaf-400/20 text-bark-300 hover:border-leaf-400/40"
                  : "cursor-not-allowed border border-leaf-400/10 text-bark-500 opacity-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "diary" && canSeeDiary && (
          <DiaryTab subjectId={subject.id} date={date} diary={diary} demo={demo} />
        )}
        {tab === "diary" && !canSeeDiary && <DiaryPrivate label={subject.label} />}
        {tab === "day" && canSeeDiary && <DayTab day={day} />}
        {tab === "closeout" && canSeeDiary && <CloseoutTab closeout={closeout} />}
        {tab === "patterns" && <PatternsTab patterns={patterns} role={role} />}
        {tab === "whatif" && <WhatIfTab demo={demo} />}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-bark-500">{DOCTOR_RAIL}</p>
    </main>
  );
}

function DiaryPrivate({ label }: { label: string }) {
  return (
    <div className="card-living animate-bloom rounded-3xl px-6 py-8 text-center">
      <p className="font-medium text-dew-100">This diary belongs to {label}.</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-bark-300">
        Food logs stay private by default for teens — parents see weekly
        patterns instead, never the plate-by-plate diary. Check the Patterns
        tab for the gentle overview.
      </p>
    </div>
  );
}

function DiaryTab({
  subjectId,
  date,
  diary,
  demo,
}: {
  subjectId: string;
  date: string;
  diary: FoodLogEntry[];
  demo: boolean;
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [calLow, setCalLow] = useState("");
  const [calHigh, setCalHigh] = useState("");
  const [protein, setProtein] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const low = Number(calLow);
    const high = Number(calHigh);
    if (!description.trim() || !Number.isFinite(low) || !Number.isFinite(high)) {
      setError("Give the food a name and a calorie range.");
      return;
    }
    if (high < low) {
      setError("The high end of the range can't be below the low end.");
      return;
    }
    if (source === "photo_estimate" && low === high) {
      setError("Photo estimates are ranges — low and high can't be the same.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/health/subjects/${subjectId}/nutrition/logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          logged_at: new Date(`${date}T12:00:00Z`).toISOString(),
          source,
          calories_low: low,
          calories_high: high,
          ...(protein.trim() !== ""
            ? { protein_g_low: Number(protein), protein_g_high: Number(protein) }
            : {}),
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setDescription("");
      setCalLow("");
      setCalHigh("");
      setProtein("");
      router.refresh();
    } catch {
      setError("Couldn't save the entry — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(logId: string) {
    try {
      const res = await fetch(
        `/api/v1/health/subjects/${subjectId}/nutrition/logs/${logId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("delete_failed");
      router.refresh();
    } catch {
      setError("Couldn't remove the entry — try again in a moment.");
    }
  }

  return (
    <div>
      <div className="grid gap-3">
        {diary.length === 0 && (
          <div className="card-living rounded-3xl px-6 py-6 text-center">
            <p className="text-sm text-bark-300">
              Nothing logged for {formatShortDate(date)} yet — the first entry
              is the hardest, then it&apos;s a habit.
            </p>
          </div>
        )}
        {diary.map((e, i) => (
          <div
            key={e.id}
            className="card-living animate-bloom flex items-center justify-between gap-3 rounded-3xl px-5 py-4"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-dew-100">{e.description}</p>
              <p className="mt-1 text-xs text-bark-500">
                {formatCalorieRange(Number(e.calories_low), Number(e.calories_high))}
                {e.source === "photo_estimate" && ` · ${ESTIMATE_BADGE}`}
                {e.protein_g_low != null && ` · ${e.protein_g_low}–${e.protein_g_high}g protein`}
              </p>
            </div>
            {!demo && (
              <button
                onClick={() => remove(e.id)}
                className="shrink-0 rounded-2xl border border-leaf-400/20 px-3 py-1.5 text-xs text-bark-500 hover:border-red-300/40 hover:text-red-300"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {!demo && (
        <div className="card-living animate-bloom mt-6 rounded-3xl px-6 py-5">
          <p className="font-medium text-dew-100">Log something</p>
          <p className="mt-1 text-sm text-bark-300">
            Ranges welcome — &quot;about 500–700&quot; beats a fake-exact
            number every time.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was it? (e.g. two eggs and toast)"
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500 sm:col-span-2"
            />
            <input
              value={calLow}
              onChange={(e) => setCalLow(e.target.value)}
              inputMode="numeric"
              placeholder="Calories, low end"
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500"
            />
            <input
              value={calHigh}
              onChange={(e) => setCalHigh(e.target.value)}
              inputMode="numeric"
              placeholder="Calories, high end"
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500"
            />
            <input
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              inputMode="numeric"
              placeholder="Protein grams (optional)"
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500"
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100"
            >
              <option value="manual">I typed it in</option>
              <option value="photo_estimate">Photo estimate (range)</option>
              <option value="nutritionix">Nutritionix lookup</option>
              <option value="barcode">Barcode scan</option>
            </select>
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            className="mt-4 rounded-2xl bg-leaf-500 px-5 py-2.5 text-sm font-semibold text-canopy-950 shadow-glow-sm transition hover:bg-leaf-400 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Log it"}
          </button>
        </div>
      )}
    </div>
  );
}

function DayTab({ day }: { day: DaySummary | null }) {
  if (!day) {
    return (
      <div className="card-living rounded-3xl px-6 py-8 text-center">
        <p className="text-sm text-bark-300">No entries for this day yet.</p>
      </div>
    );
  }
  const t = day.totals;
  const target = day.target;
  return (
    <div className="card-living animate-bloom rounded-3xl px-6 py-5">
      <p className="font-medium text-dew-100">
        {formatShortDate(day.date)} · {t.entries} {t.entries === 1 ? "entry" : "entries"}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DayStat
          label="Calories"
          value={formatCalorieRange(t.calories_low, t.calories_high)}
          target={
            target?.daily_calorie_low != null
              ? `${target.daily_calorie_low}–${target.daily_calorie_high ?? "…"} target`
              : undefined
          }
        />
        <DayStat
          label="Protein"
          value={t.protein_g != null ? `${t.protein_g}g` : "—"}
          target={target?.protein_g_target != null ? `${target.protein_g_target}g target` : undefined}
        />
        <DayStat
          label="Carbs / fat"
          value={`${t.carbs_g != null ? `${t.carbs_g}g` : "—"} / ${t.fat_g != null ? `${t.fat_g}g` : "—"}`}
        />
      </div>
      {t.estimated_entries > 0 && (
        <p className="mt-4 text-xs text-bark-500">{ESTIMATE_BADGE}</p>
      )}
    </div>
  );
}

function DayStat({ label, value, target }: { label: string; value: string; target?: string }) {
  return (
    <div className="rounded-2xl border border-leaf-400/15 bg-canopy-900/60 px-4 py-3">
      <p className="text-xs text-bark-500">{label}</p>
      <p className="mt-1 font-semibold text-dew-100">{value}</p>
      {target && <p className="mt-1 text-xs text-bark-500">{target}</p>}
    </div>
  );
}

function CloseoutTab({ closeout }: { closeout: DayCloseout | null }) {
  if (!closeout) {
    return (
      <div className="card-living rounded-3xl px-6 py-8 text-center">
        <p className="text-sm text-bark-300">Nothing to close out — log a meal first.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="card-living animate-bloom rounded-3xl px-6 py-5">
        <p className="font-medium text-dew-100">The gentle closeout</p>
        <p className="mt-2 text-sm leading-relaxed text-bark-300">{closeout.tomorrow_note}</p>
        {closeout.gaps.length > 0 && (
          <div className="mt-4 space-y-3">
            {closeout.gaps.map((g) => (
              <div key={g.nutrient} className="rounded-2xl border border-leaf-400/15 bg-canopy-900/60 px-4 py-3">
                <p className="text-sm text-dew-100">
                  About <span className="font-semibold">{g.short_by}{g.unit}</span> more {g.nutrient} would round the day out.
                </p>
                {g.swaps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {g.swaps.map((s) => (
                      <p key={s.id} className="text-xs text-bark-300">
                        🌱 Try <span className="text-dew-100">{s.to_food}</span> instead of {s.from_food.toLowerCase()} — {s.why.toLowerCase()}.
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-bark-500">{REAL_FOOD_FIRST}</p>
    </div>
  );
}

function PatternsTab({ patterns, role }: { patterns: WeeklyPatterns | null; role: "parent" | "child" }) {
  if (!patterns || patterns.entries === 0) {
    return (
      <div className="card-living rounded-3xl px-6 py-8 text-center">
        <p className="text-sm text-bark-300">
          No entries this week yet — patterns appear once there&apos;s a week to look at.
        </p>
      </div>
    );
  }
  return (
    <div className="card-living animate-bloom rounded-3xl px-6 py-5">
      <p className="font-medium text-dew-100">This week, gently</p>
      <p className="mt-1 text-sm text-bark-300">
        {role === "parent"
          ? "Aggregates only — the diary stays private. This is the whole window, by design."
          : "Your week at a glance — the shape of it, not a score."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <DayStat label="Days logged" value={`${patterns.days_logged} of 7`} />
        <DayStat
          label="Avg calories"
          value={
            patterns.avg_calories_low != null
              ? formatCalorieRange(Math.round(patterns.avg_calories_low), Math.round(patterns.avg_calories_high ?? patterns.avg_calories_low))
              : "—"
          }
        />
        <DayStat
          label="Avg protein"
          value={patterns.avg_protein_g != null ? `${patterns.avg_protein_g}g` : "—"}
        />
      </div>
      <p className="mt-3 text-xs text-bark-500">
        Week starting {formatShortDate(patterns.week_start)} · {patterns.entries} entries
      </p>
    </div>
  );
}

function WhatIfTab({ demo }: { demo: boolean }) {
  const [query, setQuery] = useState("");
  return (
    <div className="card-living animate-bloom rounded-3xl px-6 py-5">
      <p className="font-medium text-dew-100">What if I eat…?</p>
      <p className="mt-1 text-sm text-bark-300">{WHATIF_FRAMING}</p>
      <div className="mt-4 flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="a Whopper with cheese"
          disabled={demo}
          className="flex-1 rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500 disabled:opacity-50"
        />
        <button
          disabled
          className="cursor-not-allowed rounded-2xl bg-leaf-500/40 px-5 py-2.5 text-sm font-semibold text-canopy-950 opacity-60"
        >
          Ask
        </button>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-bark-300">
        The what-if simulator is still connecting to its food database —
        Pookie would rather say &quot;coming soon&quot; than guess at your
        food. Meanwhile: {REAL_FOOD_FIRST}
      </p>
    </div>
  );
}
