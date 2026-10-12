# Squad 5 — Travel, Marketplace & Support UI: QA Execution Report

**QA Engineer:** Muse (QA subagent) · **Branch:** `staging-build` · **Date:** 2026-10-12 (~04:30 EDT)
**Build under test:** Wave 2 frontend (commits `b328922`, `7e8889d`), TEST-PLAN.md `1f235b6`
**Do not deploy.** No live deploy exists (MD rule); this agent has no live-browser access.

## 0. Execution method (read this first)

This execution is **static + code-level only** — no staging deploy exists and no live browser was available.
Every test case was executed against the shipped code: route components, API route handlers,
`src/lib/api/support.ts`, `src/lib/squad5/context.ts`, and migrations
`032_support_tickets_base.sql` / `033_support_tickets_rbac.sql` / `046_faq.sql`.
Verdicts mean:

- **PASS** — the code provably implements the requirement (evidence = file:line).
- **FAIL** — the code provably does NOT meet the requirement. A FAIL on a P0 row blocks the module.
- **BLOCKED** — cannot be proven without a staging deploy, live fixtures/accounts, or pending
  cross-squad tables (events table, `health_allergies`, `driving_rules`, link-code endpoints).

Static ≠ shipped. Per the plan's language discipline: "code written" ≠ "test passed" ≠ "module shippable."

## 1. Executive summary

| Area | Result |
|---|---|
| tsc (`npx tsc --noEmit`) | ✅ PASS — clean, exit 0 |
| No-placeholder grep gate (TODO/FIXME/STUB/HACK/lorem/mock) | ✅ PASS — zero hits in shipped Squad 5 code |
| Fixture-signature / mock-data markers | ✅ PASS — none |
| D7 coarse-location | ✅ PASS — ZIP-only; zero `geolocation`/`watchPosition`/`getCurrentPosition` hits |
| D2 "never train" claim | ✅ PASS — no user-visible claim; only a gate comment in code |
| Panel 🛑 code review | ❌ **3 P0 defects** (§2) |
| FR failures (P1) | ❌ **3 P1 defects** (§2) |
| Deviations (#1 W30 tile, #5 ring target) | #1 = P2 (MD sign-off needed) · #5 = **justified, code correct** |
| Frontend engineer's deviations #2/#3/#4/#6 | ⚠️ **Not found in repo docs** — cannot verify; open question for the parent |

**Go/no-go for the squad's scope: NO-GO until the 3 P0s are fixed.** The P0s are (1) crisis
keyword matrix misses 3 of 5 plan keywords, (2) teen tickets are created with `teen_privacy=false`
so parents CAN see them (the UI banner promises otherwise), and (3) FR-SAFETY-007 outing gate has
no implementation in Squad 5 code paths.

## 2. Defect list

### P0-1 — Crisis pattern-interrupt misses 3 of 5 TEST-PLAN keywords
- **File:** `src/components/support/crisis-interrupt.tsx:10-26` (`CRISIS_PATTERNS`)
- **What fails:** S5-S2-10 keyword matrix. `isCrisisMessage` is a client-side substring match and
  misses: `"I feel like ending it"` (no pattern contains it), `"nobody would care if I died"`,
  `"I cut myself"` (patterns only contain `"cutting myself"`). Hits: `"I want to hurt myself"`
  (`"hurt myself"` ✓), `"I'm thinking about suicide"` (`"suicide"` ✓).
- **Why P0:** on a missed keyword the message goes to the pookie-tutor worker with no crisis
  resources, and the flow is NOT frozen — the panel 🛑 ("crisis keywords → pattern-interrupt")
  is violated for those phrasings. There is no server-side backstop: `src/app/api/v1/support/chat/route.ts`
  has zero crisis detection, and `SUPPORT_SYSTEM` has no crisis instruction.
- **Fix:** expand `CRISIS_PATTERNS` to cover the plan matrix exactly (`"ending it"`, `"if i died"`,
  `"care if i died"`, `"cut myself"`, `"kill me"`, `"no reason to live"` already present, etc.);
  add a server-side pattern check in the chat route before proxying; add a crisis instruction to
  `SUPPORT_SYSTEM` as a backstop for near-miss phrasings.

### P0-2 — Teen-created tickets get `teen_privacy=false`; parents CAN see them
- **Files:** `src/components/support/ticket-form.tsx` (~L84-94, POST body has no `teenPrivacy` field);
  `src/lib/api/support.ts:134` (`teen_privacy: input.teenPrivacy ?? false`); the ticket form is
  rendered with `isTeen` from `src/app/c/[childSlug]/support/tickets/new/page.tsx` but never passes it.
- **What fails:** S5-S3-08 premise / FR-SUPPORT-004. The RLS policies in
  `supabase/migrations/033_support_tickets_rbac.sql:287-296` are CORRECT (`teen_privacy=true`
  rows invisible to parents), but the write path never sets the flag for teen principals — so a
  real teen ticket lands with `teen_privacy=false` and is readable by the parent. Worse, the UI
  **promises the opposite**: ticket-form.tsx:115-120 — *"Your parents won't be told you opened it
  and can't see it."* Copy/code contradiction = data-leak risk.
- **Fix (server-side, fail-closed):** in `openTicket` (src/lib/api/support.ts:115), resolve the
  caller's age band via the existing `support_user_age_band` RPC and force `teen_privacy=true`
  for teen/child principals regardless of the client-sent value. Client sends `teenPrivacy` too,
  but the server must not trust it.

### P0-3 — FR-SAFETY-007 outing gate has no implementation in Squad 5 code
- **Files:** `src/components/travel/trails-panel.tsx`, `src/components/travel/events-panel.tsx`
  (both `Share my plan` sheets are free-text copy flows; no Safety-Basics / trusted-adult check).
- **What fails:** TEST-PLAN §4 row + S5-GATE-01/02: independent 13–15 must be blocked from W27/W29
  outing flows until trusted-adult contact + 3-min Safety Basics + family-aware defaults are set.
  No such check exists anywhere in Squad 5 scope (grep for `safety_basics|outing_plan` returned nothing).
- **Fix/owner:** likely owned by Squad 1's outing-plan integration (migrations `032_safety_outing_plans.sql`
  exist; the trails/events sheets already mark "arrives with Squad 1's outing plans"). Until the
  gate lands, treat W27/W29 outing flows as P0-blocked for independent 13–15. Squad 5 owes a gate
  call-site even if Squad 1 owns the state.

