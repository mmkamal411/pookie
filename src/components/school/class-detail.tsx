"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PookieOrb } from "@/components/pookie-orb";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassDetail } from "@/lib/school/types";
import { bandStyles, deltaCopy, dueDateLabel, gapCopy } from "./styles";
import { PathTo90 } from "./path-to-90";
import { TeacherThread } from "./teacher-thread";
import { CheckinForm } from "./checkin-form";
import { ClassFiles } from "./class-files";

/**
 * /c/[childSlug]/school/[classSlug] — the class page.
 * Grade hero first (numeric + letter side by side, gap-to-90 leading),
 * then: assignments, Path-to-90, teacher thread, check-in + handouts
 * below the hero — "what do I do next" stays first.
 */
export function ClassDetailView({
  detail,
  childName,
  childSlug,
  childId,
  checkinToday,
  role,
  demo = false,
}: {
  detail: ClassDetail;
  childName: string;
  childSlug: string;
  childId: string;
  checkinToday: boolean;
  role: "parent" | "child";
  demo?: boolean;
}) {
  const [data, setData] = useState(detail);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/classes/${data.class.id}`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: ClassDetail };
      setData(json.data);
      setVersion((v) => v + 1);
    } catch {
      // A failed refresh keeps the last good render — never a blank page.
    }
  }, [childId, data.class.id, demo]);

  const band = gradeBand(data.grade?.numeric);
  const s = bandStyles[band];
  const gap = gapTo90(data.grade?.numeric);
  const displayName = data.class.display_name ?? data.class.name;
  const attention = (data.assignments ?? []).filter((a) => a.status === "missing" || a.status === "late");

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "6%", left: "18%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "30%", left: "90%", animationDelay: "1.8s" }} />

      <Link href={`/c/${childSlug}/school`} className="animate-bloom text-sm font-medium text-nova-300 hover:text-nova-400">
        ← All classes
      </Link>

      {/* Grade hero — numeric + letter side by side, separated by a line, visible on open */}
      <section className="animate-bloom mt-4 rounded-3xl border border-nova-400/20 bg-nebula-900/60 p-6 sm:p-8" style={{ animationDelay: "0.05s", boxShadow: s.glow }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-nova-400 uppercase">{data.grade?.term ?? "Current term"}</p>
            <h1 className="text-sunlit mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{displayName}</h1>
            <p className="mt-2 text-sm text-stardust-300">
              {[data.class.period ? `Period ${data.class.period}` : null, data.class.teacher_name].filter(Boolean).join(" · ")}
            </p>
          </div>
          <PookieOrb size={64} />
        </div>

        <div className="mt-6 flex items-center gap-5">
          <p className={`text-5xl font-semibold tabular-nums sm:text-6xl ${s.text}`}>
            {data.grade?.numeric != null ? data.grade.numeric.toFixed(1) : "—"}
          </p>
          <span className="h-16 w-px bg-nova-400/25" aria-hidden="true" />
          <div>
            <p className={`text-4xl font-bold ${s.text}`}>{letterGrade(data.grade?.numeric)}</p>
            <p className="mt-1 text-xs text-stardust-300">letter</p>
          </div>
        </div>

        <p className="mt-5 text-lg font-medium text-star-100">{gapCopy(gap)}</p>
        {(() => {
          const newest = data.history[0]?.numeric;
          const oldest = data.history[data.history.length - 1]?.numeric;
          const delta = newest != null && oldest != null ? +(newest - oldest).toFixed(1) : null;
          const copy = deltaCopy(delta);
          return copy ? <p className="mt-1 text-sm text-stardust-300">{copy}</p> : null;
        })()}
        {attention.length > 0 && (
          <p className="mt-3 inline-block rounded-full border border-red-400/30 bg-nebula-800/60 px-3 py-1 text-xs font-medium text-red-300">
            {attention.length} {attention.length === 1 ? "assignment needs" : "assignments need"} attention — recovering {attention.length === 1 ? "it" : "them"} is the fastest climb
          </p>
        )}
      </section>

      {/* Assignments */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">Assignments</h2>
        {data.assignments.length > 0 ? (
          <div className="mt-4 grid gap-3">
            {data.assignments.map((a, i) => (
              <div
                key={a.id}
                className="card-living animate-bloom flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
                style={{ animationDelay: `${0.1 + i * 0.05}s` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-star-100">{a.title}</p>
                  <p className="mt-0.5 text-xs text-stardust-300">
                    {[a.category, a.points_earned != null && a.points_possible != null ? `${a.points_earned}/${a.points_possible}` : a.points_possible != null ? `out of ${a.points_possible}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-medium ${a.status === "missing" || a.status === "late" ? "text-red-300" : "text-aurum-300"}`}>
                    {a.status === "missing" ? "Missing" : a.status === "late" ? "Late" : a.status === "graded" ? "Graded" : a.status === "submitted" ? "Submitted" : dueDateLabel(a.due_date)}
                  </p>
                  {a.due_date && (a.status === "missing" || a.status === "late") && (
                    <p className="text-[11px] text-stardust-500">{dueDateLabel(a.due_date)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-stardust-300">No assignments tracked yet for this class.</p>
        )}
      </section>

      {/* Path to 90 */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">Your next steps</h2>
        <div className="mt-4" key={version}>
          <PathTo90
            plan={data.study_plan}
            childId={childId}
            classId={data.class.id}
            role={role}
            demo={demo}
            onChanged={refresh}
          />
        </div>
      </section>

      {/* Teacher thread */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">Teacher thread</h2>
        <div className="mt-4" key={`thread-${version}`}>
          <TeacherThread
            thread={data.teacher_thread}
            childId={childId}
            classId={data.class.id}
            teacherName={data.class.teacher_name}
            role={role}
            demo={demo}
            onChanged={refresh}
          />
        </div>
      </section>

      {/* Check-in + handouts below the hero */}
      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <CheckinForm childId={childId} childName={childName} doneToday={checkinToday} demo={demo} />
        {!demo && <ClassFiles childId={childId} classId={data.class.id} className={displayName} />}
      </section>
    </main>
  );
}
