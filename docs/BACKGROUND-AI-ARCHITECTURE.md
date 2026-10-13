# Background AI Architecture — Pookie

> **Locked principle (Mehedi, 2026-10-12):** The AI works in the BACKGROUND,
> automating things to assist the pilot — an ambient intelligence quietly
> handling their life while they fly. NOT a chatbot you talk to. Conversational
> AI (Pookie/Muse chat) is secondary — a station you visit, not the home.
>
> **Expanded (Mehedi, 2026-10-12 ~22:22):** The AI is proactive and ambient —
> it rearranges the cockpit layout around the pilot's actual life and speaks up
> through the day with nudges. It does not wait to be asked.
>
> **Standing product rule that constrains everything below:** Pookie is the
> USER's personal assistant. Child-related features are opt-in modules, never
> assumed. The background AI must NEVER assume parenthood — child/school
> signals only exist for pilots who linked children.

**Status:** architecture + starter implementation (nudge engine core, bill-due
watcher, layout-plan generator stub). Phase 1 of 4.

---

## 1. System map

Four core systems, one shared spine. Everything the background AI does flows
through the **event bus + feed**; nothing acts on the pilot's life without
leaving a plain-English trace.

```
┌─────────────────────────────────────────────────────────────────────┐
│ DATA SOURCES (observed, never owned)                                │
│ bills · tasks · shopping lists · mail · health · school/children ·  │
│ travel · spending · calendar* · weather · notifications prefs        │
└──────────────┬──────────────────────────────────────────────────────┘
               │ signals (normalized facts, e.g. "bill X due in 2 days")
               ▼
┌──────────────────────────┐    ┌───────────────────────────────────┐
│ BACKGROUND AUTOMATION    │    │ NUDGE / PROACTIVITY ENGINE        │
│ LOOP                     │    │ (System 2 — §4)                   │
│ (System 1 — §3)          │    │ watchers → score → dedup →        │
│ scheduled + event-driven │    │ quiet-hours → deliver             │
│ actions at 3 approval    │    │                                   │
│ tiers                    │    │                                   │
└────────────┬─────────────┘    └───────────────┬───────────────────┘
             │ actions & nudges                 │ nudges
             ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ACTIVITY FEED ("Overnight by Pookie") — plain-English trace of      │
│ everything the AI did, suggested, or noticed. Read + act from the   │
│ dashboard. Nothing silent stays invisible.                          │
└──────────────┬──────────────────────────────────────────────────────┘
               │ live signals (counts, attention, recency)
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ADAPTIVE COCKPIT LAYOUT ENGINE (System 3 — §5)                       │
│ panel registry → signal scoring → life-pattern template → pilot      │
│ override merge → LayoutPlan JSON → cockpit renders the plan         │
└─────────────────────────────────────────────────────────────────────┘

* calendar: personal calendar is a planned data source (school calendar and
  travel events exist today); the meeting-nudge scenario is spec'd in §7 and
  built when the source lands.
```

**Where conversational AI sits:** the Pookie chat (Cloudflare `pookie-tutor-v2`
worker, Llama 3.3) and the Muse queue are the *talk-to-me* station. The
background layer is the *works-while-you-fly* layer. They share the feed: a
chat conversation can spawn a one-tap approval; a background automation can
drop a "I handled this — tap to undo" card the chat can explain. See §9.

---

## 2. The automation loop (System 1)

**Observe → Decide → Act → Trace.** The loop runs on two triggers:

- **Scheduled cycles** (cron): every 15 min for watchers (bills, tasks,
  school due-today), hourly for digest-class work, nightly for layout-plan
  refresh and the morning-briefing pre-compute.
- **Event-driven**: domain events on the bus (`bill.created`, `mail.scanned`,
  `sync.completed`, `grade.dropped`) let watchers react in seconds instead of
  waiting for the next cycle.

### What the background agent observes