### P1-1 — Initial ticket body stored UNREDACTED (S5-S2-14); UI copy claims otherwise
- **Files:** `src/lib/api/support.ts` (~L139-143: `db.from('ticket_events').insert({ ..., body: input.body })`);
  `supabase/migrations/033_support_tickets_rbac.sql:554` (redaction trigger exists ONLY on
  `ticket_messages`); `src/components/support/ticket-form.tsx:198` claims
  *"Sensitive patterns (card numbers, passwords) are redacted on the way in — never stored."*
- **What fails:** a PAN/SSN/password pasted into the ticket's "what happened" field persists raw in
  `ticket_events.body`. The C.3 redaction trigger never fires on this table.
- **Fix:** extend the redaction trigger (or a shared `redact_pii()` function) to `ticket_events`
  before storage, or redact in `openTicket` before insert. Correct the ticket-form copy if the
  trigger route is chosen and verify it before claiming it again.

### P1-2 — FAQ corpus is 23 articles; plan requires ≥90 with per-module coverage
- **Files:** `docs/squads/squad5/work/faq_seed.sql` (23 INSERTs; verified by script), `docs/squads/squad5/work/faq_seed_gen.py`
- **What fails:** S5-S1-01 (FR-SUPPORT-001): "all 28 modules + access-model + privacy + legal topics
  covered; total corpus ≥90 articles." Present articles cover W30/W12/W6/support-access topics but
  **nothing for W25, W26, W27, W28, W29** (no "How do I use Events/Trails/Weather/Fuel/Restaurants?").
  Also gates sol-support §E.4 ("no module ships without its FAQ leaves live").
- **Fix:** extend the generator to ≥90 articles including per-module how-to + troubleshooting for every
  Squad 5 module; re-run (generator already validates Flesch-Kincaid ≤8.0 — it passes on the 23).

