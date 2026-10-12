# Squad 5 Backlog — Travel, Marketplace & Support UI

**Squad:** Travel, Marketplace & Support UI · **PM (PMP):** Product Manager
**Branch:** `staging-build` · **Date:** 2026-10-12 · **Status:** Wave 1 (PM + UX + Tech Lead + QA in parallel; Frontend joins Wave 2)
**Authority:** `docs/BUILD-SPECIFICATION.md` v1.0 · `docs/MASTER-BUILD-CHECKLIST.md` · `docs/PANEL-ROUND2-SOLUTIONS.md` §9 ·
`docs/solutions/sol-support.md` · `docs/solutions/sol-safety.md` §§5/8/9 · `docs/MD-DECISIONS.md` (D1–D7, all resolved)

## 0. Managing Director directive (Mehedi, 2026-10-12) — NO PLACEHOLDERS

Every item below ships as a **full working implementation**: real database tables, real API endpoints,
real UI wired to real data, real RLS policies. No mock data, no "coming soon"/seedling screens, no stubbed
functions, no TODO comments in shipped code. Definition of done for every item: **"works end-to-end
against real data."** Where an external API key is unavailable, the integration code is complete and tested,
reads the key from env, and only the missing credential shows an honest "configuration needed" state.
Every item carries a **Data source** line and the acceptance criterion **"No mock data; verified against
live source."**

## 1. Scope

| # | Module | Panel | Complexity | Item |
|---|---|---|---|---|
| W25 | Fuel & Charging | ✅ | 🟢 | S5-002 |
| W26 | Weather | ⚠️ | 🟢 | S5-003 |
| W27 | Events | 🛑 as designed → **redesigned only** | 🟠 | S5-009 |
| W28 | Restaurants | ⚠️ | 🟡 | S5-004 |
| W29 | Trails & Parks | 🛑 as designed → **redesigned only** | 🟠 | S5-010 |
| W30 | Flights | 🛑 as designed → **redesigned only** | 🔴 | S5-012 |
| W31 | Rental Cars | 🛑 as designed → **redesigned only** | 🟠 | S5-011 |
| W6 | Driving School | 🛑 as designed → **redesigned only** | 🟡 | S5-006 |
| W12 | Babysitters | ⚠️ | 🟡 | S5-005 |
| S1 | Help Center & FAQ | (new category) | 🟢 | S5-001 |
| S2 | AI Support Chat | (new category) | 🟠 | S5-007 |
| S3 | Support Tickets | (new category) | 🟠 | S5-008 |

**Never build the un-vetted versions.** W27/W29/W30/W31/W6 ship ONLY in the redesigned shapes specified in
the FR-MOD rows + `sol-safety.md` §§5/8/9 + panel §9. The 🛑 "as designed" shapes (unvetted events listing,
solo-hike recs for <16, teen flight self-booking, teen rental initiation, DDS-rule-free driving module)
are recorded in §7 and must fail QA if detected.

## 2. Build sequence (least-dependent first)

```
S5-001 S1 FAQ (🟢) → S5-002 W25 Fuel (🟢) → S5-003 W26 Weather (🟢) → S5-004 W28 Restaurants (🟡)
→ S5-005 W12 Babysitters (🟡) → S5-006 W6 Driving School (🟡) → S5-007 S2 AI chat (🟠)
→ S5-008 S3 Tickets (🟠) → S5-009 W27 Events (🟠) → S5-010 W29 Trails (🟠)
→ S5-011 W31 Rental Cars (🟠) → S5-012 W30 Flights (🔴)
```

Rationale: S1 has zero code dependencies and unblocks S2's retrieval corpus; W25/W26 are standalone
external-API modules; W28 needs only a listings vendor decision; W12/W6 are data-table + UI builds;
S2 needs Squad 1's crisis protocol; S3 needs S2's handoff + migration numbers deconflicted; W27/W29 need
Squad 1's Explorer Setup gate + trails/events schemas; W31/W30 are the compliance-heaviest and land last.

## 3. Cross-squad inputs Squad 5 needs (tracked, not owned)

