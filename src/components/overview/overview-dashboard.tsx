import Link from "next/link";
import type { SchoolOverview } from "@/lib/school/types";
import { ClassCard } from "@/components/school/class-card";
import { GreetingHero } from "./greeting-hero";
import { OverviewSection } from "./overview-section";
import { DueNextStrip } from "./due-next-strip";
import { AttentionItems } from "./attention-items";
import { UpcomingList } from "./upcoming-list";
import { isUrgent } from "./due-helpers";

/**
 * Home tab — `/c/[childSlug]/`.
 * The morning glance: greeting hero, due-next strip, 6 grade cards
 * (highest first), attention items, upcoming assignments, check-in nudge.
 * through the same component.
 */
export function OverviewDashboard({
  overview,
  childName,
  childSlug,
  schoolName,
  gradeLevel,
  role,
}: {
  overview: SchoolOverview;
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
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 pt-10 pb-8">
      <div className="firefly" style={{ width: 8, height: 8, top: "6%", left: "10%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "18%", left: "88%", animationDelay: "1.6s" }} />
      <div className="firefly" style={{ width: 10, height: 10, top: "48%", left: "4%", animationDelay: "2.8s" }} />

      <GreetingHero
        childName={childName}
        schoolName={schoolName}
        gradeLevel={gradeLevel}
        attentionCount={attentionCount}
        urgentCount={urgentCount}
        classCount={classes.length}
      />

      <div className="mt-8">
        <DueNextStrip items={overview.due_next} childSlug={childSlug} />
      </div>

      <div className="mt-8 space-y-8">
        <OverviewSection title="Classes" badge={classes.length} delay={0.2}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls, i) => (
              <ClassCard key={cls.class_id} cls={cls} childSlug={childSlug} index={i} tone="white" />
            ))}
          </div>
          <Link
            href={`/c/${childSlug}/school`}
            className="cta-glow mt-4 inline-block text-sm font-medium text-nova-600 hover:text-nova-500"
          >
            Open the school board →
          </Link>
        </OverviewSection>

        <OverviewSection title="Needs extra love" badge={attentionCount || null} delay={0.24}>
          <AttentionItems classes={classes} dueNext={overview.due_next} childSlug={childSlug} />
        </OverviewSection>

        <OverviewSection title="Coming up" badge={overview.due_next.length || null} delay={0.28}>
          <UpcomingList items={overview.due_next} childSlug={childSlug} />
        </OverviewSection>

        {!overview.checkin_today && (
          <OverviewSection title="Today's check-in" badge="!" delay={0.32}>
            <Link
              href={`/c/${childSlug}/school#checkin`}
              className="card-white block rounded-2xl px-5 py-4"
            >
              <p className="text-sm font-medium text-[#1f1f4a]">
                {childName} hasn&apos;t checked in today yet.
              </p>
              <p className="mt-1 text-sm text-[#55557e]">
                Two minutes — how did school go? It shapes tonight&apos;s plan. →
              </p>
            </Link>
          </OverviewSection>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-stardust-500">
        {role === "parent" ? "Parent view" : "Student view"} · grades refresh with each school sync
      </p>
    </main>
  );
}
