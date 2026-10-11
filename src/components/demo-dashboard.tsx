import { PookieOrb } from "@/components/pookie-orb";
import { getDemoDashboardData, type DemoClassGrade } from "@/lib/demo";

/** Grade → semantic color. Soft glows, never harsh. */
function gradeStyle(grade: number): { text: string; ring: string; glow: string } {
  if (grade >= 90)
    return {
      text: "text-leaf-300",
      ring: "border-leaf-400/30",
      glow: "shadow-glow-sm",
    };
  if (grade >= 80)
    return {
      text: "text-sunlight-300",
      ring: "border-sunlight-400/30",
      glow: "shadow-sun-warm",
    };
  if (grade >= 70)
    return {
      text: "text-orange-300",
      ring: "border-orange-400/30",
      glow: "0 0 14px rgb(251 146 60 / 0.22)",
    };
  return {
    text: "text-red-300",
    ring: "border-red-400/30",
    glow: "0 0 14px rgb(248 113 113 / 0.25)",
  };
}

function ClassCard({ cls, index }: { cls: DemoClassGrade; index: number }) {
  const s = gradeStyle(cls.grade);
  return (
    <div
      className={`card-living animate-bloom rounded-3xl border ${s.ring} p-5`}
      style={{ animationDelay: `${0.1 + index * 0.08}s`, boxShadow: s.glow }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-dew-100">{cls.name}</p>
        <p className={`text-2xl font-semibold tabular-nums ${s.text}`}>
          {cls.grade.toFixed(1)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${s.ring} text-sm font-bold ${s.text}`}
        >
          {cls.letter}
        </span>
        <p className="text-xs text-bark-300">{cls.note}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canopy-800">
        <div
          className={`h-full rounded-full ${s.text.replace("text-", "bg-")}`}
          style={{ width: `${Math.min(100, cls.grade)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Demo dashboard — mock grades rendered in the design language.
 * Shown only in demo mode; the real dashboard workstream replaces this.
 */
export function DemoDashboard() {
  const { classes, upcoming } = getDemoDashboardData();
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="animate-bloom flex items-center gap-4">
        <PookieOrb size={52} />
        <p className="text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase">
          Today&apos;s garden
        </p>
      </div>
      <h1 className="text-sunlit animate-bloom mt-3 text-3xl font-semibold tracking-tight">
        Here&apos;s how Dawson is growing today.
      </h1>
      <p
        className="animate-bloom mt-3 max-w-lg leading-relaxed text-bark-300"
        style={{ animationDelay: "0.1s" }}
      >
        Walton High School · Grade 10 · Goal: 90%+ in every class
      </p>

      <h2
        className="animate-bloom mt-10 text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase"
        style={{ animationDelay: "0.15s" }}
      >
        Classes
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls, i) => (
          <ClassCard key={cls.name} cls={cls} index={i} />
        ))}
      </div>

      <h2
        className="animate-bloom mt-10 text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase"
        style={{ animationDelay: "0.3s" }}
      >
        Coming up
      </h2>
      <div className="mt-4 grid gap-3">
        {upcoming.map((item, i) => (
          <div
            key={item.title}
            className="card-living animate-bloom flex items-center justify-between rounded-2xl px-5 py-4"
            style={{ animationDelay: `${0.35 + i * 0.08}s` }}
          >
            <p className="text-sm text-dew-100">{item.title}</p>
            <p className="text-xs font-medium text-sunlight-300">{item.due}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
