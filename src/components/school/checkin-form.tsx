"use client";

import { useState } from "react";
import { PookieOrb } from "@/components/pookie-orb";

/**
 * Daily check-in: mood / energy / stress + a private note.
 * Writes to POST /api/v1/children/[childId]/school/checkins (upsert 1/day).
 */
export function CheckinForm({
  childId,
  childName,
  doneToday,
}: {
  childId: string;
  childName: string;
  doneToday: boolean;
}) {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(doneToday);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/checkins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: new Intl.DateTimeFormat("en-CA", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
          mood,
          energy,
          stress,
          text: text.trim() ? text.trim() : undefined,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setSaved(true);
    } catch {
      setError("Couldn't save the check-in — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="card-living animate-rise flex items-center gap-4 rounded-3xl border border-nova-400/20 px-5 py-4">
        <PookieOrb size={36} />
        <p className="text-sm text-stardust-100">
          {childName} has checked in today. Pookie is listening. 🌱
        </p>
      </div>
    );
  }

  return (
    <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
      <div className="flex items-center gap-3">
        <PookieOrb size={40} />
        <div>
          <h3 className="font-medium text-star-100">Today&apos;s check-in</h3>
          <p className="text-xs text-stardust-300">
            How is {childName} feeling? Honest answers grow the best plans.
          </p>
        </div>
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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Anything on your mind today? (private — just between you and Pookie)"
        className="input-rooted mt-4 w-full rounded-2xl px-4 py-3 text-sm"
      />

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="btn-dapple mt-4 rounded-2xl px-6 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save check-in"}
      </button>
    </div>
  );
}
