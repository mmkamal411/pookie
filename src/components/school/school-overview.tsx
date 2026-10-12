"use client";

import Link from "next/link";
import { useGradeCelebration } from "@/lib/orb/use-grade-celebration";
import type { CalibrationSummary, SchoolOverview, TodayCheckin } from "@/lib/school/types";
import type { AttendanceSummary, GpaBlock, SemesterCard as SemesterCardData } from "@/server/services/school-enrich";
import type { TriviaFact } from "@/lib/school/trivia";
import type { CobbEvent } from "@/lib/school/cobb-calendar";
import type { Freshness } from "@/lib/school-sync-health-types";
import { ClassesList } from "./classes-list";
import { CheckinForm } from "./checkin-form";
import { ProvenanceLabel, ProvenanceLine } from "./provenance-label";
import { DidYouKnow } from "./did-you-know";
import { SemesterCard } from "./semester-card";
import { SyncHealthSummary } from "./sync-health-summary";
import { BellSchedule } from "./bell-schedule";
import { CobbCalendar } from "./cobb-calendar";
import { WeatherCard } from "./weather-card";
import { dueDateLabel } from "./styles";

export interface OverviewEnrich {
  semester: SemesterCardData;
  gpa: GpaBlock | null;
  attendance: AttendanceSummary;
  trivia: TriviaFact;
  health: { allGreen: boolean; sources: { source: string; name: string; freshness: Freshness }[] };
  calendarEvents: CobbEvent[];
}

/**
 * /c/[childSlug]/school — the full d-dash comprehensiveness, spaceship-styled:
 * Did You Know, semester card (GPA + attendance + simulator), data-freshness
 * strip, classes list, due-next rail, bell schedule, Cobb calendar, weather,
 * and the daily check-in. Provenance labels mark school-of-record data.
 */
export function SchoolOverview({
  overview,
  childName,
  childSlug,
  childId,
  role,
  calibration,
  labToday,
  todayCheckin,
  enrich,
}: {
  overview: SchoolOverview;
  childName: string;
  childSlug: string;
  childId: string;
  role: "parent" | "child";
  calibration?: CalibrationSummary | null;
  labToday?: { class_name: string } | null;
  todayCheckin?: TodayCheckin | null;
  enrich: OverviewEnrich;
}) {
  const needsAttention = overview.classes.filter((c) => c.numeric != null && c.numeric < 80).length;
  // Squad Oracle: the orb celebrates whenever a grade climbs.
  useGradeCelebration(overview.classes);

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 py-10">
      <div className="firefly" style={{ width: 8, height: 8, top: "8%", left: "12%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "22%", left: "86%", animationDelay: "1.4s" }} />
      <div className="firefly" style={{ width: 10, height: 10, top: "60%", left: "6%", animationDelay: "2.6s" }} />

      {/* Did You Know — top of the flight deck */}
      <DidYouKnow fact={enrich.trivia} />

      <div className="animate-bloom mt-6 flex items-center gap-4">
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          School · Mission Status
        </p>
      </div>

      <h1 className="text-sunlit animate-bloom mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {childName}&apos;s School, From the Flight Deck
      </h1>
      <p className="animate-bloom mt-3 max-w-xl leading-relaxed text-stardust-300" style={{ animationDelay: "0.08s" }}>
        The mission: <span className="font-semibold text-star-100">90%+ in every class</span>. Every
        number below is a starting point for a plan — never a judgment.
        {needsAttention > 0 && (
          <>
            {" "}{needsAttention} {needsAttention === 1 ? "class is" : "classes are"} getting extra
            love right now.
          </>
        )}
      </p>

      {/* Semester card — term, countdowns, GPA, attendance, simulator */}
      <div className="mt-6">
        <SemesterCard semester={enrich.semester} gpa={enrich.gpa} attendance={enrich.attendance} />
      </div>

      {/* Data freshness strip */}
      <div className="mt-4">
        <SyncHealthSummary
          sources={enrich.health.sources}
          allGreen={enrich.health.allGreen}
          childSlug={childSlug}
        />
      </div>

      {/* Classes list */}
      <div className="animate-bloom mt-8 flex items-center gap-3" style={{ animationDelay: "0.2s" }}>
        <h2 className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          Classes
        </h2>
        <ProvenanceLabel kind="school-of-record" />
      </div>
      <ProvenanceLine kind="school-of-record" className="mt-1" />
      <div className="mt-4">
        <ClassesList classes={overview.classes} childSlug={childSlug} />
      </div>

      {/* Due next */}
      <div className="animate-bloom mt-10 flex items-center gap-3" style={{ animationDelay: "0.2s" }}>
        <h2 className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          Coming Up Next
        </h2>
        <ProvenanceLabel kind="school-of-record" />
      </div>
      {overview.due_next.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {overview.due_next.map((item, i) => (
            <div
              key={item.id}
              className="card-living animate-bloom flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
              style={{ animationDelay: `${0.24 + i * 0.06}s` }}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-star-100">{item.title}</p>
                <p className="mt-0.5 text-xs text-stardust-300">
                  {item.class_name}
                  {item.category ? ` · ${item.category}` : ""}
                </p>
              </div>
              <p className={`shrink-0 text-xs font-medium ${item.status === "missing" || item.status === "late" ? "text-red-300" : "text-aurum-300"}`}>
                {item.status === "missing" ? "Missing — let's recover it" : item.status === "late" ? "Late — still worth turning in" : dueDateLabel(item.due_date)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="animate-bloom mt-4 text-sm text-stardust-300" style={{ animationDelay: "0.24s" }}>
          Nothing on the horizon — a clear, sunny stretch. 🌤️
        </p>
      )}

      {/* Daily check-in */}
      <div className="mt-10" id="checkin">
        <CheckinForm
          childId={childId}
          childName={childName}
          role={role}
          todayCheckin={todayCheckin ?? null}
          calibration={calibration ?? null}
          labToday={labToday ?? null}
        />
      </div>

      {/* Reference — collapsed by default */}
      <div className="mt-10 space-y-3">
        <h2 className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          Reference
        </h2>
        <BellSchedule />
        <CobbCalendar events={enrich.calendarEvents} />
        {/* Prism E5 2026-10-12: the minutiae calendar page had no inbound
            links anywhere — deep-link-only. */}
        <Link
          href={`/c/${childSlug}/school/minutiae`}
          className="card-living flex items-center justify-between rounded-2xl px-5 py-4"
        >
          <div>
            <p className="text-sm font-medium text-star-100">School Minutiae</p>
            <p className="mt-0.5 text-xs text-stardust-300">
              The small stuff — early releases, late starts, odd days
            </p>
          </div>
          <span aria-hidden="true" className="text-nova-300">→</span>
        </Link>
        <WeatherCard childId={childId} />
      </div>

      <p className="mt-8 text-center text-xs text-stardust-500">
        Grades refresh with each school sync · {role === "parent" ? "Command View" : "Flight-Deck View"}
      </p>
    </main>
  );
}
