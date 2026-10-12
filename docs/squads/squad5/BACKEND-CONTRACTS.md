# Squad 5 — BACKEND-CONTRACTS.md (Wave 2 handoff)

**Squad:** Travel, Marketplace & Support UI · **Author:** Tech Lead / Senior Backend Engineer
**Date:** 2026-10-12 · **Branch:** `staging-build` · **Status:** Wave 1 deliverable — Frontend builds FROM this contract in Wave 2
**Authority:** `docs/BUILD-SPECIFICATION.md`, `docs/solutions/sol-support.md`, `docs/squads/squad5/BACKLOG.md`,
`docs/squads/squad5/NO-PLACEHOLDERS-ADDENDUM.md`, `docs/MD-DECISIONS.md` (D1–D7)

> **Migration freeze (MD, 2026-10-12):** no files may be created/modified in `supabase/migrations/`.
> Anything marked **PENDING** below is fully specified in `docs/squads/squad5/PENDING-MIGRATIONS.md`
> (review-ready SQL, awaiting MD renumbering). Anything marked **REAL** exists in the tree today —
> build against it now. Do not invent endpoints; if it's not here, it doesn't exist.

## 0. Conventions

- **Base URL:** the Next.js app (`/api/...`). All routes require a Supabase JWT (`Authorization: Bearer`),
  except the two marked `anon OK`.
- **Auth model:** RLS is the enforcement layer (NFR-SEC-001). Every route handler MUST create the
  Supabase client with the **request's JWT** (user-scoped), never the service_role key — except the
  cron/admin routes explicitly marked `service_role`.
- **Cookie rule (AGENTS.md, commit 538f288):** in route handlers, never rely on `next/headers`
  `cookies().set()` propagating to a fresh `NextResponse`. Capture `setAll()` cookies into a local
  array and call `response.cookies.set()` explicitly. Reference: `src/app/auth/callback/route.ts`.
- **Age bands:** `support_user_age_band(uuid)` → `'adult' | 'teen' | 'child'` (**REAL**, 033). Parent-role
  users are always `adult`. Missing DOB fails closed to `child`.
- **Error shape:** every error returns `{ "error": "<code>", "message": "<plain-language ≤8th-grade>" }`
  with the HTTP status from the catalog in §9. `message` is user-safe to render.
- **No PII in push/email bodies** (§D.3): notifications carry ticket number + subject only.
- **Money:** amounts are integer **cents** everywhere.

## 1. What exists today (REAL — build against this now)

| Object | Migration | Notes |
|---|---|---|
| `support_agents` | 032 (+033 dup) | Internal staff; no authenticated grants — RPC-only surface |
| `support_tickets` | 032 | Canonical ticket table. Has `teen_privacy`, `sensitive`, `holiday` (D4), `reopened_count`, `sla_due_at`, `sla_breached`, `source`, `closed_at`. Ticket number auto-defaults to `PK-YYYY-NNNN` via `ticket_number_seq` |
| `ticket_events` | 032 | **Canonical thread table** (append-only). `kind` ∈ message, agent_reply, ai_transcript, system_note, internal_note, credit_issued, approval_requested, approval_decided, grant_requested, status_change. `internal=true` rows are agent-only |
| `support_oncall` | 032 | D4 holiday on-call overrides (date → agent) |
| `support_credit_approvals` | 032 | D4: amounts > $50 (5000¢) need admin approval |
| `support_user_age_band()`, `support_is_agent()`, `support_caller_agent_id()` | 033 | Agent checks; deactivation revokes instantly |
| `support_sla_due_at(priority)` | 033 | Window-aware P1 (4 coverage-hours, 9–5 ET, 7d); P2 +24h; P3 +72h |
| `support_business_days_ago(n)` | 033 | Mon–Fri arithmetic for the 5-business-day auto-close |
| `support_tickets` RLS | 033 | Owner select/insert; parent select (non-`teen_privacy` child tickets); agent queue (assigned or open-unassigned); lead all. No UPDATE/DELETE for `authenticated` |
| `ticket_events` RLS | 032 | Owner/parent see non-internal rows on visible tickets; agents see all rows on accessible tickets |
| `access_events` + `log_access_event()` | 021 | **Canonical audit append point.** `child_id` nullable; `event_type` includes all `support.*` types + D4 `support.credit.*` types |
| `support_grants` + `expire_support_grants()` | 034 | 3-scope allowlist (`school.grades.read`, `billing.read`, `sync.status.read`); 72h expiry cap CHECK; health scopes rejected by CHECK |
| `faq_articles`, `faq_feedback`, `faq_article_versions` | 046 | Live-only public read; feedback insert open; writes are service_role-only |

