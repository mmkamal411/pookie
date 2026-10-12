"use client";

import { useState } from "react";
import type { AttendanceSummary, GpaBlock, SemesterCard } from "@/server/services/school-enrich";
import { GpaSimulator } from "./gpa-simulator";

/**
 * Semester card — Fall 2026 Semester, GP2 of 3, day counters, progress bar,
 * GPA block, and expandable attendance. The GPA Simulator lives in a
 * collapsible below.
 */
export function SemesterCard({
  semester,
  gpa,
  attendance,
}: {
  semester: SemesterCard;
  gpa: GpaBlock | null;
  attendance: AttendanceSummary;
}) {
  const [attOpen, setAttOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);

  return (
    <section aria-label="Semester status" className="card-living animate-bloom overflow-hidden rounded-3xl border border-nova-400/20" style={{ animationDelay: "0.12s" }}>
      {/* Term info + countdowns */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-nova-300 capitalize">
            {semester.termLabel}
          </p>
          <p className="mt-1 text-lg font-bold text-star-100">
            Grading Period {semester.gradingPeriod}{" "}
            <span className="font-medium text-stardust-300">of {semester.gradingPeriodsTotal}</span>
          </p>
          <p className="mt-0.5 text-xs text-stardust-300">{semester.dateRange}</p>
        </div>
        <div className="flex shrink-0 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold tabular-nums text-comet-300">{semester.gradingPeriodDaysLeft}</p>
            <p className="text-[9px] font-semibold tracking-widest text-stardust-400 capitalize">Days Left</p>
            <p className="text-[10px] font-semibold text-stardust-300">Grading Period</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-nova-300">{semester.semesterDaysLeft}</p>
            <p className="text-[9px] font-semibold tracking-widest text-stardust-400 capitalize">Days Left</p>
            <p className="text-[10px] font-semibold text-stardust-300">Semester</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 px-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-nebula-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-comet-400 to-nova-300 transition-all"
            style={{ width: `${semester.progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] font-medium text-stardust-400">
          {semester.progressPct}% of semester complete
        </p>
      </div>

      {/* GPA block */}
      {gpa ? (
        <button
          type="button"
          onClick={() => setSimOpen(!simOpen)}
          aria-expanded={simOpen}
          className="mt-2 flex w-full items-center justify-between gap-3 border-t border-nova-400/10 px-5 py-4 text-left"
        >
          <span className="flex items-center gap-4">
            <span className="text-center">
              <span className="block text-2xl font-bold tabular-nums text-star-100">{gpa.unweighted.toFixed(2)}</span>
              <span className="block text-[10px] font-semibold tracking-widest text-stardust-400 capitalize">GPA</span>
            </span>
            <span className="text-xs text-stardust-300">
              Weighted {gpa.weighted.toFixed(2)} · HOPE {gpa.hope.toFixed(2)}
            </span>
          </span>
          <span className="shrink-0 text-xs text-stardust-300">
            <span className="mr-2 hidden sm:inline">What-If Simulator</span>
            <span aria-hidden="true" className={`inline-block transition-transform ${simOpen ? "rotate-180" : ""}`}>▾</span>
          </span>
        </button>
      ) : (
        <p className="mt-2 border-t border-nova-400/10 px-5 py-4 text-sm text-stardust-300">
          GPA instruments warming up — grades land with the first sync.
        </p>
      )}
      {gpa && (
        <div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: simOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="border-t border-nova-400/10 px-5 py-4">
              <GpaSimulator gpa={gpa} />
            </div>
          </div>
        </div>
      )}

      {/* Attendance */}
      <button
        type="button"
        onClick={() => setAttOpen(!attOpen)}
        aria-expanded={attOpen}
        className="flex w-full items-center justify-between gap-3 border-t border-nova-400/10 px-5 py-4 text-left"
      >
        <span className="text-xs font-semibold tracking-[0.18em] text-stardust-300 capitalize">Attendance</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-2 rounded-xl border border-nova-400/15 bg-nebula-800/60 px-3 py-1.5">
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tabular-nums text-aurum-300">{attendance.tardy}</span>
              <span className="text-[10px] font-semibold tracking-wider text-stardust-300 capitalize">Tardy</span>
            </span>
            <span className="h-4 w-px bg-nova-400/20" aria-hidden="true" />
            <span className="flex items-baseline gap-1.5">
              <span className="text-base font-bold tabular-nums text-orange-300">{attendance.absent}</span>
              <span className="text-[10px] font-semibold tracking-wider text-stardust-300 capitalize">Absent</span>
            </span>
          </span>
          <span aria-hidden="true" className={`text-stardust-400 transition-transform ${attOpen ? "rotate-180" : ""}`}>▾</span>
        </span>
      </button>
      <div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: attOpen ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="border-t border-nova-400/10 px-5 py-3">
            {attendance.detail.length > 0 ? (
              <div className="text-xs">
                {attendance.detail.map((d, i) => (
                  <div key={i} className={`flex justify-between gap-3 py-1.5 ${i < attendance.detail.length - 1 ? "border-b border-nova-400/10" : ""}`}>
                    <span className="text-stardust-200">{d.date}</span>
                    <span className={d.excused ? "text-stardust-300" : "font-semibold text-red-300"}>{d.reason}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stardust-300">Clean record — nothing to show.</p>
            )}
            <p className="mt-2 text-[10px] text-stardust-500">
              Source: {attendance.source}
              {attendance.lastPull ? ` · ${attendance.lastPull}` : ""}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
