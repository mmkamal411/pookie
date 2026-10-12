"use client";

// W8 — Wellbeing. Teen-private mood pulse, journal, crisis-ladder hooks.
// Hard rule: never parent-visible, including aggregates. The route itself
// denies parents (see the page); this component assumes the subject.
// Event emission (wellbeing_events, metadata only) is a database trigger
// owned by the backend (sol-health section 5.3). Crisis *response* belongs
// to the safety designer; this file defines the data-side surfaces.
// Contract: docs/solutions/sol-health.md section 5; UX: sol-ux.md section 11.

import { useCallback, useEffect, useState } from "react";
import {
  getWellbeingState,
  submitWellbeingCheckin,
  deleteWellbeingEntry,
  setWellbeingRetention,
} from "@/lib/health/actions";
import type { HealthContext, WellbeingState } from "@/lib/health/types";
import { MOOD_LABELS, COPY, TIER_NAMES } from "@/lib/health/types";
import {
  HealthPageHeader,
  MedicalDisclaimerFooter,
  CrisisResources,
  NedaCard,
  TierBadge,
  BackendNotReady,
  ActionError,
} from "./ui";

const MOOD_EMOJI: Record<number, string> = { 1: "🌧", 2: "☁", 3: "🌤", 4: "☀", 5: "✨" };

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function CrisisScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="animate-rise">
      <div className="card-living rounded-3xl p-6">
        <h2 className="text-sunlit text-2xl font-semibold">{COPY.wellbeingRung3}</h2>
        <p className="mt-2 text-sm leading-relaxed text-stardust-300">
          You do not have to handle this alone. Right now you can:
        </p>
        <div className="mt-4">
          <CrisisResources />
        </div>
        <p className="mt-4 rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3 text-xs leading-relaxed text-stardust-300">
          {COPY.wellbeingFirstRun}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl bg-nova-500 px-4 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
          >
            I am okay for now
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm font-medium text-stardust-300 hover:text-star-100"
          >
            Back to my check-in
          </button>
        </div>
      </div>
    </div>
  );
}