### 1.1 Reconciliation items (MD decision needed — do NOT work around)

| ID | Conflict | Recommendation |
|---|---|---|
| R-A | `ticket_messages` (033) duplicates `ticket_events` (032) as the thread table | **Keep `ticket_events`** (covers D4 credit/grant/status kinds). Drop `ticket_messages`; move its PII-redaction trigger onto `ticket_events`. Pending SQL in PENDING-MIGRATIONS.md Unit P6 |
| R-B | `support_log_event()` (033) duplicates `log_access_event()` (021) and skips adult tickets | **Use `log_access_event()` everywhere** (nullable `child_id`, full event-type list). Make `support_log_event` a thin wrapper or drop it. Pending SQL in Unit P6 |
| R-C | SLA: FR-SUPPORT-003 (authoritative — 4h within 9–5 ET, 7d, first response) vs sol-support §D.1 (P1 4h / P2 24h / P3 72h, "proposed") | `support_sla_due_at()` stays as the implementation; BACKLOG R-003 records FR-SUPPORT-003 as authoritative. First-response SLA = window-aware 4h for all priorities; the P1/P2/P3 resolution targets below are marked proposed |
| R-D | `support_tickets` lacks `resolved_at` / `lead_review` (033's CREATE was a no-op after 032) | Pending Unit P1 adds both columns (`ADD COLUMN IF NOT EXISTS`) |
| R-E | Migration number collisions in tree (030×2, 031×2, 032×3, 033×3, 034×2, 035×2, 047×2) | MD owns the registry (freeze). `APPLY_ORDER.md` is stale — do not trust it |

---

## 2. S3 Support Tickets — endpoints

Thread model: **one append-only table** (`ticket_events`). User messages (`kind='message'`),
agent replies (`kind='agent_reply'`), the S2 transcript (`kind='ai_transcript'`), status changes
(`kind='status_change'`), internal notes (`kind='internal_note'`, agent-only via RLS), and D4
financial events all live here, ordered by `created_at`.

Status machine (enforced in RPC + `support_tickets_transition_guard`):
`open → in_progress → resolved → closed`, with `resolved → in_progress` (reopen) and
`closed → in_progress` (reopen ≤ 30 days). "Resolved" never auto-closes the ticket — only
`rpc_user_confirm_resolution` or the 5-business-day auto-close moves `resolved → closed`.

### 2.1 `POST /api/support/tickets` — open a ticket — **PENDING** (`rpc_open_ticket`)

Auth: user JWT. Under-13 child-role principals are rejected server-side (sol-support C5);
the parent opens in their own session with `child_id` set (on-behalf-of).

Request:
```json
{
  "subject": "Grades stopped updating",
  "category": "school.sync",
  "body": "My Geometry grade has shown the same number for a week...",
  "child_id": "uuid|null",
  "priority": "P2",
  "source": "manual|s2_escalation|faq",
  "ai_transcript": "string|null"
}
```
- `priority` default `"P2"`. `P1` is accepted from users (triage may reprioritize); it marks the
  ticket `sensitive` (lead-assignment only).
- `source='s2_escalation'` requires `ai_transcript` (stored as `kind='ai_transcript'`, collapsed in UI).
- Teen-authored tickets get `teen_privacy=true` automatically → invisible to parent accounts
  at the RLS policy level (FR-SUPPORT-004). Safety-category tickets get `sensitive=true`.

Response `201`:
```json
{ "ticket_id": "uuid", "ticket_number": "PK-2026-0042", "sla_due_at": "2026-10-12T17:00:00Z",
  "status": "open", "teen_privacy": true }
```
Errors: `not_authenticated` 401 · `under13_ticket_denied` 403 · `child_access_denied` 403 ·
`subject_required`/`body_required` 422 · `invalid_priority`/`invalid_source` 422.
RLS notes: INSERT policy pins `user_id = auth.uid()`; the RPC sets everything else server-side.

### 2.2 `GET /api/support/tickets` — list my tickets — **REAL** (PostgREST + RLS)

Auth: user JWT. `GET /rest/v1/support_tickets?select=id,ticket_number,subject,category,status,priority,sla_due_at,sla_breached,teen_privacy,created_at&order=created_at.desc`
RLS returns: own tickets; parents additionally see non-`teen_privacy` tickets on their children;
agents see their queue via the agent-console route below. **Never** expose `assigned_agent_id`
of other agents to users (select an allowlist of columns, as above).

### 2.3 `GET /api/support/tickets/[id]` — ticket + thread — **REAL** (PostgREST + RLS)

- Ticket: `GET /rest/v1/support_tickets?id=eq.<id>&select=<allowlist>` (RLS enforced).
- Thread: `GET /rest/v1/ticket_events?ticket_id=eq.<id>&order=created_at.asc` — RLS excludes
  `internal=true` rows for non-agents. Render `kind='ai_transcript'` collapsed ("📎 Chat transcript").
- The response MUST include the "What can support see?" affordance linking the §B visibility copy.

### 2.4 `POST /api/support/tickets/[id]/messages` — post a message — **PENDING** (`rpc_post_ticket_message`)

Request: `{ "body": "string (1–20000 chars)", "attachments": [{ "name": "string", "size": 1234, "mime": "image/png" }], "internal": false }`
- Attachments: ≤10 MB each (server-enforced); images/PDFs. The PII redaction filter runs on
  ingest (PANs/SSNs/passwords/bank numbers → `[redacted]`, original bytes never stored); health-pattern
  content is flagged to the agent and never copied into internal notes.
- `internal=true` is accepted **only** from agent sessions (writes `kind='internal_note'` +
  `support.internal_note.created` audit). Users passing `internal:true` get it silently forced false.
- A user reply on a `resolved` ticket reopens it (`in_progress`, `reopened_count+1`) — the
  "No, still broken" path. `reopened_count > 2` sets `lead_review` (churn signal).
- Posting on a `closed` ticket → `ticket_closed` (reopen first).

Response `201`: `{ "event_id": "uuid", "kind": "message|agent_reply|internal_note", "created_at": "...", "redacted": false, "health_flagged": false }`
Errors: `ticket_not_found` 404 · `ticket_not_accessible` 403 · `ticket_closed` 409 ·
`attachment_too_large` 413 · `body_too_long` 422.

### 2.5 Resolution handshake — **PENDING**

| Endpoint | RPC | Who | Transition |
|---|---|---|---|
| `POST /api/support/tickets/[id]/confirm` | `rpc_user_confirm_resolution` | ticket owner | `resolved → closed` (sets `closed_at`) |
| `POST /api/support/tickets/[id]/reopen` | `rpc_user_reopen` | ticket owner | `resolved|closed → in_progress` (closed only ≤30d; bumps `reopened_count`) |
| `POST /api/support/agent/tickets/[id]/resolve` | `rpc_agent_mark_resolved` | assigned agent / lead | `in_progress → resolved` (sets `resolved_at`; arms the confirm card — does NOT close) |

Auto-close: `rpc_auto_close_resolved()` (cron/service_role or lead) closes `resolved` tickets silent
for 5 business days, with a system note ("Reopen within 30 days if it's not fixed").
Errors: `confirm_not_allowed` 409 · `reopen_not_allowed` 409 · `invalid_status_transition` 409.

### 2.6 Agent console — **PENDING** (all agent-JWT; `support_is_agent` checked per call)

| Endpoint | RPC | Notes |
|---|---|---|
| `POST /api/support/agent/tickets/[id]/viewed` | `rpc_support_ticket_viewed` | **Must** be called when an agent opens a ticket — writes `support.ticket.viewed`. No silent browsing (§B.3) |
| `POST /api/support/agent/tickets/[id]/claim` | `rpc_claim_ticket` | Refuses on `sensitive` without lead tier (`sensitive_claim_requires_lead` 403); refuses conflict-of-interest — agent family-linked to the ticket's child (`conflict_of_interest` 403, logged); refuses already-claimed (`ticket_already_claimed` 409). Sets `in_progress` + system note |
| `POST /api/support/agent/tickets/[id]/assign` | `rpc_assign_ticket` | Lead/admin only (`lead_required` 403). Body: `{ "agent_id": "uuid" }` |
| `GET /api/support/agent/queue` | PostgREST + RLS | Unassigned `open` tickets + own assigned; filters: status, priority, `sla_breached`, `sla_due_at < now()+2h` (SLA risk), `sensitive`. Lead sees all |
| `GET /api/support/agent/oncall?date=` | `support_oncall` table | D4 holiday rotation; empty date → default alternating-ISO-week rotation in code |

Agent queue list responses MUST NOT include user PII beyond display name + ticket subject.

### 2.7 SLA engine — **REAL** (`support_sla_due_at`, `support_business_days_ago`) + **PENDING** sweep

- `sla_due_at` is set at open from `support_sla_due_at(priority)`: P1 = 4 coverage-hours within
  9 AM–5 PM ET, 7 days/week (holidays included per MD D4 on-call) — an 11 PM P1 is due 1 PM next day.
- **R-C (MD-pending):** FR-SUPPORT-003 is authoritative for first response (4h in-window, all
  priorities). The P1/P2/P3 resolution targets (4h window / 24h / 72h) are sol-support §D.1
  "proposed" until MD reconciles. Build first-response to FR-SUPPORT-003.
- `rpc_support_sla_sweep()` (cron every 15 min, service_role or lead): sets `sla_breached=true`,
  bumps P3→P2, returns `{breached, bumped}`. P1 breach pages the on-call lead (out-of-band).
  The user thread shows the §A.3 red copy ("We're late — sorry. A lead has been notified.").

### 2.8 D4 financial authority — **PENDING** (`rpc_issue_support_credit`, `rpc_decide_credit_approval`)

MD D4: agents may issue credits/adjustments **up to $50 in-ticket**; above $50 needs admin (MD) approval.

- `POST /api/support/agent/tickets/[id]/credit` — body `{ "amount_cents": 2500, "reason": "string 1–280" }`.
  - `amount_cents ≤ 5000`: agent-issued immediately → `ticket_events` row `kind='credit_issued'`
    (visible in thread) + `access_events` `support.credit.issued` with `amount_cents`.
  - `amount_cents > 5000`: creates `support_credit_approvals` row (`pending`) → thread row
    `kind='approval_requested'` + `support.credit.approval_requested`. The agent console shows
    "Waiting on Managing Director approval".
- `POST /api/support/admin/credit-approvals/[id]/decide` — admin only. Body
  `{ "approve": true, "note": "string|null" }` → on approve, writes the `credit_issued` thread row +
  `support.credit.approval_decided` (+`support.credit.issued`).
- Errors: `not_support_agent` 403 · `credit_amount_invalid` 422 (≤0) · `admin_required` 403.

---

## 3. Break-glass support grants — **PENDING** RPCs on the **REAL** `support_grants` table (034)

Least-privilege, teen-approved, 24h TTL (lead-extendable to 72h). Every step writes `access_events`
via `log_access_event()` (021). The `support_grants` rows are retained 3 years as audit evidence (§C.1).

**Scope allowlist (server-side, 034 CHECK):** `school.grades.read` · `billing.read` · `sync.status.read`.
`health.*`, `wellbeing.*`, `mood.*`, `checkin.*` are rejected with the explicit
`health_scope_rejected` error (sol-support C1) — never the generic allowlist error, so misuse is
visible in review. Anything else → `scope_not_allowed`.

**Who consents (sol-support C2):** if the ticket is about a 13+ teen's data, the consent card goes
to the **teen** (child is the access authority) — never the parent. Otherwise the ticket counterparty.
`support_grant_consenter(ticket_id)` resolves this server-side; only that user may approve/deny/revoke.

| Endpoint | RPC | Flow |
|---|---|---|
| `POST /api/support/agent/tickets/[id]/grant-request` | `rpc_request_support_grant` | Agent on an accessible ticket. Body: `{ "scope": "school.grades.read", "purpose": "≤280 chars, user-visible" }`. Guards: allowlist + health-reject + ≤3 requests/day/agent (`grant_rate_limited` 429). Creates `pending` grant (consent window 24h). Returns `{ grant_id, status: "pending", expires_at, consenter_user_id }`. Audit: `support.grant.requested` + `support.consent_card.sent` |
| `POST /api/support/grants/[id]/decision` | `rpc_decide_support_grant` | **Data owner only** (`not_data_owner` 403 otherwise). Body: `{ "approve": true }`. Approve → `active`, `expires_at = now()+24h`. Deny → `denied` (+ `support.grant.denied`; >2 denials/week flags the agent for lead review — agent console surfaces it) |
| `POST /api/support/agent/grants/[id]/extend` | `rpc_extend_support_grant` | Lead only. `{ "hours": 48 }` — max 72h from consent (`extend_cap_exceeded` 422) |
| `POST /api/support/grants/[id]/revoke` | `rpc_revoke_support_grant` | Data owner or lead, anytime. → `revoked` + `support.grant.revoked`. Surfaced in Settings → Privacy → "Support access" |
| `POST /api/support/agent/grants/[id]/read` | `rpc_support_scoped_read` | Agent reads **through** the grant. Checks active grant (right agent/ticket/scope, unexpired) → `no_active_grant` 403 otherwise. Returns `{ ticket_id, scope, accessed_at, data }` and writes `support.grant.data_accessed` **per call** |

**Scoped payload shapes** (`rpc_support_scoped_read`):
- `school.grades.read` → `{ grades: [{ class, term, grade, as_of }] }` (from `grades` ⨝ `classes`; 006/002 — REAL)
- `billing.read` → `{ data_status: "module_not_built", note: "..." }` — **integration point**: no billing
  tables exist yet (Money squad). Grant validation + audit are fully enforced; the payload reader lands
  with the billing tables. The agent console renders "billing detail not yet connected".
- `sync.status.read` → `{ jobs: [...5 latest...], heartbeats: [...] }` (from `sync_jobs`, `sync_heartbeats`; 013 — REAL)

Cron: `expire_support_grants()` (**REAL**, 034, service_role, every 15 min) flips `active`/`pending`
past `expires_at` → `expired` + audit. Post-expiry reads are denied by the active-grant check.

## 4. S1 FAQ — endpoints (**REAL** tables 046; **PENDING** search RPCs + seed)

Corpus: `faq_articles` (046 — REAL, no seed yet). **PENDING** seed: 23-article launch floor
(§A.5.1 coverage: every section ≥1 how-to + ≥1 troubleshooting; 8 legal accordions; all FK ≤ 8.0,
validated by `docs/squads/squad5/work/faq_seed_gen.py`) in PENDING-MIGRATIONS.md Unit P2.
Full ~90-article corpus is content-team owned (BACKLOG S5-001).

- `GET /api/support/faq/search?q=<query>&band=<all|teen|parent>` — **PENDING** `rpc_faq_search`
  (keyword-first: `ts_rank` over `search_vector` + `pg_trgm` typo tolerance on title).
  Until the RPC lands, the route may use PostgREST full-text on `search_vector` — but **age-band
  filtering MUST happen server-side** (046's public-read policy is band-blind; the route filters).
  Response: `{ results: [{ article_id, slug, title, category, score, snippet }], band }`.
  The count of hidden (band-filtered) results is never disclosed.
- Semantic fallback: when keyword returns <3 results or a weak top score, the route embeds the
  query (Workers AI) and calls **PENDING** `rpc_faq_semantic_search(embedding, band)` (pgvector
  cosine). Rendered under a quiet "Related answers" header — no AI-hype copy.
- `GET /api/support/faq/articles/[slug]?band=` — **PENDING** `rpc_faq_get_article`. Returns the
  full article **including** the `LegalAccordion` fields (`legal_note_md`, `legal_citation`,
  `legal_basis`, `legal_reviewed_at`, `legal_review_due_at`, `legal_version`, `legal_stale`).
  Contract rules (§A.5.2): collapsed by default; badge ∈ Required by law / Our choice / Law + our
  choice; `our_choice` MUST show the honesty line; stale accordions show the amber "being
  re-reviewed" banner and are never hidden. Band mismatch → `faq_band_forbidden` 403.
  **No legal accordion goes live without licensed-attorney approval (§E.1).**
- `POST /api/support/faq/feedback` — **PENDING** `rpc_faq_feedback`. Body:
  `{ article_id, helpful: bool, reason?: wrong_answer|out_of_date|too_confusing|did_not_answer, note?: ≤500 }`.
  Until the RPC lands, direct insert per 046's policy is acceptable (band check in route).
- Editorial: **PENDING** `faq_article_versions` trigger — every edit snapshots; legal edits bump
  `legal_version` and restart the 6-month review clock. **PENDING** `rpc_faq_flagged_for_review()`
  (service_role): helpful-rate <60% over 30 days (≥10 responses) → editorial review queue.
- `anon OK` for search and article fetch (band=`all` only).

## 5. S2 AI support chat — integration contract

- `POST /api/support/chat` → **real** `pookie-tutor` Worker (`POOKIE_TUTOR_URL` env; Llama 3.3 70B)
  with the support-scoped system prompt + FAQ-corpus retrieval (S1) + safety middleware
  (Squad 1 crisis protocol — **integration point**: crisis pattern-interrupt per sol-support §A.2
  red box; `crisis_events` audit; crisis-flagged conversations are never human-read at launch).
  If the worker URL is unset → honest "configuration needed" state; escalation to S3 always works.
- **Disclosure (non-dismissible):** header chip "🤖 AI assistant — not a person" + first-run InfoLine
  (can't see grades/health/check-ins; can't delete/export; "A human is one tap away — just say 'human'").
  **D2 gate:** the "never train" claim MUST NOT be user-visible until NFR-PRIVACY-010 (DPA
  verification) is recorded — interim honest copy only.
- **Escalation** → `POST /api/support/tickets` with `source='s2_escalation'` + `ai_transcript`
  (full transcript attached; ticket number issued synchronously; wait-time from live queue data —
  never a fake precise number). Tripwires: confidence <0.60 after FAQ lookup · explicit "human" ·
  3 failed attempts on one intent · crisis language (safety protocol, never the queue alone) ·
  deletion/export requests (info + immediate human ticket).
- Under-13: the chat session rejects under-13 principals server-side (`under13_ticket_denied`);
  the parent is the counterparty; the system prompt pins this.

---

## 6. Travel — server-side gates (**PENDING**) + external integrations

### 6.1 Purchase/booking gates — FR-TRAVEL-001 (server-side, never UI-only)

- `POST /api/travel/purchase/check` — **PENDING** `rpc_travel_purchase_check(user_id, flow)`.
  Body: `{ "flow": "flight" | "rental_car" | "event_ticket" }`. Uses `support_user_age_band()`.
  Response:
  ```json
  { "allowed": false, "reason_code": "minor_purchaser_blocked",
    "message": "Flights need a grown-up to book.", "requires_adult": true }
  ```
  - `child`/`teen` + any flow → `allowed:false`, `reason_code='minor_purchaser_blocked'`.
  - `rental_car` + `teen`/`child` → `reason_code='rental_car_teen_hidden'` (W31 — also invisible, §6.2).
  - Every denied attempt on a real booking path writes an audit row (`log_access_event`,
    `event_type='request_denied'`, metadata `{flow, reason_code}`).
  - **Full minor-traveler rules engine + custody profile** (FR-MOD-W30/FR-SAFETY-012) is a separate
    pending unit owned with Squad 1's custody-flag contract — this gate is the invariant floor.
- `GET /api/travel/modules/[module]/visibility` — **PENDING** `rpc_travel_module_visibility(user_id, module)`.
  `module` ∈ `w25_fuel|w26_weather|w27_events|w28_restaurants|w29_trails|w30_flights|w31_rental_cars`.
  `w31_rental_cars` → `false` for `teen`/`child` (hidden at menu, route, AND RPC — QA proves all
  three layers with a 16-year-old test account). `w30_flights` is visible to all (planning) but
  purchase-gated above. **Menu-wide** age-gating (FR-MENU-004) is Platform Team 1's `modules.ts`
  registry — this RPC is the travel-scoped API-layer enforcement.

### 6.2 External data integrations (route handlers; cache-first)

All travel reads go through **`external_data_cache`** (**PENDING**, Unit P5:
`cache_key PK, source, payload jsonb, fetched_at, ttl_seconds, expires_at` generated,
`rpc_cache_get` / `rpc_cache_put` (service_role) / `rpc_purge_expired_cache()`).
Miss → fetch upstream → `rpc_cache_put` → serve. Upstream failure → honest "unavailable" state,
never synthetic data. **D7: coarse location only** (city/ZIP from the user profile) — no precise
GPS is requested, stored, or transmitted anywhere in Squad 5 code.

| Endpoint | Upstream | Key (env) | TTL | Notes |
|---|---|---|---|---|
| `GET /api/travel/weather?zip=` | NWS `api.weather.gov` (`/points` → `/forecast` + `/alerts/active?point=`) | none — keyless, but send `User-Agent: Pookie/<contact-email>` (NWS requires it) | 15 min (alerts), 1 h (forecast) | Forecasts/alerts are NWS-verbatim; any AI translation links the official alert + timestamp. Always-visible "not an emergency-alert system" disclaimer. <18 safety footer per sol-safety §5 |
| `GET /api/travel/fuel?zip=&fuel_type=` | EIA v2 (`/petroleum/pri/gnd/data/` — retail gasoline) | `EIA_API_KEY` (free, eia.gov/opendata) | 24 h | Per-station prices are NOT in EIA's free series — the endpoint returns area-average prices by PADD/region with an honest "regional average" label; station-level search is marked as a future vendor integration, not faked |
| `GET /api/travel/chargers?zip=` | OpenChargeMap v3 (`/poi/?latitude=&longitude=&maxresults=`) | `OPENCHARGEMAP_API_KEY` (free tier) | 24 h | Real charger POIs; coarse ZIP centroid for the query point |
| `GET /api/travel/trails?...` | NPS API (`developer.nps.gov/api/v1/parks`, `trails` where available) + park-authority data | `NPS_API_KEY` (free, api.data.gov) | 7 d | Trail schemas + `rpc_get_trails` are **Squad 1** (`trails`, `trail_safety_guidance`); Squad 5 builds UI + dusk-check + NWS cross-check on their contract |
| `GET /api/travel/events?...` | Municipal public calendars (Cobb Parks & Rec, Marietta) | none (public) | 1 h | `events` schema + `rpc_get_events` are **Squad 1** (sol-safety §9.2: `host_type` check, `is_private_residence` exclusion, `age_tag` NOT NULL). Squad 5 builds ingestion + curation UI on their contract |
| `GET /api/travel/restaurants?zip=` | **Foursquare Places API** (Tech-Lead decision) | `FOURSQUARE_API_KEY` (free tier) | 6 h | **Decision:** Foursquare free tier over Google Places (pay-per-request). GA DPH inspection scores from the published source; allergen hard-blocks read Squad 1's `emergency_medical.allergies` (never inferred); 21+/bar-primary excluded <18 server-side |

W30 flights data: airline UM rules as seeded versioned data (`airline_minor_rules` — **pending,
with Squad 1's custody-flag contract**); no live booking engine for minors — rules + visibility +
alerts only. W31 rental data: `rental_age_rules(company, state, min_age, license_requirement,
under_25_surcharge)` seeded versioned data (**pending**); under-21 → planning mode only.

## 7. Marketplace

### 7.1 W6 Driving School — **PENDING** (Unit P3)

- `GET /api/marketplace/driving/rules?state=GA` → `driving_rules` reference table (seeded,
  versioned, `verified_at` + `source_url`). GA (verified against dds.georgia.gov 2024–2025 Parent
  Teen Driving Guide): permit at 15 (vision + knowledge exam, $10, 21+ supervisor, no driving
  12:00 AM–5:00 AM); Joshua's Law 30h classroom + 40h supervised (6 at night); Class D at 16+
  (permit held 1 yr + 1 day; no driving midnight–5 AM; passengers: family-only 6 mo, then 1
  non-family <21 for 6 mo, then ≤3 non-family <21); full Class C at 18. FL (verified against
  flhsmv.gov): learner's at 15 (TLSAE course, 21+ supervisor, daylight-only 3 mo then to 10 PM);
  50h supervised (10 at night); Class E at 16 (6 AM–11 PM), 17 (5 AM–1 AM), full at 18.
  Per-state from day one (MD D3); adding a state is a data row.
- `POST /api/marketplace/driving/log` → **PENDING** `rpc_log_driving_hours`
  `{ child_id, drive_date, minutes_total, minutes_night, supervisor_name }` — append-only
  (edits create new versions). Teen or parent of the child may log.
- `GET /api/marketplace/driving/progress?child_id=` → **PENDING** `rpc_driving_hours_progress`
  → `{ total_minutes, night_minutes, total_target, night_target, pct_total, pct_night }`
  computed from real rows against the state's requirement.
- Under-15 accounts: planning mode only (no log UI, no "eligible" language).

### 7.2 W12 Babysitters — schema owned by Squad 4 (Home & Money)

Squad 5 builds the directory UI + "Share for a bit" flow on Squad 4's `babysitters` table and
Platform's time-boxed grant RPCs (FR-ACCESS-011/012, MD D6 tiers: 8/30d trusted, 2/30d first-time).
**Integration point** — build against the spec'd interface; mark with code comment + doc note.
Every profile shows "parent-vetted, not background-checked by Pookie" (no implied vetting).

## 8. Environment variables

| Var | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything | anon key only in the client |
| `SUPABASE_SERVICE_ROLE_KEY` | cron routes (`/api/cron/*`) only | never in the client bundle (NFR-SEC-002) |
| `POOKIE_TUTOR_URL` | S2 chat | unset → honest "configuration needed"; escalation still works |
| `EIA_API_KEY` | W25 fuel prices | free at eia.gov/opendata |
| `OPENCHARGEMAP_API_KEY` | W25 chargers | free tier |
| `NPS_API_KEY` | W29 trails | free at api.data.gov |
| `FOURSQUARE_API_KEY` | W28 restaurants | free tier (Tech-Lead decision §6.2) |

Cron routes (service_role, Vercel/Cloudflare cron): `/api/cron/support/sla-sweep`
(`rpc_support_sla_sweep`), `/api/cron/support/expire-grants` (`expire_support_grants()` —
**REAL**, 034), `/api/cron/support/auto-close` (`rpc_auto_close_resolved` — PENDING),
`/api/cron/cache/purge` (`rpc_purge_expired_cache` — PENDING).

## 9. Error catalog

| Code | HTTP | Meaning |
|---|---|---|
| `not_authenticated` | 401 | no/invalid JWT |
| `not_support_agent` / `lead_required` / `admin_required` | 403 | role-tier failure (checked per call) |
| `under13_ticket_denied` | 403 | under-13 principal tried S2/S3 — parent must open |
| `teen_privacy_denied` | 403 | parent session tried to read a teen-owned ticket |
| `ticket_not_accessible` / `grant_not_found` | 403/404 | wrong owner or wrong agent |
| `sensitive_claim_requires_lead` | 403 | self-assign on P1/teen-authored/safety ticket |
| `conflict_of_interest` | 403 | agent is family-linked to the ticket's child (logged) |
| `health_scope_rejected` | 422 | health/wellbeing/mood/check-in scope requested (C1) |
| `scope_not_allowed` | 422 | scope outside the 034 allowlist |
| `grant_rate_limited` | 429 | >3 grant requests/day/agent |
| `grant_not_pending` / `grant_expired` / `no_active_grant` | 409/410/403 | grant lifecycle guards |
| `not_data_owner` | 403 | non-consenter tried to decide/revoke a grant |
| `extend_requires_lead` / `extend_cap_exceeded` | 403/422 | grant TTL guards |
| `invalid_status_transition` / `confirm_not_allowed` / `reopen_not_allowed` / `ticket_closed` / `ticket_already_claimed` | 409 | ticket state machine |
| `minor_purchaser_blocked` / `rental_car_teen_hidden` | 403 | FR-TRAVEL-001 / W31 gates |
| `module_hidden_for_age_band` | 403 | W31 etc. at the API layer |
| `faq_band_forbidden` / `faq_not_found` | 403/404 | article age-band / missing |
| `attachment_too_large` | 413 | >10 MB |
| `subject_required` / `body_required` / `body_too_long` / `bad_purpose` / `bad_attachments` | 422 | input validation |
| `credit_amount_invalid` | 422 | credit ≤ 0 |
| `service_role_required` | 403 | cron-only RPC called with a user JWT |

---

*End of BACKEND-CONTRACTS.md. Companion: `PENDING-MIGRATIONS.md` (review-ready SQL for every
PENDING item). Open reconciliations: R-A, R-B, R-C, R-D, R-E (§1.1) — MD decision needed.*
