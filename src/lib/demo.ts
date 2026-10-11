import { cookies } from "next/headers";
import type { TenantMembership } from "./tenant/types";
import type { ClassDetail, SchoolOverview } from "./school/types";

/**
 * Demo mode — lets the founder click through the full app without logging in.
 *
 * SAFETY: demo mode ONLY activates when the deploy explicitly sets
 * NEXT_PUBLIC_DEMO_MODE=1. The real auth/RLS flow is completely untouched
 * when the env var is absent. Never set this on production.
 */

/** Cookie marking this browser as a demo session. */
export const DEMO_COOKIE = "pookie_demo";

/** Fixed mock IDs — stable across demo sessions, never collide with real rows. */
export const DEMO_CHILD_ID = "00000000-0000-4000-8000-0000000000d0";
export const DEMO_USER_ID = "00000000-0000-4000-8000-0000000000d1";

/** True only on deploys that explicitly opt into demo mode. */
export function isDemoDeploy(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "1";
}

/**
 * True when this request is a demo session: deploy opted in AND the
 * browser carries the demo cookie (set by visiting /demo).
 */
export async function isDemoRequest(): Promise<boolean> {
  if (!isDemoDeploy()) return false;
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}

/** One mock membership: demo parent + one child, Dawson. */
export function getDemoMemberships(): TenantMembership[] {
  return [
    {
      child_id: DEMO_CHILD_ID,
      role: "parent",
      child: {
        id: DEMO_CHILD_ID,
        slug: "dawson",
        first_name: "Dawson",
        nickname: "Dawson",
        avatar_url: null,
        school_name: "Walton High School",
        grade_level: "10",
      },
    },
  ];
}

export interface DemoClassGrade {
  name: string;
  grade: number;
  letter: string;
  note: string;
}

export interface DemoUpcomingItem {
  title: string;
  due: string;
}

/** Mock W1 school overview — reference dataset, clearly mock values. */
export function getDemoSchoolOverview(): SchoolOverview {
  const classes = [
    {
      class_id: "00000000-0000-4000-8000-00000000c101",
      class_slug: "ap-csp",
      name: "AP CS Principles",
      display_name: "AP CS Principles",
      period: null,
      teacher_name: "Whitney Hubbard",
      term: "GP2",
      numeric: 80.2,
      delta_7d: 0.4,
    },
    {
      class_id: "00000000-0000-4000-8000-00000000c102",
      class_slug: "env-science",
      name: "Env Science",
      display_name: "Env Science",
      period: null,
      teacher_name: "Rudolph Armocida",
      term: "GP2",
      numeric: 79.0,
      delta_7d: 2.0,
    },
    {
      class_id: "00000000-0000-4000-8000-00000000c103",
      class_slug: "chinese-iii",
      name: "H Chinese III",
      display_name: "H Chinese III",
      period: null,
      teacher_name: "Xiaoman Cook",
      term: "GP2",
      numeric: 97.1,
      delta_7d: 0.3,
    },
    {
      class_id: "00000000-0000-4000-8000-00000000c104",
      class_slug: "american-gov",
      name: "American Gov",
      display_name: "American Gov",
      period: "5th",
      teacher_name: "Sarah Burwell",
      term: "GP2",
      numeric: 79.0,
      delta_7d: 1.0,
    },
    {
      class_id: "00000000-0000-4000-8000-00000000c105",
      class_slug: "geometry",
      name: "Geometry",
      display_name: "Geometry",
      period: "6th",
      teacher_name: "Kathryn Thomason",
      term: "GP2",
      numeric: 69.5,
      delta_7d: -5.5,
    },
    {
      class_id: "00000000-0000-4000-8000-00000000c106",
      class_slug: "lit-comp-ii",
      name: "Lit & Comp II",
      display_name: "Lit & Comp II",
      period: "7th",
      teacher_name: "Ashley Nickell",
      term: "GP2",
      numeric: 84.2,
      delta_7d: 0.2,
    },
  ];
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return {
    classes,
    due_next: [
      {
        id: "00000000-0000-4000-8000-00000000a101",
        class_id: classes[4].class_id,
        class_slug: classes[4].class_slug,
        class_name: classes[4].name,
        title: "Unit 4 quiz",
        category: "Quizzes",
        due_date: new Date(now + day).toISOString(),
        status: "upcoming",
        points_earned: null,
        points_possible: 100,
        notes: null,
      },
      {
        id: "00000000-0000-4000-8000-00000000a102",
        class_id: classes[1].class_id,
        class_slug: classes[1].class_slug,
        class_name: classes[1].name,
        title: "Rock lab report",
        category: "Labs",
        due_date: new Date(now + 4 * day).toISOString(),
        status: "upcoming",
        points_earned: null,
        points_possible: 50,
        notes: null,
      },
      {
        id: "00000000-0000-4000-8000-00000000a103",
        class_id: classes[2].class_id,
        class_slug: classes[2].class_slug,
        class_name: classes[2].name,
        title: "Vocab quiz",
        category: "Quizzes",
        due_date: new Date(now + 4 * day).toISOString(),
        status: "upcoming",
        points_earned: null,
        points_possible: 30,
        notes: null,
      },
    ],
    checkin_today: false,
  };
}

