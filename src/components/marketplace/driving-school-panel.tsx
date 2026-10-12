// W6 Driving School — GA DDS rules engine UI.
// "Your Georgia timeline" computed from DOB; Joshua's Law hours log with a
// progress ring backed by the real driving_log table. Under-15: planning mode
// only — no log UI, no "eligible" language. Per-state from day one (GA/FL).

"use client";

import { useEffect, useState } from "react";
import { Button, Card, CollapseRow, InfoLine, Sheet } from "@/components/ui";
import { ErrorCard, InitializingCard, LoadingRows, api } from "@/components/travel/travel-shared";

interface Rule {
  rule_code: string;
  category: "permit" | "supervised_hours" | "provisional" | "full_license";
  title: string;
  summary_md: string;
  min_age_years: number | null;
  source_name: string;
  source_url: string;
  rules_verified_at: string;
  from_snapshot: boolean;
}
interface RulesData {
  state: string;
  source: "database" | "verified_snapshot";
  rules: Rule[];
}
interface ProgressData {
  status: string;
  total_minutes?: number;
  night_minutes?: number;
  total_target?: number;
  night_target?: number;
  pct_total?: number;
  pct_night?: number;
  entries?: { drive_date: string; minutes_total: number; minutes_night: number; supervisor_name: string; conditions: string | null }[];
  message?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  permit: "Learner's permit",
  supervised_hours: "Supervised hours",
  provisional: "Provisional license",
  full_license: "Full license",
};

