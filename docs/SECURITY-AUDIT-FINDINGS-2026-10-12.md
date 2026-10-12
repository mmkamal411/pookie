# Security Audit Findings — Phase 0 (2026-10-12)

**Auditor:** Security Engineer, Platform Team 2 · **Branch:** `staging-build`
**Scope:** committed code only. Untracked files (migrations 017–025) are marked
PENDING and excluded from committed-code findings.

## Committed-code findings

### CRITICAL

**SEC-001 — RLS permits parents to read (and overwrite) teen check-in text**
- Evidence: `supabase/migrations/006_w1_school_core.sql:307-309` —
  `checkins_tenant_read ... FOR SELECT USING (child_id = ANY (public.current_child_ids()))`;
  the `checkins` table carries `mood, energy, stress, text` where `text` is
  documented as "child-private free text" (006:144-151). Any parent JWT can
  `SELECT text` directly via PostgREST — the comment's "enforced in the route"
  claim (006:138-140) does not cover direct PostgREST access, which RLS is the
  perimeter for.
- Second arm: `checkins_member_update` (006:316-319) lets *any tenant member*
  UPDATE any check-in row — a parent can overwrite the teen's check-in text.
- Third arm: no DELETE policy — the teen cannot delete their own check-in,
  contradicting FR-SCHOOL-003 ("teen-deletable").
- Violates: FR-SCHOOL-003, FR-ACCESS-006 (scope-filtered API), FR-HEALTH-003.
- Fix: (1) replace `checkins_tenant_read` with a teen-only SELECT policy
  (caller holds `child` role on that child); (2) expose parents a
  SECURITY DEFINER aggregate function/view returning counts + averages per
  day/class, never raw text/mood per row; (3) restrict UPDATE to the teen's
  own rows, DELETE to the teen only (parent backfill via an explicit,
  audited RPC if the feature is kept); (4) add the check-in scope to
  `resolve_visible_scopes()` deny-by-default for Reflection/Wellness.

### HIGH

