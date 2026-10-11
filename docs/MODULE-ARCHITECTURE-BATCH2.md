# Module Architecture — Batch 2: W5 (College Prep) · W16 (Minutiae) · W22 (Health Tracker) · W23 (Nutrition)

**Owner:** Technical Architect · **Date:** 2026-10-11 · **Status:** SPEC — for DBA + API + frontend + edge/worker implementation
**Source of truth for behavior:** `~/workspace/your_files/app-rename-multi-child-plan/AI-MOTHER-VISION.md` (W5, W16, W22, W23) + `docs/GUIDANCE-FRAMEWORK.md` (age tiers, privacy contract) + vision §5 (compliance metadata).
**Extends:** `docs/MODULE-ARCHITECTURE.md` (batch 1: W1/W20/W21) — same invariants, same conventions; this doc adds, never contradicts.
**Unblocks:** DBA (migrations 009–012), backend (REST routes + Edge Functions), frontend (UI routes), QA (honesty/privacy checklists).

## 0. Invariants (batch 1's §0 stands; batch 2 adds)

1. **REST only** (`/api/v1/...`, canonical envelope via `handleRoute` in `src/server/rest.ts`). No tRPC, no Server Actions as primary (ADR-001/002/004).
2. **Every route: resolve → assert → use → audit.** `assertTenant` / `assertParent` / `assertHousehold` from `src/server/tenant.ts`, plus the new `assertHealthSubject()` (§3.5). 403 on scope violation (never 404 — no confirm/deny); best-effort `auditEvent()`. `audit_event()` requires a real `child_id` — household/health routes pass the anchor child (batch-1 §1.2 pattern).
3. **supabase-js only; `service_role` only in API routes / Edge Functions** — never client, never Server Components (CI greps build output).
4. **RLS is the authorization layer.** Tenant tables: `child_id = ANY (public.current_child_ids())`. Household tables: the `is_household_member` / `is_household_parent` predicates (007/008). Health tables: the `health_metric_visible()` predicate (§3.2) — same funnel shape, no parallel membership system. Explicit GRANTs on every table; `DROP POLICY IF EXISTS` before every `CREATE POLICY`; `CREATE TABLE IF NOT EXISTS`; migrations re-runnable.
5. **No per-table audit triggers.** Route-level `audit_event()` per platform convention (batch-1 §0.5). Batch-2 exceptions, both deliberate and documented: audited *reads* on transcript-release detail and on safety-override grants (§1.1, §3.2) — disclosures get accounting.
6. **Compliance metadata rides with every row** (vision §5): `data_class` (`S`/`T`/`P`) and `retention_class` on every table holding family documents, financial data, health data, or education records. Health rows are `data_class='S'`; college reference data is `'P'`; everything else tenant-scoped defaults `'T'`.
7. **Teen privacy tiers are law** (founder-locked, `docs/GUIDANCE-FRAMEWORK.md` Part 2): 13–17 sensitive = child-confidential by default + audited safety override. No silent parent overrides anywhere in W22/W23. The override's existence and consequence are disclosed to the teen at onboarding and per-use.
8. **Wellness tracking, NEVER diagnosis or dosing** (W22/W23): no diagnostic verbs in any copy, no dosing endpoints exist (the API surface simply has none — architecture, not policy), deterministic phrase blocklist enforced at the API layer, "talk to your doctor" rails on anything clinical.
9. **Demo mode untouched.** `NEXT_PUBLIC_DEMO_MODE` gating lives in `src/lib/demo.ts` / `src/app/demo/route.ts` / login page. New pages check `isDemoMode()` and render static demo data; the demo never calls `/api/v1/*`.
10. **Letters are computed client-side; bands never point probabilities** (W5 honesty rules, §1.4): selectivity stats always render with as-of date + source; no admit-chance percentages, no "guarantee" language — enforced by copy lint, not just intent.

**Scoping rule (applies to every table below):** each table carries `child_id` (per-child things: W5, W16), or `owner_user_id` (household-anchored: W22 subjects, W23 via subjects), or is explicitly global Class-P reference data (W5 college directory). The justification is stated per table. Nothing invents a second membership system.

---

## 1. W5 — College prep pipeline ("Will my child get into a good college?")

Per-child module: the list, the deadlines, the essays, the scores, and the releases all belong to one teen's journey. **Scoping: `child_id` on every tenant table.** The only exceptions are the global reference tables (`colleges`, `college_stats`, `requirement_templates`, `college_aid_programs`) — public Class-P data, no tenant rows, public read.

### 1.1 Data models → migration `009_college_prep.sql`

**`colleges` — global directory (Class P, NOT tenant-scoped).**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text NOT NULL | |
| `city` / `state` | text | |
| `control` | text CHECK `IN ('public','private-nonprofit','private-for-profit')` | |
| `unitid` | text UNIQUE | IPEDS UNITID — the join key for Scorecard/IPEDS refreshes |
| `url` | text | admissions URL |
| `tags` | text[] | e.g. `{'ga-in-state','southeast-regional','pre-med','hbcu'}` — drives the 50-seed groupings |
| `data_class` | text NOT NULL DEFAULT `'P'` | vision §5 labeling |

RLS: public read (`USING (true)`); no client writes (seed + worker only). GRANT SELECT to anon, authenticated. **Seed (in-migration): 50 colleges** — GA in-state (UGA, Georgia Tech, Georgia State, Kennesaw State, Georgia Southern, Augusta University, Mercer, Emory, Spelman, Morehouse, Agnes Scott, Berry, Oglethorpe…), Southeast regional (Auburn, Alabama, Clemson, South Carolina, Tennessee, Florida, FSU, UNC Chapel Hill, NC State, Duke, Vanderbilt, Wake Forest, Ole Miss, LSU, Kentucky…), national pre-med (Johns Hopkins, WashU, Rice, Northwestern, Case Western, Pitt, Baylor, Boston University, Tufts, Emory…cross-listed). Exact 50 enumerated in the seed script; tags make the groupings queryable.

**`college_stats` — selectivity data with honesty built into the schema.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `college_id` | uuid NOT NULL → `colleges(id)` ON DELETE CASCADE | |
| `stat_key` | text NOT NULL | `acceptance_rate`, `sat_math_25/75`, `sat_ebrw_25/75`, `act_25/75`, `avg_net_price`, `grad_rate_6yr`, `test_optional`… new stat = new rows, zero schema change |
| `stat_value` | numeric | |
| `stat_text` | text | for non-numeric (`test_optional='yes-2026'`) |
| `as_of` | date NOT NULL | **every stat cited with as-of — schema-enforced** |
| `source` | text NOT NULL | `'scorecard'`, `'ipeds'`, `'cds'`, `'manual'` |

UNIQUE `(college_id, stat_key)`. RLS: public read; no client writes. GRANT SELECT to anon, authenticated.

