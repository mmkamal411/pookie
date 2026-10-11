"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PookieOrb } from "@/components/pookie-orb";
import {
  DOCTOR_RAIL,
  DOCTOR_RAIL_SHORT,
  GLUCOSE_SOURCES_NOTE,
  OVERRIDE_EXPLAINER,
  TEEN_PRIVACY_PROMISE,
  WEIGHT_HIDDEN_NOTE,
} from "@/server/health/copy";
import type {
  HealthReading,
  HealthSubject,
  MetricDef,
  SafetyOverride,
} from "@/server/services/health";
import {
  formatHealthValue,
  formatShortDate,
  latestPerMetric,
} from "@/lib/health-format";

/**
 * /household/health/[subjectId] — one person's trends, logging, and
 * privacy controls. Teen-role callers never see weight (filtered in the
 * service); parents see the safety-override panel.
 */
export function SubjectDetail({
  subject,
  defs,
  readings,
  overrides,
  role,
  demo = false,
}: {
  subject: HealthSubject;
  defs: MetricDef[];
  readings: HealthReading[];
  overrides: SafetyOverride[] | null;
  role: "parent" | "child";
  demo?: boolean;
}) {
  const latest = latestPerMetric(readings);
  const isParent = role === "parent";
  const isTeenBand = subject.age_band === "teen" || subject.age_band === "unknown";

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "22%", left: "86%", animationDelay: "1.4s" }} />

      <Link href="/household/health" className="text-sm text-leaf-400 hover:text-leaf-300">
        ← Everyone
      </Link>

      <div className="animate-bloom mt-4 flex items-center gap-4">
        <PookieOrb size={56} />
        <p className="text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase">
          Health · {subject.label}
        </p>
      </div>

      <h1 className="text-sunlit animate-bloom mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {subject.label}&apos;s trends
      </h1>
      <p className="animate-bloom mt-3 max-w-xl text-sm leading-relaxed text-bark-300" style={{ animationDelay: "0.08s" }}>
        {DOCTOR_RAIL_SHORT}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/household/health/${subject.id}/nutrition`}
          className="rounded-2xl bg-leaf-500 px-5 py-2.5 text-sm font-semibold text-canopy-950 shadow-glow-sm transition hover:bg-leaf-400"
        >
          Nutrition →
        </Link>
      </div>

      {defs.length === 0 ? (
        <div className="card-living animate-bloom mt-8 rounded-3xl px-6 py-8 text-center">
          <p className="text-dew-100 font-medium">No readings yet.</p>
          <p className="mt-2 text-sm text-bark-300">
            Log the first one below — trends start with a single dot.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {defs.map((def, i) => {
            const lat = latest.get(def.metric_key);
            const recent = readings
              .filter((r) => r.metric_key === def.metric_key)
              .slice(0, 7);
            return (
              <div
                key={def.metric_key}
                className="card-living animate-bloom rounded-3xl px-6 py-5"
                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium text-dew-100">{def.display_name}</p>
                  {def.default_sensitivity === "sensitive" && (
                    <span className="rounded-full border border-halo-200/30 px-2.5 py-0.5 text-xs text-halo-200">
                      sensitive
                    </span>
                  )}
                </div>
                <p className="mt-2 text-2xl font-semibold text-sunlit">
                  {lat ? formatHealthValue(lat, def) : "—"}
                </p>
                {lat && (
                  <p className="mt-1 text-xs text-bark-500">
                    latest · {formatShortDate(lat.recorded_at)}
                    {lat.source !== "manual" ? ` · ${lat.source}` : ""}
                  </p>
                )}
                {recent.length > 1 && (
                  <div className="mt-3 space-y-1 border-t border-leaf-400/10 pt-3">
                    {recent.slice(1).map((r) => (
                      <div key={r.id} className="flex items-baseline justify-between text-xs">
                        <span className="text-bark-500">{formatShortDate(r.recorded_at)}</span>
                        <span className="text-bark-300">{formatHealthValue(r, def)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {def.metric_key === "blood_glucose" && (
                  <p className="mt-3 text-xs leading-relaxed text-bark-500">{GLUCOSE_SOURCES_NOTE}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!demo && (
        <LogReadingForm subjectId={subject.id} defs={defs} />
      )}

      {isParent && !demo && (
        <OverridePanel
          subjectId={subject.id}
          defs={defs}
          overrides={overrides ?? []}
        />
      )}

      {!isParent && (
        <div className="animate-bloom mt-8 rounded-3xl border border-halo-200/20 bg-canopy-800/60 px-6 py-5">
          <p className="text-sm leading-relaxed text-bark-300">{TEEN_PRIVACY_PROMISE}</p>
          {isTeenBand && (
            <p className="mt-3 text-sm leading-relaxed text-bark-300">{WEIGHT_HIDDEN_NOTE}</p>
          )}
        </div>
      )}

      <p className="mt-8 text-xs leading-relaxed text-bark-500">{DOCTOR_RAIL}</p>
    </main>
  );
}

function LogReadingForm({
  subjectId,
  defs,
}: {
  subjectId: string;
  defs: MetricDef[];
}) {
  const router = useRouter();
  const [metricKey, setMetricKey] = useState(defs[0]?.metric_key ?? "");
  const [value, setValue] = useState("");
  const [valueText, setValueText] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const numeric = value.trim() === "" ? undefined : Number(value);
      if (numeric !== undefined && !Number.isFinite(numeric)) {
        throw new Error("bad_number");
      }
      const res = await fetch(`/api/v1/health/subjects/${subjectId}/metrics`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          metric_key: metricKey,
          value_numeric: numeric,
          value_text: valueText.trim() || undefined,
          recorded_at: new Date(`${date}T12:00:00Z`).toISOString(),
          note: note.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setValue("");
      setValueText("");
      setNote("");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Couldn't save the reading — check the number and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-living animate-bloom mt-8 rounded-3xl px-6 py-5" style={{ animationDelay: "0.2s" }}>
      <p className="font-medium text-dew-100">Log a reading</p>
      <p className="mt-1 text-sm text-bark-300">
        Manual entry — from a cuff, a scale, or the phone&apos;s health app.
        Trends only, never diagnoses.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select
          value={metricKey}
          onChange={(e) => setMetricKey(e.target.value)}
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100"
        >
          {defs.map((d) => (
            <option key={d.metric_key} value={d.metric_key}>
              {d.display_name}{d.unit ? ` (${d.unit})` : ""}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="decimal"
          placeholder="Number (e.g. 5200)"
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500"
        />
        <input
          value={valueText}
          onChange={(e) => setValueText(e.target.value)}
          placeholder="Or text (e.g. 120/80)"
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500 sm:col-span-2"
        />
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {saved && <p className="mt-3 text-sm text-leaf-300">Saved — the trend is growing. 🌱</p>}
      <button
        onClick={submit}
        disabled={saving || !metricKey}
        className="mt-4 rounded-2xl bg-leaf-500 px-5 py-2.5 text-sm font-semibold text-canopy-950 shadow-glow-sm transition hover:bg-leaf-400 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Log it"}
      </button>
    </div>
  );
}

function OverridePanel({
  subjectId,
  defs,
  overrides,
}: {
  subjectId: string;
  defs: MetricDef[];
  overrides: SafetyOverride[];
}) {
  const router = useRouter();
  const sensitive = defs.filter((d) => d.default_sensitivity === "sensitive");
  const [metricKey, setMetricKey] = useState(sensitive[0]?.metric_key ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = overrides.filter((o) => o.revoked_at == null);

  async function grant() {
    if (reason.trim().length < 20) {
      setError("Say a little more — overrides need a real reason (20+ characters).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/health/subjects/${subjectId}/overrides`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ metric_key: metricKey, reason: reason.trim() }),
      });
      if (!res.ok) throw new Error("save_failed");
      setReason("");
      router.refresh();
    } catch {
      setError("Couldn't record the override — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(overrideId: string) {
    try {
      const res = await fetch(
        `/api/v1/health/subjects/${subjectId}/overrides/${overrideId}/revoke`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("revoke_failed");
      router.refresh();
    } catch {
      setError("Couldn't revoke the override — try again in a moment.");
    }
  }

  return (
    <div className="animate-bloom mt-8 rounded-3xl border border-halo-200/20 bg-canopy-800/60 px-6 py-5" style={{ animationDelay: "0.24s" }}>
      <p className="font-medium text-dew-100">Safety overrides</p>
      <p className="mt-2 text-sm leading-relaxed text-bark-300">{OVERRIDE_EXPLAINER}</p>

      {active.length > 0 && (
        <div className="mt-4 space-y-2">
          {active.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-2xl border border-halo-200/20 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-dew-100">
                  {o.metric_key} · active since {formatShortDate(o.created_at)}
                </p>
                <p className="truncate text-xs text-bark-500">{o.reason}</p>
              </div>
              <button
                onClick={() => revoke(o.id)}
                className="shrink-0 rounded-2xl border border-leaf-400/30 px-4 py-1.5 text-xs font-medium text-leaf-300 hover:bg-leaf-400/10"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {sensitive.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-dew-100">Grant a new override</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <select
              value={metricKey}
              onChange={(e) => setMetricKey(e.target.value)}
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100"
            >
              {sensitive.map((d) => (
                <option key={d.metric_key} value={d.metric_key}>{d.display_name}</option>
              ))}
            </select>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this needed? (20+ characters — this is recorded)"
              rows={2}
              className="rounded-2xl border border-leaf-400/20 bg-canopy-900 px-4 py-2.5 text-sm text-dew-100 placeholder:text-bark-500 sm:col-span-2"
            />
          </div>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button
            onClick={grant}
            disabled={saving || !metricKey}
            className="mt-3 rounded-2xl bg-sunlight-400 px-5 py-2.5 text-sm font-semibold text-canopy-950 shadow-sun-warm transition hover:bg-sunlight-300 disabled:opacity-50"
          >
            {saving ? "Recording…" : "Record override"}
          </button>
        </div>
      )}
    </div>
  );
}
