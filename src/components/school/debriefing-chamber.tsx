"use client";

import { useEffect, useRef, useState } from "react";
import type { CheckinHandout } from "@/server/services/school-debrief";

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Stage = "standby" | "briefing" | "transmitting" | "logged";

interface Prefill {
  covered: string | null;
  clicked: string | null;
  fuzzy: string | null;
  dueNext: string | null;
  confidence: number | null;
}

function Meter({
  label,
  value,
  set,
  low,
  high,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
  low: string;
  high: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-stardust-300">
        <span>{label}</span>
        <span className="font-bold tabular-nums text-aurum-300">{value}/5</span>
      </span>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="w-full accent-cyan-300"
        aria-label={`${label}: ${low} to ${high}`}
      />
      <span className="flex justify-between text-[10px] text-stardust-500">
        <span>{low}</span>
        <span>{high}</span>
      </span>
    </label>
  );
}

/**
 * The Debriefing Chamber — the daily check-in as a mission event.
 * A holographic chamber where the student reports back from the day's
 * mission; the divine orb receives the report as debriefing officer.
 *
 * Writes: day-level checkin (mood/energy) → checkin_class_details
 * (covered/clicked/fuzzy/due_next/confidence) → checkin handout uploads
 * (auto-tagged to the current unit).
 */
