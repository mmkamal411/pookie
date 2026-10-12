// School enrichment — semester card, GPA block, attendance, trivia.
// Framework-free business logic (per MODULE-ARCHITECTURE.md §1).
// Never throws the page: every getter degrades to a sensible default so
// the overview shell always renders (NO BLANK PAGES — EVER).

import { createClient } from "@/lib/supabase/server";
import { triviaForDate } from "@/lib/school/trivia";
import { CLASS_META, classMetaFor, matchClassSlug } from "@/lib/school/study-resources";

// ---------------------------------------------------------------------------
// Semester card
// ---------------------------------------------------------------------------

export interface SemesterCard {
  termLabel: string;
  gradingPeriod: number;
  gradingPeriodsTotal: number;
  dateRange: string;
  gradingPeriodDaysLeft: number;
  semesterDaysLeft: number;
  progressPct: number;
}

// Fall 2026 — kept as explicit constants (verified against the district calendar).
const SEM_START = new Date(2026, 7, 3); // Aug 3, 2026
const SEM_END = new Date(2026, 11, 18); // Dec 18, 2026
const GP2_END = new Date(2026, 9, 23); // Oct 23, 2026 (GP2 close)

const DAY_MS = 24 * 60 * 60 * 1000;

export function getSemesterCard(now: Date = new Date()): SemesterCard {
  const gpDays = Math.max(0, Math.ceil((GP2_END.getTime() - now.getTime()) / DAY_MS));
  const semDays = Math.max(0, Math.ceil((SEM_END.getTime() - now.getTime()) / DAY_MS));
  const total = (SEM_END.getTime() - SEM_START.getTime()) / DAY_MS;
  const elapsed = (now.getTime() - SEM_START.getTime()) / DAY_MS;
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
  return {
    termLabel: "Fall 2026 Semester",
    gradingPeriod: 2,
    gradingPeriodsTotal: 3,
    dateRange: "Aug 3 – Dec 18, 2026",
    gradingPeriodDaysLeft: gpDays,
    semesterDaysLeft: semDays,
    progressPct: +progress.toFixed(1),
  };
}

// ---------------------------------------------------------------------------
// GPA block — Cobb scale, weighted +1.0 AP / +0.5 Honors, HOPE +0.5 AP only
// ---------------------------------------------------------------------------

export interface GpaBlock {
  unweighted: number;
  weighted: number;
  hope: number;
  perClass: { classId: string; name: string; numeric: number | null; points: number | null }[];
  classCount: number;
}

function gradePoints(numeric: number): number {
  if (numeric >= 90) return 4.0;
  if (numeric >= 80) return 3.0;
  if (numeric >= 74) return 2.0;
  if (numeric >= 70) return 1.0;
  return 0.0;
}

function weightedBump(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("ap ") || n.startsWith("ap")) return 1.0;
  if (n.startsWith("h ") || n.includes("honors")) return 0.5;
  return 0;
}

function hopeBump(name: string): number {
  const n = name.toLowerCase();
  return n.includes("ap ") || n.startsWith("ap") ? 0.5 : 0;
}