### P1-3 — S2 chat proxy sends user content to the worker with no server-side PII handling
- **File:** `src/app/api/v1/support/chat/route.ts` (messages proxied verbatim; no redaction; no persistence)
- **What fails (partial):** S5-S2-14's battery targets `ticket_messages.body`; the chat path stores
  nothing server-side (client state only), so the gap is narrower than P1-1 — but a crisis keyword
  message or PII typed in chat reaches the third-party worker unredacted, and the escalation-to-ticket
  handoff summary is built client-side. Treat as P1 pending the D2/DPA gate decision; at minimum the
  handoff summary must route through the redacted ticket path.
- **Fix:** confirm chat-transcript retention policy (currently none server-side — acceptable if
  intentional, but document it); ensure handoff-created tickets pass through `openTicket`'s fixed
  redaction path.

### P2-1 — Deviation #1: W30 tile hidden from teens in the travel hub (plan expected plan-only visibility)
- **Files:** `src/lib/modules.ts:99` (`hideForTeen: true, minAge: 18` on W30);
  `src/components/travel/travel-hub.tsx` (filters by `resolveModuleVisibility === "visible"`).
- **What fails:** TEST-PLAN §14 expects W30 = V for teens (planning summary + adult handoff); S5-W30-02
  expects the teen to walk the flow. The build hides the tile; the deep link
  `/c/[childSlug]/travel/flights` still renders the correct plan-only panel
  (`src/app/c/[childSlug]/travel/flights/page.tsx` + `flights-panel.tsx:74-112`) with no checkout.
  Internal inconsistency: the visibility route (`src/app/api/v1/travel/modules/[module]/visibility/route.ts`)
  comments "w30_flights is visible to all (planning)" while modules.ts hides it in the hub.
- **Verdict:** NOT a panel 🛑 violation (the server-side purchaser invariant is the 🛑, and hiding is
  the safer direction). Needs MD sign-off; align the route comment with the shipped behavior.

### P2-2 — W29 "sunset warning" is informational, not a ≤90-minute firing warning
- **Files:** `src/app/api/v1/travel/trails/route.ts` (returns `sunset_today` + static
  `sunset_warning_minutes: 90`); `src/components/travel/trails-panel.tsx` (InfoLine always renders).
- **What fails (partial S5-W29-03):** sunset is computed from real solar math (✓), but there is no
  time-comparison that fires the warning only within 90 minutes of sunset — the copy "You'll get a
  heads-up 90 minutes before sunset" is shown unconditionally.
- **Fix:** compare current time to computed sunset server- or client-side and render the warning only
  at ≤90 min; keep the informational sunset line as-is.

### P2-3 — Deviation: crisis path files NO ticket (plan S5-S2-11 expected a quietly-filed ticket)
- **File:** `src/components/support/ai-chat.tsx:144-150`, `crisis-interrupt.tsx` ("No auto-ticket —
  a ticket is created only at explicit user request").
- **What fails:** TEST-PLAN S5-S2-11 expects a `source='s2_escalation'`, crisis-flagged ticket filed
  quietly second. The build freezes the flow and shows resources but creates no ticket.
- **Verdict:** NOT a panel 🛑 violation (the 🛑 is "never a ticket queue" as the response — satisfied).
  The build is arguably more conservative (S5-S2-12 no-auto-parent-notification). Needs MD sign-off on
  the deviation; update the plan if accepted.

### P2-4 — TEST-PLAN S5-W6-02 pass criteria are stale (30h math); build's 40h/6h is CORRECT
- **Files:** `docs/squads/squad5/TEST-PLAN.md:230-234`; `src/lib/marketplace/driving-rules-seed.ts`
  (`DRIVING_HOUR_TARGETS = GA: 40h/6h night`); `src/app/api/v1/marketplace/driving/log/route.ts`.
- **What fails:** the plan's expected "3.5h → 11.7%" encodes 30h; Georgia Joshua's Law is
  **30h classroom + 40h supervised driving (6 at night)** — the ring target of 40h/6h matches the
  real law and the verified seed (`hours.joshuas_law: "Joshua's Law: 30 hours class + 40 hours driving"`).
  Deviation #5 is **justified** — fix the plan, not the code. (Note BACKLOG.md:198/207 and UX-SPECS.md:178
  still say "30-hour log" — those docs need the same correction.)

### P3-1 — Vestigial teen state branch in travel hub (dead code)
- **File:** `src/components/travel/travel-hub.tsx` (`m.id === "W30" ? teen ? { kind: "connecting", line: "" } : ...`)
- **What fails:** cleanup rule only. W30 is filtered out of `modules` for teen viewers, so the teen
  branch is unreachable.
