"use client";

import { useState } from "react";
import { orbCelebrate } from "@/lib/orb/orb-events";
import type { CalibrationSummary, TodayCheckin } from "@/lib/school/types";
import { ProvenanceLabel } from "./provenance-label";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function bandCopy(band: CalibrationSummary["band"]): string {
  if (band === "sharpening")
    return "your estimates are getting sharper — that's metacognition, and it predicts better studying.";
  if (band === "steady") return "steady — you're reading yourself well.";
  return "still calibrating — keep estimating, the pattern builds with practice.";
}

/**
 * Daily check-in — FR-SCHOOL-003 panel redesign.
 *
 * This is a TEEN-OWNED metacognition tool, never a parent-facing lie detector:
 * - The teen optionally estimates near-term outcomes ("I think I got ~80% on
 *   today's quiz") and sees their rolling calibration ("within ±X pts on
 *   average — your estimates are getting sharper").
 * - Calibration, estimates, and the check-in body are NEVER shown to parents:
 *   this component fetches only teen-scoped endpoints (requireChildRole),
 *   and renders a private-space note for any non-teen role.
 * - Check-ins are teen-deletable, effective immediately.
 * - Day-of-lab: one-question lab-safety pulse (FR-SCHOOL-019) + anonymous ask box.
 */
