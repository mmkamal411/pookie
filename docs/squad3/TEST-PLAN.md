# Squad 3 — School Track 🌿 · QA Test Plan

**Version:** 1.0 · **Date:** 2026-10-12 · **Author:** QA Engineer (Squad 3)
**Repo:** `~/workspace/pookie-app` · branch `staging-build` · **No deploy — QA only**
**Build status:** `npm run build` ✅ passes locally (2026-10-12, exit 0, all school routes render)

**Authority chain:** `docs/BUILD-SPECIFICATION.md` (FR-SCHOOL-001–019, FR-AI, FR-AUTH-011, NFR-SEC, NFR-PRIVACY)
· `docs/solutions/sol-school-ai.md` (§5 calibration enforcement) · `docs/pm/QUALITY-PLAN.md` (7-area protocol)
· **MD D5 REVISED (docs/MD-DECISIONS.md, 2026-10-12):** second-parent = **OPEN SIGNUP** — "Connect to my family"
is fully functional at launch; the **corroborated claim flow is v1 scope** (verified sign-in + full legal name +
child name/DOB + creating-parent's signup email + perjury-style + custody attestations → Parent A approval (<13)
or teen approval (13+) → connected). Invite-from-inside (deep link/QR) remains the fastest path. Custody: STAY OUT —
`court_order_restriction` exists for verified presented orders; disputes go to human review case-by-case.
· **MD directive 2026-10-12: NO PLACEHOLDERS** — any work package failing the placeholder audit (§1) is NOT done.

---

## 1. Placeholder Audit (Managing Director directive — MANDATORY)

Run **before** any work package is marked done. Any failure = NOT DONE, regardless of how finished the UI looks.
Script: [`scripts/placeholder-audit.sh`](scripts/placeholder-audit.sh)

### Checklist

| # | Check | How | Pass bar |
|---|---|---|---|
| P1 | No mock/fixture data in shipped code paths | `placeholder-audit.sh` scans `src/`, `supabase/migrations/`, `public/` for `mock`, `fixture`, `sampleData`, `dummy` outside `*.test.*`, `*.stories.*`, and script-only dirs | Zero hits in shipped paths |
| P2 | No stubbed functions | Grep for `throw new Error("not implemented")`, `TODO implement`, empty handler bodies, `return null // TODO` | Zero hits |
| P3 | No TODO/FIXME/XXX/HACK comments | Repo-wide grep (case-insensitive) | Zero hits |
| P4 | No "coming soon" / dead-end UI | Grep `src/` for `coming soon`, `coming-soon`, `under construction`, `placeholder`, disabled buttons without an enabled path | Zero hits (HTML `placeholder=` input attributes are fine — audit distinguishes) |
| P5 | Every API call hits a real endpoint | No fetch/XHR targets against `localhost`, `/mock/`, `example.com`, or commented-out production URLs; every route in `src/app/api/v1/` resolves to a handler | Cross-check route tree vs client calls |
| P6 | Every RLS policy actually enforced | Policies exercised with **real JWTs** (teen, Parent A, Parent B, revoked parent, agent, anon) against staging — never `service_role` bypass, never `SET` tricks | Bypass attempts in §10 all blocked |

### Result for this plan's scan (2026-10-12, `staging-build`)

School scope (`src/app/c/[childSlug]/school`, `src/components/school`, `src/server/services/school.ts`,
`src/app/api/v1/children/[childId]/school`, `src/lib/school`): **PASS** — no TODO/FIXME, no "coming soon", no mocks.
(The three `placeholder=` hits in `checkin-form.tsx`, `path-to-90.tsx`, `teacher-thread.tsx` are HTML input
attributes, not fake UI.) No `console.log` in school scope.
**⚠️ Note:** `checkin-form.tsx:114` placeholder copy reads *"Anything on your mind today? (private — just between
you and Pookie)"* — this promise is **currently false at the RLS layer** (see DEF-S3-001). The audit passes the
copy's intent; the defect below makes the copy a lie. Fix the defect, not the audit.

### Repo-wide audit result (2026-10-12, refined script)

Ran `placeholder-audit.sh src` repo-wide after refining out comment-only false positives (comments asserting
"no mocks", deliberate "not implemented in v1" scope cuts with fail-safe behavior, SQL migration test-matrix notes).
**Two true violations remain:**
- **P2:** `src/server/essay-feedback.ts:26` — STUB, no AI provider wired (→ DEF-S3-011, school track).
- **P3:** `src/lib/tenant/actions.ts:219` — TODO(email), no transactional email provider (→ DEF-S3-012, Platform QA).