- **Fix:** remove the teen sub-branch.

## 3. Per-test-case results

Legend: ✅ PASS · ❌ FAIL · ⚠️ PARTIAL · 🚫 BLOCKED (needs staging/fixture/live source).
"Static" = proven from code; anything requiring accounts, fixtures, timers, or live sources is BLOCKED.

### §1 No-placeholder audit (addendum §4)
| Check | Verdict | Evidence |
|---|---|---|
| TODO/FIXME/STUB/HACK/lorem/mock grep gate | ✅ PASS | zero hits in all Squad 5 dirs (only HTML `placeholder=` attrs + comments citing the addendum) |
| Fixture-signature markers in responses | ✅ PASS | routes return honest `service_initializing`/`configuration_needed` states, never fake data |
| External-source failure modes (NWS, EIA, OCM, NPS, Foursquare, municipal, tutor worker) | ✅ PASS (static) | `UPSTREAM_UNAVAILABLE`/`configuration_needed` paths in all 7 routes; 🚫 live-down behavior needs staging |

### §4 Panel-compliance rows
| Panel 🛑 | Tests | Verdict |
|---|---|---|
| W27 no invented events | S5-W27-01, S5-W27-05 | ✅ PASS — host-type allowlist + `is_private_residence=false` + server-side age filter, `src/app/api/v1/travel/events/route.ts:37-54`; tampered `audience=grown_up` forced to `family` for non-adults (:35) |
| W27 18+/21+ filtering | S5-W27-03 | ✅ PASS — server-side tag filter derived from RPC band, not client params |
| W27 curation policy + audience modes | S5-W27-02, S5-W27-04 | ✅ PASS (static) — policy InfoLine on panel + `curation_policy` in API; Grown-up disabled for teens (`events-panel.tsx:117-129`) |
| W29 solo-hike <16 | S5-W29-01 | ✅ PASS — no solo-encouraging language; under-16 gets "Bring 2+ people — go with an adult" (`trails-panel.tsx:75-89, 186-196`); grep for solo/alone/by-yourself in teen paths: none |
| W29 dusk/darkness | S5-W29-03 | ⚠️ PARTIAL → P2-2 (computed sunset ✓, no ≤90-min firing logic) |
| W29 official sources only | S5-W29-04 | ✅ PASS — `safety_block` with NPS source + official URL; `guidance_catalog: "pending"` honest flag |
| W29 share my plan | S5-W29-05 | ✅ PASS (static) — first-class Sheet with trusted-adult picker; 🚫 check-in timers + overdue nudges need Squad 1 outing plans + staging |
| W30 teen self-booking | S5-W30-01, S5-W30-02 | ✅ PASS — `POST /api/v1/travel/purchase/check` denies minors server-side with audit row (`src/app/api/v1/travel/purchase/check/route.ts`); teen panel renders plan-only, zero checkout copy (`flights-panel.tsx:74-112`) |
| W30 UM rules engine | S5-W30-03 | ⚠️ PARTIAL — adult panel shows honest "verified airline rulebook… still being compiled" (`flights-panel.tsx:150-164`); 🚫 UM fee math needs the catalog + staging |
| W30 custody profile | S5-W30-04 | 🚫 BLOCKED — no custody logic in Squad 5 code; needs fixture + Squad 1 integration |
| W31 teen invisibility | S5-W31-01, S5-W31-02 | ✅ PASS — `notFound()` for non-adult at route level (`src/app/c/[childSlug]/travel/rentals/page.tsx:15-16`); visibility API returns `visible:false` for minors (`visibility/route.ts`); no other W31 API endpoints exist |
| W31 under-21 planning mode | S5-W31-03, S5-W31-04 | ✅ PASS (static) — planning-mode copy + under-25 surcharge callouts (`rentals-panel.tsx:43-70`); 🚫 real surcharge math needs rate cards + staging |
| W6 GA DDS rules | S5-W6-01 | ✅ PASS — permit 15, Joshua's Law 30h class + 40h driving, Class D 16 midnight–5AM + passenger limits, Class C 18 (`driving-rules-seed.ts:24-112`, sourced dds.georgia.gov, dated) |
| W6 driving log | S5-W6-02 | ✅ PASS (static, modulo P2-4) — 40h/6h-night ring backed by real `driving_log` table via `marketplace/driving/log` |
| W6 per-state rules | S5-W6-03 | ✅ PASS (static) — `?state=` param, GA + FL seeds; 🚫 staging needed for table-vs-snapshot path |
| Safety gate 13–15 | S5-GATE-01/02/03 | ❌ FAIL → P0-3 (no gate code in Squad 5 scope) |
| S2 crisis | S5-S2-10/11/12 | ❌ FAIL → P0-1 (S5-S2-10 matrix); S5-S2-11 deviated (P2-3); S5-S2-12 ✅ (no parent notification anywhere in crisis path) |
| S3 teen privacy | S5-S3-08/09 | ❌ FAIL → P0-2 (write path); RLS policies themselves ✅ correct |
| FR-TRAVEL-001 sweep | S5-TRAV-01 | ✅ PASS (static) — no purchase/booking/commit endpoint exists for any Squad 5 module except the denying gate |