export function CheckinForm({
  childId,
  childName,
  role,
  todayCheckin,
  calibration,
  labToday,
}: {
  childId: string;
  childName: string;
  role: "parent" | "child";
  todayCheckin?: TodayCheckin | null;
  calibration?: CalibrationSummary | null;
  labToday?: { class_name: string } | null;
}) {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [text, setText] = useState("");
  const [estimates, setEstimates] = useState<Array<{ label: string; estimate: number }>>([]);
  const [labReadCard, setLabReadCard] = useState(false);
  const [labQuestion, setLabQuestion] = useState("");
  const [saved, setSaved] = useState(!!todayCheckin);
  const [checkinId, setCheckinId] = useState<string | null>(todayCheckin?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialNote, setPartialNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Parent (or any non-teen) view: check-ins are the teen's private space.
  // Never the form, never the body, never calibration — by construction.
  if (role !== "child") {
    return (
      <div className="card-living animate-rise rounded-3xl border border-nova-400/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-star-100">Check-ins are {childName}&apos;s private space</p>
            <p className="mt-0.5 text-xs leading-relaxed text-stardust-300">
              Their words, mood answers, and estimate calibration stay with them — you
              can&apos;t see them here, and they can&apos;t see yours. What your
              school shares with you directly doesn&apos;t change.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <ProvenanceLabel kind="app-generated" />
        </div>
      </div>
    );
  }

  async function submit() {
    setSaving(true);
    setError(null);
    setPartialNote(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/checkins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: todayIso(),
          mood,
          energy,
          stress,
          text: text.trim() ? text.trim() : undefined,
          estimates: estimates.length > 0 ? estimates : undefined,
          lab_read_safety_card: labToday ? labReadCard : undefined,
          lab_anonymous_question: labToday && labQuestion.trim() ? labQuestion.trim() : undefined,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { estimates_saved: boolean; lab_saved: boolean; checkin: { id: string } };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "save_failed");
      setCheckinId(json.data?.checkin?.id ?? null);
      // Squad Oracle: the debriefing officer celebrates — mission logged.
      orbCelebrate("daily debriefing complete");
      if (json.data && (!json.data.estimates_saved || (labToday && !json.data.lab_saved))) {
        setPartialNote(
          "Your check-in saved. The newest bits (estimates / lab pulse) need one more backend update — they'll appear here once it's live. Nothing was lost.",
        );
      }
      setSaved(true);
    } catch {
      setError("Couldn't save the check-in — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!checkinId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/checkins/${checkinId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
      setSaved(false);
      setCheckinId(null);
      setConfirmDelete(false);
      setMood(3);
      setEnergy(3);
      setStress(3);
      setText("");
      setEstimates([]);
    } catch {
      setError("Couldn't delete that check-in — try again in a moment.");
    } finally {
      setDeleting(false);
    }
  }

  function copyQuestion() {
    if (!labQuestion.trim()) return;
    void navigator.clipboard?.writeText(labQuestion.trim()).then(
      () => setCopied(true),
      () => setCopied(false),
    );
    window.setTimeout(() => setCopied(false), 2500);
  }

  const showCalibration = calibration && calibration.paired >= 5 && calibration.mean_error_pts != null;

  if (saved) {
    return (
      <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-medium text-star-100">Checked in for today 🌱</p>
            <p className="mt-0.5 text-xs text-stardust-300">
              Only you see this. It never appears in anything your parents see, and it
              never affects your access.
            </p>
          </div>
        </div>
        {todayCheckin && todayCheckin.estimates.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {todayCheckin.estimates.map((e) => (
              <p key={e.id} className="text-xs text-stardust-300">
                You estimated <span className="font-semibold text-star-100">{e.estimate_pct}%</span> on{" "}
                {e.label}
                {e.actual_pct != null && (
                  <>
                    {" "}— actual <span className="font-semibold text-star-100">{e.actual_pct}%</span> (
                    {Math.abs(e.estimate_pct - e.actual_pct) <= 5 ? "right on it" : "noted for your pattern"})
                  </>
                )}
              </p>
            ))}
          </div>
        )}
        {partialNote && (
          <p className="mt-3 rounded-2xl border border-aurum-400/30 bg-nebula-800/60 px-4 py-2.5 text-xs text-aurum-200">
            {partialNote}
          </p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <ProvenanceLabel kind="app-generated" />
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-medium text-stardust-500 underline-offset-2 hover:text-red-300 hover:underline"
            >
              Delete today&apos;s log
            </button>
          ) : (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-stardust-300">Delete it for real?</span>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="rounded-xl border border-red-400/40 px-3 py-1 font-medium text-red-300 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 font-medium text-stardust-300"
              >
                Keep it
              </button>
            </span>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="font-medium text-star-100">Daily Log</h3>
          <p className="text-xs text-stardust-300">
            Your space. Honest answers grow the best plans — and only you see them.
          </p>
        </div>
      </div>

      {/* Calibration — teen-only metacognition, never a lie detector */}
      <div className="mt-4 rounded-2xl border border-nova-400/15 bg-nebula-800/60 px-4 py-3">
        <p className="text-xs font-medium text-nova-300">Your estimation pattern</p>
        {showCalibration ? (
          <p className="mt-1 text-sm text-star-100">
            Within <span className="font-semibold text-aurum-300">±{calibration.mean_error_pts} pts</span> on
            average — {bandCopy(calibration.band)}
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-stardust-300">
            Estimate a few outcomes below. After 5 graded results, you&apos;ll see your
            pattern here — how sharp your guesses are getting.
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-stardust-500">
          Only you see this. It never appears in anything your parents see, and it never
          affects your access.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {(
          [
            { label: "Mood", value: mood, set: setMood, low: "Heavy", high: "Bright" },
            { label: "Energy", value: energy, set: setEnergy, low: "Drained", high: "Charged" },
            { label: "Stress", value: stress, set: setStress, low: "Calm", high: "Overwhelmed" },
          ] as const
        ).map((m) => (
          <label key={m.label} className="block">
            <span className="mb-1 flex items-center justify-between text-xs text-stardust-300">
              <span>{m.label}</span>
              <span className="font-semibold text-aurum-300 tabular-nums">{m.value}/5</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={m.value}
              onChange={(e) => m.set(Number(e.target.value))}
              className="w-full accent-nova-400"
              aria-label={`${m.label}: ${m.low} to ${m.high}`}
            />
            <span className="flex justify-between text-[10px] text-stardust-500">
              <span>{m.low}</span>
              <span>{m.high}</span>
            </span>
          </label>
        ))}
      </div>

      {/* Outcome estimates — collapsed by default */}
      <details className="mt-4 rounded-2xl border border-nova-400/10 bg-nebula-800/60 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-nova-300">
          Estimate an outcome <span className="font-normal text-stardust-500">(optional — trains your calibration)</span>
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-stardust-300">
            Guess how you did on something recent — like &ldquo;I think I got ~80% on
            today&apos;s quiz.&rdquo; When the real grade lands, you&apos;ll see how close you were.
          </p>
          {estimates.map((e, i) => (
            <div key={i} className="rounded-2xl border border-nova-400/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <input
                  value={e.label}
                  onChange={(ev) =>
                    setEstimates((prev) => prev.map((p, j) => (j === i ? { ...p, label: ev.target.value } : p)))
                  }
                  maxLength={120}
                  placeholder="What is it? (e.g. Geometry quiz)"
                  className="input-rooted flex-1 rounded-xl px-3 py-2 text-sm"
                  aria-label="What you're estimating"
                />
                <button
                  type="button"
                  onClick={() => setEstimates((prev) => prev.filter((_, j) => j !== i))}
                  className="text-xs font-medium text-stardust-500 hover:text-red-300"
                  aria-label="Remove estimate"
                >
                  Remove
                </button>
              </div>
              <label className="mt-2 block">
                <span className="mb-1 flex justify-between text-xs text-stardust-300">
                  <span>Your guess</span>
                  <span className="font-semibold text-aurum-300 tabular-nums">~{e.estimate}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={e.estimate}
                  onChange={(ev) =>
                    setEstimates((prev) =>
                      prev.map((p, j) => (j === i ? { ...p, estimate: Number(ev.target.value) } : p)),
                    )
                  }
                  className="w-full accent-nova-400"
                  aria-label={`Your estimate for ${e.label || "this item"}`}
                />
              </label>
            </div>
          ))}
          {estimates.length < 3 && (
            <button
              type="button"
              onClick={() => setEstimates((prev) => [...prev, { label: "", estimate: 80 }])}
              className="rounded-xl border border-nova-400/30 px-4 py-1.5 text-xs font-medium text-nova-300"
            >
              + Add an estimate
            </button>
          )}
        </div>
      </details>

      {/* Lab-safety pulse — day-of-lab only (FR-SCHOOL-019) */}
      {labToday && (
        <div className="mt-4 rounded-2xl border border-aurum-400/25 bg-nebula-800/60 px-4 py-3">
          <p className="text-sm font-medium text-aurum-200">Lab today in {labToday.class_name} 🧪</p>
          <label className="mt-2 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={labReadCard}
              onChange={(e) => setLabReadCard(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-aurum-400"
            />
            <span className="text-sm text-star-100">I read the safety card for today&apos;s lab.</span>
          </label>
          <label className="mt-3 block">
            <span className="text-xs text-stardust-300">
              Anything you&apos;re unsure about? (goggles, gloves, chemicals, heat) — ask
              anonymously:
            </span>
            <textarea
              value={labQuestion}
              onChange={(e) => setLabQuestion(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="e.g. Do we need goggles for the flame test?"
              className="input-rooted mt-1.5 w-full rounded-2xl px-4 py-3 text-sm"
            />
          </label>
          {labQuestion.trim() && (
            <button
              type="button"
              onClick={copyQuestion}
              className="mt-2 rounded-xl border border-aurum-400/30 px-4 py-1.5 text-xs font-medium text-aurum-200"
            >
              {copied ? "Copied — paste it in the teacher thread ✓" : "Copy to ask my teacher"}
            </button>
          )}
          <p className="mt-2 text-[11px] text-stardust-500">
            Your question stays private unless you choose to share it — it&apos;s never
            sent anywhere automatically.
          </p>
        </div>
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Anything on your mind today? (private — only you see this)"
        className="input-rooted mt-4 w-full rounded-2xl px-4 py-3 text-sm"
      />

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {partialNote && (
        <p className="mt-2 rounded-2xl border border-aurum-400/30 bg-nebula-800/60 px-4 py-2.5 text-xs text-aurum-200">
          {partialNote}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="btn-dapple rounded-2xl px-6 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save check-in"}
        </button>
        <ProvenanceLabel kind="app-generated" />
      </div>
    </div>
  );
}