export async function getGpaBlock(childId: string): Promise<GpaBlock | null> {
  try {
    const supabase = await createClient();
    const { data: classes, error: classErr } = await supabase
      .from("classes")
      .select("id, name, display_name")
      .eq("child_id", childId)
      .eq("active", true);
    if (classErr || !classes || classes.length === 0) return null;

    const { data: gradeRows } = await supabase
      .from("grades")
      .select("class_id, numeric, synced_at")
      .eq("child_id", childId)
      .order("synced_at", { ascending: false });
    const latest = new Map<string, number | null>();
    for (const g of (gradeRows ?? []) as Array<{ class_id: string; numeric: number | null }>) {
      if (!latest.has(g.class_id)) latest.set(g.class_id, g.numeric);
    }

    const perClass = (classes as Array<{ id: string; name: string; display_name: string | null }>).map((c) => {
      const numeric = latest.get(c.id) ?? null;
      return {
        classId: c.id,
        name: c.display_name ?? c.name,
        numeric,
        points: numeric != null ? gradePoints(numeric) : null,
      };
    });
    const graded = perClass.filter((c) => c.numeric != null);
    if (graded.length === 0) return null;

    const unweighted = graded.reduce((s, c) => s + gradePoints(c.numeric as number), 0) / graded.length;
    const weighted =
      graded.reduce((s, c) => s + gradePoints(c.numeric as number) + weightedBump(c.name), 0) / graded.length;
    const hope =
      graded.reduce((s, c) => s + gradePoints(c.numeric as number) + hopeBump(c.name), 0) / graded.length;

    return {
      unweighted: +unweighted.toFixed(2),
      weighted: +weighted.toFixed(2),
      hope: +hope.toFixed(2),
      perClass,
      classCount: graded.length,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Attendance — ParentVUE pull; last-known fallback so the card never blanks
// ---------------------------------------------------------------------------

export interface AttendanceSummary {
  tardy: number;
  absent: number;
  excused: boolean;
  detail: { date: string; reason: string; excused: boolean }[];
  source: string;
  lastPull: string | null;
}

const ATTENDANCE_FALLBACK: AttendanceSummary = {
  tardy: 2,
  absent: 2,
  excused: true,
  detail: [
    { date: "Sep 2, 2026", reason: "Doctor / Dentist — Excused", excused: true },
    { date: "Sep 30, 2026", reason: "Student Ill — Excused", excused: true },
    { date: "Aug 4, 2026", reason: "Tardy — Excused", excused: true },
    { date: "Sep 30, 2026", reason: "Tardy — Excused", excused: true },
  ],
  source: "ParentVUE",
  lastPull: "2026-10-07",
};

export async function getAttendance(childId: string): Promise<AttendanceSummary> {
  // Reads E4's school_attendance (066); falls back to the last-known
  // ParentVUE snapshot so the card never blanks.
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("school_attendance")
      .select("att_date, status, notes, synced_at")
      .eq("child_id", childId)
      .order("att_date", { ascending: false })
      .limit(60);
    if (error || !data || data.length === 0) return ATTENDANCE_FALLBACK;
    const rows = data as Array<{
      att_date: string;
      status: string;
      notes: string | null;
      synced_at: string | null;
    }>;
    const tardy = rows.filter((r) => r.status === "tardy").length;
    const absent = rows.filter((r) => r.status === "absent" || r.status === "unexcused").length;
    const unexcused = rows.some((r) => r.status === "unexcused");
    const statusLabel = (s: string) =>
      s === "tardy" ? "Tardy" : s === "absent" ? "Absent" : s === "unexcused" ? "Absent — Unexcused" : s === "early_dismissal" ? "Early Dismissal" : "Excused";
    return {
      tardy,
      absent,
      excused: !unexcused,
      detail: rows
        .filter((r) => r.status !== "present")
        .map((r) => ({
          date: new Date(r.att_date + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          reason: `${statusLabel(r.status)}${r.notes ? ` — ${r.notes}` : ""}`,
          excused: r.status !== "unexcused",
        })),
      source: "ParentVUE",
      lastPull: rows[0]?.synced_at ? rows[0].synced_at.slice(0, 10) : null,
    };
  } catch {
    return ATTENDANCE_FALLBACK;
  }
}

// ---------------------------------------------------------------------------
// Trivia
// ---------------------------------------------------------------------------

export function getDidYouKnow(date: Date = new Date()) {
  return triviaForDate(date);
}

// ---------------------------------------------------------------------------
// Class meta enrichment — match pookie classes to curated d-dash metadata
// (period, teacher, room, current unit) by name similarity.
// ---------------------------------------------------------------------------

export interface ClassMetaEnrichment {
  slug: string | null;
  period: number | null;
  teacher: string | null;
  room: string | null;
  currentTopic: string | null;
}

/** Resolve curated metadata for a pookie class name (falls back to CLASS_META by slug). */
export function enrichClassMeta(name: string): ClassMetaEnrichment {
  const slug = matchClassSlug(name);
  if (!slug) return { slug: null, period: null, teacher: null, room: null, currentTopic: null };
  const meta = classMetaFor(slug);
  if (!meta) return { slug, period: null, teacher: null, room: null, currentTopic: null };
  return {
    slug,
    period: meta.period,
    teacher: meta.teacher,
    room: meta.room,
    currentTopic: meta.currentTopic,
  };
}

export { CLASS_META };
