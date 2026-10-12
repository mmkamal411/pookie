import Link from "next/link";
import type { SchoolOverview } from "@/lib/school/types";
import type { HomeBriefing } from "@/server/services/school";
import { ClassCard } from "@/components/school/class-card";
import { MissionBriefing } from "@/components/home/mission-briefing";
import { CommandStrip } from "@/components/home/command-strip";
import { SchoolCalendar } from "@/components/home/school-calendar";
import { StudySparks } from "@/components/home/study-sparks";
import { FormulaCard } from "@/components/home/formula-card";
import { OverviewSection } from "./overview-section";
import { DueNextStrip } from "./due-next-strip";
import { AttentionItems } from "./attention-items";
import { UpcomingList } from "./upcoming-list";
import { isUrgent } from "./due-helpers";

/**
 * Home tab — `/c/[childSlug]/`.
 * Structure ported from d-dash's beloved dashboard (Squad Homeport):
 * mission briefing (greeting + quote + weather) → command strip (KPIs) →
 * due-next rail → classes → needs extra love → coming up → school
 * calendar → brain hacks → formula of the day → check-in nudge.
 * All sections collapsed by default; the glance survives in the headers.
 */
export function OverviewDashboard({
  overview,
  briefing,
  childName,
  childSlug,
  schoolName,
  gradeLevel,
  role,
}: {
  overview: SchoolOverview;
  briefing: HomeBriefing;
  childName: string;
  childSlug: string;
  schoolName: string | null;
  gradeLevel: string | null;
  role: "parent" | "child";
}) {
  // F3: Null-guard — overview may be partial if a query failed.
  const classes = [...(overview?.classes ?? [])].sort((a, b) => {
    if (a.numeric == null) return 1;
    if (b.numeric == null) return -1;
    return b.numeric - a.numeric;
  });
  const attentionCount = classes.filter((c) => c.numeric != null && c.numeric < 80).length;
  const urgentCount = (overview?.due_next ?? []).filter(isUrgent).length;

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 pt-4 pb-8">
      <div className="firefly" style={{ width: 8, height: 8, top: "6%", left: "10%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "18%", left: "88%", animationDelay: "1.6s" }} />
      <div className="firefly" style={{ width: 10, height: 10, top: "48%", left: "4%", animationDelay: "2.8s" }} />

      {/* Vista hero — Squad Vista 2026-10-12: the open window. The astronaut
          lands looking out at the cosmos; the mission board waits one gentle
          scroll below. Space is the hero, not a wall of cards.
          Squad Horizon: the hero gets a viewport frame — the physical window
          frame of the bridge. */}
      <div className="vista-hero">
        <MissionBriefing
          childName={childName}
          schoolName={schoolName}
          gradeLevel={gradeLevel}
          attentionCount={attentionCount}
          urgentCount={urgentCount}
          classCount={classes.length}
        />
        <a href="#mission-board" className="vista-scroll-cue" aria-label="Scroll to your mission board">
          <span>your mission board</span>
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>

      <div id="mission-board" className="vista-board mt-2">
        <CommandStrip
          classes={classes}
          dueNext={overview.due_next}
          checkinStreak={briefing.checkin_streak}
        />
      </div>

      <div className="mt-8">
        <DueNextStrip items={overview.due_next} childSlug={childSlug} />
      </div>

      <div className="mt-8 space-y-8">
        <OverviewSection title="Classes" badge={classes.length} delay={0.2}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls, i) => (
              <ClassCard key={cls.class_id} cls={cls} childSlug={childSlug} index={i} />
            ))}
          </div>
          <Link
            href={`/c/${childSlug}/school`}
            className="cta-glow mt-4 inline-block text-sm font-medium text-nova-400 hover:text-nova-300"
          >
            Open the school console →
          </Link>
        </OverviewSection>

        <OverviewSection title="Course Corrections" badge={attentionCount || null} delay={0.24}>
          <AttentionItems classes={classes} dueNext={overview.due_next} childSlug={childSlug} />
        </OverviewSection>

        <OverviewSection title="On the Horizon" badge={overview.due_next.length || null} delay={0.28}>
          <UpcomingList items={overview.due_next} childSlug={childSlug} />
        </OverviewSection>

        <OverviewSection
          title="School calendar"
          badge={briefing.events.length || null}
          delay={0.3}
        >
          <SchoolCalendar events={briefing.events} />
        </OverviewSection>

        <OverviewSection
          title="Brain hacks"
          badge={briefing.sparks.length || null}
          delay={0.32}
        >
          <StudySparks sparks={briefing.sparks} />
        </OverviewSection>

        {briefing.formula && (
          <OverviewSection title="Formula of the day" delay={0.34}>
            <FormulaCard formula={briefing.formula} />
          </OverviewSection>
        )}

        {!overview.checkin_today && (
          <OverviewSection title="Daily Log" badge="!" delay={0.36}>
            <Link
              href={`/c/${childSlug}/school#checkin`}
              className="card-cockpit block rounded-2xl px-5 py-4"
            >
              <p className="text-sm font-medium text-star-100">
                {childName} hasn't logged today's check-in yet.
              </p>
              <p className="mt-1 text-sm text-stardust-300">
                Two minutes — how did the mission go? It shapes tonight's flight plan. →
              </p>
            </Link>
          </OverviewSection>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-stardust-500">
        {role === "parent" ? "Command view" : "Flight-deck view"} · grades refresh with each school sync
      </p>
    </main>
  );
}
