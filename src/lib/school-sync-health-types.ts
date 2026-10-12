// Shared school-sync-health types + pure helpers.
// No server imports here — safe for client components.

export type Freshness = "fresh" | "stale" | "error" | "running" | "never";

export interface MachineHealth {
  machine: string;
  freshness: Freshness;
  lastRunFinished: string | null;
  lastSuccessAt: string | null;
  nextScheduledRun: string | null;
  rowsPulled: number;
  rowsByTable: Record<string, number>;
  lastError: string | null;
  consecutiveErrors: number;
  ageMinutes: number | null;
}

export interface SourceHealth {
  source: string;
  name: string;
  description: string;
  freshness: Freshness;
  machines: MachineHealth[];
  lastRunFinished: string | null;
  lastSuccessAt: string | null;
  nextScheduledRun: string | null;
  rowsPulled: number;
  rowsByTable: Record<string, number>;
  lastError: string | null;
  consecutiveErrors: number;
  cadence: string | null;
  ageMinutes: number | null;
}

export interface SyncHealthSummary {
  sources: SourceHealth[];
  allGreen: boolean;
  checkedAt: string;
  recomputed: boolean;
}

export const SOURCE_META: Record<string, { name: string; description: string }> = {
  studentvue: { name: "StudentVUE", description: "Student gradebook detail + category weights" },
  parentvue: { name: "ParentVUE", description: "Parent grades + attendance pull" },
  "gmail-teacher": { name: "Teacher Emails", description: "Teacher + counselor email pull" },
  "ctls-learn": { name: "CTLS Learn", description: "Curriculum materials + upcoming work" },
  "ctls-parent": { name: "CTLS Parent", description: "Class schedule + announcements" },
  "ccsd-calendar": { name: "District Calendar", description: "CCSD calendar events ingest" },
  "checkin-app": { name: "Check-In App", description: "Daily check-in data bridge" },
};

/** Human age: "5 min ago" / "2 h ago" / "3 d ago". */
export function ageLabel(ageMinutes: number | null): string {
  if (ageMinutes == null) return "Never pulled";
  if (ageMinutes < 1) return "Just now";
  if (ageMinutes < 60) return `${ageMinutes} min ago`;
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function freshnessLabel(f: Freshness): string {
  switch (f) {
    case "fresh": return "Fresh";
    case "stale": return "Stale";
    case "error": return "Error";
    case "running": return "Running";
    case "never": return "Awaiting First Run";
  }
}