export function DebriefingChamber({
  childId,
  classId,
  className,
  currentUnit,
  initialCheckinId,
  role,
}: {
  childId: string;
  classId: string;
  className: string;
  currentUnit: string | null;
  initialCheckinId: string | null;
  role: "parent" | "child";
}) {
  const [stage, setStage] = useState<Stage>("standby");
  const [covered, setCovered] = useState("");
  const [clicked, setClicked] = useState("");
  const [fuzzy, setFuzzy] = useState("");
  const [dueNext, setDueNext] = useState("");
  const [confidence, setConfidence] = useState(3);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [staged, setStaged] = useState<File[]>([]);
  const [handouts, setHandouts] = useState<CheckinHandout[]>([]);
  const [checkinId, setCheckinId] = useState<string | null>(initialCheckinId);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill an in-progress debriefing + list already-uploaded handouts.
  useEffect(() => {
    if (stage !== "briefing" || prefilled) return;
    let cancelled = false;
    (async () => {
      try {
        if (checkinId) {
          const [dRes, hRes] = await Promise.all([
            fetch(`/api/v1/children/${childId}/school/checkins/${checkinId}/class-details?class_id=${classId}`),
            fetch(`/api/v1/children/${childId}/school/checkins/${checkinId}/handouts`),
          ]);
          if (cancelled) return;
          if (dRes.ok) {
            const dj = (await dRes.json()) as { data: { debrief: Prefill | null } };
            const d = dj.data?.debrief;
            if (d) {
              setCovered(d.covered ?? "");
              setClicked(d.clicked ?? "");
              setFuzzy(d.fuzzy ?? "");
              setDueNext(d.dueNext ?? "");
              if (d.confidence) setConfidence(d.confidence);
            }
          }
          if (hRes.ok) {
            const hj = (await hRes.json()) as { data: { handouts: CheckinHandout[] } };
            setHandouts((hj.data?.handouts ?? []).filter((h) => h.classId === classId));
          }
        }
      } catch {
        // prefill is a nicety, never a blocker
      } finally {
        if (!cancelled) setPrefilled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, prefilled, checkinId, childId, classId]);

  function stageFiles(files: FileList | null) {
    if (!files) return;
    const next = [...staged];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        setError(`"${f.name}" is over 10 MB — pick a smaller file.`);
        continue;
      }
      if (next.length >= 5) {
        setError("Five handouts per debriefing is the limit — plenty for one mission.");
        break;
      }
      next.push(f);
    }
    setStaged(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function transmit() {
    setError(null);
    setStage("transmitting");
    try {
      // 1. Day-level check-in (upsert 1/day): mood + energy + mission summary.
      const summary = [
        `Debriefed ${className}.`,
        confidence >= 4 ? "Confidence high." : confidence === 3 ? "Confidence steady." : "Confidence shaky — needs support.",
        dueNext.trim() ? `Due next: ${dueNext.trim()}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      const cRes = await fetch(`/api/v1/children/${childId}/school/checkins`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date: todayIso(), mood, energy, text: summary }),
      });
      if (!cRes.ok) throw new Error("checkin_failed");
      const cJson = (await cRes.json()) as { data: { checkin: { id: string } } };
      const cid = cJson.data?.checkin?.id;
      if (!cid) throw new Error("checkin_failed");
      setCheckinId(cid);

      // 2. Per-class debriefing detail.
      const dRes = await fetch(`/api/v1/children/${childId}/school/checkins/${cid}/class-details`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          covered: covered.trim() || null,
          clicked: clicked.trim() || null,
          fuzzy: fuzzy.trim() || null,
          due_next: dueNext.trim() || null,
          confidence,
        }),
      });
      if (!dRes.ok) throw new Error("debrief_failed");

      // 3. Handout uploads — auto-tagged to the current unit server-side.
      // Uploads are best-effort: the debriefing itself already saved above.
      const failed: string[] = [];
      for (const f of staged) {
        try {
          const form = new FormData();
          form.append("file", f);
          form.append("class_id", classId);
          const hRes = await fetch(`/api/v1/children/${childId}/school/checkins/${cid}/handouts`, {
            method: "POST",
            body: form,
          });
          if (!hRes.ok) throw new Error("handout_failed");
        } catch {
          failed.push(f.name);
        }
      }
      setStaged([]);
      if (failed.length > 0) {
        setError(
          `Debriefing saved, but ${failed.length} handout${failed.length === 1 ? "" : "s"} didn't upload (${failed.slice(0, 2).join(", ")}${failed.length > 2 ? "…" : ""}) — the handout storage is still wiring up. Your words are safe; try the handouts again from Class Files.`
        );
        setStage("briefing");
        return;
      }
      setStage("logged");
    } catch {
      setError("Transmission interrupted — nothing was lost. Try transmitting again.");
      setStage("briefing");
    }
  }

  const hasContent =
    covered.trim() !== "" || clicked.trim() !== "" || fuzzy.trim() !== "" || dueNext.trim() !== "" || staged.length > 0;

  // Parent (or any non-teen) view: the chamber is the teen's private space.
  // (After all hooks — role never changes for a mounted component.)
  if (role !== "child") {
    return (
      <div className="card-living rounded-3xl border border-nova-400/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-star-100">The debriefing chamber is the student&apos;s private space</p>
            <p className="mt-0.5 text-xs leading-relaxed text-stardust-300">
              What was covered, what clicked, what&apos;s fuzzy — the mission report
              stays with the student, always.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "standby") {
    return (
      <div className="card-living overflow-hidden rounded-3xl border border-nova-400/20">
        <button
          type="button"
          onClick={() => setStage("briefing")}
          className="group flex w-full items-center gap-4 px-5 py-5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-star-100">Debriefing Chamber</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-stardust-300">
              Report back from today&apos;s {className} mission — covered, clicked,
              fuzzy, due next, handouts. Two minutes, ceremonial.
            </span>
          </span>
          <span className="btn-dapple shrink-0 rounded-2xl px-5 py-2.5 text-sm font-bold text-nebula-950 transition-transform group-hover:scale-105">
            Enter
          </span>
        </button>
      </div>
    );
  }

  if (stage === "logged") {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-comet-400/40 bg-nebula-900/80 px-6 py-10 text-center" style={{ boxShadow: "0 0 40px rgb(74 222 128 / 0.15)" }}>
        <h3 className="text-sunlit mt-4 text-xl font-semibold">Debriefing Logged</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-300">
          The orb has your report, {className} mission archived.
          {currentUnit ? ` Tagged to ${currentUnit}.` : ""} Rest well, astronaut —
          tomorrow&apos;s mission briefs at 0800.
        </p>
        <button
          type="button"
          onClick={() => setStage("briefing")}
          className="mt-5 rounded-2xl border border-nova-400/25 px-5 py-2 text-sm font-medium text-nova-300 transition hover:bg-nova-400/10"
        >
          Amend the Report
        </button>
      </div>
    );
  }

  return (
    <div className="debrief-shell relative">
      <style>{`
        .debrief-shell { border-radius: 1.5rem; padding: 2px; background: conic-gradient(from var(--debrief-angle, 0deg), rgba(103,232,249,.55), rgba(45,212,191,.45), rgba(74,222,128,.4), rgba(103,232,249,.55)); animation: debrief-spin 7s linear infinite; }
        @property --debrief-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes debrief-spin { to { --debrief-angle: 360deg; } }
        .debrief-scanline { position: absolute; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, rgba(103,232,249,.7), transparent); animation: debrief-scan 5s ease-in-out infinite; pointer-events: none; }
        @keyframes debrief-scan { 0% { top: 2%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { top: 98%; opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .debrief-shell { animation: none; } .debrief-scanline { display: none; } }
      `}</style>
      <div className="relative overflow-hidden rounded-3xl bg-nebula-950/95">
        <div className="debrief-scanline" aria-hidden="true" />

        {/* Debriefing officer */}
        <div className="flex flex-col items-center px-6 pb-2 pt-7 text-center">
          <p className="mt-3 text-[11px] font-semibold tracking-[0.22em] text-cyan-300/90 capitalize">
            Debriefing Chamber
          </p>
          <h3 className="text-sunlit mt-1 text-xl font-semibold">
            {className} — Mission Report
          </h3>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-stardust-300">
            The orb is listening. Report today&apos;s mission honestly —
            {currentUnit ? <> you&apos;re currently flying <span className="font-semibold text-star-100">{currentUnit}</span>.</> : " every detail sharpens tomorrow's flight plan."}
          </p>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4">
          {/* 01–04: the report */}
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-cyan-300/80"><span className="tabular-nums">01</span> · What Was Covered</p>
            <textarea
              value={covered}
              onChange={(e) => setCovered(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Today's lesson, in your words…"
              className="input-rooted w-full rounded-2xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-cyan-300/80"><span className="tabular-nums">02</span> · What Clicked</p>
            <textarea
              value={clicked}
              onChange={(e) => setClicked(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="The concept that made sense today…"
              className="input-rooted w-full rounded-2xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-cyan-300/80"><span className="tabular-nums">03</span> · What&apos;s Still Fuzzy</p>
            <textarea
              value={fuzzy}
              onChange={(e) => setFuzzy(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="What's still blurry — no judgment, just signal…"
              className="input-rooted w-full rounded-2xl px-4 py-3 text-sm"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-cyan-300/80"><span className="tabular-nums">04</span> · What&apos;s Due Next</p>
            <input
              value={dueNext}
              onChange={(e) => setDueNext(e.target.value)}
              maxLength={1000}
              placeholder="Next assignment, quiz, or deadline…"
              className="input-rooted w-full rounded-2xl px-4 py-3 text-sm"
            />
          </div>

          {/* 05: handouts */}
          <div>
            <p className="mb-1.5 text-xs font-bold tracking-wider text-cyan-300/80"><span className="tabular-nums">05</span> · Handouts <span className="font-normal text-stardust-400">(photos/scans — auto-tagged{currentUnit ? ` to ${currentUnit}` : " to this class"})</span></p>
            <div className="flex flex-wrap gap-2">
              {handouts.map((h) => (
                <a
                  key={h.id}
                  href={h.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-comet-400/30 bg-nebula-800/60 px-3 py-1.5 text-xs text-star-100"
                  title={h.unitTag ? `Tagged: ${h.unitTag}` : undefined}
                >
                  <span className="truncate">📎 {h.fileName}</span>
                  {h.unitTag && <span className="shrink-0 text-[10px] text-comet-300">· {h.unitTag}</span>}
                </a>
              ))}
              {staged.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-aurum-400/30 bg-nebula-800/60 px-3 py-1.5 text-xs text-star-100">
                  <span className="truncate">📎 {f.name}</span>
                  <button
                    type="button"
                    onClick={() => setStaged((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-stardust-400 hover:text-red-300"
                    aria-label={`Remove ${f.name}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {staged.length + handouts.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-nova-400/40 px-3 py-1.5 text-xs font-medium text-nova-300 transition hover:bg-nova-400/10"
                >
                  + Add Handout
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => stageFiles(e.target.files)}
            />
          </div>

          {/* Vitals */}
          <div className="grid gap-4 rounded-2xl border border-nova-400/10 bg-nebula-900/60 p-4 sm:grid-cols-3">
            <Meter label="Mission Confidence" value={confidence} set={setConfidence} low="Shaky" high="Locked In" />
            <Meter label="Mood" value={mood} set={setMood} low="Heavy" high="Bright" />
            <Meter label="Energy" value={energy} set={setEnergy} low="Drained" high="Charged" />
          </div>

          {error && <p className="text-xs text-red-300">⚠️ {error}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={transmit}
              disabled={stage === "transmitting" || !hasContent}
              className="btn-dapple flex-1 rounded-2xl px-6 py-3 text-sm font-bold text-nebula-950 transition-transform hover:scale-[1.01] disabled:opacity-50"
            >
              {stage === "transmitting" ? "Transmitting Debriefing…" : "🛰️ Transmit Debriefing"}
            </button>
            <button
              type="button"
              onClick={() => setStage("standby")}
              className="rounded-2xl border border-nova-400/20 px-4 py-3 text-sm text-stardust-300"
            >
              Stand Down
            </button>
          </div>
          <p className="text-center text-[11px] text-stardust-500">
            Private to you — the debriefing never appears in anything your parents see.
          </p>
        </div>
      </div>
    </div>
  );
}