**Selectivity-data decision (spec'd, not deferred): v1 seeds statically; live Scorecard calls are a P2 system ETL, never a request-time call.** Rationale: (a) deterministic UI with honest as-of dates on day one; (b) no runtime dependency on a third-party API in the teen-facing path; (c) the iron rule ("no worker runs without a resolved child_id") governs *tenant* data — a nightly `college-stats-refresh` Edge Function touching only public Class-P rows is a system-scope ETL, explicitly carved out here and audited as `actor_kind='worker'`, `child_id=NULL`. It upserts `college_stats` with fresh `as_of`/`source='scorecard'`. The UI **never** calls the Scorecard API live. v1 ships the static seed; the refresh worker is P2 (interface documented in §1.2).

**`college_list` — the teen's list.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | tenant key |
| `college_id` | uuid NOT NULL → colleges | |
| `status` | text NOT NULL DEFAULT `'exploring'` CHECK `IN ('exploring','applying','applied','accepted','denied','waitlisted','enrolled','removed')` | |
| `interest_rank` | smallint | teen's own ranking |
| `notes` | text | |
| `data_class` | text NOT NULL DEFAULT `'T'` | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

UNIQUE `(child_id, college_id)`. RLS: tenant read/write (teen + parent). GRANT SELECT, INSERT, UPDATE, DELETE to authenticated.

**`college_deadlines` — 30/14/7/2-day escalation.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | denormalized tenant key (keeps RLS single-predicate) |
| `college_list_id` | uuid NOT NULL → `college_list(id)` ON DELETE CASCADE | |
| `deadline_type` | text NOT NULL CHECK `IN ('ed','ea','rd','rolling','financial-aid','scholarship','housing','deposit','transcript-request')` | |
| `due_date` | date NOT NULL | the date the college states |
| `status` | text NOT NULL DEFAULT `'open'` CHECK `IN ('open','done','waived')` | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

INDEX `(child_id, due_date) WHERE status='open'` — the proactive engine's query. RLS: tenant read/write. The 30/14/7/2-day reminders are computed by the engine from `due_date` (deterministic code), not stored.

**`requirement_templates` — global checklist starter set (Class P).** `(template_key PK, label, description, applies_to text[] default '{}')`. Seed: `transcript`, `school-profile`, `rec-letter`, `essay-personal`, `essay-supplemental`, `test-scores`, `portfolio`, `interview`, `application-fee`, `fafsa`, `css-profile`. Public read; no client writes.

**`college_requirements` — per-college checklist.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | tenant key |
| `college_list_id` | uuid NOT NULL → `college_list(id)` ON DELETE CASCADE | |
| `template_key` | text → `requirement_templates(template_key)` | |
| `label` | text NOT NULL | denormalized for per-college wording |
| `status` | text NOT NULL DEFAULT `'not-started'` CHECK `IN ('not-started','in-progress','complete','waived','na')` | |
| `detail` | jsonb NOT NULL DEFAULT `'{}'` | e.g. `{"required_count": 2}` for rec letters |
| `completed_at` | timestamptz | |

When a college is added to the list, the route seeds the standard template set as rows (parent/teen then trims). RLS: tenant read/write.

**`essays` + `essay_drafts` + `essay_feedback` — the essay workspace.**

`essays`: `id`, `child_id` (tenant key), `college_list_id` nullable → `college_list` (NULL = personal statement), `prompt` text NOT NULL, `word_limit` int, `status` ('brainstorming','drafting','revising','final'), `created_at`.
`essay_drafts`: `id`, `essay_id` → essays CASCADE, `version` int NOT NULL, `body` text NOT NULL, `word_count` int, `created_by` CHECK `IN ('child','parent')`, `created_at`. UNIQUE `(essay_id, version)`.
`essay_feedback`: `id`, `draft_id` → essay_drafts CASCADE, `child_id` (tenant key, denormalized), `feedback` text NOT NULL, `model` text, `safety_status` text NOT NULL DEFAULT `'pending'` CHECK `IN ('pending','approved','rejected')` — **the write-path gate**: AI feedback is child-facing output; the teen's UI filters `safety_status='approved'` exactly like `study_plans` (batch-1 §1.1). `created_at`.
RLS: tenant read on all three; drafts INSERT by tenant members; feedback rows written by the committee worker via service_role with explicit `child_id`. The teen's drafts are the teen's — a parent can read (intra-tenant trust, per batch-1 convention) but the *authoring* surface is the teen's.

**`recommenders` + `recommender_assignments`.**

`recommenders`: `id`, `child_id` (tenant key), `name` text NOT NULL, `email` text, `relationship` text, `status` CHECK `IN ('identified','asked','agreed','submitted','declined')` DEFAULT `'identified'`, `asked_at`, `submitted_at`, `notes`.
`recommender_assignments`: `id`, `recommender_id` → recommenders CASCADE, `college_list_id` → college_list CASCADE, UNIQUE `(recommender_id, college_list_id)`.
RLS: tenant read/write.

**`test_scores` — manual entry + upload verification. NEVER scraped.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | tenant key |
| `test_type` | text NOT NULL CHECK `IN ('SAT','PSAT','ACT','AP','PLAN','OTHER')` | |
| `test_date` | date | |
| `sections` | jsonb NOT NULL DEFAULT `'{}'` | e.g. `{"math": 720, "ebrw": 680}`; AP: `{"score": 4}` |
| `total` | int | |
| `evidence_path` | text | `<child_uid>/test-scores/<yyyy>/<id>.pdf` in new private bucket `test-score-reports`; path-only |
| `verification_status` | text NOT NULL DEFAULT `'unverified'` CHECK `IN ('unverified','verified','mismatch')` | "you entered X / report says Y" |
| `verified_by` / `verified_at` | uuid → users / timestamptz | who attested the match |
| `superseded_by` | uuid → test_scores(id) | retakes chain; old rows kept (score history matters) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**Hard ban (architecture, not policy): there is no College Board / ACT integration and no code path that fetches scores.** No scraper, no credential flow, no "connect your College Board account" — the vision's blunt reality is encoded by absence. The verification flow is: teen/parent enters scores → uploads the official score-report PDF → a second human (parent for teen-entered, teen for parent-entered) confirms "report says Y" → `verification_status='verified'`. `mismatch` requires a note. RLS: tenant read/write. Storage RLS for `test-score-reports`: path segment 1 = uploader uid; predicate via `is_household_member`-adjacent tenant check (DBA: mirror the `mail-photos` pattern from 008, keyed to the child's tenant).

**`transcript_releases` — parent authorizes per-college/per-document; authority flips at 18.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | tenant key |
| `college_list_id` | uuid → `college_list(id)` ON DELETE SET NULL | per-college |
| `document_type` | text NOT NULL CHECK `IN ('transcript','school-profile','recommendation-packet','other')` | per-document |
| `status` | text NOT NULL DEFAULT `'requested'` CHECK `IN ('requested','authorized','sent','completed','cancelled')` | |
| `authorized_by` | uuid → users | who authorized (parent for minors, student at 18+) |
| `authorized_at` | timestamptz | |
| `sent_at` | timestamptz | |
| `recipient` | text | counselor/school contact the request goes to |
| `data_class` | text NOT NULL DEFAULT `'S'` | education records — vault-grade handling |
| CONSTRAINT `release_authorization_integrity` CHECK (status IN ('authorized','sent','completed') AND authorized_by IS NOT NULL AND authorized_at IS NOT NULL OR status IN ('requested','cancelled')) | | mirrors `dispute_approval_integrity` (008) — "orchestrate, don't push" as a CHECK |

**Authority rule:** under 18 (from `children.date_of_birth`, computed at request time — lazy, no cron): `assertParent` required to authorize. At 18+: the student authorizes their own release (`assertTenant` + caller is the linked user). Every `authorized`/`sent` transition calls `auditEvent(child_id, 'transcript_release.authorized'/'sent', { release_id, college })` — FERPA disclosure accounting (vision §5). Audited *reads*: the detail route (which shows recipient + document) audits `transcript_release.read` — same Class-S exception as mail detail.
RLS: tenant read; INSERT/UPDATE gated by the authority rule in the route (RLS allows tenant write; the route enforces who).

**`college_gpa_scenarios` — saved what-if runs (the simulator itself is compute, §1.2).**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | tenant key |
| `name` | text NOT NULL | e.g. "Geometry to 90, Gov to 85" |
| `assumptions` | jsonb NOT NULL | `{"<class_id>": <hypothetical_numeric>, ...}` |
| `result_gpa` | numeric(4,3) | snapshot of the computed result |
| `created_by` | uuid → users | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

RLS: tenant read/write.

