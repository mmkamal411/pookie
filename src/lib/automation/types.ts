// Background AI — shared types.
// Framework-free: no Next.js, no React, no Supabase imports. The automation
// core runs in any host (Next.js route, Cloudflare Worker, Edge Function).

/** Approval tiers — the single gate for everything the background AI does. */
export type ApprovalTier = "silent" | "one-tap" | "suggest-only";

/** Where a nudge is allowed to surface. */
export type NudgeTier = "banner" | "feed" | "digest";

/** Lifecycle of a nudge in the feed. */
export type NudgeStatus = "pending" | "acted" | "dismissed";

/**
 * Normalized facts about one household, collected once per cycle and handed
 * to every watcher. Watchers are pure functions of these signals — they never
 * query the database themselves.
 */
export interface HouseholdSignals {
  householdId: string; // owner_user_id — the household anchor
  collectedAt: string; // ISO timestamp
  billsDueSoon: BillSignal[];
  billsOverdue: BillSignal[];
  tasksOverdue: number;
  tasksDueToday: number;
  shoppingOpenItems: number;
  mailUnreadActionable: number;
  childrenLinked: boolean; // NEVER assumed — only true when children exist
  schoolAttention: SchoolSignal[];
  healthActive: boolean;
  tripUpcoming: boolean;
  quietHours: { start: string; end: string }; // "HH:MM", pilot-local
}

export interface BillSignal {
  id: string;
  name: string;
  payee: string | null;
  amount: number | null;
  dueDate: string | null; // YYYY-MM-DD
  daysUntilDue: number | null; // negative = overdue
  status: "unpaid" | "paid" | "overdue" | "autopay";
}

export interface SchoolSignal {
  childName: string;
  kind: "homework-due-today" | "grade-below-goal" | "missing-work";
  className: string;
  title: string;
  detail: string;
}

/** One thing the AI noticed. Written to automation_nudges, rendered by the feed. */
export interface Nudge {
  id?: string;
  householdId: string;
  watcher: string;
  tier: NudgeTier;
  priority: number; // 0–100
  title: string; // plain English, one line
  detail: string; // plain English, what to do / what happens if ignored
  approval: ApprovalTier;
  action: NudgeAction | null;
  status?: NudgeStatus;
  dedupKey: string;
  createdAt?: string;
  readAt?: string | null;
}

/** A closed registry of tappable actions. The frontend maps each kind to an
 *  existing handler — nudges never execute code the app doesn't already have. */
export interface NudgeAction {
  label: string;
  kind:
    | "bill.mark-paid"
    | "task.complete"
    | "shopping.add-item"
    | "mail.confirm-draft"
    | "layout.open-module";
  params: Record<string, string>;
}

/** A watcher proposes nudges from signals. Pure: no I/O, no side effects. */
export interface Watcher {
  name: string;
  /** Cooldown after a dismiss before the same entity may nudge again. */
  cooldownDays: number;
  evaluate(signals: HouseholdSignals, now: Date): Nudge[];
}

/* ------------------------------------------------------------------ */
/* Layout engine types                                                 */
/* ------------------------------------------------------------------ */

/** Life-pattern templates — ordering bias for the cockpit, never hard rules. */
export type LayoutTemplate =
  | "solo-operator"
  | "family-commander"
  | "health-first"
  | "travel-mode";

export interface LayoutPanel {
  id: string; // module id from GROVES (src/lib/modules.ts)
  title: string;
  route: string | null; // applet route; null = seedling
  rank: number; // 1-based display order
  highlight: boolean; // cockpit emphasizes (max 3)
  reason: string; // plain English why — shown on long-press
  locked: boolean; // pilot-locked position
  signalScore: number; // 0–100, for debugging/QA
}

/** The custom design plan for one pilot's cockpit. Served by GET /me/layout-plan. */
export interface LayoutPlan {
  version: 1;
  template: LayoutTemplate;
  generatedAt: string;
  panels: LayoutPanel[];
  spotlight: {
    panelId: string;
    headline: string;
    action: { label: string; route: string };
  } | null;
  overridesApplied: number;
}

/** Pilot overrides — the AI proposes, the pilot disposes. */
export interface LayoutOverride {
  panelId: string;
  /** Pin to an absolute position (1-based). Null = follow AI order. */
  lockedPosition: number | null;
  /** Hide the panel entirely. */
  hidden: boolean;
}

/* ------------------------------------------------------------------ */
/* Automation loop types                                               */
/* ------------------------------------------------------------------ */

export interface AutomationOutcome {
  watcher: string;
  evaluated: number; // candidate nudges produced
  delivered: number; // written to the feed
  skippedQuietHours: number;
  deduped: number;
  error: string | null;
}

export interface CycleResult {
  runId: string;
  startedAt: string;
  finishedAt: string;
  households: number;
  outcomes: AutomationOutcome[];
  layoutPlansRefreshed: number;
}