| Source | Table / API today | Signals extracted |
|---|---|---|
| Bills | `bills` | due in N days, overdue, autopay coverage gaps |
| Tasks | `family_tasks` | overdue, due today/tomorrow, stale (no progress 7d) |
| Shopping | `shopping_lists` | recurring items running out, price drops on watched items |
| Mail | `mail_items` + action items | bill-like mail → draft bill; deadline in letter → task |
| Health | `activity_steps`, wellbeing, meals | streaks broken, check-in missed, gentle pattern flags |
| School (children only) | grades, assignments, check-ins | grade below 90, missing work, due-today homework |
| Travel | `travel_events` | upcoming trip → packing/money checklist; price drop on watched flight |
| Money | `spending`, `credit` | unusual spend spike, subscription renewal, credit-hygiene tip |
| Weather | Open-Meteo (cached) | rain on an outdoor-plan day → briefing adjustment |
| Calendar (planned) | — | meeting in 1h → prep nudge; conflict with school pickup |

### Autonomous vs. needs-the-pilot

The **approval model** (§6) is the single gate. The loop NEVER:

- moves money, pays a bill, or changes autopay;
- contacts anyone outside the household (teachers, landlords, airlines);
- shares data across households or with any AI-training pipeline;
- touches teen-private scopes (wellness, reflection) for parent-visible output.

What it does autonomously is limited to *reversible, inside-the-app* work:
refreshing caches, drafting (never sending) emails/tasks/bills, snoozing its
own nudges after acknowledgment, archiving done items.

---

## 3. Nudge / Proactivity Engine (System 2)

The AI speaks up through the day. It does not wait to be asked.

### 3.1 Watchers

A **watcher** is a small, single-purpose observer over one data source. It
runs each cycle, reads current state, and emits candidate nudges. Watchers are
registered in `src/lib/automation/index.ts`. Each watcher is pure logic over
signals — no side effects except returning nudge candidates; the engine
decides what actually reaches the pilot.

Shipped / planned watchers:

| Watcher | Source | Example nudge |
|---|---|---|
| `bill-due` ✅ shipped | bills | "Electric bill ($142) is due in 2 days — want me to mark it paid after you pay?" |
| `task-overdue` | family_tasks | "3 tasks slipped past their due date. The oldest is 'Renew license' (6 days)." |
| `school-due-today` (children only) | assignments | "Dawson has Geometry homework due today." — never fires for childless pilots |
| `grade-watch` (children only) | grades | "Geometry slipped to 84 — 6 points from the 90 goal." |
| `mail-action` | mail_items | "That letter from the county looks like a bill — I drafted it, tap to confirm." |
| `shopping-rest`ock | shopping_lists | "You're out of milk again — add it to the list?" |
| `meeting-prep` (planned) | calendar | "Meeting with Dana at 11 AM — here's the one-pager." |
| `credit-hygiene` | credit | "Paying $200 toward the card before Friday could lift your score." |
| `trip-deals` | travel | "Miami flights dropped $80 since you looked — still interested?" |
| `health-streak` | activity | "3-day walk streak — a 10-minute loop keeps it alive." |

### 3.2 Scoring — urgency × importance

Every candidate nudge gets two 0–100 scores, then one priority:

```
urgency    = f(time pressure)     # overdue→100, due today→90, tomorrow→75,
                                  # ≤3d→60, ≤7d→40, else→20
importance = f(stakes)            # money at risk, goal distance, safety weight
priority   = 0.6 * urgency + 0.4 * importance
```

Importance is watcher-defined but bounded by house rules: safety signals
outrank money, money outranks convenience. Teen-private content scores normally
but is **delivery-scoped** — it only ever renders to the teen, never to a
parent surface (same choke point as chat, §9).

**Delivery tiers by priority:**

| Priority | Delivery | Example |
|---|---|---|
| ≥ 80 | Banner + feed (breaks quiet hours only if safety) | Bill due tomorrow; child grade dropped below goal |
| 50–79 | Feed ("Overnight by Pookie" / "While you were away") | Bill due in 3 days; tasks overdue |
| 30–49 | Digest only (folded into morning briefing) | Milk running low; streak nudge |
| < 30 | Dropped (logged, not shown) | Informational noise |

### 3.3 Dedup + quiet hours + cooldowns

- **Dedup key** per nudge: `{watcher}:{entityId}:{bucket}` (e.g.
  `bill-due:{billId}:{dueDate}`). The `automation_nudges` table enforces
  uniqueness — a nudge for the same fact is never written twice, even if the
  cron fires twice.
- **Cooldowns**: after a nudge is dismissed, the same watcher+entity stays
  quiet for its cooldown (bills: until the due date passes; shopping: 7 days).