### Definition of Done (QA gate — all must hold)

1. Placeholder audit §1 passes (all six checks).
2. `npm run build` passes; `npx tsc --noEmit` clean; zero console.logs (Mehedi's code-cleanliness rule).
3. Every spec requirement in this plan has a test result (PASS / FAIL-with-defect / BLOCKED-not-built). "Not built" is never marked done.
4. Security tests (§10): all RLS/auth-bypass attempts blocked; no secrets in repo or bundle (grep-verified).
5. Defects found in this phase are fixed in this phase (QUALITY-PLAN §5) — they do not ride into the next phase as "known issues" without Mehedi's written acceptance.
6. Logged in `docs/BUILD-LOG.md` with evidence, not claims.

---

## 2. Functional: Provenance (FR-SCHOOL-001)

School-of-record (grades, attendance, official school comms) vs app-generated (check-ins, reflections, mood, AI
chats, practice content, forecasts) must be tagged **on every surface** — UI, API, digests, briefings.

| ID | Test | Expected | Env |
|---|---|---|---|
| P-FUNC-01 | Render class page → inspect every grade/assignment | Provenance label "school" (school-of-record) visible or discoverable | local/staging |
| P-FUNC-02 | Render check-in history, path-to-90, tutor chat | Provenance label "app-generated" | local/staging |
| P-FUNC-03 | API: `GET school/overview`, `/classes/:id`, `/teacher-messages` as Parent A | JSON carries `provenance` (or equivalent) field on school vs app items | staging |
| P-FUNC-04 | Parent with Reflection scope revoked → check-in text | Not present anywhere in payloads or digests | staging |
| P-FUNC-05 | **DEF gate:** no screen promises privacy the school doesn't grant (FR-SCHOOL-015) | Copy audit: "just between you" never adjacent to school-issued-account flows | local |

---

## 3. Functional: Calibration — teen-only metacognition (FR-SCHOOL-003, sol §5)

> **State:** designed in `docs/solutions/sol-school-ai.md` §5; **NOT BUILT** in `staging-build`. Tests below run at build time. The work package is not done until all pass.

### 3.1 Algorithm verification

```
e_i = |estimate_i − actual_i|  (percentage points)
calibration (rolling, last 10 paired estimates) = 1 − mean(e_i)/100
```
| ID | Test | Vectors | Expected |
|---|---|---|---|
| C-ALG-01 | Math unit test | estimates {80,70,90,85,75,88,92,78,84,81}, actuals {82,74,86,90,79,84,96,74,86,83} → errors {2,4,4,5,4,4,4,4,2,2}, mean=3.5 | calibration = **0.965**, displayed "within ±3.5 pts on average" |
| C-ALG-02 | Perfect estimates (all e_i=0) | | calibration = **1.0** |
| C-ALG-03 | Worst case (all e_i=100) | | calibration = **0.0** |
| C-ALG-04 | Small-n guard | 4 paired estimates | **No score shown** — "need a few more to see your pattern" |
| C-ALG-05 | Rolling window | 12 paired estimates; drop the 2 oldest | Score uses only the last 10 |
| C-ALG-06 | Framing bands | error shrinking vs stable vs growing | "getting sharper" / "steady" / "still calibrating" — copy about the *skill of estimating*, never honesty/accusation |

### 3.2 Data-flow enforcement

| ID | Test | Expected | Env |
|---|---|---|---|
| C-SEC-01 | **Automated 403 assertions** — parent-scoped JWT against EVERY calibration endpoint (`calibration_scores`, `checkin_estimates`, estimate-create for a teen's own row) | 403 or empty on all; zero calibration rows leak | staging · script [`calibration-403-check.sh`](scripts/calibration-403-check.sh) |
| C-SEC-02 | `calibration_scores` / `checkin_estimates` RLS SELECT | Only the owning teen (and service_role pipelines); no parent role, no agent path, no briefing query may reference them | staging |
| C-SEC-03 | Parent briefing/digest generation | Generated from a **separate allowlisted projection** — no join path to calibration tables exists in the briefing code | code review + staging |
| C-SEC-04 | Teen UI guarantee | "Only you see this. It never appears in anything your parents see, and it never affects your access." renders in-product on the teen's check-in history | staging |

---

## 4. Functional: Parent blocklist — serializer sampling (FR-SCHOOL-003, NFR-PRIVACY-002/004)

Blocklist (sol §5.3): `calibration_scores.*`, `checkin_estimates.*`, `checkins.text`/`body` beyond scope.
Parent-visible payloads are sampled by the nightly access-audit job **and** by CI.

| ID | Test | Expected | Env |
|---|---|---|---|
| B-SER-01 | Sample serializer output for Parent A across school/overview, classes, teacher-messages, briefings | Zero blocklisted fields present | staging · script [`parent-blocklist-check.sh`](scripts/parent-blocklist-check.sh) |
| B-SER-02 | Parent A attempts direct PostgREST read of `checkins` with their JWT | SELECT returns **no** `text` for the teen's rows (requires DEF-S3-001 fix: RLS column-level or teen-only SELECT) | staging |
| B-SER-03 | Scope matrix probe: Parent A with Performance only | `teacher-messages` visible; `checkins.text` absent; calibration absent | staging |
| B-SER-04 | Sibling/household leakage (FR-MOD-X01): revoke Parent A on child 1 → switch to child 2 | No child-1 data in digests, shared surfaces, or the child switcher after switch | staging |

---

## 5. Functional: Inbox segregation (FR-SCHOOL-002 🛑, FR-SCHOOL-016 ⚠️)

> **State: NOT BUILT.** `listTeacherMessages` reads `teacher_messages` with no counselor filtering; no counselor table exists. Blocked-as-merged until the segregation ships (sol §4: separate tables, not flags).

| ID | Test | Expected | Env |
|---|---|---|---|
| I-SEG-01 | Counselor email arrives → where does it land? | `counselor_messages` (separate table per sol §4.1) — never in a teacher thread | staging |
| I-SEG-02 | Counselor thread renders for parent vs teen | Parent view follows the School-module scope setting; ASCA B.2 confidentiality honored — counselor content is not a parent CC line | staging |
| I-SEG-03 | Provenance label on every thread | `school-of-record` + sender role (teacher vs counselor) | staging |
| I-SEG-04 | Safety-critical tags (permission slip, field trip, incident, emergency) | Tagged; non-toggleable; separate safety channel `revokeAccess` cannot touch | staging |
| I-SEG-05 | CC'd teacher email with **non-linked students** in To/CC | Non-linked students **redacted** before any parent-visible render (FERPA-in-practice, FR-SCHOOL-016) | staging |

---

## 6. Functional: Second-parent flow — OPEN SIGNUP + claim v1 (FR-AUTH-011, MD D5 REVISED)

**Flow under test:** Sign up → "Connect to my family" → identify child (verified sign-in + full legal name + child
name/DOB + creating-parent's signup email + perjury-style attestation + custody attestation) → approval request to
**Parent A (<13)** or **teen (13+)** → connected on approval. Invite-from-inside (deep link/QR) is the fastest path.
Custody STAY OUT: `court_order_restriction` = verified presented orders only; disputes → human review.

### 6.1 Claim flow

| ID | Test | Expected | Env |
|---|---|---|---|
| SP-CLM-01 | Claim without verified sign-in | **Refused** — verified sign-in is a hard prerequisite | staging |
| SP-CLM-02 | **Enumeration resistance:** probe with existing child (real name + real DOB) vs non-existing child (random name/DOB), timing-normalized | **Identical responses** — "if this child is in Pookie, we've notified the parent on record"; identical status codes, identical latency envelope | staging |
| SP-CLM-03 | Response content for a match | Reveals **nothing** about whether a match existed (no "request sent to Parent A" vs "not found" differentiation) | staging |
| SP-CLM-04 | **Rate-limit enforcement:** burst of claim submissions from one IP/account | 429s after threshold; CAPTCHA on the claim path | staging |
| SP-CLM-05 | Missing perjury attestation or custody attestation checkbox | **Rejected** — required-field validation server-side, not just client | staging |
| SP-CLM-06 | Custody attestation: "any court orders limiting access?" = YES | Claim routed to **human review**; never auto-granted, never auto-rejected | staging |
| SP-CLM-07 | Approval routing: child <13 | Goes to **Parent A** (sees verified attributes, not "identity confirmed") | staging |
| SP-CLM-08 | Approval routing: child 13+ | Goes to **teen** (verification badges, anti-coercion check, 30-day lockout semantics) + **fact-only notification to Parent A** (no veto) | staging |
| SP-CLM-09 | Parent A approves Parent B | `child_access.granted_by='parent'`, reason code + audit row in `access_events` | staging |
| SP-CLM-10 | **No auto-grant:** any path that could create access without human approval | **Zero auto-grants** — assert no code path inserts `child_access` on claim submit | code review + staging |
| SP-CLM-11 | **14-day unresponsive escalation:** Parent A silent 14 days | Human-review escalation with documentary proof requirement fires | staging |
| SP-CLM-12 | **30-day re-request lockout:** rejection → Parent B re-claims at day 15 and day 31 | Day 15: **refused**; day 31: accepted | staging |
| SP-CLM-13 | Rejection UX | One-time dismissible card, **no reason given**, 30-day lockout starts | staging |
| SP-CLM-14 | Parent B awaiting decision | Working "just me" Pookie immediately — no dead end, no blocked dashboard | staging |
| SP-CLM-15 | "Connect to my family" three-card first-run (Just me / Add my child / Connect to my family) | All three cards functional at launch; no stub card | staging |

### 6.2 Invite-from-inside (fastest path)

| ID | Test | Expected | Env |
|---|---|---|---|
| SP-INV-01 | Invite minting restricted to existing parent members | Non-parent mint attempt → 403; only `parent` role mints (already enforced in `consume_invite`) | staging |
| SP-INV-02 | Deep link / QR generation | `…/verify-invite?token=<48-hex>`; QR encodes the same URL; token = **24 random bytes hex** (not sequential, not UUIDv4-time, not Math.random) | staging |
| SP-INV-03 | `/verify-invite` pre-auth render | **Zero child PII** pre-authentication. ⚠️ **Known violation (Compliance Review 4d2b373, 2026-10-12):** `get_invite_preview` currently returns `child_first_name`/`child_nickname` to unauthenticated visitors — violates FR-AUTH-009/NFR-PRIVACY-005. Fix (Platform Team 1): strip child-name fields from the pre-auth preview (validity + inviting adult's display name only). Re-run this test after the fix. | staging |
| SP-INV-04 | Token guessing / enumeration | Invalid token vs expired token vs used token → **no differentiated oracle** (uniform "invalid or expired") | staging |
| SP-INV-05 | **Expiry:** 7-day email invite; expired token | Refused with a clear re-invite path | staging |
| SP-INV-06 | **Single-use:** consume token → consume again | Second consume fails; audit shows one `invite_consumed` | staging |
| SP-INV-07 | Email-ownership check on consume | Sign-in email ≠ invite email → `invite_email_mismatch` | staging |
| SP-INV-08 | 6-digit link codes (migration 019) | 15-min TTL; single use; **brute-force lockout at 5 attempts**; anti-coercion private confirmation on redeem | staging |
| SP-INV-09 | "Ask Parent A for an invite" empty state (Parent B with no invite) | Empty state renders — points at **both** paths: "Connect to my family" (open-signup claim) and "ask Parent A to send you an invite" (deep link/QR) — never a dead end | staging |

### 6.3 Court-order restriction flag

| ID | Test | Expected | Env |
|---|---|---|---|
| SP-CT-01 | `court_order_restriction = true` on child | **Self-serve linking fully disabled**: claim path and invite redemption both refuse with "this family's access is managed by our team — contact support" copy; no human-review bypass in-app | staging |
| SP-CT-02 | Flag set mid-claim | In-flight claim halts; routed to human review | staging |
| SP-CT-03 | Teen is told plainly why access changed | Fact-only, age-appropriate copy when a verified order changes access | staging |

---

## 7. Functional: Muse 18+ gate (FR-AI-002 🛑)

> **State: NOT BUILT.** ("Muse" in `staging-build` = the legacy async AI-tutor queue, NOT the direct mode. The 18+ direct-mode gate must be verified at build time.)

| ID | Test | Expected | Env |
|---|---|---|---|
| M-GATE-01 | **UI:** account age 17y11m → Pookie tab | No "direct mode" toggle/card exists; no navigation path | staging |
| M-GATE-02 | **API:** under-18 JWT calls the direct-mode endpoint directly | **403** — server-side age check, never client-only | staging |
| M-GATE-03 | Edge: turns 18 during session | Gate re-evaluated from verified DOB at request time (no stale client flag) | staging |
| M-GATE-04 | 18+ enabled | "direct mode" naming (never "unfiltered"); identical safety rules across modes; system-level minor-safety policy active | staging |
| M-GATE-05 | UI copy for blocked users | Boring, non-shaming; no "ask your parents" guilt screens | staging |

---

## 8. Functional: AI practice quizzes — fail-closed (FR-SCHOOL-005 🛑)

> **State: NOT BUILT.** Until the verification pipeline ships and the pilot passes, the product ships **source-text flashcards only**.

| ID | Test | Expected | Env |
|---|---|---|---|
| Q-FC-01 | Study materials surface | **Verbatim Q/A spans from uploaded material only** — no AI-generated distractors, no invented questions | staging |
| Q-FC-02 | Any stage of the generation pipeline fails (answer-key verification, distractor check, AI-label attach, opt-in check) | Item **never leaves staging** — fail-closed, no partial render | staging |
| Q-FC-03 | Machine-verified answer keys (when built) | Deterministic verification (computation, not LLM judgment); human spot-check sampling 5%/week | staging |
| Q-FC-04 | AI-label persistence | Every AI-generated item carries a persistent, non-dismissible AI label in data AND UI | staging |
| Q-FC-05 | Per-class opt-in (when built) | Default off; teen/parent opt-in per class; pilot measured before scale | staging |
| Q-FC-06 | SAT formula bank (FR-SCHOOL-018) | Single curated bank is the grounding source for quizzes, tips, tutor math, SAT formulas — no second source | staging |

---

## 9. Functional: Path-to-90 forecast engine (FR-SCHOOL-007 ⚠️, sol §1)

> **State: PARTIAL.** `study_plans` (persisted plans) + `path-to-90.tsx` exist. The deterministic forecast engine (sol §1.2) is **not built as a pure versioned function**. DEF-S3-002 conflicts with sol §1.4 (current: parent-only writes; required: teen-owner CRUD, parent read-only).

| ID | Test | Expected | Env |
|---|---|---|---|
| F-DET-01 | **Determinism:** same inputs twice → same outputs | Byte-identical forecast; `inputs_hash` matches | staging |
| F-DET-02 | Golden fixtures (to 0.01): 3 fixtures covering on-track / stretch / out-of-reach | Exact outputs; CI gate fails on drift | staging |
| F-DET-03 | Property: weight-sum invariant | Weights not summing to 1.0 ± 0.001 → engine **REFUSES** with "weights invalid" (never silently renormalizes) | staging |
| F-DET-04 | Property: monotonicity | Higher assumed future scores ⇒ higher forecast | staging |
| F-DET-05 | Property: idempotence | Recompute N times → identical row; no duplicate rows | staging |
| F-DET-06 | **Versioning:** engine version bump | Old forecasts marked `superseded_by`; `engine_version` stored on every row | staging |
| F-DET-07 | **Staleness:** cited input changes (sync updates a category) | Prior forecast marked `stale`; UI shows "recompute" | staging |
| F-DET-08 | **Citations:** every forecast | Each input cited with source + timestamp ("Gradebook sync Oct 11, 3:05 AM (StudentVUE)"); unverified fallbacks labeled ⚠ | staging |
| F-DET-09 | **Parent read-only:** Parent A PATCHes the teen's checkbox | **403** — teen (owner) full CRUD; parent SELECT only (requires DEF-S3-002 fix) | staging |
| F-DET-10 | What-if simulator | Client-side, never writes; parent can play, nothing persists except the teen's own checkbox state | staging |

---

## 10. Security (NFR-SEC-001/003/004/007)

### 10.1 RLS verification on school tables (real JWTs — P6)

| ID | Target | Attempt | Expected |
|---|---|---|---|
| S-RLS-01 | `checkins` | Parent JWT `SELECT * FROM checkins WHERE child_id = …` | Raw `text` **not readable** by parent (needs DEF-S3-001 fix) |
| S-RLS-02 | `calibration_scores`, `checkin_estimates` (when built) | Parent JWT SELECT | Zero rows / 403 |
| S-RLS-03 | `study_plans` | Parent JWT INSERT/UPDATE (after DEF-S3-002 fix) | Blocked — teen-only |
| S-RLS-04 | `study_plans` | Child JWT SELECT on unapproved plan | Hidden (fail-closed `safety_status` gate) |
| S-RLS-05 | `grades`, `grade_snapshots`, `due_next` | Anon JWT | Zero rows (no anon grants) |
| S-RLS-06 | `teacher_messages` | Revoked-parent JWT | Zero rows |
| S-RLS-07 | Cross-tenant IDOR | Parent A (child 1) requests child 2's `school/overview` | 403/404 — no leakage |
| S-RLS-08 | `invites` | Anon hits `/verify-invite?token=` | Only `get_invite_preview` projection; full row unreadable |
| S-RLS-09 | Storage: `class-files` bucket (private) | Parent JWT on another tenant's path; anon on any path | Denied |

### 10.2 Auth-bypass attempts

| ID | Attempt | Expected |
|---|---|---|
| S-AUTH-01 | Call `/api/v1/children/{childId}/school/checkins` (POST) with no/invalid token | 401 |
| S-AUTH-02 | Parent JWT calls teen-only `PATCH /path-to-90-actions/:id` (when built) | 403 |
| S-AUTH-03 | Child JWT calls parent-only `PATCH /plans/:planId` (current behavior — inverted per DEF-S3-002) | 403 under current code (documented); after fix, child 200 / parent 403 |
| S-AUTH-04 | Expired JWT, tampered JWT | 401 |
| S-AUTH-05 | `consume_invite` RPC directly as anon with guessed token | No privilege escalation; email-match still enforced server-side |

### 10.3 Claim fuzzing (D5 revised — open signup)

| ID | Fuzz | Expected |
|---|---|---|
| S-FUZ-01 | Claim payload: empty strings, 10k-char names, emoji/RTL names, SQL injection in name/DOB fields, future DOB, DOB making child 100 | Validation errors only; no 500s; no rows created; no log injection |
| S-FUZ-02 | Enumeration probe battery (100 existing-style + 100 random) | Statistical indistinguishability: identical response bodies/statuses; timing variance within noise |
| S-FUZ-03 | Double-submit / replay of a consumed invite token | Idempotent refusal |
| S-FUZ-04 | Race: two simultaneous consumes of the same token | Exactly one succeeds |

### 10.4 XSS / secrets / injection

| ID | Test | Expected |
|---|---|---|
| S-XSS-01 | Check-in text, teacher-message body, plan action text with `<script>`, `javascript:`, SVG onload payloads | Rendered escaped; no script execution (React default escaping + audit) |
| S-XSS-02 | `grep -r` for secrets in `src/`, `public/`, `supabase/migrations/` | Zero API keys, tokens, private keys |
| S-XSS-03 | Bundle audit | No `NEXT_PUBLIC_` secret material beyond the Supabase anon key; no service_role key |

### 10.5 Red-team attack chains + chaos

| ID | Scenario | Expected |
|---|---|---|
| S-RT-01 | Revoked parent + cached JWT | Old token still accepted (Supabase default) → but RLS re-evaluates on `current_child_ids()` per request: access gone. **Verify** the revoke takes effect without token rotation. |
| S-RT-02 | Compromised Parent B session attempts teen's check-in text via briefing endpoint | Blocklisted; nothing in digest projections |
| S-RT-03 | **Chaos:** kill Supabase mid check-in submit | Request fails cleanly; no partial row; client shows retry (no silent drop) |
| S-RT-04 | **Chaos:** drop network mid-sync pull | Ingest anomaly detection flags; no half-written grades (transactional sync) |

---

## 11. Non-functional

### 11.1 Performance (NFR-PERF-001)

| ID | Test | Bar | Env |
|---|---|---|---|
| N-P-01 | School overview, class detail, teacher-messages, check-in submit — p95 | **<3s** per route | staging |
| N-P-02 | Check-in submit (POST) | **<1s** target (teen's daily ritual — latency kills the habit) | staging |
| N-P-03 | Invite consume + redirect | <3s | staging |
| N-P-04 | Every JS chunk referenced by served HTML | Returns 200 (smoke-test verified) | staging |

### 11.2 Accessibility (NFR-A11Y-001)

All rebuilt school screens: check-in form, class page, path-to-90, teacher thread, verify-invite, "Connect to my family" flow.

| ID | Test | Bar |
|---|---|---|
| N-A-01 | Labels | Every input has an associated label (axe scan: zero violations) |
| N-A-02 | Contrast | Text ≥ 4.5:1 on Nebula dark background (no light-on-white, no gray-on-gray) |
| N-A-03 | Keyboard | Full flow keyboard-only: Tab order sane, focus visible, modals trap focus, Esc closes |
| N-A-04 | Reduced motion | `prefers-reduced-motion`: sparkle/starfield animations off; no essential info conveyed by motion alone |

### 11.3 Daily-update audit (source → pull → storage → render, zero manual intervention)

| ID | Source | Verify |
|---|---|---|
| N-D-01 | StudentVUE gradebook sync | Pull → `grades`/`grade_snapshots` → class page; forecast invalidated on change |
| N-D-02 | `due_next` feed | Pull → `due_next` → class page; path-to-90 remaining-work inputs |
| N-D-03 | Check-in estimate pairs | Estimate → actual arrival → calibration table (when built) → teen UI only |
| N-D-04 | Teacher/counselor mail ingestion | Source → correct table (segregated) → correct thread → correct audience |
| N-D-05 | Study Sparks (renamed peer tips, FR-SCHOOL-004) | 4-week expiry enforced; study-skills-only; provenance labels; sampling QA |

### 11.4 Production optimization (staging evidence)

RLS query plans on the hot paths (check-in submit, overview, calibration reads); no N+1 in `getSchoolOverview`; cache headers on static chunks; zero-error verification (no unhandled 500s in logs for school routes).

---

## 12. Regression — W1 school pages for real users (no demo code — removed; don't regress)

These pages existed pre-redesign and carry real users. Every change must leave them green.

| ID | Page/Route | Regression check |
|---|---|---|
| R-01 | `/c/[childSlug]/school` | Renders with real grades; empty-state for no-sync (no demo numbers) |
| R-02 | `/c/[childSlug]/school/[classSlug]` | Class detail, assignments, uploads |
| R-03 | Check-in form + submit | POST works; teen sees own history; parent sees aggregates only |
| R-04 | Path-to-90 checkboxes | Teen toggles persist (after DEF-S3-002 fix); what-if never writes |
| R-05 | Teacher thread | Draft → approve → send flow; send-window respected; no AI-ghostwritten send path (FR-AI-004) |
| R-06 | `/verify-invite` | Public render, consume, redirect |

**Anti-regression rule:** no demo/fixture data may appear on these pages. If a sync hasn't run, the UI shows an honest empty state — never sample grades.

---

## 13. Defect checklist (filed 2026-10-12 · severity per QUALITY-PLAN §5)

Security defects stop the line: the phase does not exit until fixed and re-tested.

| ID | Severity | Defect | Spec ref | Owner |
|---|---|---|---|---|
| DEF-S3-001 | 🔴 **Critical — stops the line** | `checkins_tenant_read` RLS allows **any tenant member (including parents) to SELECT raw checkin `text`** directly via PostgREST. The in-product promise "private — just between you and Pookie" (checkin-form.tsx:114) is false at the data layer. The migration comment claims enforcement "in the route," but no route restriction can stop a direct table read. Fix: teen-only SELECT (or column-level redaction) per sol §5.3. | FR-SCHOOL-003, NFR-SEC-001/007 | Squad 3 devs |
| DEF-S3-002 | 🟠 High | `PATCH /school/plans/:planId` is **parent-only** (route comment + `requireParentRole`); `study_plans_*` RLS grants writes to parent role. Spec requires the opposite for Path-to-90 checkboxes: **teen (owner) full CRUD, parent read-only** (sol §1.4). Until fixed, parents can edit the teen's checkboxes. | FR-SCHOOL-007 | Squad 3 devs |
| DEF-S3-003 | 🟠 High | No counselor-mail segregation: `listTeacherMessages` reads a single `teacher_messages` table with no counselor filtering; no counselor table/endpoint exists. Ships as **merged inbox = 🛑 blocked** (ASCA B.2). | FR-SCHOOL-002 | Squad 3 devs |
| DEF-S3-004 | 🟠 High | No CC redaction: non-linked students in CC'd teacher emails are never redacted before parent-visible render. | FR-SCHOOL-016 | Squad 3 devs |
| DEF-S3-005 | 🟡 Medium | Calibration (`calibration_scores`, `checkin_estimates`) **not built** — algorithm, endpoints, RLS, and UI all pending. §3 tests cannot run; work package not done. | FR-SCHOOL-003, sol §5 | Squad 3 devs |
| DEF-S3-006 | 🟡 Medium | AI quiz pipeline **not built** — verify the flashcards-only fallback is what's actually shipping (Q-FC-01) and that no AI-generated question can render. | FR-SCHOOL-005 | Squad 3 devs |
| DEF-S3-007 | 🟡 Medium | Muse 18+ direct-mode gate **not built** — verify §7 at build time (UI + API). Note: existing "Muse" naming = legacy tutor queue, not the gated mode; rename on sight to avoid confusion. | FR-AI-002 | Squad 3 devs |
| DEF-S3-008 | 🟡 Medium | `court_order_restriction` flag **not implemented** in code (spec-only). Self-serve disable path (SP-CT-01/02) untestable. | FR-AUTH-011, FR-SAFETY-011 | Squad 3 devs |
| DEF-S3-009 | 🟡 Medium | No QR generation for invite-from-inside — only the raw `/verify-invite?token=` URL exists. "Fastest path" UX depends on it. | FR-AUTH-011 | Squad 3 devs |
| DEF-S3-010 | 🟡 Medium | Corroborated claim flow (open signup "Connect to my family") **not built** — v1 scope per D5 revised. §6.1/6.3 tests un-runnable; no placeholders allowed when built. | FR-AUTH-011 | Squad 3 devs |
| DEF-S3-011 | 🟠 High (no-placeholders rule) | **Essay-feedback STUB**: `src/server/essay-feedback.ts:26` — "no AI provider is called," local deterministic length/prompt checks only — behind a real shipped endpoint (`/api/v1/children/[childId]/college/essays/[essayId]/feedback`). If the UI presents this as AI essay feedback, it's a placeholder violation. Either wire the provider or ship honest copy ("basic checks — AI feedback coming with the quiz pipeline pilot"). | FR-SCHOOL-009, no-placeholders directive | Squad 3 devs |
| DEF-S3-012 | 🟡 Medium (cross-squad) | **TODO(email)**: `src/lib/tenant/actions.ts:219` — no transactional email provider wired; email send path is a no-op stub. Found by placeholder audit P3; flagged for Platform QA to own. | NFR-SEC-007 (audit), no-placeholders directive | Platform Team 1 |

---

## 14. Local vs staging test matrix

| Area | Runnable locally (`npm run build` ✅) | Requires staging |
|---|---|---|
| Placeholder audit §1, tsc, console.log scan | ✅ Done — PASS | — |
| Calibration math C-ALG-01–06 | — | Code + unit tests (run in CI when built) |
| Calibration 403 assertions C-SEC-01 | — | Script `calibration-403-check.sh` — needs real JWTs (teen + Parent A) |
| Blocklist sampling B-SER-01/02 | — | Script `parent-blocklist-check.sh` — needs staging + parent JWT |
| RLS verification §10.1 | Partial (policy text review) | Real-JWT probes — staging |
| Claim flow §6.1/6.3 | — | Full implementation + staging |
| Invite flow §6.2 | Route tree verified locally | Token crypto, expiry, single-use — staging |
| Muse gate §7 | — | Build + staging |
| Perf §11.1 | — | Staging smoke + timings |
| A11y §11.2 | Static review locally | Interactive (keyboard, reduced-motion) — staging |
| Regression §12 | Build-level | Live staging pass |
| Daily-update audit §11.3 | — | Staging with real sync sources |

---

## 15. Scripts

- [`scripts/placeholder-audit.sh`](scripts/placeholder-audit.sh) — runs locally; the §1 gate.
- [`scripts/calibration-403-check.sh`](scripts/calibration-403-check.sh) — staging; parent-JWT 403/empty assertions on every calibration endpoint (run when endpoints land).
- [`scripts/parent-blocklist-check.sh`](scripts/parent-blocklist-check.sh) — staging; samples parent-visible API payloads for blocklisted fields; intended for CI + the nightly access-audit job.

---

**Next:** fix DEF-S3-001 (stops the line), then DEF-S3-002/003/004; land calibration (§3), claim flow (§6), Muse gate (§7) with zero placeholders; re-run this plan end-to-end. Nothing in §5–§9 ships to a real family until its fix is built **and** re-verified (QUALITY-PLAN §1 🛑 gate).