**SEC-002 — Invite-consume error differentiation is an enumeration oracle**
- Evidence: `src/server/errors.ts:71-72` + `src/server/errors.ts:22-23` —
  `invite_not_found_or_expired` → `INVITE_NOT_FOUND` ("This invite is invalid or
  has expired.") vs `invite_email_mismatch` → `INVITE_EMAIL_MISMATCH`
  ("This invite was sent to a different email address."), both returned from
  `POST /api/v1/invites/consume` (`src/app/api/v1/invites/consume/route.ts:14-24`),
  whose RPC raises the two distinct errors
  (`supabase/migrations/001_tenancy_core.sql:505-512`).
  Probing tokens with a throwaway account distinguishes "token invalid" from
  "token valid, wrong email" — a bearer-capability oracle.
- Violates: NFR-PRIVACY-005, FR-AUTH-009 (no enumeration oracle).
- Fix: map both to a single envelope code/message ("This invite is invalid or
  has expired."). Additionally: rate-limit the consume endpoint (no throttle
  found) and audit repeated failures.

### MEDIUM

**SEC-003 — `teacher_messages` read policy excludes the teen subject**
- Evidence: `supabase/migrations/006_w1_school_core.sql:297-305` — the SELECT
  policy requires `ca.role = 'parent'`; a teen cannot read their own school
  comms. Panel requires counselor-mail segregation and provenance (FR-SCHOOL-002),
  not teen exclusion. Likely inverted.
- Fix: grant the teen (child role) SELECT on their own messages; keep
  outbound approve/send parent-only (already enforced in
  `src/server/services/school.ts:622-623, 665-666` via `requireParentRole`).

**SEC-004 — Tutor worker path has no scope filtering**
- Evidence: `src/app/api/v1/tutor/chat/route.ts:24-31` — the route forwards
  `child_id` + messages to the external `pookie-tutor` worker and returns its
  JSON verbatim. If the worker personalizes from teen-private sources
  (check-ins, reflections, mood), a *parent-initiated* chat can surface that
  content to the parent. Worker code is not in this repo; no scope attestation
  found.
- Violates (in spirit): FR-AI-003 (never Reflection/Wellness-derived content to
  parents), FR-ACCESS-006.
- Fix: require the worker owner to attest which data sources the prompt
  builder touches; pass the caller's resolved scopes to the worker and have it
  strip out-of-scope context; server-side post-filter on the response for
  callers whose role is `parent`.

## Clean (verified, no finding)

- **Workers cookie rule:** swept all `src/app/**/route.ts` — only
  `src/app/auth/callback/route.ts` writes cookies and it follows
  NFR-RELIABILITY-001 (pendingCookies array + explicit `response.cookies.set`,
  lines 33-48). No `next/headers` cookie-write-then-constructed-response pattern
  anywhere else. `src/lib/tenant/actions.ts:71` uses `cookies().set()` inside a
  Server Action (active-child cookie) — the standard Server Action pattern, not
  the route-handler anti-pattern; the cookie is validated against memberships
  before set and is never used as authorization (RLS via
  `current_child_ids()` remains the gate).
- **API envelope coverage:** all 52 routes under `src/app/api/` go through
  `handleRoute` (auth required, canonical error envelope); every child-scoped
  route asserts via `assertTenant`/`assertParent`/`assertHousehold`
  (`src/server/tenant.ts`). No unauthenticated route found.
- **Teacher approve/send:** parent-only enforced in the service layer
  (`requireParentRole`, school.ts:622-623, 665-666); send requires
  `status='approved'` + the 06:00–22:00 send window (409 otherwise); optimistic
  `status` guards prevent double-approve/double-send. Note: v1 only *marks*
  sent — transmission is future work; FR-AI-004 (no AI-ghostwritten send path
  until parent-authorship rules ship) remains a product gate.
- **`/verify-invite` pre-auth surface** (`src/app/verify-invite/page.tsx`):
  discloses only capability-URL identity fields (child nickname, invitee
  email, inviter name) via `get_invite_preview`; no grades/access rows.
  Accept requires sign-in + email match + server-side `consume_invite` check.
  Acceptable; the enumeration concern is SEC-002, not this page.
- **Health metrics privacy predicate:** `health_metric_visible()` in
  `supabase/migrations/011_w22_health_tracker.sql:248-309` is deny-by-default
  with sensitive teen metrics private to the teen (or an audited, active
  parental safety override). Solid — but note the file header says this is
  "SUPERSEDED by health_tier_visible" per sol-health §1.3 and still unapplied;
  the H0–H3 enum + tier matrix (untracked 022) must land and this function
  must be replaced before W22 holds real teen data (FR-HEALTH-001).
- **`me` PATCH** (`src/app/api/v1/me/route.ts:25-33`): only updates the
  caller's display name; no role/self-grant path (FR-ACCESS-010 intact).

## PENDING CODE ARRIVAL — will re-audit (not findings, tracked)

- **P-1** `resolve_visible_scopes()` + scope-filtering middleware (Backend) —
  grep across repo + migrations: no matches. Re-audit targets: scope-confusion
  bugs, teen-private leakage paths, per-route enforcement coverage on
  `/api/v1`, RLS gaps on new tables.
- **P-2** Support RBAC: no `support_tickets`/`ticket_events` tables, no agent
  support role, no `teen_privacy` flag, no agent-read audit. S1/S2/S3 are menu
  seedlings only (`src/lib/modules.ts:116-122`, `route: null`). Cannot verify
  FR-SUPPORT-004/005 yet.
- **P-3** `access_events` append-only table (FR-ACCESS-009) and
  `child_access.granted_by` enforcement (FR-ACCESS-004) — referenced only in
  **untracked** migrations 018/019/020 (not committed); 021/023 placeholders in
  APPLY_ORDER.md. Re-audit on commit.
- **P-4** Health-tier chain 022_health_tiers, 023_health_reconsent,
  024_health_grace_and_deletion, 025_wellbeing (untracked) — re-audit H0–H3
  enforcement and the `health_tier_visible` supersede.

## Phase 0 pen-test checklist (executable; run in staging after migrations applied)

| # | Step | Tool | PASS criterion |
|---|---|---|---|
| PT-1 | Anon `GET <rest>/checkins?select=id` | curl + anon key | 0 rows or 401/403 |
| PT-2 | Parent JWT `GET <rest>/checkins?select=text` | curl | 0 rows (post SEC-001 fix) |
| PT-3 | Parent JWT `PATCH <rest>/checkins?id=eq.<teen-row>` | curl | 403/denied (post fix) |
| PT-4 | Teen JWT `DELETE` own check-in row | curl | 204 (post fix; currently denied — track) |
| PT-5 | `POST /api/v1/invites/consume` with random token vs valid-token/wrong-email | curl | identical code+message both cases |
| PT-6 | Unauthenticated `POST /api/v1/invites/consume` | curl | 401/403, no oracle |
| PT-7 | Parent of child A `GET /api/v1/children/<childB>/school/overview` (B not in tenant) | curl | 403 `TENANT_SCOPE_VIOLATION`, never 404 |
| PT-8 | Child JWT `POST .../teacher-messages/<id>/approve` | curl | 403 `PARENT_ROLE_REQUIRED` |
| PT-9 | Parent `POST .../teacher-messages/<id>/send` on `draft` | curl | 409 CONFLICT |
| PT-10 | Parent approves at 23:00 child-local | curl + tz fixture | `held: true` |
| PT-11 | 6+ wrong guesses on one link code (post P-3) | curl | locked out, uniform error |
| PT-12 | `agent_reader` JWT (job X) reading another child's tables | psql/PostgREST | 0 rows |
| PT-13 | Expired `agent_tenant_scope` job JWT | PostgREST | 0 rows (fail-closed) |
| PT-14 | Support tickets (post P-2): user A reads user B's ticket; agent reads health/grades without consent | curl | 403; reads appear in teen-visible audit |
| PT-15 | Revoke Parent A on child 1; inspect digests/notifications/switcher for child-1 data | UI + API | zero leakage (FR-MOD-X01) |
| PT-16 | Smoke: `?v=` single version, smoke-test-staging.py green | CI | pass |

Sign-off: Phase 0 is **NOT signed off** until SEC-001 and SEC-002 are fixed and
re-tested (PT-2, PT-3, PT-5), and P-1..P-4 have landed and been re-audited.