- **Quiet hours**: default 22:00–07:00 pilot-local, overridable in notification
  prefs (`quiet_hours_start/end`). Non-critical nudges wait for the next cycle;
  only safety-tier (priority ≥ 90 with a safety flag) breaks quiet hours.
  School-email-style send windows (6:00–22:00) apply to anything that would
  notify outside the app.
- **Digest collapsing**: ≥3 nudges from one watcher in a cycle collapse into
  one summary nudge ("3 bills need attention — $412 total").

### 3.4 The nudge vs. autonomous-action line

A nudge **notices and proposes**; an automation **does**. The line is drawn by
reversibility and blast radius:

- **Nudge (never acts):** anything involving money, other people, or external
  systems. "Let's pay that bill" is a nudge with a one-tap action — the tap
  marks it paid *in the tracker*; the actual payment stays the pilot's.
- **Autonomous (silent tier):** internal, reversible, no external effect —
  drafting the bill from mail (pilot confirms), refreshing the briefing,
  snoozing a nudge the pilot acknowledged.
- **The gray zone is always resolved toward nudge.** If a watcher isn't sure
  the action is safe and reversible, it emits a suggestion, not an action.

---

## 4. Adaptive Cockpit Layout Engine (System 3)

As the pilot connects data sources, the AI takes control of the cockpit
layout: it generates a **custom design plan** for that pilot's cockpit — which
panels appear, their order, what's highlighted — from their actual life. The
cockpit is not static; it adapts to the pilot.

### 4.1 How it works

```
signals (per household, refreshed nightly + on big events)
   → score every registered panel (base weight + signal boosts)
   → pick life-pattern template (ordering bias)
   → merge pilot overrides (locks / hidden panels win)
   → LayoutPlan JSON (versioned, cached, served to the cockpit)
```

**Panel registry.** Panels are registered in code (starter:
`src/lib/automation/layout/engine.ts`), one per module, derived from the
`GROVES` module directory (`src/lib/modules.ts`) — the layout engine never
invents a panel for a module that doesn't exist, and it never shows a panel
for a module the pilot hasn't connected (no empty upsells for "just me"
pilots; no school panel for childless pilots).

**Signals** (examples): `billsDueSoon`, `tasksOverdue`, `shoppingOpenItems`,
`mailUnreadActionable`, `childrenLinked`, `schoolAttention` (grade < goal or
due-today work), `healthActive` (recent logs), `tripUpcoming`,
`spendingSpike`, `sourcesConnected[]`.

**Life-pattern templates** (ordering bias, not hard rules):

| Template | When | Bias |
|---|---|---|
| `solo-operator` | no children linked | Money, tasks, health, shopping first; school absent |
| `family-commander` | children + school attention | School + Today top; bills/tasks next |
| `health-first` | health signals dominate | Health, meals, activity top |
| `travel-mode` | trip within 14 days | Travel, money, tasks top |

**Pilot override — the AI proposes, the pilot disposes.** Overrides persist in
`cockpit_layout_overrides` (panel locks, hidden panels, pinned order). A locked
panel keeps the pilot's position forever; scoring only orders the unlocked
rest. "Reset to Pookie's plan" is one tap.

### 4.2 LayoutPlan JSON schema (UI contract)

Served by `GET /api/v1/me/layout-plan`. The cockpit renders panels in
`panels[]` order. Versioned so the frontend can evolve safely.

```jsonc
{
  "version": 1,
  "template": "family-commander",       // life-pattern template used
  "generatedAt": "2026-10-13T02:00:00Z",
  "panels": [
    {
      "id": "school",                   // module id from GROVES
      "title": "School",
      "route": "/school",               // applet route; null = seedling
      "rank": 1,
      "highlight": true,               // cockpit emphasizes (glow/border)
      "reason": "Geometry homework due today",   // plain-English why — shown on long-press
      "locked": false,                 // pilot-locked position
      "signalScore": 82                // 0–100, for debugging/QA
    }
  ],
  "spotlight": {                        // the ONE thing the cockpit leads with
    "panelId": "school",
    "headline": "Geometry homework due today",
    "action": { "label": "View", "route": "/school" }
  },
  "overridesApplied": 2
}
```

