// Adaptive cockpit layout engine (stub — phase 1).
// Generates a custom design plan for the pilot's cockpit from live signals:
// which panels appear, their order, what's highlighted. Deterministic — no
// LLM. The AI proposes; pilot overrides (locks/hides) always win.
//
// Panel registry is derived from the GROVES module directory
// (src/lib/modules.ts): the engine never invents a panel for a module that
// doesn't exist, and a panel only appears when its module is connected or
// live for this pilot.

import { GROVES } from "@/lib/modules";
import type {
  HouseholdSignals,
  LayoutOverride,
  LayoutPanel,
  LayoutPlan,
  LayoutTemplate,
} from "../types";

interface PanelDef {
  id: string;
  title: string;
  route: string | null;
  /** Base prominence before signal boosts (0–100). */
  base: number;
  /** Extra score when the predicate matches the household's signals. */
  boosts: { when: (s: HouseholdSignals) => boolean; points: number; reason: string }[];
  /** Hide entirely when true (e.g. school with no children — never assume). */
  hideWhen?: (s: HouseholdSignals) => boolean;
}

const TODAY: PanelDef = {
  id: "today",
  title: "Today",
  route: null,
  base: 80,
  boosts: [
    { when: (s) => s.tasksOverdue > 0, points: 15, reason: "tasks overdue" },
    { when: (s) => s.tasksDueToday > 0, points: 10, reason: "tasks due today" },
  ],
};

const BILLS: PanelDef = {
  id: "W7",
  title: "Money",
  route: "/household/vault",
  base: 55,
  boosts: [
    { when: (s) => s.billsOverdue.length > 0, points: 35, reason: "bills overdue" },
    { when: (s) => s.billsDueSoon.length > 0, points: 20, reason: "bills due soon" },
  ],
};

const SCHOOL: PanelDef = {
  id: "W1",
  title: "School",
  route: "/school",
  base: 60,
  hideWhen: (s) => !s.childrenLinked, // user-first: never assume parenthood
  boosts: [
    { when: (s) => s.schoolAttention.length > 0, points: 30, reason: "school needs attention" },
  ],
};

const SHOPPING: PanelDef = {
  id: "W20",
  title: "Shopping",
  route: "/household/shopping",
  base: 40,
  boosts: [
    { when: (s) => s.shoppingOpenItems > 0, points: 15, reason: "items on the list" },
  ],
};

const MAIL: PanelDef = {
  id: "W21",
  title: "Mail",
  route: "/household/mail",
  base: 40,
  boosts: [
    { when: (s) => s.mailUnreadActionable > 0, points: 20, reason: "mail needs action" },
  ],
};

const HEALTH: PanelDef = {
  id: "W2",
  title: "Health",
  route: "/health",
  base: 45,
  boosts: [{ when: (s) => s.healthActive, points: 20, reason: "health streak active" }],
};

const TRAVEL: PanelDef = {
  id: "travel",
  title: "Travel",
  route: null,
  base: 30,
  boosts: [{ when: (s) => s.tripUpcoming, points: 40, reason: "trip coming up" }],
};

const PANEL_DEFS: PanelDef[] = [TODAY, SCHOOL, BILLS, MAIL, SHOPPING, HEALTH, TRAVEL];

function pickTemplate(signals: HouseholdSignals): LayoutTemplate {
  if (signals.tripUpcoming) return "travel-mode";
  if (signals.healthActive && !signals.childrenLinked) return "health-first";
  if (signals.childrenLinked) return "family-commander";
  return "solo-operator";
}

/** Template ordering bias: panel ids that float to the top for a template. */
const TEMPLATE_BIAS: Record<LayoutTemplate, string[]> = {
  "solo-operator": ["today", "W7", "W2", "W20", "W21", "travel"],
  "family-commander": ["today", "W1", "W7", "W20", "W21", "W2", "travel"],
  "health-first": ["W2", "today", "W7", "W20", "W21", "travel"],
  "travel-mode": ["travel", "W7", "today", "W20", "W21", "W2"],
};

/** Resolve the canonical title/route for a panel id from GROVES. */
function resolveFromModules(id: string): { title: string; route: string | null } | null {
  for (const grove of GROVES) {
    const mod = grove.modules.find((m) => m.id === id);
    if (mod) return { title: mod.name, route: mod.route };
  }
  return null;
}

/**
 * Generate the layout plan. Pure function of signals + overrides — the route
 * handler supplies overrides from cockpit_layout_overrides.
 */
export function generateLayoutPlan(
  signals: HouseholdSignals,
  overrides: LayoutOverride[] = [],
): LayoutPlan {
  const template = pickTemplate(signals);
  const bias = TEMPLATE_BIAS[template];
  const overrideById = new Map(overrides.map((o) => [o.panelId, o]));

  const scored = PANEL_DEFS.filter((def) => {
    if (overrideById.get(def.id)?.hidden) return false;
    if (def.hideWhen?.(signals)) return false;
    return true;
  }).map((def) => {
    let score = def.base;
    const reasons: string[] = [];
    for (const boost of def.boosts) {
      if (boost.when(signals)) {
        score += boost.points;
        reasons.push(boost.reason);
      }
    }
    // Template bias: earlier in the bias list = small score nudge.
    const biasIdx = bias.indexOf(def.id);
    if (biasIdx >= 0) score += (bias.length - biasIdx) * 2;
    const resolved = resolveFromModules(def.id);
    return {
      def,
      score: Math.min(100, score),
      title: resolved?.title ?? def.title,
      route: resolved?.route ?? def.route,
      reasons,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Locked panels keep the pilot's absolute position; everything else flows
  // around them in AI order.
  const locked = scored.filter((p) => overrideById.get(p.def.id)?.lockedPosition != null);
  const free = scored.filter((p) => overrideById.get(p.def.id)?.lockedPosition == null);
  const ordered: typeof scored = [];
  const lockedByPos = new Map<number, (typeof scored)[number]>();
  for (const p of locked) {
    lockedByPos.set(overrideById.get(p.def.id)!.lockedPosition!, p);
  }
  let fi = 0;
  const total = scored.length;
  for (let pos = 1; pos <= total; pos++) {
    const lp = lockedByPos.get(pos);
    if (lp) ordered.push(lp);
    else if (fi < free.length) ordered.push(free[fi++]);
  }
  while (fi < free.length) ordered.push(free[fi++]);

  const panels: LayoutPanel[] = ordered.map((p, i) => ({
    id: p.def.id,
    title: p.title,
    route: p.route,
    rank: i + 1,
    highlight: i < 3 && p.score >= 60,
    reason:
      p.reasons.length > 0
        ? p.reasons.join("; ")
        : "part of your daily cockpit",
    locked: overrideById.get(p.def.id)?.lockedPosition != null,
    signalScore: p.score,
  }));

  // Spotlight follows the strongest signal, not the pilot's locked order — its
  // job is to surface what needs attention; locked panels keep their position.
  const topSignal = scored[0] ?? null;
  return {
    version: 1,
    template,
    generatedAt: new Date().toISOString(),
    panels,
    spotlight:
      topSignal && topSignal.score >= 60
        ? {
            panelId: topSignal.def.id,
            headline: topSignal.reasons[0] ?? "needs attention",
            action: { label: "Open", route: topSignal.route ?? "/today" },
          }
        : null,
    overridesApplied: overrides.length,
  };
}