### §5–§10 module cases (beyond §4)
| ID | Verdict | Note |
|---|---|---|
| S5-W27-06 age tags | ✅ PASS (static) | badge on every card (`events-panel.tsx:143-147`) |
| S5-W27-07 municipal labels | 🚫 BLOCKED | needs events table + staging |
| S5-W29-02 difficulty guidance | 🚫 BLOCKED | difficulty comes from the pending guidance catalog (honest "pending" flag) |
| S5-W29-06 NWS disclaimer on trails | ✅ PASS | NWS alert InfoLine (`trails-panel.tsx:101-107`) |
| S5-W30-05 itinerary sharing toggle | 🚫 BLOCKED | no booking path exists to attach it to |
| S5-W30-06 adult positive control | 🚫 BLOCKED | needs sandbox booking provider + staging |
| S5-W25-01 family-aware routing | 🚫 BLOCKED | fuel route returns regional EIA average; no per-station routing logic shipped (honest) |
| S5-W26-01 NWS alerts | ✅ PASS (static) | alerts from api.weather.gov with link+timestamp path (`weather/route.ts`) |
| S5-W26-02 disclaimer + coarse location | ✅ PASS | disclaimer contract flag; ZIP-only input |
| S5-W28-01 verified listings | ✅ PASS (static) | Foursquare real places; 🚫 live spot-verify needs staging + key |
| S5-W28-02 allergen hard-block | ✅ PASS (static) | server-side block from `health_allergies` + honest `unavailable` flag; no "allergy-safe" claims; 🚫 needs table + staging |
| S5-W28-03 bar-primary <18 | ✅ PASS | `BAR_PRIMARY` category set filtered server-side (`restaurants/route.ts:62-66`) |
| S5-W28-04 teen night bias | ✅ PASS (static) | night-safety bias toggle default-ON <18 (`restaurants-panel.tsx` comment) — copy verified, behavior 🚫 staging |
| S5-W6-01/02/03 | ✅ PASS (static) | see §4 rows; S5-W6-02 with P2-4 plan correction |
| S5-W12-01 vetting label | ✅ PASS | "Parent-vetted, not background-checked by Pookie" on directory + per profile (`babysitters-panel.tsx:150,188`) |
| S5-W12-02 teen read-only | ✅ PASS | add/grant controls gated by `isParent` (`babysitters-panel.tsx:155,168,191,223`) |
| S5-MENU-01 age-gating sweep | ⚠️ PARTIAL | W31 ✅ hidden all teen bands; W30 hub-hidden (P2-1 deviation); W24 = Squad 4 scope; 🚫 full sweep needs staging accounts |
| S5-MENU-02 teenPrivate locked | 🚫 BLOCKED | cross-squad surface (Wellbeing), not in Squad 5 scope to prove |

