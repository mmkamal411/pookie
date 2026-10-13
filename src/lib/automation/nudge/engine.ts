// Nudge engine — scoring, quiet hours, cooldowns, dedup, delivery.
// Framework-free core: persistence is injected via NudgeStore so this file
// has no Supabase import and runs in any host.

import type {
  HouseholdSignals,
  Nudge,
  NudgeTier,
  Watcher,
} from "../types";

/** Minimal persistence contract the engine needs. Implemented by the host. */
export interface NudgeStore {
  /** Dedup keys already present for this household (any status). */
  existingDedupKeys(householdId: string, keys: string[]): Promise<Set<string>>;
  /** Dedup keys dismissed within their watcher cooldown window. */
  recentlyDismissed(householdId: string, keys: string[]): Promise<Set<string>>;
  /** Write new nudges. Rows whose dedup key collides are skipped by the DB. */
  insert(nudges: Nudge[]): Promise<number>;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

/** Urgency from time pressure. Negative days = overdue. Null = no date. */
export function scoreUrgency(daysUntilDue: number | null): number {
  if (daysUntilDue == null) return 20;
  if (daysUntilDue < 0) return 100;
  if (daysUntilDue === 0) return 90;
  if (daysUntilDue === 1) return 75;
  if (daysUntilDue <= 3) return 60;
  if (daysUntilDue <= 7) return 40;
  return 20;
}

/** Priority = 0.6 * urgency + 0.4 * importance. Both 0–100. */
export function scorePriority(urgency: number, importance: number): number {
  return Math.round(0.6 * urgency + 0.4 * importance);
}

/** Delivery tier from priority. Below 30 the nudge is dropped (logged, not shown). */
export function tierForPriority(priority: number): NudgeTier | null {
  if (priority >= 80) return "banner";
  if (priority >= 50) return "feed";
  if (priority >= 30) return "digest";
  return null;
}

/* ------------------------------------------------------------------ */
/* Quiet hours                                                         */
/* ------------------------------------------------------------------ */

/** True when `now` falls inside the pilot's quiet hours (HH:MM, pilot-local). */
export function inQuietHours(now: Date, quietHours: HouseholdSignals["quietHours"]): boolean {
  const hh = now.getHours();
  const mm = now.getMinutes();
  const mins = hh * 60 + mm;
  const [sh, sm] = quietHours.start.split(":").map(Number);
  const [eh, em] = quietHours.end.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  // Overnight window (e.g. 22:00–07:00) wraps midnight.
  if (start > end) return mins >= start || mins < end;
  return mins >= start && mins < end;
}

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

export interface DeliveryReport {
  watcher: string;
  evaluated: number;
  delivered: number;
  skippedQuietHours: number;
  deduped: number;
  droppedBelowThreshold: number;
  error: string | null;
}

/**
 * Run one watcher: evaluate → score → tier → quiet-hours gate → cooldown
 * gate → dedup → insert. A watcher throwing never propagates — the error is
 * reported and the cycle continues (graceful degradation).
 */
export async function deliverWatcher(
  watcher: Watcher,
  signals: HouseholdSignals,
  now: Date,
  store: NudgeStore,
): Promise<DeliveryReport> {
  const report: DeliveryReport = {
    watcher: watcher.name,
    evaluated: 0,
    delivered: 0,
    skippedQuietHours: 0,
    deduped: 0,
    droppedBelowThreshold: 0,
    error: null,
  };
  try {
    const candidates = watcher.evaluate(signals, now);
    report.evaluated = candidates.length;
    if (candidates.length === 0) return report;

    const keys = candidates.map((c) => c.dedupKey);
    const [existing, dismissed] = await Promise.all([
      store.existingDedupKeys(signals.householdId, keys),
      store.recentlyDismissed(signals.householdId, keys),
    ]);

    const quiet = inQuietHours(now, signals.quietHours);
    const fresh = candidates.filter((c) => {
      if (existing.has(c.dedupKey) || dismissed.has(c.dedupKey)) {
        report.deduped += 1;
        return false;
      }
      // Safety-tier banners (priority ≥ 90) break quiet hours; everything
      // else waits for the next cycle.
      if (quiet && !(c.tier === "banner" && c.priority >= 90)) {
        report.skippedQuietHours += 1;
        return false;
      }
      return true;
    });

    if (fresh.length === 0) return report;
    report.delivered = await store.insert(fresh);
    return report;
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
    return report;
  }
}

/** Collapse ≥3 nudges from one watcher into a single summary nudge. */
export function collapseToDigest(watcher: string, nudges: Nudge[], summaryTitle: string): Nudge[] {
  if (nudges.length < 3) return nudges;
  const top = [...nudges].sort((a, b) => b.priority - a.priority);
  const first = top[0];
  return [
    {
      householdId: first.householdId,
      watcher,
      tier: "feed",
      priority: Math.max(...top.map((n) => n.priority)),
      title: summaryTitle,
      detail: top
        .slice(0, 3)
        .map((n) => `• ${n.title}`)
        .join("\n"),
      approval: "suggest-only",
      action: {
        label: "Review",
        kind: "layout.open-module",
        params: { moduleId: watcherModule(watcher) },
      },
      dedupKey: `${watcher}:digest:${new Date().toISOString().slice(0, 10)}`,
    },
  ];
}

function watcherModule(watcher: string): string {
  if (watcher.startsWith("bill")) return "W7";
  if (watcher.startsWith("task")) return "tasks";
  if (watcher.startsWith("school") || watcher.startsWith("grade")) return "W1";
  if (watcher.startsWith("shopping")) return "W20";
  if (watcher.startsWith("mail")) return "W21";
  return "home";
}
