// Typed client for the management APIs (settings, sync, health, portals).
// Matches the BACKEND-BUILT contract (Senior Backend Developer, aaacbfb):
// REST /api/v1, handleRoute + `{ data }` envelope,
// errors `{ ok, error: { code, message, requestId } }`.
//
// Reconciled differences vs the original proposal (see BUILD-LOG.md):
// - Children: camelCase bodies; POST needs lastName; DELETE is a soft archive.
// - Sync: GET returns { jobs: [...] } (nested); no started_at (use claimed_at),
//   no error string (use errors[]); POST returns { job: { id, status } }.
// - Heartbeats: child-scoped GET .../sync/heartbeats → { workers: [...] }.
// - Credentials are "portals": portal_key vocabulary (studentvue|parentvue|
//   ctls-learn|o365); no PATCH (save = upsert); test is dual-mode with scope
//   honesty (never a live portal login).
// - Profile (/me) + notifications: BUILT — services/profile.ts
//   ManagementApiError("not_built"); views render per-card pending states.

export class ManagementApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ManagementApiError("network", "Couldn't reach the server — check your connection.");
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok || !json || !("data" in json)) {
    throw new ManagementApiError(
      json?.error?.code ?? `http_${res.status}`,
      json?.error?.message ?? `Request failed (${res.status}).`
    );
  }
  return json.data as T;
}

/* ---------------- Children (backend: services/children.ts) ---------------- */

/** GET /api/v1/children → { data: ChildSummary[] } (camelCase). */
export interface ChildSummary {
  id: string;
  firstName: string;
  nickname: string | null;
  slug: string;
  schoolName: string | null;
  gradeLevel: string | null;
}

export const listChildren = () => api<ChildSummary[]>("/api/v1/children");

/** POST /api/v1/children — lastName required (create_child RPC). → { data: { id } } */
export const createChild = (input: {
  firstName: string;
  lastName: string;
  nickname?: string | null;
  schoolName?: string | null;
  gradeLevel?: string | null;
}) => api<{ id: string }>("/api/v1/children", { method: "POST", body: JSON.stringify(input) });

/** PATCH /api/v1/children/[childId] — camelCase fields; slug/status excluded. */
export const updateChild = (
  childId: string,
  patch: {
    firstName?: string;
    lastName?: string;
    nickname?: string | null;
    schoolName?: string | null;
    gradeLevel?: string | null;
  }
) => api<ChildSummary>(`/api/v1/children/${childId}`, { method: "PATCH", body: JSON.stringify(patch) });

/** GET /api/v1/children/[childId] — full child detail (includes lastName). */
export interface ChildDetail extends ChildSummary {
  lastName: string | null;
  district: string | null;
  timezone: string | null;
  avatarUrl: string | null;
}

export const getChild = (childId: string) =>
  api<ChildDetail>(`/api/v1/children/${childId}`);

/** DELETE /api/v1/children/[childId] — SOFT archive → { data: { id, status: "archived" } }. */
export const deleteChild = (childId: string) =>
  api<{ id: string; status: string }>(`/api/v1/children/${childId}`, { method: "DELETE" });

/* ---------------- Sync console (backend: services/sync.ts) ---------------- */

export type SyncJobStatus = "pending" | "running" | "complete" | "failed";

/** One row of GET .../sync/requests → { data: { jobs: SyncJob[] } }. */
export interface SyncJob {
  id: string;
  status: SyncJobStatus;
  device: string | null;
  summary: string | null;
  errors: string[];
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
}

export const listSyncJobs = (childId: string, limit = 20) =>
  api<{ jobs: SyncJob[] }>(`/api/v1/children/${childId}/sync/requests?limit=${limit}`);

/** Sync Now — enqueues a pending job. → { data: { job: { id, status: "pending" } } } */
export const triggerSync = (childId: string) =>
  api<{ job: { id: string; status: SyncJobStatus } }>(
    `/api/v1/children/${childId}/sync/requests`,
    { method: "POST", body: JSON.stringify({}) }
  );

/* ---------------- Agent heartbeats (child-scoped) ---------------- */

/** One row of GET .../sync/heartbeats → { data: { workers: WorkerHeartbeat[] } }. */
export interface WorkerHeartbeat {
  worker_id: string;
  status: "idle" | "running" | "error" | string;
  last_seen: string | null;
  last_job_id: string | null;
  last_successful_sync_at: string | null;
  version: string | null; // null until migration 014
  last_error: string | null; // null until migration 014
  is_stale: boolean;
}