Rules the frontend can rely on: `panels` is always sorted by display order;
`highlight` is true for at most 3 panels; `reason` is always plain English;
`spotlight` may be null on a quiet day (render the standard hero instead —
never a blank space).

### 4.3 Nudge object schema (UI contract)

Served by `GET /api/v1/me/nudges`. One row per nudge; the feed is the
"Overnight by Pookie" / "While you were away" surface.

```jsonc
{
  "id": "uuid",
  "watcher": "bill-due",
  "tier": "feed",                       // "banner" | "feed" | "digest"
  "priority": 72,                       // 0–100
  "title": "Electric bill due in 2 days",
  "detail": "City Power $142.50 is due Thursday. Tap below once you've paid and I'll mark it in the tracker.",
  "action": {                           // null when there is nothing to tap
    "label": "Mark paid",
    "kind": "bill.mark-paid",           // namespaced action id; frontend maps to handler
    "params": { "billId": "uuid" }
  },
  "status": "pending",                  // "pending" | "acted" | "dismissed"
  "dedupKey": "bill-due:uuid:2026-10-15",
  "createdAt": "2026-10-13T06:00:00Z",
  "readAt": null
}
```

Action `kind` values are a closed registry (`bill.mark-paid`,
`task.complete`, `shopping.add-item`, `mail.confirm-draft`, …). The frontend
maps each kind to an existing handler — nudges never execute code the app
doesn't already have.

---

## 5. Approval model

Three tiers. The tier is stamped on every feed item and every automation run.

| Tier | Meaning | Examples | Pilot effort |
|---|---|---|---|
| **Silent** | Runs on its own; reported in the feed after the fact | Refresh briefing data; draft a bill from mail; snooze an acknowledged nudge; archive a completed task | Zero — "Pookie handled this while you were away" |
| **One-tap confirm** | AI prepares everything; pilot taps once | Draft teacher email (existing pattern); mark bill paid; confirm mail-drafted bill; apply layout plan | One tap in the feed |
| **Suggest-only** | AI proposes; nothing happens until the pilot acts in the module | "Let's plan a vacation — here are good deals"; rebooking a flight; changing insurance | Pilot does it, AI assists |

**Plain-English feed rules** (Mehedi's grandmother test applies to automation
too): every feed item says what happened in one sentence, what (if anything)
the pilot should do, and what happens if they do nothing. No jargon, no
"sync completed" — "I checked your bills overnight. Nothing due this week."

**Undo:** every silent action the AI takes is reversible from the feed item
for 7 days ("Undo" on drafts, un-archive, un-snooze).

---

## 6. Concrete automation scenarios

1. **Bill due → reminder → one-tap.** Watcher spots City Power $142.50 due in
   2 days (priority 72, feed tier). Nudge carries a "Mark paid" action. After
   the due date passes unpaid, priority escalates to banner. Recurring bills
   auto-roll the next due date (silent).
2. **Flight price drop → alert + rebooking draft.** Pilot watches a flight;
   price drops $80 → suggest-only nudge with the deal and a "draft rebooking
   checklist" (never rebooks — money + external system).
3. **Calendar + weather → briefing adjustment.** Rain forecast on a day with an
   outdoor school event → digest nudge in the morning briefing: "Rain likely
   at 3 PM — the field trip may move indoors."
4. **Shopping list + store proximity → cheapest-option nudge.** Milk on the
   list + pilot near a store with a lower price → digest nudge. (Requires
   coarse location only — city/ZIP max per MD decision D7.)
5. **Mail → bill draft.** OCR finds "Amount due $89.20, due Nov 1" → silent
   draft bill in the tracker + one-tap "Confirm" nudge. Pilot confirms or
   deletes; nothing is created without confirmation.
6. **School (children only) → homework + grade nudges.** Assignment due today
   → morning banner for the household; grade slips below 90 → feed nudge with
   the gap-to-90 framing. Never fires for childless pilots.
7. **Credit hygiene → coaching nudge.** Utilization spike → suggest-only:
   "Paying $200 before Friday could lift your score — here's the math."
8. **Vacation deals → suggest-only.** Pilot browsed Miami; fares drop →
   "Let's plan that trip — here are good deals" with options. Never books.
9. **Health streak → gentle nudge.** 3-day walk streak + no log today →
   digest: "A 10-minute loop keeps the streak alive." Shame-free, never
   medical advice.