**`college_aid_programs` — global aid reference (Class P).** `(program_key PK, name, state, summary, eligibility_url, as_of date)`. Seed: `hope` (Georgia HOPE Scholarship), `zell-miller` (Georgia Zell Miller Scholarship) with summaries + links + as-of. Public read; no client writes. (Eligibility *evaluation* against the teen's GPA is a P2 rules engine; v1 is the reference + links.)

### 1.2 W5 API contracts

Base `/api/v1/children/[childId]/college/...`. Every route: `handleRoute` → `assertTenant(childId)` (or `assertParent` where noted) → use → `auditEvent(childId, ...)`.

| Method + path | Request (Zod sketch) | Response `data` | Assertion | Notes |
|---|---|---|---|---|
| `GET .../college/list` | query `{ status? }` | `{ entries: [{ list_id, college: {...}, stats: [{stat_key, value, as_of, source}], deadlines_open, requirements_done, requirements_total }] }` | `assertTenant` | Stats always include `as_of`+`source`. Readiness dashboard payload. |
| `POST .../college/list` | `{ college_id: uuid, status?, interest_rank? }` | `{ entry }` | `assertTenant` | Seeds standard `college_requirements` rows from templates in the same transaction. Audits `college_list.added`. |
| `PATCH .../college/list/[listId]` | `{ status?, interest_rank?, notes? }` | `{ entry }` | `assertTenant` | Forward-only-ish: `removed` is terminal-ish (re-adding creates a new row). Audits on status change. |
| `GET .../college/list/[listId]` | — | `{ entry, college, stats, deadlines, requirements, essays, recommenders, releases }` | `assertTenant` | The per-college command center. |
| `GET/POST .../college/list/[listId]/deadlines` | POST: `{ deadline_type, due_date: date, }` | `{ deadlines }` / `{ deadline }` | `assertTenant` | |
| `PATCH .../college/deadlines/[deadlineId]` | `{ status?, due_date? }` | `{ deadline }` | `assertTenant` | Audits `college_deadline.completed`. |
| `GET/PATCH .../college/list/[listId]/requirements` | PATCH: `{ requirement_id, status }` | `{ requirements }` | `assertTenant` | Checklist toggles. |
| `GET/POST .../college/essays` | POST: `{ college_list_id: uuid.nullable(), prompt, word_limit? }` | `{ essays }` / `{ essay }` | `assertTenant` | |
| `POST .../college/essays/[essayId]/drafts` | `{ body: min(1).max(20000) }` | `{ draft }` (auto-increment `version`) | `assertTenant` | `created_by` = caller role. |
| `POST .../college/drafts/[draftId]/feedback` | `{ }` (queues AI feedback) | `{ accepted: true }` | `assertTenant` | Enqueues the committee worker; feedback row lands `safety_status='pending'`. Teen UI never renders pending rows. |
| `GET .../college/essays/[essayId]` | — | `{ essay, drafts, feedback: [...] }` | `assertTenant` | Route filters feedback to `approved` for child-role callers (defense in depth over RLS). |
| `GET/POST .../college/recommenders` | POST: `{ name: min(1), email?: email, relationship? }` | `{ recommenders }` | `assertTenant` | |
| `POST .../college/recommenders/[recId]/assign` | `{ college_list_id: uuid }` | `{ assignment }` | `assertTenant` | |
| `PATCH .../college/recommenders/[recId]` | `{ status, submitted_at? }` | `{ recommender }` | `assertTenant` | |
| `GET/POST .../college/test-scores` | POST: `{ test_type, test_date?, sections: record, total?, evidence_path? }` | `{ scores }` / `{ score }` (`verification_status='unverified'`) | `assertTenant` | Upload goes through a signed-upload route first (service_role mints the URL; pattern from mail `POST /items`). |
| `POST .../college/test-scores/[scoreId]/verify` | `{ attested_total, attested_sections, match: boolean, note? }` | `{ score }` (`verified`/`mismatch`) | `assertTenant` + attester ≠ original enterer (route-enforced second pair of eyes) | Audits `test_score.verified`. |
| `GET/POST .../college/releases` | POST: `{ college_list_id, document_type, recipient }` | `{ releases }` / `{ release }` (`status='requested'`) | `assertTenant` | Anyone in the tenant may *request*. |
| `POST .../college/releases/[releaseId]/authorize` | `{ }` | `{ release }` (`status='authorized'`, `authorized_by/at`) | **Authority rule** (§1.1): `assertParent` if under 18; student-self if 18+ | CHECK constraint backs it. Audits `transcript_release.authorized` (disclosure accounting). |
| `POST .../college/releases/[releaseId]/send` | — | `{ release }` (`status='sent'`, `sent_at`) | same authority rule | Requires `authorized` (409 otherwise). v1: produces the counselor-request artifact via the teacher-comms approval UX (reused, per vision) — the school sends; we orchestrate. Audits `transcript_release.sent`. |
| `POST .../college/gpa-simulate` | `{ assumptions: z.record(z.string().uuid(), z.number().min(0).max(110)), save_as?: z.string().max(80) }` | `{ current_gpa, scenario_gpa, deltas: [{class_id, from, to}], band_note }` | `assertTenant` | **W5→W1 seam** (§5.1): reads W1 `grades` + `classes.grade_weights` via RPC `simulate_gpa`. Unweighted 4.0 via `letterGrade()` bands (client util, batch-1 §0.6). `save_as` persists to `college_gpa_scenarios`. |
| `GET .../college/aid-programs` | — | `{ programs: [...] }` | `assertTenant` | HOPE/Zell Miller reference. |

**New RPC (DBA, in 009):** `simulate_gpa(p_child_id uuid, p_assumptions jsonb)` RETURNS `{current_gpa, scenario_gpa, deltas jsonb}` — `SECURITY DEFINER`, asserts `p_child_id = ANY (public.current_child_ids())`, reads `grades` + `classes.grade_weights` (W1 tables), computes unweighted 4.0 GPA from numeric bands. The route calls it; the route never hand-rolls grade math (single implementation, tested once).

### 1.3 W5 UI routes

| Route | Placement rationale |
|---|---|
| `/c/[childSlug]/college` | Child-scoped. List manager: cards per college with stats (as-of cited), readiness %, next deadline. The 9th→12th roadmap surface. |
| `/c/[childSlug]/college/[listId]` | Per-college command center: deadlines timeline, requirements checklist, essays, recommenders, releases. |
| `/c/[childSlug]/college/gpa` | GPA simulator: current trajectory (W1 grades) + what-if sliders → "path to X GPA". Mission-framed (gap-to-goal, not judgment). |
| `/c/[childSlug]/college/tests` | Test scores: manual entry, upload, verification status. Explicit "we never pull from College Board/ACT" explainer. |

**Age gating:** per `GUIDANCE-FRAMEWORK.md`, college/career framing is the 16+ "launch tier" for the teen surface; the parent surface is ungated. Implementation: the teen-role view of `/college` shows the roadmap + list; AI-generated strategy content (committee) is 16+ only (route filters; under-16 teen sees parent-authored content + static reference). Dawson (15) → parent-driven planning surface now, teen strategy unlocks at 16.

### 1.4 Honesty rules (non-negotiable — QA checklist)

1. **Bands never point probabilities.** Selectivity renders as 25th–75th bands with as-of + source. No admit-chance %, no "safety/match/reach" computed as probabilities. (The words safety/match/reach may appear only as the *family's own* labels on their list, never as model output.)
2. **Every stat cited with as-of date + source.** The schema forces it (`as_of NOT NULL`, `source NOT NULL`); the UI renders it next to the number. No exceptions.
3. **No "guarantee" language.** Copy lint blocklist (deterministic, CI-checkable on the college surfaces): `guarantee*`, `assured admiss*`, `*% chance`, `will get in`, `shoo-in`, `lock`. Reviewer: Claude safety pass on committee-generated college content.
4. **Test-optional honesty:** `test_optional` stat carries its as-of; UI notes "policies change — verify on the college site" with the college URL.
5. **GPA simulator honesty:** labels the result "unweighted estimate from current ParentVUE grades" + "weighted GPA rules vary by school — this is directional."

---

## 2. W16 — School minutiae calendar ("Did I miss picture day?")

Per-child: picture day belongs to Dawson's calendar, not the family's. **Scoping: `child_id`.** Fed by the school-comms email extractor (W1's pipeline — §5.4).

### 2.1 Data models → migration `010_school_minutiae.sql`

**`school_events` — the dated task with owner + deadline + prep.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `child_id` | uuid NOT NULL → children CASCADE | tenant key — per-child view |
| `title` | text NOT NULL | e.g. "Picture Day — wear your best smile" |
| `event_date` | date NOT NULL | the day it happens |
| `kind` | text NOT NULL CHECK `IN ('picture-day','permission-slip','spirit-week','field-trip','book-fair','early-release','fundraiser','teacher-birthday','other')` | drives lead-time defaults |
| `detail` | text | extracted context (cost, theme, what to bring) |
| `owner` | text NOT NULL DEFAULT `'parent'` CHECK `IN ('parent','child')` | who does the prep |
| `prep_instructions` | text | "lay out the good shirt Wednesday night" |
| `prep_lead_hours` | int NOT NULL | lead-time reasoning, set by extractor or default map |
| `prep_deadline` | timestamptz NOT NULL | computed: `event_date - prep_lead_hours` (route computes; stored for the engine's query) |
| `reminder_at` | timestamptz | escalation reminder (default = `prep_deadline`) |
| `reminder_sent` | boolean NOT NULL DEFAULT false | |
| `acknowledged_at` / `acknowledged_by` | timestamptz / uuid → users | escalation stops on ack |
| `source` | text NOT NULL DEFAULT `'manual'` CHECK `IN ('extractor','manual')` | |
| `source_kind` | text | e.g. `'school-email'` |
| `source_message_id` | uuid | **claim column** — FK to the school-comms ingestion table, added by that pipeline's migration (see §5.4 / Q5) |
| `dedupe_key` | text NOT NULL | `child_id | normalized(title) | event_date` — five emails about picture day → one task |
| `status` | text NOT NULL DEFAULT `'upcoming'` CHECK `IN ('upcoming','done','missed','cancelled')` | |
| `data_class` | text NOT NULL DEFAULT `'T'` | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

UNIQUE `(child_id, dedupe_key)`. INDEX `(child_id, event_date)`; INDEX `(status, reminder_at) WHERE status='upcoming' AND reminder_sent=false` — the engine's escalation query.
RLS: tenant read; INSERT/UPDATE/DELETE by tenant members (parents manage; the child-role may ack + complete `owner='child'` rows — route-enforced). Extractor writes via service_role with explicit `child_id`.

**Lead-time defaults (deterministic map, code not schema):** `permission-slip → 14h` ("sign it tonight"), `picture-day → 12h`, `spirit-week → 72h` (costume check), `field-trip → 48h`, `book-fair → 24h`, `fundraiser → 168h`, `early-release → 12h` (pickup plan), `teacher-birthday → 48h`, `other → 24h`. The extractor may override per-email ("permission slip due Friday — sign it tonight" → 14h from a Thursday email). Escalation: `reminder_at` passes + unacknowledged → proactive-engine nudge (engine reads the index above; no new infra).

### 2.2 W16 API contracts

Base `/api/v1/children/[childId]/school/events/...`. Every route: `handleRoute` → `assertTenant(childId)` → use → `auditEvent(childId, ...)`.

| Method + path | Request (Zod sketch) | Response `data` | Notes |
|---|---|---|---|
| `GET .../school/events?from=&to=&kind=` | query filters | `{ events: [...] }` ordered by `event_date` | The per-child minutiae view. |
| `POST .../school/events` | `{ title: min(1).max(200), event_date: date, kind, detail?, owner?, prep_lead_hours? }` | `{ event }` (`prep_deadline` computed server-side; `dedupe_key` computed) | Manual add. Audits `school_event.created`. |
| `PATCH .../school/events/[eventId]` | `{ title?, event_date?, kind?, detail?, owner?, prep_lead_hours?, status? }` | `{ event }` | Recomputes `prep_deadline` when date/kind/lead changes. |
| `POST .../school/events/[eventId]/acknowledge` | `{ }` | `{ event }` (`acknowledged_at/by`) | Child-role allowed on own rows — stops escalation. Audits `school_event.acknowledged`. |
| `DELETE .../school/events/[eventId]` | — | `{ deleted: true }` | Parent-only (route `assertParent`). Manual-row cleanup; extractor rows are re-created on next run if the email persists (documented). |

**Extractor (Edge Function `school-event-extractor`, P2 with the comms pipeline):** input `{ message_id, child_id, subject, body, received_at }` (service_role, explicit `child_id`); deterministic + LLM hybrid — LLM proposes `{title, event_date, kind, detail, prep_instructions, prep_lead_hours}`, deterministic code verifies `event_date` appears in/plausibly derives from the text and clamps `prep_lead_hours` to the kind map ± override; INSERT … `ON CONFLICT (child_id, dedupe_key) DO NOTHING`; audits `actor_kind='worker'`. Handwriting/OCR'd PDFs: same `handwriting_flag` honesty as mail-ocr — low confidence → `status='upcoming'` + `detail` flagged "verify against the flyer", never a fabricated date.

### 2.3 W16 UI route

**`/c/[childSlug]/school/events`** — per-child minutiae view: upcoming timeline grouped by week, each card showing owner chip + prep deadline + acknowledge CTA. (Placed under `/school/` — it is school data, child-scoped; a household rollup across children is future, noted in §7 Q5-adjacent.)

---

## 3. W22 — Exercise & health tracker ("Are we actually healthy?")

### 3.1 THE DECISION — why this does not follow the batch-1 patterns verbatim

Batch 1 gave two scoping patterns: `child_id` (per-child things: W1) and `owner_user_id`-anchored household things with no `child_id` (W20/W21). **Health metrics fit neither exactly: they belong to *people* — including adults who are not children** (an adult's blood pressure shared with a spouse but not the kids; a teen's sleep private from everyone).

**Decision: introduce `health_subjects` — a minimal person registry keyed to the household anchor.** This is NOT a second membership system, and the distinction matters:

- **What it is:** a person roster per household: `owner_user_id` (the same household anchor as W20/W21) + `subject_id`, with optional links to `users(id)` (when the person has a login) and `children(id)` (for child tenants). No roles, no grants, no access semantics — it answers "whose body is this?" not "who may see it?"
- **Why not `child_id`:** metrics for a spouse/parent have no child row; forcing one would corrupt the tenant model.
- **Why not `owner_user_id` alone:** one flat bucket per household cannot express per-person privacy ("my BP is shared with my spouse, not the kids") — and per-person privacy *is the product* (vision: "The privacy model is the product, not the plumbing").
- **Why not a `households`/`family_members` membership table:** that would duplicate `child_access` as a membership source of truth (batch-1 §2.1 rejected exactly this). `health_subjects` carries zero authorization semantics; **all access still funnels through `current_child_ids()` → `household_owner_for_child()`** — the same single funnel as every batch-1 policy. Authorization lives in `health_visibility` (per-metric sharing rules) + the `health_metric_visible()` predicate, not in the roster.
- **The vision's iron rule survives:** workers resolve `child_id` (or the subject's linked child) → owner → subject. `audit_event()` gets the anchor child (linked child when present, else the `assertHousehold()` anchor — batch-1 §1.2 pattern).

**W22 is the data layer; W2 is the interpretation — the seam (§5.2):** W22 stores normalized readings (`health_metrics`) + sources + visibility. W2 (its own future migration) reads through the visibility predicate and writes *interpretation* (baselines, anomaly flags, visit agendas, conditions, medications, immunizations) to its own tables. **Contract: W22 never writes interpretation; W2 never writes raw metrics.** They share only `metric_defs` and the visibility predicate.

### 3.2 Data models → migration `011_health_tracker.sql`

**`health_subjects` — the person roster.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | the `subject_id` everything keys to |
| `owner_user_id` | uuid NOT NULL → `users(id)` ON DELETE CASCADE | **household anchor** (same anchor as W20/W21) |
| `user_id` | uuid → `users(id)` ON DELETE SET NULL | when the person has a login; NULL for pre-login persons (Q1) |
| `child_id` | uuid → `children(id)` ON DELETE SET NULL | link for child tenants; UNIQUE where not null |
| `display_name` | text NOT NULL | |
| `date_of_birth` | date | canonical for age-banding (falls back to `children.date_of_birth` when linked) |
| `relationship` | text CHECK `IN ('self','spouse','child','parent','other')` | relative to the owner |
| `data_class` | text NOT NULL DEFAULT `'S'` | health = Class S |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

UNIQUE `(owner_user_id, user_id)` WHERE `user_id IS NOT NULL`. RLS: SELECT via `is_household_member(owner_user_id)`; INSERT/UPDATE parent-only (`is_household_parent`); no DELETE (offboard via `active=false` — add the column; ledger-like).

**`metric_defs` — global metric registry (Class P). New metric = new rows, zero schema change** (same pattern as W2's `condition_metric_defs`).

| column | type | notes |
|---|---|---|
| `metric_key` | text PK | `steps`, `sleep_hours`, `resting_hr`, `hrv_ms`, `bp_systolic`, `bp_diastolic`, `glucose_mgdl`, `weight_kg`, `active_minutes`, `active_calories`, `workouts` |
| `display_name` / `unit` | text | |
| `category` | text NOT NULL CHECK `IN ('activity','sleep','cardio','metabolic','body')` | visibility + UI grouping |
| `default_sensitivity` | text NOT NULL CHECK `IN ('general','sensitive')` | `activity→general`; `sleep/cardio/metabolic/body→sensitive` |
| `min_value` / `max_value` | numeric | physiological plausibility clamps (route-validated; e.g. `glucose_mgdl` 20–1000) |

Public read; no client writes. Seed in-migration.

**`health_metrics` — normalized readings. The data layer.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects(id)` ON DELETE CASCADE | **whose body** |
| `metric_key` | text NOT NULL → `metric_defs(metric_key)` | |
| `value` | numeric NOT NULL | plausibility-clamped at the route against `metric_defs` |
| `recorded_at` | timestamptz NOT NULL | when the body did it (not when we stored it) |
| `source` | text NOT NULL CHECK `IN ('healthkit','health-connect','dexcom','manual','omron-bridge','withings-bridge','export-import')` | |
| `device_ref` | text | opaque device/source identifier, never PII |
| `data_class` | text NOT NULL DEFAULT `'S'` | |
| `retention_class` | text NOT NULL DEFAULT `'health13m'` | 13-month rolling retention (Q8) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

INDEX `(subject_id, metric_key, recorded_at DESC)`; INDEX `(subject_id, recorded_at DESC)`.
**Resolution cap (schema-adjacent policy, enforced in the ingest function):** per-minute rollups maximum; sub-minute sensor streams are aggregated on-device/by the worker before insert. Raw waveforms never stored.
RLS: SELECT via `public.health_metric_visible(subject_id, metric_key)` (defined below); INSERT: subject-self (`health_subjects.user_id = auth.uid()`) or household parent (for under-13 / assisted entry) — route asserts; **no UPDATE, no DELETE** (append-only; corrections are new rows). GRANT SELECT, INSERT to authenticated.

**Visibility predicate (the privacy model, in SQL):**

```sql
-- DBA implements in 011. Resolution order per (subject, metric):
--   1. metric-level health_visibility row → its visible_to
--   2. category-level row → its visible_to
--   3. age-band default: under-13 → 'family'; 13–17 → activity 'family',
--      sleep/cardio/metabolic/body 'private'; 18+ → 'private'
-- Caller may read iff: caller IS the subject (user_id = auth.uid()),
--   OR (household member AND effective visible_to IN ('family')
--       OR (is_household_parent AND visible_to IN ('family','parents'))),
--   OR an active health_share_grants row covers (subject, scope),
--   OR an active health_access_overrides row covers (subject, scope).
CREATE OR REPLACE FUNCTION public.health_metric_visible(p_subject_id uuid, p_metric_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ ... $$;
```

**`health_visibility` — per-metric, per-person sharing controls.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects` CASCADE | |
| `scope` | text NOT NULL CHECK `IN ('category','metric')` | |
| `scope_key` | text NOT NULL | category name or `metric_key` |
| `visible_to` | text NOT NULL CHECK `IN ('private','parents','family')` | |
| `set_by` | uuid → `users(id)` | subject or parent |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

UNIQUE `(subject_id, scope, scope_key)`. RLS: SELECT via household membership; INSERT/UPDATE: the subject themselves, or a parent (for under-13; for 13–17 a parent may only *widen* toward the teen, never silently narrow — route rule; narrowing a teen's sharing is the teen's action). No DELETE (revocation = set `visible_to='private'` — auditable).

**`health_share_grants` — the teen shares with parents (grant, revocable).**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects` CASCADE | |
| `scope` / `scope_key` | text | same semantics as visibility |
| `granted_to` | text NOT NULL DEFAULT `'parents'` CHECK `IN ('parents','family')` | |
| `granted_by` | uuid → `users(id)` | the subject |
| `expires_at` | timestamptz | NULL = until revoked |
| `revoked_at` | timestamptz | revocation is a timestamp, never a delete |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

RLS: subject-self write; household read. The vision's W22 example lives here: "a teen's glucose readings parent-visible (diabetes care is a family affair) while sleep stays private" = a grant on `metabolic/glucose_mgdl`, no grant on `sleep`.

**`health_access_overrides` — the audited safety override. No silent overrides.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects` CASCADE | |
| `scope` / `scope_key` | text | minimum-necessary: narrowest scope that answers the concern |
| `granted_by` | uuid NOT NULL → `users(id)` | the parent invoking it |
| `reason` | text NOT NULL CHECK (char_length(reason) >= 20) | schema-enforced seriousness |
| `expires_at` | timestamptz NOT NULL | short-lived by convention (default 72h, route-set) |
| `revoked_at` | timestamptz | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

RLS: parent-only INSERT/SELECT (`is_household_parent` on the subject's owner); no UPDATE (revoke = `revoked_at`); no DELETE. **Route contract (not just RLS):** creating an override in the same transaction (a) inserts a `health_notifications` row to the teen ("a safety override was used on [scope] — reason recorded"), and (b) calls `auditEvent(anchorChildId, 'health_override.granted', { subject_id, scope, reason_hash })` — never the reason text or values (audit secret-guard). The `health_metric_visible()` predicate honors active (unexpired, unrevoked) overrides. **Audited reads:** any parent read served *through* an override is logged (`health_override.read`) — disclosures get accounting, same as mail detail.

**`health_notifications` — the disclosure surface.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects` CASCADE | recipient |
| `kind` | text NOT NULL CHECK `IN ('override_granted','override_expired','share_revoked','sync_paused','grant_used')` | |
| `title` / `body` | text NOT NULL | plain language, disclosed at onboarding what these mean |
| `read_at` | timestamptz | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

RLS: recipient-self read (subject's `user_id = auth.uid()`); system/parent-route write. This is where "paused by [child]" (W2 consent pattern) and override disclosures land.

**`health_sources` — connected sources per subject.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects` CASCADE | |
| `provider` | text NOT NULL CHECK `IN ('healthkit','health-connect','dexcom','omron-bridge','withings-bridge','manual')` | |
| `status` | text NOT NULL DEFAULT `'connected'` CHECK `IN ('connected','disconnected','error')` | |
| `last_sync_at` | timestamptz | |
| `vault_ref` | text | **opaque reference to the credential Vault entry (Dexcom OAuth tokens live in the Vault, NEVER here)** |
| `config` | jsonb NOT NULL DEFAULT `'{}'` | non-secret config only |
| UNIQUE `(subject_id, provider)` | | |

RLS: household read; subject-self or parent write. No secrets in this table — DBA adds a CI grep for `token|secret|refresh` in 011 as a tripwire (defense in depth).

### 3.3 Ingest paths (honest integration reality)

| Source | Path | Status |
|---|---|---|
| HealthKit / Health Connect | Companion app holds the OS entitlement, normalizes on-device, **pushes** to Edge Function `ingest-health-metrics` (JWT verified, subject asserted from `sub` → `user_id` → `health_subjects`; service_role write with explicit `subject_id`; per-minute rollup cap enforced) | Build now (vision: proven in founder's stack) |
| Dexcom | **Real API.** Edge Functions `dexcom-oauth` (authorize/callback; tokens → Vault, `vault_ref` stored) + `dexcom-sync` worker (resolved subject, pulls readings → `ingest-health-metrics` internal) | Build now |
| BP cuffs (Omron/Withings) | Vendor-app bridges second; **manual entry v1** (API route, subject or parent) | Manual now, bridges P2 — "don't pretend otherwise" |
| Libre / Accu-Chek | **Manual entry + export-file import v1** (LibreView is partner-gated — say so in UI; Accu-Chek limited API + export) | Manual now; partnerships aspirational |

**`ingest-health-metrics` contract:** `{ subject_id, readings: [{metric_key, value, recorded_at, source}] }` — asserts JWT `sub` maps to the subject (or a parent of an under-13 subject); clamps values against `metric_defs`; drops sub-minute duplicates; writes via service_role; audits `actor_kind='worker'`. This is also the W2 wearable pipeline's entry point (vision W2 describes exactly this shape).

### 3.4 Regulatory guardrails — wellness tracking, NEVER diagnosis or dosing

These are architecture, not copy guidelines:

1. **No diagnostic endpoints exist.** The API surface has no route that returns a condition, a diagnosis, or a dose. There is no `assess`/`diagnose`/`dose` route to misuse — the capability is absent by design. If the product ever wants it: new module, new counsel, new FDA conversation (vision's line, adopted verbatim).
2. **Deterministic phrase blocklist** enforced in API responses carrying AI-generated health text (route-level check, CI-tested): `diagnos*`, `you have *`, `take *mg`, `increase your * dose`, `your * means you`, `normal for your age` (population comparisons are banned by the guidance framework). Violations → 500 + alert, never render.
3. **Trends-only framing:** nudges are deltas vs. the subject's own baseline ("resting HR up 8 bpm vs your 30-day baseline — worth mentioning at your checkup?"), never population shaming, never conclusions.
4. **Class-S routing:** raw health values are Class S — AI summarization runs on the self-hosted model only (vision §2.3); commercial models see aggregates or nothing. Child-facing health text goes through the `safety_status` write-path gate on W2's interpretation tables.
5. **Disclaimer copy** on every health surface (UI + API `meta.disclaimer`): "Wellness tracking only — not medical advice. Talk to your doctor about any concern."

### 3.5 W22 API contracts

New helper in `src/server/tenant.ts` (append-only — no signature changes, no conflict with the demo agent's work):

```ts
// assertHealthSubject(subjectId): resolves the subject, asserts the caller
// may see it (subject-self OR household member), and returns
// { ownerUserId, subject, isSelf, isParent, ageBand, anchorChildId }.
// ageBand ∈ {'under-13','13-17','18+'} from date_of_birth (subject or linked child).
// anchorChildId = linked child_id ?? assertHousehold().anchorChildId —
// what auditEvent() receives.
export async function assertHealthSubject(subjectId: string): Promise<HealthSubjectContext>
```

Base `/api/v1/health/...`. Every route: `handleRoute` → `assertHealthSubject(subjectId)` → **visibility check** (route re-checks `health_metric_visible()` for the requested metric/category — defense in depth over RLS) → use → `auditEvent(anchorChildId, ...)`.

| Method + path | Request (Zod sketch) | Response `data` | Notes |
|---|---|---|---|
| `GET .../health/subjects` | — | `{ subjects: [{subject_id, display_name, relationship, age_band, linked_child_slug?}] }` | Household roster. `assertHousehold()`. |
| `POST .../health/subjects` | `{ display_name: min(1), date_of_birth?: date, relationship, user_id?: uuid, child_id?: uuid }` | `{ subject }` | Parent-only. One row per person. Audits `health_subject.created`. |
| `GET .../health/subjects/[subjectId]/metrics?metric=&from=&to=&rollup=` | query filters | `{ readings: [...] }` | **Visibility-filtered**: RLS + route check; a parent requesting a teen-private metric gets 403 `HEALTH_VISIBILITY_DENIED` (never 404). `meta.disclaimer` on every response. |
| `POST .../health/subjects/[subjectId]/metrics` | `{ metric_key, value: number, recorded_at, source: 'manual' }` | `{ reading }` | Manual entry (subject-self or parent). Value clamped vs `metric_defs`. Audits `health_metric.manual_entry`. |
| `GET/PUT .../health/subjects/[subjectId]/visibility` | PUT: `{ scope, scope_key, visible_to }` | `{ rules: [...] }` | Teen-narrowing is teen-only (route rule); under-13 managed by parent. Audits `health_visibility.updated`. |
| `POST .../health/subjects/[subjectId]/grants` | `{ scope, scope_key, granted_to, expires_at? }` | `{ grant }` | **Subject-self only** (the teen shares). Audits `health_grant.created` + notifies parents? No — grants are quiet by design; revocation notifies ("paused"). |
| `DELETE .../health/subjects/[subjectId]/grants/[grantId]` | — | `{ grant }` (`revoked_at` set) | Revocation inserts a `health_notifications` row to parents ("[Name] paused sharing [scope]") — transparency, never covert (vision W2 pattern). |
| `POST .../health/subjects/[subjectId]/overrides` | `{ scope, scope_key, reason: min(20), expires_at? }` | `{ override }` | **Parent-only + audited + teen-notified in one transaction** (§3.2). Audits `health_override.granted`. |
| `GET .../health/subjects/[subjectId]/notifications` | — | `{ notifications: [...] }` | Recipient-self only. |
| `GET .../health/subjects/[subjectId]/sources` | — | `{ sources: [...] }` (no secrets — `vault_ref` is opaque) | |
| `POST .../health/subjects/[subjectId]/sources/dexcom/connect` | `{ }` | `{ authorize_url }` | Starts Dexcom OAuth (Edge Function `dexcom-oauth`). Parent or subject-self. |

### 3.6 W22 UI routes

| Route | Placement rationale |
|---|---|
| `/household/health` | **Household-level, NOT under `/c/[childSlug]`.** Subjects include adults; the roster is per-household. Family hub: per-person cards showing only visibility-allowed summaries. A teen's private metrics never render on a parent's screen (RLS + route shaping — the privacy model is enforced in data, not hidden in CSS). |
| `/household/health/[subjectId]` | Per-person detail: trends, sources, privacy controls ("who sees what" — the product surface). Teen sees their own everything + their sharing controls; parents see visibility-allowed views. |

---

## 4. W23 — Calorie & nutrition tracker ("Are you actually eating right?")

Per-person like W22 (a teen's food log is theirs). **Scoping: `subject_id` → `health_subjects` (011).** W23 depends on 011's migration; no new person concept.

### 4.1 Data models → migration `012_nutrition_tracker.sql`

**`food_logs` — one row per subject per day per meal.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects(id)` ON DELETE CASCADE | **whose plate** |
| `log_date` | date NOT NULL | |
| `meal` | text NOT NULL CHECK `IN ('breakfast','lunch','dinner','snack')` | |
| `source` | text NOT NULL DEFAULT `'manual'` CHECK `IN ('manual','nl','barcode','photo','meal-plan')` | how it was logged |
| `data_class` | text NOT NULL DEFAULT `'S'` | food logs are health-adjacent Class S for teens |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

UNIQUE `(subject_id, log_date, meal)`. RLS: **subject-self only** (plus household parents of under-13 subjects) — the diary is private by default. Parents of teens get the patterns RPC (§4.2), never these rows.

**`food_log_items` — the items, with uncertainty as first-class data.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `food_log_id` | uuid NOT NULL → `food_logs(id)` ON DELETE CASCADE | |
| `name` | text NOT NULL | |
| `quantity` / `unit` / `serving_desc` | numeric / text / text | "about a fist of rice" |
| `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `sugar_g`, `sodium_mg` | numeric | NULL = unknown (never fake a zero) |
| `source` | text NOT NULL CHECK `IN ('nutritionix','usda','openfoodfacts','photo-estimate','manual')` | |
| `uncertainty_low` / `uncertainty_high` | numeric | **photo estimates MUST carry the range** ("≈500–700 cal"); NULL only for verified DB entries |
| `confidence` | numeric(4,3) | |
| `photo_path` | text | `nutrition-photos/<subject>/<date>/<id>.jpg`, path-only, private bucket |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**Route rule (Zod refine):** `source='photo-estimate'` requires `uncertainty_low` + `uncertainty_high` + `confidence` — the API refuses false precision. The UI renders the range, never a point ("about 500–700 cal", never "612 cal").
RLS: same as `food_logs` (join on `food_log_id`); subject-self only. No UPDATE (corrections = new item, old marked — keep `superseded_by`? v1: allow UPDATE by subject-self within 24h, then append-only — document; simpler: subject-self may UPDATE/DELETE own items, parents of teens may not touch the diary at all).

**`nutrition_targets` — nourishment targets, never deficits for under-18.**

| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `subject_id` | uuid NOT NULL → `health_subjects` CASCADE | |
| `effective_date` | date NOT NULL | targets evolve |
| `calories` / `protein_g` / `fiber_g` / `water_ml` | numeric | |
| `target_kind` | text NOT NULL CHECK `IN ('fuel','maintain','gain')` | **no 'deficit'/'lose' kind exists in the CHECK — under-18 weight-loss mode is unrepresentable in the schema** |
| `set_by` | text CHECK `IN ('rules-engine','parent','subject','nutritionist')` | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

UNIQUE `(subject_id, effective_date)`. The CHECK constraint is the teen-safety line *in the schema*: a deficit target cannot be stored, period. (For 18+ subjects who want one: still not in v1 — product decision, noted in §7.) RLS: subject-self + parents read; writes by rules engine (service_role) or parent/subject via route.

**`food_swaps` — real-food-first as data, not copy.** `(swap_key PK, gap_nutrient text, whole_food text, serving text, notes text)`. Seed: iron→lentils/spinach, protein→chicken thighs/eggs/greek yogurt, fiber→oats/beans, calcium→yogurt, etc. Class P, public read. The suggestion pipeline (§4.2) must cite a `food_swaps` row (or a whole-food Nutritionix/USDA entry flagged `is_whole_food`) **before** any supplement mention; supplement mentions require `food_gap_unclosable=true` + clinician disclaimer — deterministic post-check in code.

**`nutrition_days` — view (not a table), `security_invoker = true`.**

```sql
CREATE OR REPLACE VIEW public.nutrition_days WITH (security_invoker = true) AS
SELECT l.subject_id, l.log_date,
       SUM(i.calories) AS calories_in, SUM(i.protein_g) AS protein_g,
       SUM(i.fiber_g) AS fiber_g, SUM(i.sodium_mg) AS sodium_mg,
       SUM(i.sugar_g) AS sugar_g, COUNT(DISTINCT l.meal) AS meals_logged,
       SUM(CASE WHEN i.uncertainty_low IS NOT NULL THEN 1 ELSE 0 END) AS estimated_items
FROM public.food_logs l JOIN public.food_log_items i ON i.food_log_id = l.id
GROUP BY l.subject_id, l.log_date;
```

**`energy_balance` — view (012), W23→W22 seam:** `nutrition_days.calories_in` vs W22 `active_calories` per subject per day (one honest number: in vs out). `security_invoker = true`. Reads `health_metrics` through the visibility predicate — a parent sees their teen's energy balance only if the underlying metrics are visible to them.

**New RPC (DBA, in 012):** `nutrition_weekly_patterns(p_subject_id uuid)` RETURNS `{ avg_calories, avg_protein_g, avg_fiber_g, meals_logged_days, breakfast_skipped_days, pattern_flags text[], as_of }` — `SECURITY DEFINER`, asserts caller is a household parent of the subject's owner (or the subject), returns **aggregates only, never item detail**. This is the "parents see patterns, not the diary" contract enforced in the database, not the route.

### 4.2 W23 API contracts

Base `/api/v1/health/subjects/[subjectId]/nutrition/...`. Every route: `handleRoute` → `assertHealthSubject(subjectId)` → use → `auditEvent(anchorChildId, ...)`. Diary routes additionally assert subject-self (or under-13 parent); pattern routes assert parent.

| Method + path | Request (Zod sketch) | Response `data` | Notes |
|---|---|---|---|
| `POST .../nutrition/what-if` | `{ query: z.string().min(2).max(200) }` ("what if I eat a Whopper") | `{ item: {name, calories, protein_g, sodium_mg, ...}, vs_day: { pct_of_calories, pct_of_sodium, displaces }, alternative: {...} }` | **Stateless compute** — no persistence. Route → Edge Function `nutrition-lookup` (Nutritionix key server-side) → vs. today's targets. "No judgment, no red X — information." |
| `GET/POST .../nutrition/logs?date=` | POST: `{ log_date: date, meal, source?, items: [{name, quantity?, unit?, source, ...}] }` | `{ log, items }` | Subject-self (or under-13 parent). Photo items require uncertainty bounds (Zod refine). NL items resolved via `nutrition-lookup` server-side. |
| `PATCH/DELETE .../nutrition/logs/[logId]` | — | `{ log }` | Subject-self only. Parents of teens cannot edit the diary. |
| `GET .../nutrition/day?date=` | — | `{ totals, targets, deltas, plan_score }` | Totals from `nutrition_days`; `plan_score` = reality vs W13 baseline (§5.3) when a meal plan exists ("lunch matched, dinner drifted"). |
| `GET/PUT .../nutrition/targets` | PUT: `{ effective_date?, calories?, protein_g?, fiber_g?, water_ml? }` | `{ targets }` | Rules-engine computed; adjustable within guardrails. **Route refuses deficit framing for under-18** (409 `TEEN_SAFETY` — the CHECK makes it unrepresentable anyway). |
| `GET .../nutrition/patterns?days=7` | — | `nutrition_weekly_patterns()` output | **Parent-safe aggregates** — the only nutrition surface a parent of a teen gets. No item detail, ever, in this payload. |
| `GET .../nutrition/closeout?date=` | — | `{ totals, targets, gaps: [{nutrient, short_by, swap: food_swaps_row}], tomorrow_note }` | The gentle daily closeout. Gaps cite `food_swaps` whole foods first (deterministic). Shame-free copy per guidance framework. |

**Edge Functions (new, `supabase/functions/`):**
- **`nutrition-lookup`** — `{ query }` / `{ upc }` → Nutritionix (primary; server-side key) → USDA FoodData Central (verification backstop) → Open Food Facts (barcode). Returns structured nutrients + `is_whole_food` flag + source. Tenant-asserted by the calling API route (route resolves subject first; the function re-asserts `subject_id`).
- **`nutrition-photo`** — Workers AI vision (same trust boundary as `mail-ocr`) → `{ items: [{name, serving_desc, calories_range: [low, high], confidence}] }`. The route converts ranges into `uncertainty_low/high` — never a point estimate.

### 4.3 W23 UI routes

| Route | Placement rationale |
|---|---|
| `/household/health/[subjectId]/nutrition` | Under the health subject (not `/c/[childSlug]`) — subjects include adults, and the diary is per-person. Tabs: **Diary** (subject-self + under-13 parents only), **What-if** (the simulator — everyone's entry point), **Patterns** (parents of teens see this tab; teens see their own full view). Role-shaped server-side: a parent opening a teen's page gets Patterns, never the Diary. |

**Teen safety (non-negotiable, QA checklist):** (1) no deficit/weight-loss targets under 18 — schema CHECK + route 409; (2) nourishment/energy framing only ("fuel for the game", "protein for growing") — copy lint; (3) diary private — RLS subject-self, parents get the patterns RPC; (4) photo estimates render ranges, never points; (5) real-food-first — suggestion pipeline cites `food_swaps` before any supplement mention, supplements gated on `food_gap_unclosable` + clinician disclaimer.

---

## 5. Cross-module wiring (seams, not implementations)

### 5.1 W5 → W1: grades feed the GPA simulator

- **Exists in 009:** `simulate_gpa(p_child_id, p_assumptions)` RPC reading W1 `grades` + `classes.grade_weights`; `college_gpa_scenarios` for saved runs.
- **Contract:** W5 reads W1 tables read-only through the RPC. W1 never knows W5 exists. Letter bands come from the `letterGrade()` client util (batch-1 §0.6) — the RPC returns numerics; banding happens at the edge closest to render.
- **Direction:** one-way, W1 → W5.

### 5.2 W22 → W2: W22 IS the data layer, W2 is interpretation

- **W22 owns:** `health_subjects`, `health_metrics` (normalized readings), `health_sources`, `health_visibility`, `health_share_grants`, `health_access_overrides`, `health_notifications`, `metric_defs`, the `ingest-health-metrics` Edge Function, `health_metric_visible()`.
- **W2 will own (its migration, not 011):** `health_flags` (anomaly flags w/ severity + framing), `health_trends` (baseline computations), `visit_agendas`, `health_conditions` + `condition_logs`, `medications` + `medication_logs`, `immunizations`, `health_appointments`, `growth_measurements`, `lab_results`, `health_consent`.
- **The seam contract (both sides implement):**
  1. W2 reads `health_metrics` **only through `health_metric_visible()`** — W2's interpretation tables must never store a reading the reader couldn't see (enforced: W2's worker asserts visibility per subject per metric before writing flags).
  2. W22 never writes interpretation — no flags, no baselines, no nudges in 011's tables.
  3. W2 never writes `health_metrics` — corrections/annotations go in W2 tables referencing `health_metrics.id`.
  4. Shared: `metric_defs` (W2's `condition_metric_defs` extends the same key space), `health_subjects` (W2 adopts it as the person registry — no second roster), `data_class='S'` labeling.
  5. The AI committee's health summarization runs on the self-hosted model (vision §2.3 Class S) and writes to W2 tables through the `safety_status` write-path gate.

### 5.3 W23 → W13 (meal plans), W20 (shopping list), W22 (energy balance), W2 (long arc)

- **W23 → W13:** W13's future `meal_plans` table exposes the documented read contract `v_meal_plan_baseline(subject/child, date, meal, planned_items)` (created by W13's migration). W23's `day`/`closeout` routes read it for plan-vs-reality scoring ("lunch matched, dinner drifted"). Direction: W13 → W23, read-only; W23 never writes meal plans.
- **W23 → W20:** gap-to-plate suggestions read `shopping_items` via the `is_household_member` predicate ("chicken thighs are already on the list — here's a 20-minute dinner"). Read-only; W23 never writes the list (meal-plan-origin items stay W13's job via the batch route, batch-1 §2.3).
- **W23 → W22:** the `energy_balance` view (012) joins `nutrition_days` to W22 `active_calories` per subject per day — "calories in vs calories out, one honest number" — visibility-filtered through `health_metric_visible()`.
- **W23 → W2:** W2's long-arc views (weight trend, glucose response to meals) read the `nutrition_weekly_patterns()` RPC (aggregates only) — "the daily tracker never mistakes a Tuesday for a trajectory."

### 5.4 W16 → W1: school-comms email extractor

- **Exists in 010:** `school_events` with `source='extractor'`, `source_message_id` claim column, `dedupe_key` uniqueness.
- **Contract:** the W1 school-comms pipeline (general school-email ingestion — teacher/school emails beyond the per-class `teacher_messages`) exposes ingested messages with their tenant `child_id`. The `school-event-extractor` Edge Function consumes `{ message_id, child_id, ... }`, writes events `ON CONFLICT (child_id, dedupe_key) DO NOTHING`. The FK from `source_message_id` to the ingestion table is added by the comms pipeline's migration (claim now, constraint later — same convention as batch-1 §4).
- **Direction:** W1 ingestion → W16 events, one-way. The proactive engine reads `school_events` + W1 `due_next` as two feeds of the same "what's coming" surface.

### 5.5 Shared conventions for batch-2 modules

- `data_class` + `retention_class` on every row holding health, education-record, or financial-adjacent data (vision §5).
- Cross-module references are nullable `uuid` claim columns; FK constraints added by the *consuming* module's migration.
- Every AI-generated child-facing row carries `safety_status` (`essay_feedback`; W2's interpretation tables later) — the write-path gate from vision §2.5.
- New Edge Functions: `school-event-extractor`, `ingest-health-metrics`, `dexcom-oauth`, `dexcom-sync`, `nutrition-lookup`, `nutrition-photo`, plus the P2 `college-stats-refresh` system ETL. All verify tenant context first (except `college-stats-refresh`, which touches only public Class-P rows — the documented carve-out).

---

## 6. UI route map (consolidated)

| Module | Route | Placement rationale |
|---|---|---|
| W5 list + readiness | `/c/[childSlug]/college` | Child-scoped: the journey belongs to one teen. Parent surface ungated; teen AI-strategy content 16+ (guidance framework launch tier). |
| W5 college detail | `/c/[childSlug]/college/[listId]` | Deadlines, requirements, essays, recommenders, releases per college. |
| W5 GPA simulator | `/c/[childSlug]/college/gpa` | What-if sliders on W1 grades; mission-framed gap-to-goal. |
| W5 test scores | `/c/[childSlug]/college/tests` | Manual entry + upload + verification; "we never pull from College Board/ACT" explainer. |
| W16 minutiae | `/c/[childSlug]/school/events` | Child-scoped school data; per-child view with owner chips + acknowledge CTAs. |
| W22 family hub | `/household/health` | **Household-level.** Subjects include adults; per-person cards show only visibility-allowed summaries. |
| W22 subject detail | `/household/health/[subjectId]` | Trends, sources, privacy controls ("who sees what"). |
| W23 nutrition | `/household/health/[subjectId]/nutrition` | Diary (subject-self only) / What-if / Patterns tabs, role-shaped server-side. |

Demo mode: pages check `isDemoMode()` and render static demo data; the demo never calls `/api/v1/*`. No demo branches in new API routes.

---

## 7. Open questions (with recommendations)

| # | Question | Recommendation |
|---|---|---|
| Q1 | W22 subjects without logins (young kids, spouse) — `user_id` NULL rows? | Yes, allow NULL `user_id` (parent-entered manual data); link the login later via invite. A subject without a login can never be `isSelf` — reads fall back to parent/household visibility. |
| Q2 | Dexcom developer app — who provisions the OAuth client? | Founder/DevOps provisions one Dexcom developer app per environment; client id/secret → Edge Function secrets (never the repo). Document in `ENV-MANAGEMENT.md`. |
| Q3 | `college-stats-refresh` as a system-scope worker — iron-rule exception? | Yes, carved out in §1.1: it touches only public Class-P rows (`colleges`, `college_stats`), never tenant data. Audited as `actor_kind='worker'`, `child_id=NULL`. Any extension beyond Class-P rows needs a new ADR. |
| Q4 | `nutrition_days` / `energy_balance` as views vs. materialized? | Views (freshness over speed at family scale). Revisit materialization only with measured pain. Both `security_invoker = true` — DBA verifies (leak risk without it, batch-1 §7). |
| Q5 | W16 extractor's ingestion table doesn't exist yet (006 has `teacher_messages`, not general school-email ingestion). | The comms pipeline's migration defines it; 010's `source_message_id` is a claim column now, FK later. Don't block 010 on it — manual entry works day one. |
| Q6 | Which model reviews `essay_feedback` before `safety_status='approved'`? | Claude, per the committee's mandatory-reviewer role (vision §2.2). Deterministic rules layer (copy lint §1.4) runs first. |
| Q7 | 18th-birthday authority flip for transcript releases — cron or lazy? | Lazy: computed from `children.date_of_birth` at request time. No cron, no stale flags. |
| Q8 | Health readings retention? | 13 months rolling (matches grade snapshots, batch-1 §7 Q9), then export-then-purge per subject. DBA adds `cleanup_old_health_metrics()` RPC later, same pattern as `cleanup_expired_agent_scopes()`. |
| Q9 | Should W2/W8/W17 adopt `health_subjects` as the person registry? | Yes — that's its purpose. One roster; W2's migration references it, never duplicates it. |
| Q10 | Vision model for `nutrition-photo`? | Workers AI vision (same trust boundary as `mail-ocr`, batch-1 §3.3). External vision vendors only via per-photo explicit consent — same gate shape as `external_ocr_consent`. |
| Q11 | Deficit targets for 18+ subjects? | Not in v1 — product decision deferred to the guidance pod + founder. The CHECK constraint makes "not yet" structural, not accidental. |
| Q12 | Co-parent households (W14) vs `health_subjects.owner_user_id`? | Same as W20/W21 (batch-1 §7 Q5): one roster per owner user. A co-parent sees a shared child's metrics via the derived household predicate + visibility rules, scoped to their own household's subjects. Explicit multi-owner health sharing waits for W14. |

---

## 8. Appendix — migration plan + DBA checklist

**Files (in order):** `009_college_prep.sql` (W5: reference tables + seeds, then tenant tables) → `010_school_minutiae.sql` (W16) → `011_health_tracker.sql` (W22: `health_subjects`, `metric_defs` + seed, `health_metrics`, visibility/grant/override/notification/sources tables, `health_metric_visible()`) → `012_nutrition_tracker.sql` (W23: depends on 011; `food_logs`, `food_log_items`, `nutrition_targets`, `food_swaps` + seed, views, `nutrition_weekly_patterns()`). 010 is independent of 009/011/012; 012 depends on 011.

**New storage buckets (private; DBA/DevOps create):** `test-score-reports` (`<uploader_uid>/test-scores/<yyyy>/<id>.pdf`), `nutrition-photos` (`<subject_id>/<yyyy-mm-dd>/<id>.jpg`). Path-only columns; signed URLs server-side, short TTL. Storage RLS mirrors the `mail-photos` pattern (008): path segment 1 checked against the tenant/household predicate.

**DBA checklist:**
- [ ] Every table: `CREATE TABLE IF NOT EXISTS`; `ENABLE ROW LEVEL SECURITY`; `DROP POLICY IF EXISTS` before each `CREATE POLICY`; explicit GRANTs (least privilege; anon gets nothing except the four global reference reads: `colleges`, `college_stats`, `requirement_templates`, `college_aid_programs`, `metric_defs`, `food_swaps`).
- [ ] `health_metric_visible()` — test as four JWTs: subject-self (all rows), parent of 13–17 teen (only visible_to-allowed), teen (own all), anon (zero). Sensitive-default test: new teen subject with no visibility rows → parent sees `activity` metrics, gets zero `sleep` rows.
- [ ] `health_metrics`: no UPDATE/DELETE policies or grants (append-only). `health_access_overrides`: parent-only INSERT; no UPDATE/DELETE.
- [ ] `transcript_releases` CHECK `release_authorization_integrity` present (mirrors 008's `dispute_approval_integrity`).
- [ ] `nutrition_targets` CHECK has no deficit kind (only `fuel`/`maintain`/`gain`).
- [ ] `food_log_items`: no CHECK on uncertainty columns (NULL allowed for verified DB entries), but the *route* enforces bounds for `photo-estimate` — DBA notes this as route-enforced, not schema-enforced, for QA.
- [ ] `nutrition_days` + `energy_balance` views created `WITH (security_invoker = true)`; verify with `\d+`.
- [ ] `simulate_gpa()` + `nutrition_weekly_patterns()` are `SECURITY DEFINER` with `SET search_path = public` and assert the caller's scope inside the function body (fail closed).
- [ ] 009 seeds: 50 colleges (tagged), `college_stats` with `as_of` + `source` on every row, requirement templates, HOPE/Zell Miller rows with `as_of`.
- [ ] 011 seeds: `metric_defs` (11 keys, plausibility clamps set).
- [ ] 012 seeds: `food_swaps` (iron/protein/fiber/calcium whole-food rows).
- [ ] `audit_log` secret-guard trigger (004) covers new `auditEvent` calls — never put health values, food items, essay bodies, or score values in `detail` (ids + hashes only).
- [ ] CI grep tripwire (new in 011): `health_sources` migration + Edge Functions must not contain `token|secret|refresh` column/value patterns — Dexcom tokens live in the Vault.
- [ ] Regenerate types (`supabase gen types`) after all four land; CI must fail on drift (ADR-003).

**Backend notes:** `assertHealthSubject()` in `src/server/tenant.ts` (append-only addition, §3.5); W5/W16 routes use `assertTenant`; W22/W23 use `assertHealthSubject`; household roster route uses `assertHousehold`. `service_role` only in: mail-style upload paths (signed URL minting), the seven Edge Functions (§5.5), and the `simulate_gpa`/`nutrition_weekly_patterns` RPCs. W22/W23 response shaping: diary/metric detail routes re-check visibility *after* RLS (defense in depth); parent-role callers get 403 `HEALTH_VISIBILITY_DENIED`, never silent empty lists (empty-list-on-denied trains users to misread privacy as absence).

**Frontend notes:** college surfaces get the copy-lint blocklist (§1.4) as a CI check on the `/college` routes; health surfaces carry the `meta.disclaimer` from every API response; nutrition photo items render `uncertainty_low–uncertainty_high` ranges (component contract: never render a point estimate from a `photo-estimate` row); `/household/health*` pages are role-shaped server-side (the layout, not CSS, decides which tabs exist).

---

## 9. Demo-mode & conflict flags (for the Engineering Coordinator)

- **Demo agent conflict check:** the demo agent is touching `middleware.ts`, `src/lib/tenant/actions.ts`, `page.tsx`. This spec requires **no changes** to any of those files: `assertHealthSubject()` is an append-only export in `src/server/tenant.ts` (a different file from `src/lib/tenant/actions.ts` — similar names, no overlap); no new middleware logic (health/college routes reuse the existing session + tenant firewall); no changes to `page.tsx` (new top-level routes are additive under `/household/health` and `/c/[childSlug]/college|/school/events`). **No merge conflict expected**, but the coordinator should sequence the tenant.ts edit after the demo agent's pass to avoid a same-file race.
- **`NEXT_PUBLIC_DEMO_MODE` stays build-time:** new pages follow the existing `isDemoMode()` pattern (static demo data, zero `/api/v1/*` calls). L6 from the security baseline audit (demo-mode prod safety rests on build-time env var) applies unchanged — needs the CI assertion + Pages prod settings check already flagged.
- **M1/M2 from the security baseline audit still apply:** agent JWT `sub` must be a UUID before the agent read path touches these tables (M1); `assertTenant`'s fail-open role default must flip to least-privilege before any route gates on `ctx.role` (M2) — batch-2 routes gate on role in several places (transcript authority, diary privacy, override grants).
- **Sequencing recommendation:** DBA lands 009 → 010 → 011 → 012 in order (012 hard-depends on 011). Backend can build W5/W16 routes in parallel with the 011/012 DBA work; frontend starts after the RPC signatures (`simulate_gpa`, `nutrition_weekly_patterns`, `health_metric_visible`) are frozen.