export const listHeartbeats = (childId: string) =>
  api<{ workers: WorkerHeartbeat[] }>(`/api/v1/children/${childId}/sync/heartbeats`);

/**
 * Health color from heartbeat age — derived client-side per the contract:
 * green <1h · yellow 1–12h · red >12h (or never seen).
 */
export function heartbeatHealth(iso: string | null): "green" | "yellow" | "red" {
  if (!iso) return "red";
  const ageH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (ageH < 1) return "green";
  if (ageH < 12) return "yellow";
  return "red";
}

/* ---------------- School portals — credential metadata (Vault-backed) ---------------- */

export type PortalKey = "studentvue" | "parentvue" | "ctls-learn" | "o365";

export const PORTAL_LABEL: Record<PortalKey, string> = {
  studentvue: "StudentVUE (Cobb)",
  parentvue: "ParentVUE (Cobb)",
  "ctls-learn": "CTLS Learn",
  o365: "Microsoft 365 school login",
};

export const PORTAL_KEYS: PortalKey[] = ["studentvue", "parentvue", "ctls-learn", "o365"];

/**
 * One row of GET .../portals → { data: { portals: PortalMeta[] } }.
 * Credential values are NEVER returned — username is masked, the password
 * is unretrievable by any client path.
 */
export interface PortalMeta {
  id: string;
  child_id: string;
  portal_key: PortalKey;
  label: string;
  username_masked: string | null;
  has_credential: boolean;
  status: string;
  last_verified_at: string | null;
  consecutive_failures: number;
  credentials_updated_at: string | null;
  created_at: string;
}

export const listPortals = (childId: string) =>
  api<{ portals: PortalMeta[] }>(`/api/v1/children/${childId}/portals`);

/**
 * Save (upsert — no PATCH): { portal_key*, label*, username?, password* }
 * → { data: { portal: { id, portal_key, status } } }.
 */
export const savePortal = (
  childId: string,
  input: { portal_key: PortalKey; label: string; username?: string; password: string }
) =>
  api<{ portal: { id: string; portal_key: PortalKey; status: string } }>(
    `/api/v1/children/${childId}/portals`,
    { method: "POST", body: JSON.stringify(input) }
  );

/**
 * Test connection — dual mode, scope honesty:
 * password present → pre-save sanity checks only (nothing persisted);
 * password absent → checks the SAVED credential.
 * Neither mode is a live portal login — the UI must not claim it is.
 * → { data: { ok, checked_at, scope, message } }
 */
export const testPortal = (
  childId: string,
  input: { portal_key: PortalKey; username?: string; password?: string }
) =>
  api<{ ok: boolean; checked_at: string; scope: string; message: string }>(
    `/api/v1/children/${childId}/portals/test`,
    { method: "POST", body: JSON.stringify(input) }
  );

/** DELETE .../portals/[portalKey] → { data: { removed } }. Idempotent. */
export const deletePortal = (childId: string, portalKey: PortalKey) =>
  api<{ removed: boolean }>(`/api/v1/children/${childId}/portals/${portalKey}`, { method: "DELETE" });

/* ---------------- Profile + notifications ---------------- */
// Backend: services/profile.ts — GET/PATCH /api/v1/me,
// GET/PATCH /api/v1/me/notifications.

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export interface NotificationPrefs {
  sync_complete: boolean;
  grade_drop: boolean;
  due_soon: boolean;
  weekly_digest: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const getProfile = (): Promise<Profile> =>
  api<Profile>("/api/v1/me");
export const updateProfile: (patch: { name?: string; avatar_url?: string | null }) => Promise<Profile> =
  (patch) =>
    api<Profile>("/api/v1/me", {
      method: "PATCH",
      // avatar_url has no users-table column yet (SQL workstream DDL);
      // the backend persists name and returns avatar_url: null.
      body: JSON.stringify({ name: patch.name ?? null }),
    });
export const getNotificationPrefs = (): Promise<NotificationPrefs> =>
  api<NotificationPrefs>("/api/v1/me/notifications");
export const updateNotificationPrefs: (patch: Partial<NotificationPrefs>) => Promise<NotificationPrefs> =
  (patch) =>
    api<NotificationPrefs>("/api/v1/me/notifications", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
