"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { PookieOrb } from "@/components/pookie-orb";
import { gapTo90, gradeBand, letterGrade } from "@/lib/grades";
import type { ClassDetail } from "@/lib/school/types";
import { bandStyles, deltaCopy, gapCopy } from "./styles";
import { PathTo90 } from "./path-to-90";
import { TeacherThread } from "./teacher-thread";
import { ClassFiles } from "./class-files";
import { ProvenanceLabel } from "./provenance-label";
import { PeerPlaybook } from "./peer-playbook";
import { AssignmentsGrouped } from "./assignments-grouped";
import { WhatIfSimulator } from "./what-if-simulator";
import { ExplainBack } from "./explain-back";
import { StudyMaterials } from "./study-materials";
import { StudyResources } from "./study-resources";
import { ResourceLibrary } from "./resource-library";
import { DebriefingChamber } from "./debriefing-chamber";

/**
 * /c/[childSlug]/school/[classSlug] — the class page, d-dash comprehensive.
 * Grade hero first (numeric + letter side by side, gap-to-90 leading), then:
 * 98% playbook, the debriefing chamber, assignments by impact, what-if,
 * Path-to-90, explain-it-back, study materials, the student's own resource
 * library, curated study resources, class files, teacher thread.
 */
export function ClassDetailView({
  detail,
  childName,
  childSlug,
  childId,
  checkinId,
  role,
  curatedSlug,
  room,
  currentUnit,
  gradeWeights,
}: {
  detail: ClassDetail;
  childName: string;
  childSlug: string;
  childId: string;
  checkinId: string | null;
  role: "parent" | "child";
  /** Curated slug (apcsp/envsci/…) for Drive materials, tips, resources. */
  curatedSlug: string | null;
  room: string | null;
  currentUnit: string | null;
  /** Live category weights from classes.grade_weights (may be {}). */
  gradeWeights: Record<string, number> | null;
}) {
  const [data, setData] = useState(detail);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/classes/${data.class.id}`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: ClassDetail };
      setData(json.data);
      setVersion((v) => v + 1);
    } catch {
      // A failed refresh keeps the last good render — never a blank page.
    }
  }, [childId, data.class.id]);

  const band = gradeBand(data.grade?.numeric);
  const s = bandStyles[band];
  const gap = gapTo90(data.grade?.numeric);
  const displayName = data.class.display_name ?? data.class.name;
  const teacherLine = [
    data.class.period ? `Period ${data.class.period}` : null,
    data.class.teacher_name,
    room ? `Room ${room}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const attention = (data.assignments ?? []).filter((a) => a.status === "missing" || a.status === "late");

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "6%", left: "18%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "30%", left: "90%", animationDelay: "1.8s" }} />

      <Link href={`/c/${childSlug}/school`} className="animate-bloom text-sm font-medium text-nova-300 hover:text-nova-400">
        ← All Classes
      </Link>

      {/* Grade hero — numeric + letter side by side, separated by a line, visible on open */}
      <section className="animate-bloom mt-4 rounded-3xl border border-nova-400/20 bg-nebula-900/60 p-6 sm:p-8" style={{ animationDelay: "0.05s", boxShadow: s.glow }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-nova-400 capitalize">{data.grade?.term ?? "Current Term"}</p>
            <h1 className="text-sunlit mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{displayName}</h1>
            <p className="mt-2 text-sm text-stardust-300">{teacherLine || "Teacher · Room syncing…"}</p>
            {currentUnit && (
              <span className="mt-3 inline-block rounded-full border border-comet-400/40 bg-comet-400/10 px-3 py-1 text-xs font-semibold text-comet-300">
                Current: {currentUnit}
              </span>
            )}
          </div>
          <PookieOrb size={64} />
        </div>

        <div className="mt-4">
          <ProvenanceLabel kind="school-of-record" />
        </div>

        <div className="mt-6 flex items-center gap-5">
          <p className={`text-5xl font-semibold tabular-nums sm:text-6xl ${s.text}`}>
            {data.grade?.numeric != null ? data.grade.numeric.toFixed(1) : "—"}
          </p>
          <span className="h-16 w-px bg-nova-400/25" aria-hidden="true" />
          <div>
            <p className={`text-4xl font-bold ${s.text}`}>{letterGrade(data.grade?.numeric)}</p>
            <p className="mt-1 text-xs text-stardust-300 capitalize">Letter</p>
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

      {/* 98% Playbook — peer tips, high visibility */}
      <section className="mt-5">
        <PeerPlaybook childId={childId} slug={curatedSlug} />
      </section>

      {/* Debriefing chamber — the daily check-in as a mission event */}
      <section className="mt-5" id="debrief">
        <DebriefingChamber
          childId={childId}
          classId={data.class.id}
          className={displayName}
          currentUnit={currentUnit}
          initialCheckinId={checkinId}
          role={role}
        />
      </section>

      {/* Assignments grouped by impact */}
      <section className="mt-8">
        <div className="animate-bloom flex items-center gap-3">
          <h2 className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">Assignments</h2>
          <ProvenanceLabel kind="school-of-record" />
        </div>
        <div className="mt-4">
          <AssignmentsGrouped assignments={data.assignments ?? []} slug={curatedSlug} />
        </div>
      </section>

      {/* Assignment what-if */}
      <section className="mt-5">
        <WhatIfSimulator
          assignments={data.assignments ?? []}
          slug={curatedSlug}
          currentGrade={data.grade?.numeric ?? null}
          liveWeights={gradeWeights}
        />
      </section>

      {/* Path to 90 */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">Your Next Steps</h2>
        <div className="mt-4" key={version}>
          <PathTo90
            plan={data.study_plan}
            childId={childId}
            classId={data.class.id}
            childName={childName}
            role={role}
            onChanged={refresh}
          />
        </div>
      </section>

      {/* Explain it back — 60-second self-test */}
      <section className="mt-5">
        <ExplainBack
          childId={childId}
          classId={data.class.id}
          topic={currentUnit ?? displayName}
        />
      </section>

      {/* Study materials — from Drive */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">Study Materials</h2>
        <p className="mt-1 text-xs text-stardust-400">From your Drive · grouped by unit</p>
        <div className="mt-4">
          <StudyMaterials childId={childId} slug={curatedSlug} />
        </div>
      </section>

      {/* My resource library — the student owns it */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">My Resource Library</h2>
        <p className="mt-1 text-xs text-stardust-400">Khan, YouTube, Quizlet, Desmos — whatever works. Yours to keep.</p>
        <div className="mt-4">
          <ResourceLibrary childId={childId} classId={data.class.id} currentUnit={currentUnit} />
        </div>
      </section>

      {/* Study resources — curated */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">Study Resources</h2>
        <p className="mt-1 text-xs text-stardust-400">Curated for this class · Pookie&apos;s picks</p>
        <div className="mt-4">
          <StudyResources childId={childId} slug={curatedSlug} />
        </div>
      </section>

      {/* Class files */}
      <section className="mt-8">
        <ClassFiles childId={childId} classId={data.class.id} className={displayName} />
      </section>

      {/* Teacher thread */}
      <section className="mt-8">
        <h2 className="animate-bloom text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">Teacher Inbox</h2>
        <div className="mt-4" key={`thread-${version}`}>
          <TeacherThread
            thread={data.teacher_thread}
            childId={childId}
            classId={data.class.id}
            teacherName={data.class.teacher_name}
            role={role}
            onChanged={refresh}
          />
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-stardust-500">
        Grades refresh with each school sync · {role === "parent" ? "Command View" : "Flight-Deck View"}
      </p>
    </main>
  );
}