function ProgressRing({ pct, label }: { pct: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${label}: ${pct}%`}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="#00E5FF"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * Math.min(100, pct)) / 100}
          transform="rotate(-90 42 42)"
          style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.5))" }}
        />
        <text x="42" y="47" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="600">
          {pct}%
        </text>
      </svg>
      <p className="text-sm text-stardust-300">{label}</p>
    </div>
  );
}

export function DrivingSchoolPanel({
  childId,
  childAge,
  role,
}: {
  childId: string;
  childAge: number | null;
  role: "parent" | "child";
}) {
  const [stateCode, setStateCode] = useState("GA");
  const [rules, setRules] = useState<RulesData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [error, setError] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [driveDate, setDriveDate] = useState(new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState("");
  const [nightMinutes, setNightMinutes] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [conditions, setConditions] = useState("");
  const [saving, setSaving] = useState(false);
  const [logMsg, setLogMsg] = useState("");

  const under15 = childAge != null && childAge < 15;
  const canLog = !under15;

  const load = () => {
    setState("loading");
    Promise.all([
      api<RulesData>(`/api/v1/marketplace/driving/rules?state=${stateCode}`),
      api<ProgressData>(`/api/v1/marketplace/driving/log?child_id=${childId}&state=${stateCode}`).catch(
        () => ({ status: "service_initializing" as const }),
      ),
    ])
      .then(([r, p]) => {
        setRules(r);
        setProgress(p);
        setState("loaded");
      })
      .catch((e: Error) => {
        setError(e.message);
        setState("error");
      });
  };

  useEffect(load, [stateCode, childId]);

  const logDrive = async () => {
    const mins = Number.parseInt(minutes, 10);
    const night = Number.parseInt(nightMinutes || "0", 10);
    if (!mins || mins < 1 || !supervisor.trim() || !driveDate) return;
    setSaving(true);
    setLogMsg("");
    try {
      await api("/api/v1/marketplace/driving/log", {
        method: "POST",
        body: JSON.stringify({
          child_id: childId,
          drive_date: driveDate,
          minutes_total: mins,
          minutes_night: night,
          supervisor_name: supervisor.trim(),
          conditions: conditions.trim() || undefined,
        }),
      });
      setLogOpen(false);
      setMinutes("");
      setNightMinutes("");
      setSupervisor("");
      setConditions("");
      load();
    } catch (e) {
      setLogMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const stage =
    childAge == null
      ? "Your Georgia license timeline"
      : childAge < 15
        ? "Getting ready"
        : childAge < 16
          ? "Permit stage"
          : childAge < 18
            ? "Provisional Class D stage"
            : "Full license stage";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-2xl">🚗</span>
          <h2 className="text-lg font-semibold text-star-100">Driving School</h2>
        </div>
        <div className="flex gap-1.5" aria-label="State">
          {(["GA", "FL"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStateCode(s)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                stateCode === s
                  ? "border-nova-400/50 bg-nova-500/15 text-star-100"
                  : "border-nova-400/15 text-stardust-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-nova-400/25">
        <p className="text-[11px] font-semibold tracking-wide text-nova-300 capitalize">
          Your {stateCode === "GA" ? "Georgia" : "Florida"} license timeline
        </p>
        <p className="mt-1 text-base font-semibold text-star-100">{stage}</p>
        {under15 ? (
          <p className="mt-1 text-sm leading-relaxed text-stardust-300">
            Your permit journey starts at 15. Here&apos;s how to get ready — study guides, what
            the permit test feels like, what to expect at the DDS.
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-stardust-300">
            {childAge != null && childAge < 16
              ? "Permit stage: drive supervised, log every drive, no late nights."
              : childAge != null && childAge < 18
                ? "Provisional Class D: no driving midnight–5 AM, and passenger limits apply."
                : "Full license at 18 — drive safe."}
          </p>
        )}
      </Card>

      {state === "loading" && <LoadingRows rows={4} />}
      {state === "error" && <ErrorCard message={error} onRetry={load} />}

      {state === "loaded" && rules && (
        <div className="space-y-2">
          {(["permit", "supervised_hours", "provisional", "full_license"] as const).map((cat) => {
            const catRules = rules.rules.filter((r) => r.category === cat);
            if (catRules.length === 0) return null;
            return (
              <CollapseRow key={cat} title={CATEGORY_LABEL[cat]} meta={`${catRules.length}`}>
                <div className="space-y-3">
                  {catRules.map((r) => (
                    <div key={r.rule_code}>
                      <p className="text-sm font-medium text-star-100">{r.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed">{r.summary_md}</p>
                      <p className="mt-1 text-[11px] text-stardust-500">
                        Source: {r.source_name} · verified {r.rules_verified_at}
                      </p>
                    </div>
                  ))}
                </div>
              </CollapseRow>
            );
          })}
          {rules.source === "verified_snapshot" && (
            <p className="text-[11px] text-stardust-500">
              Rules from the verified reference snapshot — the live rules table connects soon.
            </p>
          )}
        </div>
      )}

      <Card>
        <p className="text-sm font-semibold text-star-100">Joshua&apos;s Law driving log</p>
        <InfoLine className="mt-2" icon="📓">
          Georgia&apos;s Joshua&apos;s Law needs supervised driving logged before the Class D
          test. Pookie&apos;s log counts every drive — append-only, so entries are never silently
          changed.
        </InfoLine>

        {progress?.status === "service_initializing" ? (
          <div className="mt-3">
            <InitializingCard
              title="The driving log is connecting"
              message={progress.message ?? "Your drives will save here once the log table is live."}
            />
          </div>
        ) : progress?.status === "ok" ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-5">
              <ProgressRing
                pct={progress.pct_total ?? 0}
                label={`${Math.floor((progress.total_minutes ?? 0) / 60)} of ${Math.floor((progress.total_target ?? 2400) / 60)} hours`}
              />
              <ProgressRing
                pct={progress.pct_night ?? 0}
                label={`${Math.floor((progress.night_minutes ?? 0) / 60)} of ${Math.floor((progress.night_target ?? 360) / 60)} night hours`}
              />
            </div>
            {canLog ? (
              <Button onClick={() => setLogOpen(true)}>Log a drive</Button>
            ) : (
              <InfoLine>
                The driving log opens at 15 — for now, the study guides above are yours.
              </InfoLine>
            )}
            {(progress.entries ?? []).length > 0 && (
              <div className="space-y-1.5 border-t border-nova-400/10 pt-2">
                {(progress.entries ?? []).slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-stardust-300">
                    {e.drive_date} · {e.minutes_total} min
                    {e.minutes_night > 0 ? ` (${e.minutes_night} at night)` : ""} · with{" "}
                    {e.supervisor_name}
                    {e.conditions ? ` · ${e.conditions}` : ""}
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <p className="text-[11px] text-stardust-500">
        {role === "child"
          ? "You can log your own drives; a parent can log on your behalf."
          : "You can log drives on your teen's behalf."}{" "}
        Rules verified against published {stateCode === "GA" ? "GA DDS" : "FLHSMV"} guidance.
      </p>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log a drive" subtitle="Every drive counts.">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="drive-date" className="block text-sm font-medium text-star-100">Date</label>
              <input
                id="drive-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={driveDate}
                onChange={(e) => setDriveDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 focus:border-nova-300/60 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="drive-mins" className="block text-sm font-medium text-star-100">Minutes</label>
              <input
                id="drive-mins"
                inputMode="numeric"
                placeholder="45"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="drive-night" className="block text-sm font-medium text-star-100">Night minutes</label>
              <input
                id="drive-night"
                inputMode="numeric"
                placeholder="0"
                value={nightMinutes}
                onChange={(e) => setNightMinutes(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="drive-sup" className="block text-sm font-medium text-star-100">Supervisor</label>
              <input
                id="drive-sup"
                placeholder="e.g. Dad"
                value={supervisor}
                onChange={(e) => setSupervisor(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="drive-cond" className="block text-sm font-medium text-star-100">Conditions (optional)</label>
            <input
              id="drive-cond"
              placeholder="e.g. rain, highway"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
          </div>
          {logMsg && <InfoLine tone="amber">{logMsg}</InfoLine>}
          <Button
            onClick={logDrive}
            loading={saving}
            disabled={!minutes || !supervisor.trim() || !driveDate}
          >
            Save this drive
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
