// Demo-mode fixtures for the management pages (settings, sync, health,
// portals). Shapes mirror the REAL backend contract (see management-api.ts)
// so the demo path and the real path render through the same components.

import type {
  ChildSummary,
  SyncJob,
  WorkerHeartbeat,
  PortalMeta,
  NotificationPrefs,
  Profile,
} from "./management-api";
import type { FamilyMember, PendingInvite } from "./family/types";

export const DEMO_CHILD_ID = "demo-child-id";

export const demoChildren: ChildSummary[] = [
  {
    id: "demo-child-id",
    firstName: "Dawson",
    nickname: null,
    slug: "dawson",
    schoolName: "Walton High School",
    gradeLevel: "10",
  },
];

export const demoProfile: Profile = {
  id: "demo-parent-id",
  email: "parent@example.com",
  name: "Demo Parent",
  avatar_url: null,
};

export const demoNotificationPrefs: NotificationPrefs = {
  sync_complete: true,
  grade_drop: true,
  due_soon: true,
  weekly_digest: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};

export const demoSyncJobs: SyncJob[] = [
  {
    id: "job-0042",
    status: "complete",
    device: "windows-laptop",
    summary: "6 classes · 82 assignments pulled",
    errors: [],
    created_at: "2026-10-11T17:03:00-04:00",
    claimed_at: "2026-10-11T17:03:12-04:00",
    completed_at: "2026-10-11T17:04:41-04:00",
  },
  {
    id: "job-0041",
    status: "complete",
    device: "macbook",
    summary: "6 classes · 82 assignments pulled",
    errors: [],
    created_at: "2026-10-11T08:05:00-04:00",
    claimed_at: "2026-10-11T08:05:09-04:00",
    completed_at: "2026-10-11T08:06:22-04:00",
  },
  {
    id: "job-0040",
    status: "failed",
    device: "windows-laptop",
    summary: "StudentVUE session expired mid-sweep",
    errors: ["portal login rejected: session expired", "0 of 6 classes pulled before abort"],
    created_at: "2026-10-10T18:12:00-04:00",
    claimed_at: "2026-10-10T18:12:11-04:00",
    completed_at: "2026-10-10T18:13:02-04:00",
  },
];

export const demoHeartbeats: WorkerHeartbeat[] = [
  {
    worker_id: "windows-laptop",
    status: "idle",
    last_seen: new Date(Date.now() - 12 * 60_000).toISOString(),
    last_job_id: "job-0042",
    last_successful_sync_at: "2026-10-11T17:04:41-04:00",
    version: "1.4.2",
    last_error: null,
    is_stale: false,
  },
  {
    worker_id: "macbook",
    status: "idle",
    last_seen: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    last_job_id: "job-0041",
    last_successful_sync_at: "2026-10-11T08:06:22-04:00",
    version: "1.4.2",
    last_error: null,
    is_stale: false,
  },
];

export const demoPortals: PortalMeta[] = [
  {
    id: "portal-demo-1",
    child_id: DEMO_CHILD_ID,
    portal_key: "studentvue",
    label: "StudentVUE (Cobb)",
    username_masked: "d••••",
    has_credential: true,
    status: "ok",
    last_verified_at: "2026-10-11T17:03:00-04:00",
    consecutive_failures: 0,
    credentials_updated_at: "2026-10-05T09:00:00-04:00",
    created_at: "2026-10-05T09:00:00-04:00",
  },
  {
    id: "portal-demo-2",
    child_id: DEMO_CHILD_ID,
    portal_key: "o365",
    label: "Microsoft 365 school login",
    username_masked: "d••••",
    has_credential: true,
    status: "ok",
    last_verified_at: "2026-10-11T17:03:00-04:00",
    credentials_updated_at: "2026-10-05T09:00:00-04:00",
    consecutive_failures: 0,
    created_at: "2026-10-05T09:00:00-04:00",
  },
];

/* ---------------- Family (demo fixtures mirror src/lib/family/types.ts) ---------------- */

export const demoFamilyMembers: FamilyMember[] = [
  {
    childId: DEMO_CHILD_ID,
    firstName: "Dawson",
    nickname: null,
    slug: "dawson",
    avatarUrl: null,
    schoolName: "Walton High School",
    gradeLevel: "10",
    dateOfBirth: "2011-07-23",
    logins: [
      {
        email: "parent@example.com",
        displayName: "Demo Parent",
        role: "parent",
        linkedAt: "2026-10-05T09:00:00-04:00",
      },
    ],
  },
];

export const demoPendingInvites: PendingInvite[] = [
  {
    id: "demo-invite-1",
    email: "dawson@example.com",
    childId: DEMO_CHILD_ID,
    childName: "Dawson",
    sentAt: "2026-10-10T09:00:00-04:00",
    expiresAt: "2026-10-24T09:00:00-04:00",
    token: "demo-token",
  },
];