10. **Overnight digest → morning briefing.** The nightly cycle pre-computes
    the briefing; the MorningBriefing component renders it instantly, then
    live-refreshes. "Overnight by Pookie: checked 4 sources, 2 need you."

---

## 7. Technical shape

### 7.1 Worker / cron topology

Supabase is the **Free tier** — no pg_cron. The scheduler lives on
**Cloudflare** (the team already ships Workers + Pages there):

```
Cloudflare Worker `pookie-automation` (new, Cron Triggers)
   │  */15 * * * *  watcher cycle (bills, tasks, school, mail)
   │  0 * * * *     hourly digest assembly
   │  0 2 * * *     nightly: layout-plan refresh + briefing pre-compute
   ▼
POST /api/v1/automation/cron   (Next.js route, OpenNext on Pages)
   │  header x-automation-secret == AUTOMATION_CRON_SECRET (fail closed)
   ▼
runAutomationCycle()  (src/lib/automation — framework-free, host-portable)
   │  service-role Supabase client (RLS bypassed; every write carries an
   │  explicit household id — same discipline as existing supabaseAdmin)
   ▼
automation_nudges / cockpit_layout_overrides  (Postgres)
```

Why the app route instead of a Supabase Edge Function: the automation core is
framework-free TypeScript with zero Deno-only imports, so it runs in either
host. The Next.js route keeps one deploy pipeline (the Pages app) and reuses
`handleRoute` envelope + audit conventions. If a future automation needs
per-function secrets or heavy Deno I/O, it moves to an Edge Function and calls
the same core — the topology allows both.

### 7.2 Event bus

`src/lib/automation/bus.ts` — a tiny in-process pub/sub (same pattern as the
applet bus). Domain events (`bill.created`, `mail.scanned`,
`sync.completed`, `grade.updated`, `nudge.dismissed`) are emitted by route
handlers/services today; when the automation host splits into its own worker,
the bus gains a Postgres-backed outbox (`automation_outbox` table, phase 3)
with zero API change for emitters.

### 7.3 Idempotency

- Every nudge carries a `dedupKey`; the table has a unique constraint on
  `(household_id, dedup_key)` — double-fires insert zero rows.
- The cron route stamps a run id; `automation_runs` (phase 2) records
  per-watcher outcomes so a crashed cycle resumes without re-emitting.
- Layout plans are recomputed, not appended — one current plan per household.

### 7.4 Failure handling (graceful degradation, Mehedi's rule)

- Each watcher runs inside its own try/catch. One watcher throwing never
  stops the cycle; the failure is logged and the cycle continues.
- If the whole cron is down, the dashboard still renders — the feed shows
  "Pookie's overnight check didn't run — your data is still here" (never a
  blank panel, never a spinner forever).
- Nudge delivery never blocks the pilot's own actions; the feed is additive.
- LLM calls (briefing prose, deal summaries) are enhancement-only: if the
  worker is unreachable, the feed falls back to the rule-based template text.

### 7.5 Cost guardrails (LLM budgets)

- **Default: zero LLM calls.** Watchers, scoring, and layout plans are
  deterministic rules. LLM is used only for prose polish (briefing summary,
  deal explanation) via the existing `pookie-tutor-v2` worker (free tier).
- Budgets: ≤ 50 LLM calls/household/day, ≤ 1 per nudge, 10s timeout with
  fallback to template text (same `withTimeout` pattern as `pookie-tutor.ts`).
- Per-cycle counters in the run record; exceeding budget degrades to
  rule-based text, never errors.

### 7.6 Privacy — what never leaves

- **Precise location** never leaves the device (coarse city/ZIP max, D7).
- **Teen-private scopes** (wellness, reflection) never feed parent-visible
  nudges or layout reasons; the scope choke point from chat applies here too.
- **Health detail** stays in-app; nudges carry patterns ("streak"), not
  readings.
- **Credentials** (school portals, bank tokens) are never read by watchers —
  watchers read the *synced results*, never the vault.
- **No training:** per MD decision D2, nothing the automation layer touches
  is used for model training, ever.

---

## 8. How chat (Pookie/Muse) relates to the background layer