### §11–§13 support cases
| ID | Verdict | Note |
|---|---|---|
| S5-S1-01 coverage floor | ❌ FAIL → P1-2 | 23/90 articles; W25/W26/W27/W28/W29 uncovered |
| S5-S1-02 legal accordions | ✅ PASS (static) | `legal-accordion.tsx`; seed articles carry `legal_basis` + `legal_citation` (e.g. FERPA) with review dates |
| S5-S1-03 search quality | 🚫 BLOCKED | needs live corpus + staging |
| S5-S1-04 readability | ✅ PASS | generator enforces FK ≤8.0 on body + legal note; re-ran clean (23/23) |
| S5-S2-01 handoff contract | ✅ PASS | 3–5 bullet summary card → [Looks right ✓]/[Add something] (`handoff-contract.tsx:71-74`) |
| S5-S2-02 explicit human | ✅ PASS | `HUMAN_PATTERNS` tripwire → immediate handoff, no dark patterns (`ai-chat.tsx:153-157`) |
| S5-S2-03 AI disclosure | ✅ PASS | persistent "🤖 AI assistant — not a person" chip + first-run InfoLine (`ai-chat.tsx:225-232`) |
| S5-S2-04 private-data honesty | ✅ PASS | system prompt: "You CANNOT see the user's private data" (`chat/route.ts:35-38`) |
| S5-S2-13 under-13 block | ✅ PASS (static) | under-13 = parent session only; chat addresses the parent (`ai-chat.tsx:230-232`); `rpc_open_ticket` rejects under-13 principals (033 comment) |
| S5-S2-14 PII redaction | ❌ FAIL → P1-1 | trigger covers `ticket_messages` only; `ticket_events` body path unredacted |
| S5-S3-01 lifecycle | ✅ PASS (static) | claim/transition/confirm/reopen routes + `canTransitionTicket` guard; 🚫 full cycle needs staging |
| S5-S3-02 window-aware SLA | ✅ PASS (static) | `computeSlaDueAt` 4h within 9AM–5PM ET window (code review); 🚫 boundary math needs fixture tests |
| S5-S3-03 after-hours honesty | 🚫 BLOCKED | banner logic exists; needs time fixture |
| S5-S3-04 re-intro + no-PII push | 🚫 BLOCKED | needs staging |
| S5-S3-05 agent RBAC / grant allowlist | ✅ PASS | `GRANTABLE_SCOPES` = grades/billing/sync only; health/wellbeing/mood/checkin NEVER-grantable (`src/lib/api/grants.ts:9-26`) |
| S5-S3-06 in-thread teen consent | 🚫 BLOCKED | `requestSupportGrant` path exists; needs staging |
| S5-S3-07 conflict of interest | ✅ PASS | family-link check in `claimTicket` → SCOPE_FORBIDDEN (`src/lib/api/support.ts:246-285`) |
| S5-S3-08 parent-via-API | ❌ FAIL → P0-2 | RLS correct; write path breaks the premise |
| S5-S3-09 RLS matrix | ⚠️ PARTIAL | policies reviewed statically: owner/parent/agent/lead SELECTs correct; teen_privacy exclusion at RLS level ✅; 🚫 scripted per-role matrix needs live DB |
| S5-S3-10 audit log | ✅ PASS (static) | `auditSupport` on agent reads (`getTicketForAgent`); teen-visible log copy in ticket form |
| S5-S3-11 zero-parent banner | ✅ PASS | teen banner on ticket form (`ticket-form.tsx:115-120`) — **contradicted by P0-2** |
| S5-S3-12 SLA breach | 🚫 BLOCKED | needs time fixture |
| S5-S3-13 $50 authority | ✅ PASS (static) | `AGENT_CREDIT_LIMIT_CENTS = 5000` boundary in `issueOrRequestCredit` (`src/lib/api/support.ts`); audit-logged |
| S5-S3-14 holiday on-call | ✅ PASS (static) | `isSupportHoliday` + `resolveOnCallAgentId` auto-assign |

### §14 visibility matrix (static fill from code)
| Module | under-13 (parent view) | 13–15 | 16–17 | 18+ | Parent of teen |
|---|---|---|---|---|---|
| W25/W26/W27/W28/W29 | V | V | V | V | V |
| W30 Flights | V (plan) | **H (hub) / V-plan (deep link)** ⚠️ P2-1 | same | V | V |
| W31 Rental Cars | H | H | H | V | V |
| W6 Driving School | H (<15) | V | V | V | V |
| W12 Babysitters | V (parent acts) | V read-only | V read-only | V | V |
| S1 FAQ | V | V | V | V | V |
| S2/S3 | parent session | V | V | V | V |

