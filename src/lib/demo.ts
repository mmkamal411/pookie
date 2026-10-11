import { cookies } from "next/headers";
import type { TenantMembership } from "./tenant/types";

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