export function WellbeingView({ childId, ctx }: { childId: string; ctx: HealthContext }) {
  const [state, setState] = useState<WellbeingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [showRung1, setShowRung1] = useState(false);
  const [retention, setRetention] = useState<string>("default");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getWellbeingState(childId);
    setLoading(false);
    if (!res.ok) {
      if (res.code !== "backend_not_ready") setError(res.message);
      return;
    }
    setState(res.data);
    setRetention(res.data.retentionDays ? String(res.data.retentionDays) : "default");
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (mood == null || saving) return;
    setSaving(true);
    setError(null);
    const res = await submitWellbeingCheckin(childId, {
      mood,
      note: note.trim() ? note.trim() : undefined,
      needHelpNow: false,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMood(null);
    setNote("");
    // Rung 1: a single low check-in gets warmth in place, not escalation.
    setShowRung1(mood <= 2);
    load();
  }

  async function remove(entryId: string) {
    setDeleting(entryId);
    const res = await deleteWellbeingEntry(childId, entryId);
    setDeleting(null);
    if (!res.ok) setError(res.message);
    else load();
  }

  async function changeRetention(next: string) {
    setRetention(next);
    const res = await setWellbeingRetention(
      childId,
      next as "30" | "90" | "365" | "default",
    );
    if (!res.ok) {
      setError(res.message);
      load();
    }
  }

  if (crisis) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
        <CrisisScreen onBack={() => setCrisis(false)} />
        <MedicalDisclaimerFooter />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
      <div className="flex items-start justify-between gap-3">
        <HealthPageHeader
          eyebrow="W8 · Wellbeing"
          title="Wellbeing"
          sub="The mood pulse. How the day actually felt."
        />
        <button
          type="button"
          onClick={() => setCrisis(true)}
          className="animate-bloom shrink-0 rounded-full border border-nova-400/40 bg-nova-400/10 px-4 py-2 text-sm font-semibold text-nova-200 hover:bg-nova-400/20"
        >
          Get help
        </button>
      </div>

      <div
        className="animate-bloom mt-4 flex flex-wrap items-center gap-2"
        style={{ animationDelay: "0.08s" }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-comet-400/30 bg-comet-400/10 px-2.5 py-1 text-xs font-medium text-comet-300">
          🔒 Teen-private space
        </span>
        <TierBadge tier="H2" />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-stardust-500">
        Only you can see this. Not your parents. Not your school. {COPY.noAggregatesLine}
      </p>

      {!ctx.schemaReady && !loading ? (
        <div className="mt-6">
          <BackendNotReady feature="Wellbeing" />
        </div>
      ) : (
        <div className="animate-bloom mt-6 space-y-5" style={{ animationDelay: "0.14s" }}>
          {error && <ActionError message={error} onDismiss={() => setError(null)} />}

          {/* Mood pulse */}
          <section className="card-living rounded-3xl p-5">
            <h2 className="text-base font-semibold text-star-100">How is today feeling?</h2>
            <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Mood">
              {[1, 2, 3, 4, 5].map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mood === m}
                  onClick={() => setMood(m)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 transition-all ${
                    mood === m
                      ? "border-nova-400/60 bg-nova-400/15 shadow-glow-sm"
                      : "border-nova-400/15 bg-nebula-900/60 hover:border-nova-400/35"
                  }`}
                >
                  <span aria-hidden="true" className="text-2xl">
                    {MOOD_EMOJI[m]}
                  </span>
                  <span className="text-xs text-stardust-300">{MOOD_LABELS[m]}</span>
                </button>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 uppercase">
                A few words, if you want (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="What made today feel like this?"
                className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
              />
            </label>
            {showRung1 && (
              <p className="animate-rise mt-3 rounded-xl border border-comet-400/20 bg-comet-400/5 px-4 py-3 text-sm text-comet-200">
                {COPY.wellbeingRung1}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={mood == null || saving || loading}
                className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {saving ? "Saving." : "Log today's pulse"}
              </button>
              <button
                type="button"
                onClick={() => setCrisis(true)}
                className="rounded-xl border border-nova-400/40 px-4 py-2.5 text-sm font-semibold text-nova-200 hover:bg-nova-400/10"
              >
                I need help now
              </button>
            </div>
          </section>

          {/* Past entries — the teen's own trends only */}
          <section className="card-living rounded-3xl p-5">
            <h2 className="text-base font-semibold text-star-100">Your past check-ins</h2>
            {loading && <p className="mt-2 text-xs text-stardust-500">Loading.</p>}
            {!loading && state && state.entries.length === 0 && (
              <p className="mt-2 text-xs text-stardust-500">
                Nothing here yet. Your pulses will land here, for your eyes only.
              </p>
            )}
            {!loading && state && state.entries.length > 0 && (
              <ul className="mt-3 divide-y divide-nova-400/10">
                {state.entries.map((e) => (
                  <li key={e.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-star-100">
                          <span aria-hidden="true" className="mr-2">
                            {MOOD_EMOJI[e.mood] ?? "•"}
                          </span>
                          {MOOD_LABELS[e.mood] ?? ""}
                          <span className="ml-2 text-xs text-stardust-500">{formatDay(e.enteredAt)}</span>
                        </p>
                        {e.note && (
                          <p className="mt-1 text-sm leading-relaxed text-stardust-300">{e.note}</p>
                        )}
                        {e.tier === "H3" && (
                          <p className="mt-1 text-xs text-nova-300">
                            {TIER_NAMES.H3}. Only you, always.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        disabled={deleting === e.id}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-stardust-500 hover:text-red-300 disabled:opacity-50"
                      >
                        {deleting === e.id ? "Deleting." : "Delete"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Retention + NEDA */}
          <section className="card-living rounded-3xl p-5">
            <h2 className="text-base font-semibold text-star-100">How long to keep my words</h2>
            <p className="mt-1 text-xs leading-relaxed text-stardust-300">
              Your journal words auto-delete after the time you pick. Your mood scores stay as your
              private trends. Nothing here is kept forever.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Retention">
              {[
                { v: "30", label: "30 days" },
                { v: "90", label: "90 days" },
                { v: "365", label: "1 year" },
                { v: "default", label: "Default" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  role="radio"
                  aria-checked={retention === o.v}
                  onClick={() => changeRetention(o.v)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition-colors ${
                    retention === o.v
                      ? "border-nova-400/60 bg-nova-400/15 text-nova-200"
                      : "border-nova-400/15 text-stardust-300 hover:border-nova-400/35"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>

          <NedaCard />

          <p className="rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3 text-xs leading-relaxed text-stardust-300">
            {COPY.wellbeingFirstRun}
          </p>
        </div>
      )}

      <MedicalDisclaimerFooter />
    </div>
  );
}
