// W22 — Activity. Fitness as training for the mission.
// Quick workout logging, this-week view with streaks, manual step goal,
// and history. Device sync arrives in a later phase — steps are typed in
// by hand, and the UI says so honestly.
//
// Design: spaceship — dark cosmic, Title Case, divine orb accents,
// energetic but never loud. No blank pages: every empty state carries
// a seed action.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Button, EmptyState } from "@/components/ui";
import {
  api,
  ApiError,
  fmtDate,
  LoadVeil,
  WarmError,
} from "@/components/home-money/shared";

type WorkoutType = "run" | "walk" | "bike" | "swim" | "gym" | "sport" | "other";

interface Workout {
  id: string;
  child_id: string | null;
  type: WorkoutType;
  duration_min: number;
  distance_mi: string | number | null;
  calories: number | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

interface WeekTotal {
  week_start: string;
  workouts: number;
  minutes: number;
  miles: number;
}

interface ActivitySummary {
  workouts_this_week: number;
  minutes_this_week: number;
  miles_this_week: number;
  streak_days: number;
  week_totals: WeekTotal[];
}

interface DaySteps {
  logged_date: string;
  steps: number;
  step_goal: number;
}

const WORKOUT_TYPES: { id: WorkoutType; label: string; glyph: string }[] = [
  { id: "run", label: "Run", glyph: "🏃" },
  { id: "walk", label: "Walk", glyph: "🚶" },
  { id: "bike", label: "Bike", glyph: "🚴" },
  { id: "swim", label: "Swim", glyph: "🏊" },
  { id: "gym", label: "Gym", glyph: "🏋️" },
  { id: "sport", label: "Sport", glyph: "⚽" },
  { id: "other", label: "Other", glyph: "✨" },
];

const DISTANCE_TYPES: WorkoutType[] = ["run", "walk", "bike", "swim"];
const DURATION_PRESETS = [15, 20, 30, 45, 60];

const TYPE_LABEL: Record<WorkoutType, string> = {
  run: "Run",
  walk: "Walk",
  bike: "Bike",
  swim: "Swim",
  gym: "Gym",
  sport: "Sport",
  other: "Other",
};

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtMiles(v: string | number | null): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)} mi`;
}

/* ------------------------------------------------------------------ */
/* milestones — the orb celebrates, never scolds                        */
/* ------------------------------------------------------------------ */
function earnedMilestones(
  summary: ActivitySummary,
  steps: { today: DaySteps } | null,
  historyCount: number,
): string[] {
  const out: string[] = [];
  if (historyCount > 0) out.push("First Light Logged");
  if (summary.workouts_this_week >= 3) out.push("Mission Pace — 3 Workouts This Week");
  if (summary.minutes_this_week >= 150) out.push("Weekly Endurance — 150+ Minutes");
  if (summary.streak_days >= 3) out.push(`${summary.streak_days}-Day Rhythm`);
  if (summary.streak_days >= 7) out.push(`${summary.streak_days}-Day Orbit`);
  if (steps && steps.today.steps >= steps.today.step_goal && steps.today.step_goal > 0)
    out.push("Step Goal Reached");
  return out;
}

/* ------------------------------------------------------------------ */
/* quick log form — 15-second logging                                    */
/* ------------------------------------------------------------------ */
function QuickLog({
  childParam,
  onLogged,
}: {
  childParam: string;
  onLogged: () => void;
}) {
  const [type, setType] = useState<WorkoutType>("run");
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [calories, setCalories] = useState("");
  const [notes, setNotes] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveDuration =
    customDuration.trim() !== "" ? Number(customDuration) : duration;

  async function submit() {
    setError(null);
    if (!Number.isFinite(effectiveDuration) || effectiveDuration < 1 || effectiveDuration > 1440) {
      setError("Give the workout a duration between 1 and 1440 minutes.");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        type,
        duration_min: Math.round(effectiveDuration),
      };
      if (distance.trim() !== "") body.distance_mi = Number(distance);
      if (calories.trim() !== "") body.calories = Number(calories);
      if (notes.trim() !== "") body.notes = notes.trim();
      await api<{ workout: Workout }>(`/api/v1/household/activity${childParam}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDistance("");
      setCalories("");
      setNotes("");
      setCustomDuration("");
      setShowDetails(false);
      onLogged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The log did not land. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-nova-400/20 bg-nebula-950/80 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none";

  return (
    <Card className="card-living quantum-warm" padding="lg">
      <p className="text-base font-semibold text-star-100">Log A Workout</p>
      <p className="mt-1 text-xs text-stardust-500">
        Fifteen seconds. Type, time, done — the mission logs itself.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {WORKOUT_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            aria-pressed={type === t.id}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs transition-all ${
              type === t.id
                ? "border-nova-300/60 bg-nova-500/15 text-star-100"
                : "border-nova-400/15 bg-nebula-950/60 text-stardust-400 hover:border-nova-400/40"
            }`}
            style={type === t.id ? { boxShadow: "0 0 18px rgb(52 211 153 / 0.25)" } : undefined}
          >
            <span aria-hidden="true" className="text-xl">
              {t.glyph}
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-stardust-300">Duration</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setDuration(m);
                setCustomDuration("");
              }}
              aria-pressed={customDuration === "" && duration === m}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${
                customDuration === "" && duration === m
                  ? "border-nova-300/60 bg-nova-500/15 text-star-100"
                  : "border-nova-400/15 text-stardust-400 hover:border-nova-400/40"
              }`}
            >
              {m} min
            </button>
          ))}
          <input
            value={customDuration}
            onChange={(e) => setCustomDuration(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Custom"
            inputMode="numeric"
            aria-label="Custom duration in minutes"
            className="w-24 rounded-full border border-nova-400/15 bg-nebula-950/80 px-3 py-1.5 text-center text-xs text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="mt-4 text-xs text-nova-300 hover:text-star-100"
      >
        {showDetails ? "− Hide details" : "+ Distance, calories, notes"}
      </button>

      {showDetails && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={DISTANCE_TYPES.includes(type) ? "" : "opacity-40"}>
            <label htmlFor="act-distance" className="text-xs text-stardust-300">
              Distance (mi, optional)
            </label>
            <input
              id="act-distance"
              value={distance}
              onChange={(e) => setDistance(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="e.g. 3.1"
              inputMode="decimal"
              disabled={!DISTANCE_TYPES.includes(type)}
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div>
            <label htmlFor="act-calories" className="text-xs text-stardust-300">
              Calories (optional)
            </label>
            <input
              id="act-calories"
              value={calories}
              onChange={(e) => setCalories(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Logged, never a target"
              inputMode="numeric"
              className={`mt-1 ${inputCls}`}
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="act-notes" className="text-xs text-stardust-300">
              Notes (optional)
            </label>
            <input
              id="act-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="How did it feel?"
              className={`mt-1 ${inputCls}`}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <WarmError message={error} onRetry={() => setError(null)} />
        </div>
      )}

      <div className="mt-4">
        <Button onClick={submit} disabled={busy} className="w-full">
          {busy ? "Logging…" : "Log Workout"}
        </Button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* step goal card — manual logging, honest about devices                */
/* ------------------------------------------------------------------ */
function StepCard({
  steps,
  childParam,
  onChanged,
}: {
  steps: { today: DaySteps; week: DaySteps[] } | null;
  childParam: string;
  onChanged: () => void;
}) {
  const [entry, setEntry] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = steps?.today;
  const pct =
    today && today.step_goal > 0 ? Math.min(100, Math.round((today.steps / today.step_goal) * 100)) : 0;

  async function saveSteps() {
    setError(null);
    const n = Number(entry);
    if (!Number.isFinite(n) || n < 0 || n > 200000) {
      setError("Enter a step count between 0 and 200,000.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/v1/household/activity/steps${childParam}`, {
        method: "POST",
        body: JSON.stringify({ logged_date: todayLocal(), steps: Math.round(n) }),
      });
      setEntry("");
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Steps did not save. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGoal() {
    setError(null);
    const n = Number(goal);
    if (!Number.isFinite(n) || n < 1000 || n > 100000) {
      setError("Set a daily goal between 1,000 and 100,000 steps.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/v1/household/activity/steps${childParam}`, {
        method: "POST",
        body: JSON.stringify({
          logged_date: todayLocal(),
          steps: today?.steps ?? 0,
          step_goal: Math.round(n),
        }),
      });
      setGoal("");
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Goal did not save. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const maxWeek = Math.max(1, ...(steps?.week.map((d) => d.steps) ?? [0]));

  return (
    <Card className="card-living" padding="lg">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-star-100">Step Goal</p>
          <p className="mt-1 text-xs text-stardust-500">
            Manual logging for now — device sync arrives in a later phase.
          </p>
        </div>
        {today && (
          <p className="text-right text-sm">
            <span className="font-semibold text-star-100">{today.steps.toLocaleString()}</span>
            <span className="text-stardust-500"> / {today.step_goal.toLocaleString()}</span>
          </p>
        )}
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-nebula-950/80"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Steps toward today's goal"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-nova-500 to-cyan-300 transition-all"
          style={{ width: `${pct}%`, boxShadow: "0 0 12px rgb(52 211 153 / 0.5)" }}
        />
      </div>

      {steps && steps.week.some((d) => d.steps > 0) && (
        <div className="mt-4 flex items-end justify-between gap-1.5" aria-hidden="true">
          {steps.week.map((d) => (
            <div key={d.logged_date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-nova-500/40"
                style={{
                  height: `${Math.max(4, Math.round((d.steps / maxWeek) * 56))}px`,
                  boxShadow: d.steps >= d.step_goal ? "0 0 8px rgb(52 211 153 / 0.5)" : undefined,
                  background: d.steps >= d.step_goal ? "rgb(52 211 153 / 0.6)" : undefined,
                }}
              />
              <span className="text-[10px] text-stardust-500">
                {new Date(`${d.logged_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Today's steps"
          inputMode="numeric"
          aria-label="Today's step count"
          className="w-36 rounded-xl border border-nova-400/20 bg-nebula-950/80 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
        />
        <Button size="sm" variant="ghost" onClick={saveSteps} disabled={busy}>
          Save Steps
        </Button>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="Daily goal"
          inputMode="numeric"
          aria-label="Daily step goal"
          className="w-32 rounded-xl border border-nova-400/20 bg-nebula-950/80 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
        />
        <Button size="sm" variant="ghost" onClick={saveGoal} disabled={busy}>
          Set Goal
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <WarmError message={error} onRetry={() => setError(null)} />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* main hub                                                            */
/* ------------------------------------------------------------------ */
export function ActivityHub({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [person, setPerson] = useState<"me" | "child">("child");
  const [range, setRange] = useState<"week" | "month">("week");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [steps, setSteps] = useState<{ today: DaySteps; week: DaySteps[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const childParam = person === "child" ? `?child_id=${encodeURIComponent(childId)}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const personQs = person === "child" ? `&child_id=${encodeURIComponent(childId)}` : "";
      const [act, st] = await Promise.all([
        api<{ workouts: Workout[]; summary: ActivitySummary }>(
          `/api/v1/household/activity?range=${range}${personQs}`,
        ),
        api<{ today: DaySteps; week: DaySteps[] }>(
          `/api/v1/household/activity/steps${person === "child" ? `?child_id=${encodeURIComponent(childId)}` : ""}`,
        ),
      ]);
      setWorkouts(act.workouts);
      setSummary(act.summary);
      setSteps(st);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Activity did not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [range, person, childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeWorkout(id: string) {
    setConfirmDelete(null);
    try {
      await api(`/api/v1/household/activity/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Delete did not complete. Try again in a moment.");
    }
  }

  const milestones = summary ? earnedMilestones(summary, steps, workouts.length) : [];

  if (loading && !summary) return <LoadVeil label="Charting your training course." />;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      <p className="text-xs font-medium tracking-widest text-nova-300 uppercase">W22 · Activity</p>
      <h1 className="mt-1 text-2xl font-bold text-star-100">Activity</h1>
      <p className="mt-1 text-sm text-stardust-300">
        Training for the mission — log a workout in seconds, watch the rhythm build.
      </p>

      {/* person + range controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-nova-400/20 bg-nebula-900/60 p-1" role="tablist" aria-label="Whose activity">
          {(["me", "child"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={person === p}
              onClick={() => setPerson(p)}
              className={`rounded-full px-4 py-1.5 text-xs transition-all ${
                person === p
                  ? "bg-nova-500/20 text-star-100"
                  : "text-stardust-400 hover:text-star-100"
              }`}
            >
              {p === "me" ? "Me" : childName}
            </button>
          ))}
        </div>
        <div className="flex rounded-full border border-nova-400/20 bg-nebula-900/60 p-1" role="tablist" aria-label="History range">
          {(["week", "month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={`rounded-full px-4 py-1.5 text-xs transition-all ${
                range === r ? "bg-nova-500/20 text-star-100" : "text-stardust-400 hover:text-star-100"
              }`}
            >
              {r === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <WarmError message={error} onRetry={load} />
        </div>
      )}

      <div className="animate-bloom mt-4 space-y-4" style={{ animationDelay: "0.08s" }}>
        <QuickLog childParam={childParam} onLogged={load} />

        {/* this week */}
        {summary && (
          <Card className="card-living" padding="lg">
            <p className="text-base font-semibold text-star-100">This Week</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Workouts", value: String(summary.workouts_this_week), glyph: "💪" },
                { label: "Minutes", value: fmtMinutes(summary.minutes_this_week), glyph: "⏱️" },
                { label: "Miles", value: summary.miles_this_week > 0 ? summary.miles_this_week.toFixed(1) : "—", glyph: "🛣️" },
                { label: "Day Streak", value: String(summary.streak_days), glyph: "🔥" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl border border-nova-400/15 bg-nebula-950/60 p-3 text-center"
                >
                  <div aria-hidden="true" className="text-xl">
                    {s.glyph}
                  </div>
                  <p className="mt-1 text-lg font-bold text-star-100">{s.value}</p>
                  <p className="text-[11px] text-stardust-500">{s.label}</p>
                </div>
              ))}
            </div>
            {summary.streak_days >= 2 && (
              <p className="mt-3 text-xs text-stardust-300">
                <span aria-hidden="true">✨</span> {summary.streak_days} days in a row with movement.
                The rhythm is building.
              </p>
            )}
          </Card>
        )}

        {/* milestones */}
        {milestones.length > 0 && (
          <Card className="quantum-warm card-living" padding="lg">
            <div className="flex items-center gap-3">
              <div
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-nova-500/20 text-2xl"
                style={{ boxShadow: "0 0 24px rgb(52 211 153 / 0.45)" }}
              >
                💫
              </div>
              <div>
                <p className="text-base font-semibold text-star-100">The Orb Celebrates</p>
                <p className="text-xs text-stardust-500">Milestones earned — gentle, never a grade.</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {milestones.map((m) => (
                <li key={m} className="flex items-center gap-2 text-sm text-stardust-200">
                  <span aria-hidden="true" className="text-nova-300">
                    ✦
                  </span>
                  {m}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <StepCard steps={steps} childParam={childParam} onChanged={load} />

        {/* history */}
        <Card className="card-living" padding="lg">
          <p className="text-base font-semibold text-star-100">History</p>

          {summary && summary.week_totals.some((w) => w.workouts > 0) && (
            <div className="mt-3 space-y-2">
              {summary.week_totals
                .filter((w) => w.workouts > 0)
                .map((w) => (
                  <div
                    key={w.week_start}
                    className="flex items-center justify-between rounded-xl border border-nova-400/10 bg-nebula-950/50 px-3 py-2 text-xs"
                  >
                    <span className="text-stardust-300">Week Of {fmtDate(w.week_start)}</span>
                    <span className="text-star-100">
                      {w.workouts} workout{w.workouts === 1 ? "" : "s"} · {fmtMinutes(w.minutes)}
                      {w.miles > 0 ? ` · ${w.miles.toFixed(1)} mi` : ""}
                    </span>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-4">
            {workouts.length === 0 ? (
              <EmptyState
                icon="🚀"
                title="No Workouts Logged Yet"
                message="The first rep is the hardest. Log a quick walk or gym session above and the mission log starts here."
              />
            ) : (
              <ul className="divide-y divide-nova-400/10">
                {workouts.map((w) => {
                  const glyph = WORKOUT_TYPES.find((t) => t.id === w.type)?.glyph ?? "✨";
                  const miles = fmtMiles(w.distance_mi);
                  return (
                    <li key={w.id} className="flex items-center gap-3 py-3">
                      <div
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-nova-400/20 bg-nebula-950/70 text-lg"
                      >
                        {glyph}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-star-100">
                          {TYPE_LABEL[w.type]} · {fmtMinutes(w.duration_min)}
                          {miles ? <span className="text-stardust-400"> · {miles}</span> : null}
                          {w.calories != null && w.calories > 0 ? (
                            <span className="text-stardust-400"> · {w.calories} cal</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-stardust-500">
                          {fmtTime(w.logged_at)}
                          {w.notes ? ` · ${w.notes}` : ""}
                        </p>
                      </div>
                      {confirmDelete === w.id ? (
                        <div className="flex shrink-0 gap-1.5">
                          <Button size="sm" variant="danger" onClick={() => removeWorkout(w.id)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            Keep
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(w.id)}
                          aria-label={`Delete ${TYPE_LABEL[w.type]} workout`}
                          className="shrink-0 rounded-lg px-2 py-1 text-stardust-500 hover:bg-nebula-800 hover:text-star-100"
                        >
                          🗑
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