| | Background AI (this doc) | Pookie chat | Muse queue |
|---|---|---|---|
| Role | Acts + notices on its own | Answers when asked | Deep straight-talk on hard questions |
| Host | `pookie-automation` cron → app route | `pookie-tutor-v2` worker (Llama 3.3) | same worker, `/muse-queue-*` routes |
| Trigger | schedule + domain events | pilot opens the Pookie tab | keyword or "needs depth" classifier |
| Output | feed items, nudges, layout plans | conversational replies | async deeper analysis |
| Shared surface | **the activity feed** — chat can explain any feed item ("why did Pookie suggest this?"); approving a one-tap action in chat writes the same feed status |

The chat's `buildTutorContext` pattern (live data attached to prompts) is the
model for any future LLM-polished nudge: the worker receives facts, never
credentials, and scope tags are stripped server-side per the SEC-004 contract.

---

## 9. Starter implementation (shipped, uncommitted)

Cleanly separable — no existing code refactored, only one additive render
inside `MorningBriefing`.

| File | What |
|---|---|
| `src/lib/automation/types.ts` | Shared types: signals, nudge, layout plan, approval tiers |
| `src/lib/automation/bus.ts` | In-process domain event bus |
| `src/lib/automation/signals.ts` | Household signal collector (service-role, explicit household scoping) |
| `src/lib/automation/nudge/engine.ts` | Scoring, dedup, quiet hours, cooldowns, delivery |
| `src/lib/automation/nudge/watchers/bill-due.ts` | Reference watcher: bills due ≤7d / overdue → scored nudges |
| `src/lib/automation/layout/engine.ts` | Layout-plan generator stub: panel registry over GROVES, templates, scoring, override merge |
| `src/lib/automation/index.ts` | Watcher registry + `runAutomationCycle()` |
| `supabase/migrations/078_automation_feed.sql` | `automation_nudges` + `cockpit_layout_overrides` (RLS: household members) |
| `src/app/api/v1/automation/cron/route.ts` | `POST` — secret-guarded cycle runner (cron target) |
| `src/app/api/v1/me/nudges/route.ts` | `GET` feed · `PATCH` act/dismiss |
| `src/app/api/v1/me/layout-plan/route.ts` | `GET` plan · `PUT` pilot overrides |
| `src/components/nudge-feed.tsx` | "Overnight by Pookie" feed UI (client, graceful empty/error states) |
| `src/components/morning-briefing.tsx` | Renders `<NudgeFeed/>` below the briefing counts |

Run locally: `AUTOMATION_CRON_SECRET=dev-secret POST /api/v1/automation/cron`
with header `x-automation-secret`. Migration `078` must be applied first.

---

## 10. Phased plan

- **Phase 1 — shipped (this doc):** nudge engine core + bill-due watcher +
  layout-plan stub + feed UI + cron route. Deterministic, zero LLM.
- **Phase 2 — watchers:** task-overdue, school-due-today, grade-watch,
  mail-action, shopping-restock. `automation_runs` observability table.
  Cloudflare `pookie-automation` worker with Cron Triggers → cron route.
- **Phase 3 — autonomy:** mail→bill drafting (one-tap), briefing pre-compute,
  Postgres outbox for the event bus, banner delivery surface in the cockpit.
- **Phase 4 — intelligence:** LLM polish on briefing/deals via
  pookie-tutor-v2 (budgeted), meeting-prep watcher when calendar lands,
  trip-deal watcher, layout A/B signal (which plans get kept vs. reset).

### The 3 highest-value automations to build first

1. **Bill-due watcher → feed + one-tap "mark paid"** (shipped as reference).
   Money attention is the #1 daily-life anxiety; the data and UI already
   exist; it exercises the whole pipeline (watch → score → dedup → feed →
   act) that every later watcher reuses.
2. **School-due-today + grade-watch (children-gated).** The pilot's hardest
   job is the 90% goal; a morning banner naming today's homework and a feed
   nudge when a grade slips is the addictive ritual that keeps the app
   opened daily. Gated so childless pilots never see it.
3. **Mail → bill/task drafts (one-tap confirm).** Closes the loop Mehedi
   already lives: snap a photo of mail → action items. The background layer
   turns "I saw this" into "it's already drafted, tap to confirm" — the
   clearest demo of ambient vs. chatbot AI.
