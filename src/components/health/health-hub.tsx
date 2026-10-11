"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PookieOrb } from "@/components/pookie-orb";
import { DOCTOR_RAIL, TEEN_PRIVACY_PROMISE } from "@/server/health/copy";
import type {
  HealthSubject,
  MetricDef,
} from "@/server/services/health";

export interface LatestMetric {
  metric_key: string;
  display_name: string;
  unit: string | null;
  value: string;
  recorded_at: string;
}

/**
 * /household/health — the family health hub. Per-person cards show only
 * visibility-allowed summaries (the API + RLS shape the data; the UI
 * never hides-by-CSS what the reader may not see).
 */
export function HealthHub({
  subjects,
  latestBySubject,
  role,
  childOptions,
  demo = false,
}: {
  subjects: HealthSubject[];
  latestBySubject: Record<string, LatestMetric[]>;
  role: "parent" | "child";
  childOptions: { id: string; label: string }[];
  demo?: boolean;
}) {
  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "22%", left: "86%", animationDelay: "1.4s" }} />

      <div className="animate-bloom flex items-center gap-4">
        <PookieOrb size={56} />
        <p className="text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase">
          Health · the family hub
        </p>
      </div>

      <h1 className="text-sunlit animate-bloom mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        How the family is doing
      </h1>
      <p className="animate-bloom mt-3 max-w-xl leading-relaxed text-bark-300" style={{ animationDelay: "0.08s" }}>
        Wellness tracking for the basics people actually track — steps, sleep,
        heart rate, glucose. Trends and gentle nudges, never diagnoses.
      </p>

      {subjects.length === 0 ? (
        <div className="card-living animate-bloom mt-8 rounded-3xl px-6 py-8 text-center" style={{ animationDelay: "0.12s" }}>
          <p className="text-dew-100 font-medium">Nobody is tracking yet.</p>
          <p className="mt-2 text-sm text-bark-300">
            Add the first person below and log the first reading — Pookie will
            keep the trend from there.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {subjects.map((s, i) => (
            <Link
              key={s.id}
              href={`/household/health/${s.id}`}
              className="card-living animate-bloom block rounded-3xl px-6 py-5 transition-transform hover:scale-[1.01]"
              style={{ animationDelay: `${0.12 + i * 0.06}s` }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-dew-100">{s.label}</p>
                <span className="rounded-full border border-leaf-400/30 px-3 py-1 text-xs text-leaf-300">
                  {s.subject_kind === "child" ? "child" : "family"} · {bandLabel(s.age_band)}
                </span>
              </div>
              {(latestBySubject[s.id] ?? []).length > 0 ? (
                <div className="mt-4 space-y-2">
                  {(latestBySubject[s.id] ?? []).slice(0, 4).map((m) => (
                    <div key={m.metric_key} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-bark-300">{m.display_name}</span>
                      <span className="font-medium text-dew-100">{m.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-bark-500">
                  No readings yet — open to log the first one.
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {role === "parent" && !demo && (
        <AddSubjectForm childOptions={childOptions} />
      )}

      <div className="animate-bloom mt-10 rounded-3xl border border-halo-200/20 bg-canopy-800/60 px-6 py-5" style={{ animationDelay: "0.3s" }}>
        <p className="text-sm leading-relaxed text-bark-300">{TEEN_PRIVACY_PROMISE}</p>
        <p className="mt-3 text-xs leading-relaxed text-bark-500">{DOCTOR_RAIL}</p>
      </div>
    </main>
  );
}

function bandLabel(band: HealthSubject["age_band"]): string {
  if (band === "under13") return "under 13";
  if (band === "teen") return "13–17";
  if (band === "adult") return "18+";
  return "age unknown";
}

function AddSubjectForm({ childOptions }: { childOptions: { id: string; label: string }[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"child" | "household_member">("child");
  const [childId, setChildId] = useState(childOptions[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!label.trim() || !childId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/health/subjects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: label.trim(), subject_kind: kind, child_id: childId }),
      });
      if (!res.ok) throw new Error("save_failed");
      setLabel("");
      router.refresh();
    } catch {
      setError("Couldn't add them — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-living animate-bloom mt-8 rounded-3xl px-6 py-5" style={{ animationDelay: "0.24s" }}>
      <p className="font-medium text-dew-100">Add someone to track</p>
      <p className="mt-1 text-sm text-bark-300">
        A child, or another family member anchored to a child&apos;s household.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name (e.g. Dawson)"
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500 sm:col-span-2"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "child" | "household_member")}
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100"
        >
          <option value="child">Child</option>
          <option value="household_member">Family member</option>
        </select>
        <select
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100"
        >
          {childOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <button
        onClick={submit}
        disabled={saving || !label.trim() || !childId}
        className="mt-4 rounded-2xl bg-leaf-500 px-5 py-2.5 text-sm font-semibold text-canopy-950 shadow-glow-sm transition hover:bg-leaf-400 disabled:opacity-50"
      >
        {saving ? "Adding…" : "Add them"}
      </button>
    </div>
  );
}

// Re-exported so pages can build the hub props with one import.
export type { MetricDef };