### §15 cross-module
| ID | Verdict | Note |
|---|---|---|
| S5-X01 sibling leakage | 🚫 BLOCKED | child-scoped queries everywhere; needs two-teen fixture + staging |
| S5-X02 location policy 13–17 | ✅ PASS (static) | coarse ZIP only; no precise storage; D7 clean |
| S5-X03 overdue nudge | 🚫 BLOCKED | needs Squad 1 outing plans |

### §16 security matrix (static)
| ID | Verdict | Note |
|---|---|---|
| S5-SEC-01 teen→purchase gate | ✅ PASS | gate denies minors server-side with audit; no other booking endpoints exist |
| S5-SEC-02 teen→W31 API | ✅ PASS | route `notFound()`; visibility RPC `visible:false`; no other W31 endpoints |
| S5-SEC-03 parent→teen ticket | ⚠️ FAIL-by-P0-2 | RLS correct; write path lets it happen |
| S5-SEC-04 tampered age_band | ✅ PASS | server RPC band wins; audience forced |
| S5-SEC-05 direct-URL W31 teen | ✅ PASS | `notFound()` before any data fetch |
| S5-SEC-06 conflict claim | ✅ PASS | refused + audited |
| S5-SEC-07 scope injection | ✅ PASS | allowlist at `isGrantableScope` + DB CHECK per 033 |
| S5-SEC-08 link codes | 🚫 BLOCKED | Squad 1 scope |
| S5-SEC-09 XSS | 🚫 BLOCKED | React escaping by default; needs staging battery |
| S5-SEC-10 DOB tampering | 🚫 BLOCKED | needs account API review (Squad 1) |
| S5-SEC-11 deactivated agent | ⚠️ PARTIAL | `requireAgent` checks role per call — verify `active` flag included (code path exists; DB column check 🚫 staging) |
| S5-SEC-12 second-account W31 | ✅ PASS (static) | gated on principal age band, not history |
| S5-SEC-13 internal notes hidden | ✅ PASS | user view filters `internal=false` (`getUserTicket`); RLS hides from users |
| S5-SEC-14 redaction variants | ❌ FAIL → P1-1 | trigger regexes cover SSN/PAN/password variants on `ticket_messages` only |

### §17 non-functional
| ID | Verdict |
|---|---|
| S5-PERF-01..04 | 🚫 BLOCKED — all need staging |
| S5-A11Y-01/02 | 🚫 BLOCKED — keyboard/axe walkthrough needs staging |
| S5-A11Y-03 contrast | ⚠️ PARTIAL — no light-on-white in sampled classes; needs automated sweep |
| S5-A11Y-04 reduced-motion | 🚫 BLOCKED |
| S5-A11Y-05 screen reader | ✅ PASS (static) — crisis resources are real `<a>` links (`crisis-interrupt.tsx:62-76`) |
| S5-THEME-01..04 | 🚫 BLOCKED — visual review needs staging |

## 4. Age-gating verification (task item 3)

- `hideForTeen`/`minAge` from `modules.ts` are enforced in hub rendering: both
  `travel-hub.tsx` and `marketplace-hub.tsx` filter via `resolveModuleVisibility(m, viewer) === "visible"`,
  which returns `"hidden"` for teen viewers when `hideForTeen` or `minAge` applies
  (`src/lib/menu-access.ts:43-53`). ✅
- The server band helper `getSquad5Context` (`src/lib/squad5/context.ts`) is used on every Squad 5
  page (`travel/*`, `marketplace`, `support/*`); band comes from the real `support_user_age_band`
  RPC and fails closed to `'child'`. ✅
- Inconsistency noted: W30 carries `hideForTeen` (hub-hidden) while the visibility route and UX spec
  describe plan-only visibility — P2-1.

## 5. D7 / D2 / secrets (task items 4–5)

- **D7:** zero hits for `geolocation`, `watchPosition`, `getCurrentPosition`, `latitude`/`longitude`
  storage in Squad 5 code. All location enters as a user-typed 5-digit ZIP (`ZipGate`, localStorage),
  resolved server-side to a ZIP centroid via zippopotam (`src/lib/travel/upstream.ts:47-70`). ✅
- **D2:** no user-visible "never train on your data" claim anywhere in Squad 5 copy; the only hit is
  the gate comment at `src/app/api/v1/support/chat/route.ts:8`. ✅