| Input | Owner | Needed by |
|---|---|---|
| Migrations 015–023 (access model, `child_access.expires_at` / `grant_kind` / `grant_purpose`, `access_events` 021) | Platform Team 1 | S5-005 (time-boxed grant UI), S5-008 (audit event types) |
| Popup menu shell + `modules.ts` registry + FR-MENU-004 age-gating | Platform Team 1 | All items (module registration AC) |
| MD D7 coarse-only location architecture (city/ZIP max, never precise GPS) | Platform Team 1 | S5-002, S5-003, S5-004, S5-009, S5-010 |
| Trusted-adult infra + `outing_contact` role; Explorer Setup gate (sol-safety §5); `outing_plans` schema | Squad 1 (Safety) | S5-009, S5-010 (gate on first open; share-my-plan deep link) |
| Crisis protocol G2 + crisis-router Edge Function; D1 contracted crisis vendor routing contract | Squad 1 (Safety) | S5-007 (crisis pattern-interrupt) |
| `trails` / `events` table schemas + `rpc_get_trails` / `rpc_get_events` (sol-safety §8.3/§9.2; migrations ~027/028 — **number deconflict needed, §6 R-001**) | Squad 1 (Safety) | S5-009, S5-010 (Squad 5 builds UI + curation workflows on Squad 1's schemas) |
| `emergency_medical.allergies` hard-block list (sol-safety §6.3) | Squad 1 (Safety) | S5-004 (W28 allergen hard-blocks — never inferred) |
| `court_order_restriction` flag + custody travel-restriction profile (FR-SAFETY-012) | Squad 1 (Safety) | S5-012 (W30) |
| `babysitters` table schema + time-boxed grant RPCs (FR-ACCESS-011) | Squad 4 (Home & Money) | S5-005 |
| LegalAccordion attorney approvals; S3 retention periods + redaction rules; DPA verification for "never train" (MD D2); GIPA breach-runbook scoping | Fractional Compliance + licensed counsel | S5-001, S5-007, S5-008 |
| 2 support agents hired; holiday on-call rotation (MD D4) | Mehedi / Managing Director | S5-008 |
| FAQ launch corpus authorship (~90 articles, FK ≤ 8.0) | Content team | S5-001 |
| API keys: EIA, OpenChargeMap, Foursquare-vs-Google-Places decision, NPS | Tech Lead (+ Mehedi for paid tiers) | S5-002, S5-004, S5-010 |
| Municipal calendar feeds (Cobb Parks & Rec, Marietta); GA DPH inspection-score source; GA DDS rules verification; airline UM rules verification | Tech Lead / data | S5-009, S5-004, S5-006, S5-012 |

## 4. Backlog items

---

### S5-001 — S1 Help Center & FAQ (full implementation)
- **FR traceability:** FR-SUPPORT-001 · FR-MENU (Support category)
- **Panel mark:** ✅ (Phase 4; panel rank 1 — "static content + search; no user data")
- **Complexity:** 🟢 Simple
- **Data source:** real seeded article corpus in `faq_articles` (~90 articles: 9-section tree — 7 menu categories + Account & Privacy + Legal & Your Rights; every module ≥1 how-to + ≥1 troubleshooting article); Postgres full-text (`tsvector`) + `pg_trgm` typo tolerance; pgvector semantic fallback only when keyword returns <3 results. Content authored by content team — not empty states, not lorem.
- **Dependencies:**
  - Technical: `faq_articles`, `faq_feedback`, `faq_article_versions` tables + GIN/trgm/tsvector/pgvector indexes (migration number TBD — deconflict with Squad 1's 022–029 range; see §6 R-001)
  - Data: content team delivers the ~90-article corpus; municipal/legal facts verified
  - Compliance: every `LegalAccordion` (11 Mehedi-mandated legal topics) needs **licensed-attorney approval before go-live** (sol-support §E gate 1); readability gate FK ≤ 8.0 enforced in CMS (article + accordion separately)
  - Human: content team; attorney reviewers
- **Blocked by:** attorney sign-off on legal accordions (launch-blocking for the `L`-marked articles); content corpus delivery
- **Suggested owner:** Tech Lead (schema + search) → Frontend Wave 2 (tree UI, `LegalAccordion`, "?" deep-link sheets, search UX)
- **Acceptance criteria:**
  1. All 31 modules have ≥1 how-to and ≥1 troubleshooting article live; 9-section tree renders from the DB (no hardcoded article bodies in the client).
  2. Keyword search returns ranked results; typo-tolerant; semantic fallback labeled "Related answers"; age-band filtering enforced server-side (teen never sees parent-only articles; hidden-result counts never disclosed).
  3. `LegalAccordion` renders collapsed by default with exactly one badge (`Required by law` / `Our choice` / `Law + our choice`); `our_choice` always shows the honesty line ("The law doesn't require this — we do it because…"); stale accordions (past `legal_review_due_at`) show the amber "being re-reviewed" banner and are never silently hidden.
  4. "?" affordance on Sharing screen, SYNC NOW, Settings → Safety, and ticket form deep-links to the correct article in a bottom sheet (no navigation away).
  5. Article feedback (👍/👎) writes to `faq_feedback`; articles with helpful-rate <60% over 30 days auto-flag for editorial review.
  6. **No mock data; verified against live source** — corpus is real authored content; search hits real rows.
  7. Module registered in `src/lib/modules.ts` (Support category); no module ships without its FAQ leaves live (Milestone-1 gate).

---

### S5-002 — W25 Fuel & Charging (full implementation)
- **FR traceability:** FR-MOD-W25 (✅) · FR-TRAVEL-001 · FR-MOD-X02 (location policy)
- **Panel mark:** ✅
- **Complexity:** 🟢 Simple
- **Data source:** **EIA API** (gas prices, key from env) + **OpenChargeMap** (charger locations, key from env). If a key is unavailable, integration code is complete and tested; only the missing credential shows an honest "configuration needed" state. Station data is never fabricated.
- **Dependencies:**
  - Technical: coarse-only location (MD D7 — city/ZIP; Platform Team 1); `modules.ts` registration; FR-MENU-004 age-gating
  - Data: EIA + OpenChargeMap API keys
  - Compliance: none beyond FR-TRAVEL-001
  - Human: none
- **Blocked by:** API key provisioning (build + test against sandbox/fixtures meanwhile)
- **Suggested owner:** Tech Lead (API integration + caching) → Frontend (station list/map UI, Nebula theme)
- **Acceptance criteria:**
  1. Real gas prices from EIA and real charger locations from OpenChargeMap render for the user's coarse location; prices/availability match the upstream APIs on spot check.
  2. Teen routing inherits the family-aware default (per FR-MOD-W25).
  3. No purchase, booking, or contract flow is completable by a <18 account — enforced server-side (FR-TRAVEL-001); attempt returns a clean refusal.
  4. Location used is coarse only (city/ZIP); no precise GPS requested or stored (MD D7).
  5. **No mock data; verified against live source** — every station/price row traceable to an API response.
  6. Module registered in `src/lib/modules.ts` (Travel category).

---

### S5-003 — W26 Weather (full implementation)
- **FR traceability:** FR-MOD-W26 (⚠️)
- **Panel mark:** ⚠️ — ship only with the fix
- **Complexity:** 🟢 Simple
- **Data source:** **NWS/NOAA `api.weather.gov`** (free, no key). Forecasts and alerts come only from NWS; never LLM-generated.
- **Dependencies:**
  - Technical: coarse-only location (MD D7); `modules.ts` registration
  - Data: none (keyless)
  - Compliance: panel fix set (below)
  - Human: none
- **Blocked by:** nothing — buildable immediately
- **Suggested owner:** Frontend-capable build (Tech Lead for fetch layer) → Frontend (7-day UI, alert banners)
- **Acceptance criteria:**
  1. 7-day forecast + active alerts served from `api.weather.gov`; every AI-translated summary links the official NWS alert + timestamp.
  2. Explicit, always-visible disclaimer: "not an emergency-alert system."
  3. Safety footer always shown for <18 viewers (sol-safety §5: Weather is informational, no Explorer gate, but the footer ships anyway).
  4. No forecast text is LLM-generated — verified by code inspection + QA spot check of alert wording vs NWS source.
  5. Coarse location only (MD D7).
  6. **No mock data; verified against live source** — forecast values match api.weather.gov for the same point/time.
  7. Module registered in `src/lib/modules.ts` (Travel category).

---

### S5-004 — W28 Restaurants (full implementation)
- **FR traceability:** FR-MOD-W28 (⚠️)
- **Panel mark:** ⚠️ — ship only with the fix
- **Complexity:** 🟡 Moderate
- **Data source:** **real listings vendor — Foursquare free tier vs Google Places (Tech Lead decides; documented in the item's build notes). NEVER hallucinated listings.** GA DPH inspection scores from the real published source. Allergen hard-block list from Squad 1's `emergency_medical.allergies` (never inferred).
- **Dependencies:**
  - Technical: listings vendor API; `health_allergies`/`emergency_medical.allergies` read access (Squad 1); coarse-only location (D7); `modules.ts` registration
  - Data: vendor API key; GA DPH inspection-score feed
  - Compliance: allergen hard-block logic (never "allergy-safe" claims); no weight-loss dietary framing for <18
  - Human: none
- **Blocked by:** listings-vendor decision + API key; allergy-list schema from Squad 1
- **Suggested owner:** Tech Lead (vendor integration, scoring) → Frontend (listing cards, filters)
- **Acceptance criteria:**
  1. Every listing is a real, verified live listing from the chosen vendor (spot-check 20 listings against vendor dashboard — zero fabricated entries).
  2. GA DPH inspection scores shown where available; missing scores shown as "not available," never invented.
  3. Allergen hard-blocks: user/teen allergy list blocks matching listings outright; no "allergy-safe" claims anywhere; allergen data never inferred by AI.
  4. 21+/bar-primary venues excluded for <18 (server-side filter, not UI-hiding); teen night-safety bias in ranking after dark (well-lit, populated areas).
  5. No weight-loss / diet-culture framing for <18.
  6. Explorer Setup-lite triggers on first open for 13–15 (contact check; sol-safety §5.2 — Squad 1's gate, Squad 5 wires the trigger).
  7. **No mock data; verified against live source.**
  8. Module registered in `src/lib/modules.ts` (Travel category).

---

### S5-005 — W12 Babysitters: directory + time-boxed grant UX (full implementation)
- **FR traceability:** FR-MOD-W12 (⚠️) · FR-ACCESS-011 · FR-ACCESS-012 · FR-SUPPORT-004 (teen visibility)
- **Panel mark:** ⚠️ — ship only with the fix
- **Complexity:** 🟡 Moderate
- **Data source:** real `babysitters` table (schema from Squad 4 Tech Lead) + real `child_access` rows with `expires_at`/`grant_kind`/`grant_purpose` (migration 023, Platform Team 1). Directory entries are parent-entered real data; grant flows write real rows.
- **Dependencies:**
  - Technical: migration 023 (`expires_at` on `child_access`) — Platform Team 1; `babysitters` table + time-boxed grant RPCs — Squad 4; sweeper job (`revoked_by='system'`, reason `expiry`) — Platform/Squad 4
  - Data: none external
  - Compliance: "parent-vetted, not background-checked by Pookie" labeling (real background checks require FCRA counsel first — gated, not built)
  - Human: none
- **Blocked by:** migration 023 applied; Squad 4's grant RPC contract landed
- **Suggested owner:** Tech Lead (grant-flow integration) → Frontend ("Share for a bit" flow, directory UI, Sharing-screen countdown chips)
- **Acceptance criteria:**
  1. Directory lists only real parent-added sitters; every profile shows the label "parent-vetted, not background-checked by Pookie" — no implied vetting.
  2. "Share for a bit" occasion flow works end-to-end: who → "Sitter basics" scope preset (schedule/logistics, pickup authorization, emergency medical card) → occasion presets with computed end times → real `child_access` row with `expires_at`, `grant_kind`, `grant_purpose`.
  3. Scope allowlist enforced: Reflection/Wellness/H2/H3/full-communications rejected at the RPC layer (QA attempts each — all refused).
  4. MD D6 tiered caps enforced server-side: 8 temporary grants/grantee/30d for trusted (previously approved, no blocks), 2/30d for first-time grantees; installment pattern flags on the teen's Sharing screen.
  5. Teen 13+ notified of new grantees with one-tap revoke (instant for third-party grants); teen co-approval required for NEW grantees (13–15, MD D6), notification-only for renewals within cap.
  6. Expiry as a slope: T-24h parent nudge → T-1h/T-15m sitter wrap-up → "All done" screen with [Request more time] + [Text parent] + 10-min read-only grace; expiry notice is single-fire, zero attribution, no re-request CTA.
  7. Emergency card (contacts, allergies, address) never gated by grant expiry (FR-ACCESS-012) — stated on the scope picker; verified by letting a grant lapse and confirming the card still renders.
  8. **No mock data; verified against live source** — grants are real rows; expiry is the real sweeper.
  9. Module registered in `src/lib/modules.ts` (Marketplace category).

---

### S5-006 — W6 Driving School: GA DDS rules engine (full implementation)
- **FR traceability:** FR-MOD-W6 (🛑 as designed → redesigned)
- **Panel mark:** 🛑 — **do not ship without GA DDS rules**
- **Complexity:** 🟡 Moderate
- **Data source:** **GA DDS rules as seeded, versioned data** (learner's permit at 15; Joshua's Law 30-hour requirement; provisional Class D at 16 with midnight–5AM + passenger restrictions; full Class C at 18 — verified against GA DDS published rules) + **real hours-log table** (teen-logged supervised hours, append-only).
- **Dependencies:**
  - Technical: `driving_rules(state_code, ...)` + `driving_log` tables; `modules.ts` registration
  - Data: GA DDS rules verification (published sources); per-state table seeded for ≥2 states to prove the per-state architecture (MD D3: state-aware from day one)
  - Compliance: none (informational + logging)
  - Human: none
- **Blocked by:** GA DDS rules verification pass
- **Suggested owner:** Tech Lead (rules engine + log schema) → Frontend (progress UI, log entry, restriction surfacing)
- **Acceptance criteria:**
  1. Rules engine returns correct GA milestones for a given DOB: permit eligibility at 15, Joshua's Law 30-hour requirement, Class D provisional at 16 with midnight–5AM + passenger restrictions, full Class C at 18.
  2. Digital driving log: teen adds supervised-hour entries (date, duration, supervisor, conditions); 30-hour progress computed from real rows; log is append-only (edits create new versions, never silent overwrites).
  3. Midnight–5AM and passenger restrictions are surfaced in the plan/log UI for provisional drivers — not buried.
  4. Per-state architecture proven: switching state changes the ruleset (≥2 states seeded); adding a state is a data row, not a code change.
  5. Under-15 accounts see planning mode only (no log, no "eligible" language).
  6. **No mock data; verified against live source** — GA rules match published GA DDS requirements; log rows are real user data.
  7. Module registered in `src/lib/modules.ts` (Marketplace category).

---

### S5-007 — S2 AI Support Chat (full implementation)
- **FR traceability:** FR-SUPPORT-002 · FR-SUPPORT-004 · NFR-PRIVACY-010 (MD D2)
- **Panel mark:** ✅ with refinements (Round 2 Prop 6)
- **Complexity:** 🟠 Complex
- **Data source:** **real `pookie-tutor` Worker wiring** (Llama 3.3 70B, support-scoped system prompt) + **real `faq_articles` retrieval corpus** (S5-001) + real conversation persistence. No canned-script pretending to be AI; no fake "typing" without a real call.
- **Dependencies:**
  - Technical: pookie-tutor Worker (exists); S5-001 corpus; crisis protocol G2 + crisis-router (Squad 1); ticket-creation RPC (S5-009's schema — build S2 handoff against the spec'd `rpc_open_ticket` interface and mark the integration point)
  - Data: none external
  - Compliance: crisis handoff copy needs DV-advocate + safety-designer review (sol-support §E gate 2); AI disclosure wording must not overpromise "never train" until DPA verification completes (MD D2) — interim honest copy required
  - Human: DV-advocate reviewer
- **Blocked by:** Squad 1 crisis protocol contract; DV-advocate copy review (launch-blocking for crisis path)
- **Suggested owner:** Tech Lead (worker prompt, retrieval, tripwire logic) → Frontend (chat UI, handoff card, crisis resource block)
- **Acceptance criteria:**
  1. Persistent, non-dismissible disclosure chip: "🤖 AI assistant — not a person" + first-run InfoLine stating what S2 can/can't do (can't see grades/health/check-ins, can't delete/export, can't make legal promises) + "A human is one tap away — just say 'human.'"
  2. All five escalation tripwires fire on test: (a) retrieval confidence <0.60 after FAQ lookup → offers human; (b) "human"/"real person"/"agent" → immediate handoff, no persuasion; (c) 3 failed attempts on one intent → proactive handoff with transcript attached; (d) crisis language → **safety protocol, never the ticket queue alone** (below); (e) deletion/export request → plain-language info + immediate human ticket.
  3. Crisis pattern-interrupt: support flow freezes (no ticket, no SLA timer); inline 988 / Crisis Text Line / GA Crisis Line buttons with `tel:`/`sms:`; "help me tell a trusted adult" offered; AI stays present; ticket created only on explicit user request. `crisis_events` audit row written. **No human support agent reads crisis-flagged conversations at launch.**
  4. Visible handoff contract: 3–5 bullet summary card ("what I'll hand them") → [Looks right] [Add something] → ticket number issued synchronously → wait-time estimate from live queue data (never a fake precise number).
  5. After-hours (5 PM–9 AM ET): honest banner ("offline until 9 AM ET — reply by 1 PM ET at the latest") + AI continuity + "Notes for the agent" scratchpad.
  6. Under-13: chat runs in the parent's session only; system prompt pins the counterparty as the parent; no child free-text collected (server-side rejection of under-13 principals).
  7. Teen tickets: zero-parent-notification banner (except imminent-safety); parents never CC'd.
  8. **No mock data; verified against live source** — answers grounded in the real FAQ corpus; escalation creates real tickets.
  9. Module registered in `src/lib/modules.ts` (Support category).

---

### S5-008 — S3 Support Tickets (full implementation)
- **FR traceability:** FR-SUPPORT-003 · FR-SUPPORT-004 · FR-SUPPORT-005 · FR-SUPPORT-006 (resolved by MD D4)
- **Panel mark:** ✅ with refinements (Round 2 Prop 6)
- **Complexity:** 🟠 Complex
- **Data source:** real tables — `tickets`, `ticket_messages`, `support_agents`, `support_grants`, `ticket_events` — with real RLS policies, real RPCs, real agent console, real user thread UI. Window-aware SLA engine computed from real timestamps.
- **Dependencies:**
  - Technical: S2 handoff (S5-007); migration numbers **deconflicted** (sol-support proposed 028–030; sol-safety assigned 027/028 to trails/events — Tech Lead maintains a single migration registry; §6 R-001)
  - Data: none external
  - Compliance: licensed-attorney sign-off on retention periods (§C.1), redaction rules (§C.3), GIPA breach-runbook scoping (sol-support §E gate 1); agent RBAC review
  - Human: **2 support agents hired**; holiday rotating on-call schedule (MD D4)
- **Blocked by:** migration registry deconfliction; agent hiring; attorney sign-off on retention/redaction
- **Suggested owner:** Tech Lead (schema, RLS, RPCs, SLA engine, redaction filter) → Frontend (user thread UI + agent console)
- **Acceptance criteria:**
  1. Full ticket lifecycle works end-to-end: open (from S2 handoff or manual) → claim/assign → in_progress → resolved → **user-confirmed** closed; auto-close after 5 business days of silence with one-tap reopen ≤30 days; `reopened_count` > 2 flags lead review. All transitions via RPC — direct `UPDATE` on `status` refused.
  2. Window-aware SLA per **FR-SUPPORT-003** (authoritative): 4h within 9 AM–5 PM ET, 7 days/week (11 PM ticket → first response by 1 PM next day). *Open reconciliation item:* sol-support §D.1 proposed P1 4h 24/7 / P2 24h / P3 72h — Tech Lead reconciles with MD; spec wins until then. Safety-adjacent P1 items route to the contracted crisis vendor (MD D1), not the ticket queue. Breach → `sla_breached=true`, lead notified, priority bumped, user sees "We're late — sorry. A lead has been notified."
  3. Teen ticket privacy: explicit zero-parent-notification banner; `teen_privacy` flag enforced **at the API layer** (QA proves a parent session cannot read a teen-owned ticket via direct API call); agents request in-thread consent before viewing grades/health; every agent access audit-logged and teen-visible at Settings → Privacy → "Who's looked at my stuff"; lock-screen-safe push previews (subject only, no PII in bodies).
  4. Agent RBAC (least-privilege): agent sees ticket content + user contact + relevant module context only; `support_grants` flow works (request → consent card to the data owner — the teen for teen-owned data — → 24h TTL, lead-extendable to 72h → per-call `rpc_support_scoped_read` with audit); health/wellbeing/mood/check-in scopes rejected by the grant RPC allowlist; conflict-of-interest (agent related to the family) refused with log; no self-assign on sensitive tickets (P1 / child-authored / crisis-flagged) — lead assignment only.
  5. MD D4 empowerment: agents can issue credits/adjustments up to **$50 in-ticket** without escalation; above $50 routes to Managing Director approval; holiday coverage = rotating on-call (one agent on), reflected honestly in SLA copy.
  6. Status pills (Open → With [name] → Answered → Closed) with timestamps + real presence ("Maya is looking at this now"); no queue numbers; shift-change re-intros.
  7. Redaction filter on ingest: PANs/SSNs/passwords/full bank numbers → `[redacted]`, original bytes never persisted; health details in tickets flagged to the agent and never copied into internal notes; internal notes RLS-separated (never visible to the ticket owner).
  8. **No mock data; verified against live source** — tickets, messages, grants, and audit rows are real.
  9. Module registered in `src/lib/modules.ts` (Support category).

---

### S5-009 — W27 Events (REDESIGNED — panel 🛑 as designed)
- **FR traceability:** FR-MOD-W27 (🛑) · FR-SAFETY-007 · FR-MOD-X03
- **Panel mark:** 🛑 — **do not ship as designed; ship ONLY this redesigned shape**
- **Complexity:** 🟠 Complex
- **Data source:** **municipal public calendars (Cobb Parks & Rec, Marietta city calendar, school district calendars)** as seed sources + real `events` table with curation check constraints (schema from Squad 1 per sol-safety §9.2 — Squad 5 builds the UI + curation workflows on it). Ticket-partner/nonprofit feeds only from verified hosts.
- **Dependencies:**
  - Technical: `events` table + `rpc_get_events` (Squad 1 — schema per sol-safety §9.2: `host_type` enum check constraint, `is_private_residence` exclusion constraint, `age_tag` NOT NULL); Explorer Setup gate trigger (Squad 1); share-my-plan deep link (Squad 1 `outing_plans`)
  - Data: municipal calendar feeds (ingestion job); manual-review queue staffing for nonprofit/verified-host submissions
  - Compliance: published curation policy (in-app, Settings → About → "How events are chosen"); 48h human-review SLA on user reports
  - Human: curation reviewer(s)
- **Blocked by:** Squad 1 events schema + Explorer Setup gate contract
- **Suggested owner:** Tech Lead (ingestion job, report flow, review queue) → Frontend (event cards, filters, policy page)
- **Acceptance criteria:**
  1. 🛑 anti-criteria (QA must fail the build if present): any private-residence or "DM for address" event listed; any 18+/21+ event visible to a <18 account; any event without an age tag; AI-generated event descriptions unlabeled.
  2. Curation policy enforced in SQL: `host_type` ∈ {ticketed_public, municipal, school, nonprofit, verified_host} (check constraint — anything else rejected at insert); `is_private_residence=true` rows rejected (exclusion constraint); QA attempts both inserts — both refused.
  3. Age gating server-side: <18 → 18+/21+ rows **excluded from results** (not shown-locked); <13 → `all_ages` + `family` only; "when in doubt tag up" rule documented and applied.
  4. Every event card renders: age-tag chip, host-type chip ("City of Marietta • municipal"), source link, "share my plan" button, report button. AI summaries labeled "AI summary."
  5. Report flow: `event_reports` → human review SLA 48h → takedown or tag correction → reporter notified of outcome (teen-visible).
  6. Explorer Setup gate triggers on first open for 13–15 (sol-safety §5.1); 16–17 see the lighter version; audience defaults follow §5.3 (13–15: Family/Teen only).
  7. **No mock data; verified against live source** — every event traceable to a municipal/verified feed or manual-review entry.
  8. Module registered in `src/lib/modules.ts` (Travel category).

---

### S5-010 — W29 Trails & Parks (REDESIGNED — panel 🛑 as designed)
- **FR traceability:** FR-MOD-W29 (🛑) · FR-SAFETY-007 · FR-MOD-X03 · FR-MOD-X02
- **Panel mark:** 🛑 — **do not ship as designed; ship ONLY this redesigned shape**
- **Complexity:** 🟠 Complex
- **Data source:** **NPS API + park authority data** (Georgia State Parks, NPS, Cobb County Parks) + real `trails` table (schema from Squad 1 per sol-safety §8.3; `source_verified_at` re-verified quarterly by a stale-trail job). Difficulty/supervision guidance from the seeded `trail_safety_guidance` table — never LLM-invented.
- **Dependencies:**
  - Technical: `trails` + `trail_safety_guidance` tables + `rpc_get_trails` (Squad 1); NWS alert cross-check (S5-003 feed); sunset computation (astronomical calc); Explorer Setup gate (Squad 1); share-my-plan deep link
  - Data: NPS API (keyless); park-authority source verification
  - Compliance: none beyond the safety rules below
  - Human: none
- **Blocked by:** Squad 1 trails schema + Explorer Setup gate contract
- **Suggested owner:** Tech Lead (rules engine, dusk check, stale-trail job) → Frontend (trail cards, plan-save flow)
- **Acceptance criteria:**
  1. 🛑 anti-criteria (QA must fail the build if present): any solo-hike recommendation served to a 13–15 profile; any supervision guidance not traceable to the official rating + `trail_safety_guidance` table; any trail sourced from a blog/scrape/AI guess.
  2. Every trail card shows the fixed-format safety block (source + updated date, official difficulty, "Best with" group-size guidance, supervision line, closes-at/dusk line, [Share my plan →] [Official park page →]) — never omitted, never LLM-generated.
  3. Server-side rules engine: the "solo" filter is hidden for 13–15 (not footnoted); every card for 13–15 carries group-size/supervision guidance; QA proves via direct RPC call that age gating is not UI-only.
  4. Dusk check at plan-save: `return_at` within 90 min of sunset → hard warning for 13–15 (override requires trusted-adult share); soft warning for 16–17.
  5. NWS cross-check: active NWS alert covering the trail area shows the alert banner with official link + timestamp; recommendations suppressed for severe alerts (tornado/wildfire/flood).
  6. "Share my plan" is a first-class step on every plan (voluntary, teen-controlled, per-plan recipient, check-in timers, overdue nudges to the teen-chosen contact, offline-capable plan card).
  7. **No mock data; verified against live source** — every trail row has `source_verified_at` from an official authority.
  8. Module registered in `src/lib/modules.ts` (Travel category).

---

### S5-011 — W31 Rental Cars (REDESIGNED — panel 🛑 as designed)
- **FR traceability:** FR-MOD-W31 (🛑) · FR-TRAVEL-001 · FR-MENU-004
- **Panel mark:** 🛑 — **do not ship as designed; ship ONLY this redesigned shape**
- **Complexity:** 🟠 Complex
- **Data source:** **rental-company age rules as seeded, versioned data** (`rental_age_rules(company, state, min_age, license_requirement, under_25_surcharge)` — verified against published company policies); real quote/ranking computed from the table. Per-state from day one (MD D3).
- **Dependencies:**
  - Technical: `rental_age_rules` table; `modules.ts` registration + FR-MENU-004 menu hiding; route-level + RPC-level age denial
  - Data: rental-company policy verification (published sources)
  - Compliance: none beyond the hard gates below
  - Human: none
- **Blocked by:** rental-company policy verification pass
- **Suggested owner:** Tech Lead (rules engine, server-side gates) → Frontend (planning-mode UI for under-21)
- **Acceptance criteria:**
  1. 🛑 anti-criteria (QA must fail the build if present): module visible or reachable by any teen account (menu, route, or RPC); any booking completable by a <18 account.
  2. Hidden from teen accounts — menu entry, route, and RPC all deny (QA proves with a 16-year-old test account at all three layers).
  3. Hard gate computed as (company minimum age × state × full-license requirement), enforced server-side; under-21 → planning mode only (browse/educate, no transaction path rendered at all).
  4. Under-25 surcharges included in ranked totals — the cheapest-looking option is never a pre-surcharge lie.
  5. No purchase/booking/contract completable by <18, server-side (FR-TRAVEL-001).
  6. **No mock data; verified against live source** — age rules match published company policies; surcharges match published fee tables.
  7. Module registered in `src/lib/modules.ts` (Travel category) with teen-invisible age gating.

---

### S5-012 — W30 Flights (REDESIGNED — panel 🛑 as designed)
- **FR traceability:** FR-MOD-W30 (🛑) · FR-TRAVEL-001 · FR-SAFETY-012 · FR-ACCESS-006 (Sharing toggle)
- **Panel mark:** 🛑 — **do not ship as designed; ship ONLY this redesigned shape**
- **Complexity:** 🔴 Very Complex
- **Data source:** **airline unaccompanied-minor (UM) rules as seeded, versioned data** (`airline_minor_rules(airline, um_age_bands, um_fees, phone_booking_required, id/passport_notes)` — verified against published airline policies); real itinerary records; real Sharing-toggle state. **No live booking engine for minors — the module is rules + visibility + alerts, never teen self-booking.**
- **Dependencies:**
  - Technical: `airline_minor_rules` table; itinerary-visibility Sharing toggle (Platform access model); `court_order_restriction` + custody travel-restriction profile (Squad 1, FR-SAFETY-012); teen travel-purchase alert pipeline (Platform notifications)
  - Data: airline UM policy verification (published sources, re-verified on schedule — policies change)
  - Compliance: purchaser-of-record 18+ is a **server-side invariant**; custody travel-restriction profile honored
  - Human: none
- **Blocked by:** airline UM policy verification; Squad 1 custody-flag contract; Platform Sharing-toggle API
- **Suggested owner:** Tech Lead (rules engine, purchaser invariant, custody profile wiring) → Frontend (itinerary UI, UM guidance, alerts)
- **Acceptance criteria:**
  1. 🛑 anti-criteria (QA must fail the build if present): any flight purchase completable by a <18 account; any itinerary visible without the dedicated Sharing toggle grant; any custody travel-restriction profile ignored.
  2. Purchaser-of-record must be 18+ — enforced server-side; a <18 purchase attempt returns a clean refusal and writes an audit row.
  3. Minor-traveler rules engine: for a given airline + teen age, returns the correct UM band, UM fees, phone-booking routing, and passport/TSA checks — verified against published airline policies on QA spot checks.
  4. Itinerary visibility = dedicated Sharing toggle (not bundled with any other scope); teen travel-purchase alerts fire to parents.
  5. Custody travel-restriction profile: when set, restricted itineraries are blocked/flagged per the profile — verified with a test profile.
  6. **No mock data; verified against live source** — UM rules match published airline policies; itineraries are real records.
  7. Module registered in `src/lib/modules.ts` (Travel category).

---

## 5. Wave 2 handoff contracts

- **From Tech Lead (before Frontend starts):** `BACKEND-CONTRACTS.md` — table schemas, RPC names/signatures (`rpc_get_events`, `rpc_get_trails`, `rpc_open_ticket`, grant RPCs), RLS policy summary per table, migration registry (single source of truth for migration numbers — resolves §6 R-001), env-key list (EIA, OpenChargeMap, listings vendor, NPS).
- **From UX Designer (before Frontend starts):** screen specs + copy deck per module (Nebula theme, plain English, ≤8th-grade, shame-free); Explorer Setup trigger wiring notes; crisis resource block layout; "?" affordance placement map.
- **From QA Engineer (continuous):** acceptance criteria above are the test scripts — QA executes per item and owns the 🛑 anti-criteria fail-closed checks. No item is "done" without QA sign-off against its AC list.
- **Definition of done (every item):** real tables + real endpoints + real UI wired to real data + real RLS + QA sign-off + "No mock data; verified against live source." No TODO comments in shipped code (code-cleanliness rule).

## 6. Risks & open questions

| ID | Risk / question | Impact | Mitigation / owner |
|---|---|---|---|
| R-001 | **Migration number collision:** sol-support proposed 028–030 (tickets/faq/grants); sol-safety assigned 027 (trails) / 028 (events); Squad 1 claims 022–029 | Schema conflicts, failed applies | Tech Lead maintains a single migration registry; no migration applied until numbers are deconflicted. **Managing Director to confirm.** |
| R-002 | Squad 1 owns `trails`/`events` schemas + `rpc_get_trails`/`rpc_get_events`; Squad 5 owns module UI + curation workflows | Ownership seam on S5-009/S5-010 | Recommended split recorded in §3; confirm in Tech-Lead sync before either squad writes schema. |
| R-003 | SLA table conflict: FR-SUPPORT-003 (4h within 9–5 ET 7d, authoritative) vs sol-support §D.1 (P1 4h 24/7, P2 24h, P3 72h, "proposed — justify") | S3 builds to the wrong SLA | FR-SUPPORT-003 wins; Tech Lead reconciles with MD before S5-008 build. |
| R-004 | Explorer Setup gate (Squad 1) late → W27/W29 full launch blocked | S5-009/S5-010 slip | Build UI against the spec'd gate contract; mark the integration point; gate wiring is the last merge before launch. |
| R-005 | Migration 023 (`expires_at`) late → W12 time-boxed grant UI blocked | S5-005 slip | Fallback: manual revoke path (per Squad 4's plan); directory ships first, grant UX follows 023. |
| R-006 | Allergy-list source: Squad 1 `emergency_medical.allergies` vs Squad 2 `health_allergies` | W28 hard-block wiring ambiguity | Recommend Squad 1's list as the hard-block source of truth (never-inferred requirement); Tech-Lead sync to confirm. |
| R-007 | Airline UM policies and rental-company age rules change without notice | Stale rules = wrong guidance to families | `*_verified_at` on every rules row + scheduled re-verification job; UI shows "rules verified {date}". |
| R-008 | Municipal calendar feeds lack stable APIs | W27 seed ingestion fragility | Manual-review queue as the backstop; ingestion job with failure alerting, never silent gaps. |
| R-009 | "Never train" absolute promise (MD D2) cannot publish until DPA verification | S2 disclosure copy must stay honest in the interim | Interim copy: states what S2 does with data today without the absolute promise; promise ships only after Fractional Compliance clears vendor terms. |

**Mehedi decisions still available for override:** D1–D7 are recorded in `docs/MD-DECISIONS.md`; overrides should be recorded there with rationale.

## 7. Never-build list (Squad 5 scope — panel 🛑 shapes)

Unvetted events listing (no curation policy) · solo-hike recommendations for <16 · teen flight self-booking ·
teen rental-car initiation/visibility · driving module without GA DDS rules · hallucinated restaurant listings ·
"allergy-safe" claims · weight-loss framing for <18 · LLM-generated weather · support agents viewing
health/grades without in-thread consent · parent visibility into teen-owned tickets · civilian self-serve
anything in the safety path · AI-training opt-out toggle (nothing to opt out of).

---

*PM sign-off: Product Manager (PMP), Squad 5 — 2026-10-12. No deploy. Branch `staging-build`.*