/** Mock W1 class detail for the demo — null when the slug is unknown. */
export function getDemoClassDetail(classSlug: string): ClassDetail | null {
  const overview = getDemoSchoolOverview();
  const cls = overview.classes.find((c) => c.class_slug === classSlug);
  if (!cls) return null;
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const base = cls.numeric ?? 0;
  return {
    class: {
      id: cls.class_id,
      class_slug: cls.class_slug,
      name: cls.name,
      display_name: cls.display_name,
      period: cls.period,
      teacher_name: cls.teacher_name,
      teacher_email: null,
    },
    grade: { term: cls.term, numeric: cls.numeric },
    history: [14, 11, 7, 4, 1].map((ago, i) => ({
      taken_at: new Date(now - ago * day).toISOString(),
      numeric: +(base - (cls.delta_7d ?? 0) * (i / 4) - i * 0.2).toFixed(1),
    })),
    assignments: overview.due_next
      .filter((d) => d.class_id === cls.class_id)
      .map((d) => ({
        id: d.id,
        class_id: d.class_id,
        title: d.title,
        category: d.category,
        due_date: d.due_date,
        status: d.status,
        points_earned: d.points_earned,
        points_possible: d.points_possible,
        notes: d.notes,
      })),
    study_plan: {
      id: "00000000-0000-4000-8000-00000000p101",
      class_id: cls.class_id,
      week_start: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      plan: [
        { rank: 1, action: "Finish the missing study guide before Wednesday", why: "A zero drags its whole category down", done: false },
        { rank: 2, action: "Redo the two lowest quizzes for partial credit", why: "Replacing low scores is the fastest climb", done: false },
        { rank: 3, action: "Spend 20 minutes nightly on practice problems", why: "Steady reps beat one big cram", done: true },
      ],
      generated_by: "parent",
      safety_status: "approved",
      status: "active",
      created_at: new Date(now - 2 * day).toISOString(),
    },
    teacher_thread: [
      {
        id: "00000000-0000-4000-8000-00000000m101",
        class_id: cls.class_id,
        direction: "inbound",
        subject: `Re: ${cls.name} - Dawson Kamal`,
        body: "Thank you for reaching out. Happy to discuss how we can help Dawson get back on track.",
        status: "received",
        created_at: new Date(now - 2 * day).toISOString(),
        sent_at: new Date(now - 2 * day).toISOString(),
      },
    ],
  };
}

/** Mock dashboard data — realistic shape, clearly fake values. */
export function getDemoDashboardData(): {
  classes: DemoClassGrade[];
  upcoming: DemoUpcomingItem[];
} {
  return {
    classes: [
      { name: "H Chinese III", grade: 97.1, letter: "A", note: "On track" },
      { name: "Lit & Comp II", grade: 84.2, letter: "B", note: "+0.2 this week" },
      { name: "American Gov", grade: 79.0, letter: "C", note: "+1.0 this week" },
      { name: "AP CS Principles", grade: 80.2, letter: "B", note: "Steady" },
      { name: "Env Science", grade: 79.0, letter: "C", note: "+2.0 this week" },
      { name: "Geometry", grade: 69.5, letter: "F", note: "Needs attention" },
    ],
    upcoming: [
      { title: "Geometry — Unit 4 quiz", due: "Tomorrow" },
      { title: "Env Science — lab report", due: "Friday" },
      { title: "Chinese III — vocab quiz", due: "Friday" },
    ],
  };
}