- **Secrets:** API keys read from env (`EIA_API_KEY`, `FOURSQUARE_API_KEY`, `NPS_API_KEY`,
  `POOKIE_TUTOR_URL`) — none hardcoded. ⚠️ One hygiene note: `src/lib/travel/upstream.ts:53`
  hardcodes a `User-Agent` contact `support@pookie.app` (fine, not a secret).

## 6. Deviations review (task item 7)

The parent brief listed 6 frontend-engineer deviations; only **#1** and **#5** were identifiable
from the brief text + code. **Deviations #2/#3/#4/#6 were not found in any repo doc**
(`docs/squads/squad5/*`, BUILD-LOG, commit messages searched) — **open question for the parent**:
please point QA at the Wave-2 debrief listing all six.

- **#1 — W30 teen tile hidden vs plan-only:** VERIFIED in code (`modules.ts:99`). No panel 🛑
  violation (the 🛑 is the server-side purchaser invariant, which holds). Graded **P2-1** — needs MD
  sign-off and a one-line alignment of the visibility-route comment.
- **#5 — 40h vs 30h ring target:** VERIFIED (`DRIVING_HOUR_TARGETS` GA 40h/6h night). **Justified —
  code is correct.** GA Joshua's Law = 30h classroom + 40h supervised driving (6h night); the test
  plan's "30-hour math" is the stale artifact (from BACKLOG/UX-SPECS). **Correct the plan/docs, not the code.**

## 7. Requires staging verification (cannot be proven statically)

1. Full test-account matrix (§3: qa.teen13/nogate/16, qa.adult, qa.parent.a/b, qa.agent/lead/admin/relation) + fixtures (hostile listings, custody order, allergy profile, teen ticket, UM fixtures).
2. S5-SEC-01/02/03/04/06/07/11/13 live attack battery; S5-S3-09 scripted RLS matrix against the live DB.
3. S5-S2-10 latency <10s; S5-PERF-01..04; S5-A11Y-01/02/04 walkthroughs; S5-THEME-01..04 visual review.
4. FAQ corpus coverage script (post-fix); S5-S1-03 search quality; S5-S2-01..02 live chat behavior.
5. External-source failure modes under real outages (NWS/EIA/OCM/NPS/Foursquare/worker down).
6. S5-W30-03/04/05/06, S5-W31-03/04/05, S5-W12-02 grant-tier enforcement (D6: 8/30d vs 2/30d, installment
   detection, teen co-approval — owned server-side by Squad 4's `request_sitter_grant()` RPC).
7. S5-GATE-01/02, S5-X01/X03, S5-MENU-01/02 full sweeps, S5-S3-01/03/04/06/12 lifecycle paths.
8. §18 entry criterion 3: attorney sign-off records (E.1), DV-advocate crisis-copy review (E.2),
   access-model grant-allowlist confirmation (E.3), FAQ FK report at 90+ articles (E.4), build-team
   RLS test results (E.5).

## 8. Go / no-go

**NO-GO for Squad 5's scope until:**
1. **P0-1** crisis keyword matrix fixed + server-side backstop (re-run S5-S2-10 battery on staging).
2. **P0-2** `teen_privacy` forced server-side for teen/child principals (then S5-S3-08 re-test; the UI
   banner already promises this behavior).
3. **P0-3** FR-SAFETY-007 gate resolved with Squad 1 (either land the gate or get MD sign-off that the
   outing-plan integration owns it and W27/W29 outing flows are gated there).
4. **P1-1** ticket-body redaction extended to `ticket_events` (the ticket form's copy claims it today).
5. **P1-2** FAQ corpus grown to ≥90 articles incl. all Squad 5 modules (sol-support §E.4 gate).
6. MD sign-off on P2-1 (W30 hub-hiding) and P2-3 (no quiet ticket on crisis); plan text corrections
   for P2-4 (30h→40h math) and §14 matrix row for W30.

After fixes: re-run the static battery (tsc + grep gates + this report's §3 tables) and the staging
battery in §7. No deploy was performed (MD rule).

---
*Evidence: file:line references throughout; methods: `grep` audits, targeted file reads, `npx tsc --noEmit`
(exit 0), `faq_seed_gen.py` re-run (23 articles, FK ≤8.0 pass). No live deploy or browser was available;
BLOCKED items are explicit above.*
