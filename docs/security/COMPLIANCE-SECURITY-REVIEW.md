# Compliance Review — Security Controls (COPPA / FERPA / Retention / Consent / Health Tiers)

**Reviewer:** Fractional Team 2 — Compliance Reviewer (security lens)
**Date:** 2026-10-12 · **Branch:** `staging-build` · **Tree verified against:** commit `306c8e5` (migration renumber 024–049)
**Panel references:** `docs/ACCESS-MODEL-REVIEW-CHECKLIST.md` (G1–G28), `docs/PANEL-ROUND2-SOLUTIONS.md`, `docs/BUILD-SPECIFICATION.md` (NFR-SEC / NFR-PRIVACY / NFR-LEGAL), `docs/USER-FIRST-ACCESS-MODEL-SPEC.md`, `docs/COPPA-REVIEW.md`
**Status of tree:** per BUILD-LOG working assumption, migrations 001–013+ are **files-only, not applied to any live DB**. **Tree-state addendum (2026-10-12 ~04:20, after the sibling Security Engineer's entry):** in-tree `025_rls_foundation.sql` is **truncated mid-function** (283 lines, literal `[truncated 16210 chars]` marker) and will fail on apply — it must be replaced by the sibling's staged `~/workspace/pookie-security-staging/rls_foundation.sql` during folding. An **MD freeze** is in effect on `supabase/migrations/`. Consequently, every verdict below that cites 025 is marked **STAGED, NOT IN-TREE**; the in-tree behavior is the pre-025 version. The sibling's staged policies also depend on the phantom `children.user_id` column (F2/F3) — flagged as a cross-team reconciliation item below.

> **Not legal advice.** This is a compliance-operations review of whether the technical controls satisfy the panel's stated requirements and the NFR-LEGAL gates. Items in §7 require licensed-attorney sign-off before build decisions lock (NFR-LEGAL-001–007).

---

## Executive summary

**Compliance posture: materially improved in-tree, with five launch-blocking defects remaining.**

The good news: since the panel review, the tree gained the load-bearing COPPA controls — `027_under13_bans.sql` enforces no-under-13 child-role linkage at the DB-trigger level (no privileged bypass), `042_checkin_calibration.sql` adds teen-deletable check-ins with rolling purge, and health privacy is genuinely tiered (011 `health_tier_visible()` / H0–H3 amended, 022/023 counsel-gated). The revoked-parent data-access fix (`current_child_ids()` honoring `status='active'`) exists only in the sibling's **staged** `rls_foundation.sql` — the in-tree 025 is truncated and un-applyable (see tree-state addendum). **None of the migrations are applied to a live DB yet** — these are tree-verified only.

The bad news: **six 🔴 launch-gate defects** were found, three of them cross-migration contract breaks that will surface at apply time or first call:

1. **`log_access_event()` signature mismatch (021 vs 018/019/020 callers)** — every grant/revoke/redeem/request RPC will abort with "function does not exist", rolling back the primary mutation. The entire access-authority layer (018/019/020) is non-functional until reconciled. 🔴
2. **`access_events_teen_select` (021:132–139) and `access_scopes_select` (026:185–196) reference `children.user_id`, a column no migration ever creates** — the teen-visible audit-trail requirement cannot be satisfied; 021's policy likely fails at apply. 🔴
3. **`027` Ban-3 (`access_requests_under13_guard`) also reads `children.user_id`** — it will raise the wrong error at runtime, blocking legitimate adult access-requests on under-13 children (the intended adult pass-through is broken). 🔴
4. **`/verify-invite` (016 `get_invite_preview` + `src/app/verify-invite/page.tsx`) discloses the child's first name, nickname, invite email, and inviter email to anonymous viewers pre-auth** — directly violates NFR-PRIVACY-005 ("zero child PII pre-auth") and the COPPA confidentiality duty (16 CFR 312.8). 🔴
5. **Guardian attestation at child creation is UI-only** (`src/app/onboarding/components/step-children.tsx`): `create_child()` (001:590; 025:263 redefinition in the truncated file) takes no attestation parameter and stores no attestation timestamp — a direct RPC call bypasses the panel-required attestation (checklist 1.1.2). 🛑
6. **In-tree `025_rls_foundation.sql` is truncated and un-applyable** (283 lines, literal `[truncated 16210 chars]` mid-function; sibling confirms, BUILD-LOG ~04:20). Until the staged replacement folds in, the in-tree `current_child_ids()` is 001's version with **no `status` filter** — so the revoked-parent data-access hole (§2.5) is **open in-tree**: a `status='revoked'` parent keeps full tenant reads. The fix exists only in staging. 🔴

Sibling Security Engineer's report was not present at `docs/security/SECURITY-AUDIT-REPORT.md` at review time (§6 = pending; likely overlaps on F1–F3 and the revoke hole).

---

## §1 — COPPA technical-controls checklist (panel §1.1.4: "technical guarantee, not policy")

| # | Requirement (panel) | Control location | Verdict |
|---|---|---|---|
| 1.1 | No under-13 child login / session linkage, server-side | `027_under13_bans.sql` — `trg_child_access_under13` (Ban 1): BEFORE INSERT/UPDATE on `child_access` raises `under13_child_login_denied` when `NEW.role='child'` and `is_minor_13()`; unknown/NULL DOB fails closed; **no privileged bypass by design** | **ENFORCED** ✅ |
| 1.2 | No under-13 invite acceptance | Ban 1 trigger fires inside `consume_invite()` (001:487) write path — the child-role `child_access` INSERT raises before it can persist | **ENFORCED** ✅ (defense-in-depth) |
| 1.3 | No link-code issuance for under-13 | Ban 2 trigger (`trg_link_codes_under13`) + `redeem_link_code()` age gate (`019_link_codes.sql:141`, `under13_link_forbidden`) + `child_age_tier()` (018) | **ENFORCED** ✅ |
| 1.4 | DOB-corrected-downward re-tiering | Ban 4 (`trg_children_dob_under13_sever`): any `date_of_birth` edit making the child <13 severs existing child-role linkage + writes `access_events` | **ENFORCED** ✅ |
| 1.5 | No persistent identifiers for under-13 from a child's device | Schema: no device-ID/ad-ID columns anywhere; auth cookies belong to adult account holders. Under-13s cannot obtain a session (1.1). `children.slug` is a stable identifier but is parent-managed metadata, not a child-device identifier | **ENFORCED** ✅ (with note) |
| 1.6 | Guardian attestation at child creation | UI only: `src/app/onboarding/components/step-children.tsx:23-28, 92, 269` (unchecked-by-default checkbox, client-side gate). `create_child()` (`025_rls_foundation.sql:263`) accepts no attestation param; no `attestation_at` column on `children`; server RPC does not check | **POLICY-ONLY** 🛑 — F5 |
| 1.7 | DOB gate at profile creation | `createChildSchema` (`src/app/api/v1/children/route.ts`) and `create_child()` take **no DOB input at all** — DOB can only be set later via `updateChild` | **MISSING** ⚠️ |
| 1.8 | Zero child PI on `/verify-invite` pre-auth (NFR-PRIVACY-005) | `016_invite_preview.sql` `get_invite_preview()` grants EXECUTE to **anon** and returns `child_first_name`, `child_nickname`, invite email, inviter email; `src/app/verify-invite/page.tsx:36-44` renders them before sign-in | **MISSING** 🔴 — F4 |
| 1.9 | Under-13 child-typable fields (AI chat, check-ins) blocked server-side | No under-13 session can exist (1.1), so direct child typing is structurally impossible. **Residual:** `POST /api/v1/tutor/chat` (`src/app/api/v1/tutor/chat/route.ts`) has no age-tier check — a parent in an under-13 household can relay the child's dictated words to the AI (conduit collection, COPPA-REVIEW Q3.5 — flagged for counsel, §7) | **ENFORCED at session layer; conduit risk POLICY-ONLY** ⚠️ |
| 1.10 | AI-chat in under-13 context rejected server-side | Same as 1.9 — the route trusts the session invariant; no `is_minor_13()` check in the tutor route or the pookie-tutor worker contract | **POLICY-ONLY** ⚠️ |
| 1.11 | No verification invite or link code may be ISSUED for under-13 | Issuance: Ban 2 trigger (ENFORCED). App layer: `sendChildInvite()` (`src/lib/tenant/actions.ts:144`) performs no age check before minting — the DB trigger raises, but the parent sees a raw DB error after a verify URL was generated; add an app-side pre-check for clean failure | **ENFORCED (DB) / MISSING (app UX)** ⚠️ |
| 1.12 | 13th-birthday transition job (COPPA-REVIEW Q5) | Not found in migrations or app code (no job notifies parent / offers data review / invites teen login at 13) | **MISSING** ⚠️ |
| 1.13 | Claim-dedupe fires only after email verification (NFR-PRIVACY-006) | `049_second_parent_claim.sql` — corroborated claim flow, uniform no-oracle response, rate limits, never auto-grant; `submit_parent_claim()` inside SECURITY DEFINER | **ENFORCED** ✅ (reviewed header only; full RPC audit deferred to Security Engineer) |
| 1.14 | COPPA statutory rights for both parents (§312.6, panel §3 flag) | No non-creator-parent verification + request workflow exists; the model routes everything through `granted_by` | **MISSING** ⚠️ (counsel design item, §7) |

**Notes on 1.5:** The 2025 COPPA Rule's biometric expansion (faceprints, gov IDs) — parent-uploaded photos containing the child's image are stored in `mail-photos`/avatars with no face-recognition use found in-tree; vendor no-training terms are a counsel/vendor-assurance item (§7, NFR-PRIVACY-008/010).

---

## §2 — Audit trail gap analysis (panel G-series; `access_events` required)

### 2.1 `access_events` exists in-tree — but its write path is broken

- `021_access_events.sql` creates `access_events` (append-only, no UPDATE/DELETE policies, device/ip as salted sha256 hashes, reason-code vocabulary) and `log_access_event(p_child_id, p_actor_user_id, p_event_type, p_subject_user_id, p_reason_code, p_metadata, p_amount_cents)` — **7 parameters**.
- **Callers in 018/019/020 use an 8-argument convention:** `log_access_event(child, actor, subject, event, granted_by, reason, NULL, NULL)` (018:375,496,513,523,602,647,689; 019:225; 020:174,267,307). **No 8-arg function exists → every call raises "function does not exist" → the enclosing RPC (grant_access, revoke_access, redeem_link_code, request_access, apply_cooling_off_revocations) aborts and rolls back.** Consequence: (a) access-authority mutations don't persist; (b) no `access_events` rows are ever written; (c) the subsequent `audit_event()` calls in the same RPCs never execute, so **`audit_log` also loses these events**. 🔴 **F1** — the single most severe finding: it disables the feature layer, not just the audit layer.
- Recommendation: reconcile to one signature (021's 7-arg form is the cleaner contract; 018/019/020 call sites must be rewritten — do NOT add an 8-arg overload, which would fork the contract).

### 2.2 Teen visibility of access history — broken by a phantom column

- `access_events_teen_select` (021:132–139): `WHERE c.id = access_events.child_id AND c.user_id = auth.uid()` — **`children.user_id` does not exist** (verified: no migration adds it; `children` carries `parent_user_id`). CREATE POLICY analyzes the expression at creation, so **021 likely fails at apply time**; at minimum the teen can never read their access history, violating the panel's teen-visibility requirement. 🔴 **F2**
- Same phantom reference in `access_scopes_select` (026:185–196) — the teen "sees all rows on their own record" arm is dead. 🔴 (same root cause)
- Same in 027 Ban-3 trigger (`SELECT c.user_id ... FROM public.children c`, 027:143): fires on access_requests INSERTs for under-13 targets → raises `column c.user_id does not exist` instead of the intended pass/deny logic → **legitimate adult access-requests on under-13 children fail**. 🔴 **F3**
- Root fix: the tree needs a decision — add `children.user_id` (the linked teen's auth id, per sol-access's assumed contract) OR rewrite the three call sites to resolve the teen via `child_access` (`role='child'`). The former is the sol-access contract; either way 021/026/027 must be consistent.
- **Cross-team escalation:** the sibling's staged `~/workspace/pookie-security-staging/rls_foundation.sql` also references `children.user_id` (lines 475, 479, 534, 553 — `access_requests_read`, `access_events_teen_select`, `access_events_subject_select`) while defining no `ALTER TABLE ... ADD COLUMN user_id` on `children`. The sol-access "assumed identity link" was never materialized by any migration. The folding process must either (a) add the column and set it in `redeem_link_code`/`consume_invite`/claim flows, or (b) rewrite all policies/triggers to resolve the teen via `child_access(role='child')`. Until then, both the in-tree and the staged policies are broken.

### 2.3 Revoked-parent exclusion — specified, not built

- 021 header comment: "Never shown to a revoked parent (RLS arms in a later security migration)" — **the arms were never written**. Once F2 is fixed, a revoked parent with any residual visibility must be excluded. Currently mitigated structurally: 025's `current_child_ids()` now requires `status='active'`, so most tenant funnels exclude revoked rows — but `access_events` policies don't use `current_child_ids()` at all. ⚠️

### 2.4 Does `audit_log` (004) cover the gap?

- **Integrity is good:** append-only enforced by both RLS (SELECT-only policy, 004:114) and grants (`GRANT SELECT` only, 004:199); `audit_event()` authz was fixed (F3); cross-tenant NULL-child read was closed (F4); secret-key denylist trigger (R2-3). **ENFORCED** ✅
- **Coverage is not:** audit rows for grant/revoke/redeem/request live inside the same RPCs broken by F1, so they are never written. `apply_cooling_off_revocations()` (018) writes only `access_events`, never `audit_event`. Routes write `auditEvent()` for invite_consume and child.created — those paths work.
- **Litigation-hold conflict:** `audit_log.child_id REFERENCES children ON DELETE CASCADE` — deleting a child row wipes the entire audit trail, contradicting FR-SAFETY-015's 7-year litigation-hold requirement. `access_events` uses `ON DELETE SET NULL` (correct pattern). 🟠 — needs a hold mechanism (NFR-LEGAL-005, §7).

### 2.5 Revoked parent vs audit history

- **In-tree: the revoked-parent data-access hole is OPEN.** `current_child_ids()` (001:440) has no `status` filter, so a `status='revoked'` parent retains full tenant reads — grades, check-ins, health metrics (tier permitting), `audit_log`, `consents`, and the membership roster itself. The 018 status model is therefore **cosmetic for data access** until the funnel is fixed. 🔴 (folded into executive-summary F6)
- The fix (status + expiry funnel in `current_child_ids()`, plus hardened `invites_before_write`/`create_child`/`revoke_child_access` gates) exists **only in the sibling's staged** `~/workspace/pookie-security-staging/rls_foundation.sql` — blocked on the MD-freeze folding process. After folding, revoked parents lose `audit_log` reads (policy is `child_id = ANY(current_child_ids())`).
- Cooling-off rows (`scheduled_revoke`/`pending_cooling`) remain visible during the window in the staged design — matches the panel's safe-exit design (parent UI shows access as unchanged). ✅ by design (staged).

---

## §3 — Retention-controls matrix (NFR-PRIVACY-001/002; panel G6, G17; COPPA 2025 Rule 16 CFR 312.10)

COPPA 2025: indefinite retention of children's PI is **per se non-compliant**; a written per-category schedule is required (NFR-LEGAL-005/007, §7).

| Data type | Required retention (panel/spec) | Enforcement found | Verdict |
|---|---|---|---|
| Check-ins (minor-generated content) | Teen-deletable + rolling auto-purge; never indefinite (G17; FR-SCHOOL-003) | `042_checkin_calibration.sql`: `checkins_teen_delete` RLS (teen-only DELETE, parents cannot delete/restore) ✅; `teen_privacy_settings.checkin_retention` ∈ {rolling_90d default, rolling_365d, manual_delete_only}; `purge_expired_checkins()` SECURITY DEFINER ✅ — **but no `cron.schedule` wiring in-tree** ("called by the service_role nightly worker" — external dependency) | **ENFORCED (delete) / PARTIAL (purge unscheduled)** 🟠 |
| Wellbeing entries (mood/journal) | Same as check-ins; tiered H3 → hard delete | `src/app/api/v1/health/wellbeing/route.ts`: DELETE via `rpc_health_record_delete`, H3 → hard delete next run; `auto_purge_after_days` ∈ {30,90,365} at write | **ENFORCED** ✅ |
| Health metrics / food logs | Grace + tombstone deletion | `024_health_grace_and_deletion.sql`: `sweep_health_grace`, `purge_tombstoned_health`, `purge_expired_health` — **pg_cron scheduled in-migration** (024:163,236,303) | **ENFORCED** ✅ |
| Mail raw photos / OCR images (W21) | Auto-delete ≤30 days; extract-then-mask (NFR-PRIVACY-009) | `040_w21_mail_retention.sql`: `auto_delete_at` column (30d default), `mask_account_numbers()`, `purge_expired_mail_photos()` ✅ — **but (a) no scheduler wiring (grep: 0 `cron.schedule` in 040), (b) the OCR pipeline never calls `mask_account_numbers()`** (no hits in `src/server/ocr/pipeline.ts` / `providers.ts`) — masking is aspirational until the pipeline invokes it | **POLICY-ONLY** 🛑 |
| School emails | School-year + 1 (NFR-PRIVACY-002) | No retention column, no purge job found | **MISSING** 🟠 |
| Raw financial images (W7 vault) | ≤30 days (NFR-PRIVACY-002/009) | No auto-delete found (`036_w7_vault.sql` — no purge) | **MISSING** 🟠 |
| Backups | Purged ≤30 days after source deletion (NFR-PRIVACY-002) | Not addressed in-tree | **MISSING** 🟠 |
| Account deletion (parent/teen erasure) | Cascade correctly; audit preserved under litigation hold | No deletion RPC/flow found anywhere in `src/` or migrations; `children.parent_user_id` FK has **no ON DELETE CASCADE** → parent account deletion is blocked while child rows exist; deleting a child wipes `audit_log`+`consents` (CASCADE) | **MISSING** 🛑 |
| `manual_delete_only` check-in setting | Must not equal indefinite for <13 (312.10) | The option exists for all ages; a parent could leave an under-13's check-ins undeleted forever | **Counsel question** (§7) |
| Access-request rows | 30-day TTL | `020`: `expires_at` default +30d; expired sweep referenced | **ENFORCED** ✅ (header-verified) |
| Link codes | 15-min TTL, single-use | `019`: `expires_at` now()+15min, `used_at`, one-live-code index | **ENFORCED** ✅ |
| Invites | 7-day TTL (child) | `015`: trigger-clamped 7d for `role='child'` | **ENFORCED** ✅ |

---

## §4 — Consent integrity findings (`consents` ledger, 004)

| Check | Finding |
|---|---|
| Forged attribution (`granted_by`) | **ENFORCED** — F1 fix: `consents_parent_insert` requires `granted_by = auth.uid()` (004:89–96); only parents may insert; trigger-free but policy-bound ✅ |
| Backdated/forged timestamps | **MISSING** 🛑 — `created_at timestamptz NOT NULL DEFAULT now()` (004:59) but callers hold `GRANT INSERT` (004:198) with no column constraint and **no immutable-timestamp trigger**; a parent can INSERT with an explicit past/future `created_at`. A legal ledger with forgeable timestamps is a dispute liability. Fix: `BEFORE INSERT` trigger forcing `NEW.created_at := now()` (non-privileged), or revoke the column from the INSERT grant. |
| Consent unbundling (Performance / Communications / Reflection / Wellness, 1.2.1) | **POLICY-ONLY** 🟠 — `consents.scope` is free text (`char_length > 0` only); the enforcement layer `access_scopes` (026) has the six scopes with teen-private defaults ✅, but **no consent-capture screen exists in the invite/link-code/request flows** in `src/` — the per-domain unbundled consent (unchecked by default, health subcategories, naming check-in text + mood explicitly) is spec'd, not built. Note the consent-screen requirement (≤8th-grade reading, no re-prompt 90d) has no app code at all. |
| 90-day no re-prompt after decline (NFR-PRIVACY-007, 1.2.1) | **MISSING** 🛑 — zero hits in migrations or `src/`. The only re-request rule in-tree is the 30-day access-request lockout (020) — a different mechanism. Needs a `consent_declines` record + server-side check in every consent prompt path. |
| Revocation = new row (append-only) | **ENFORCED** — no UPDATE/DELETE policies or grants (004) ✅ |
| Non-creator parent COPPA rights (§312.6) | **MISSING** — see §1.14 / §7 |
| `recipient` free text (FERPA accounting) | Schema allows arbitrary recipients; acceptable for v1, but disclosure-accounting queries should be tested against real rows before launch |

---

## §5 — Health-tier readiness verdict (panel 🛑 G3: H0–H3; launch-gate question)

**Question:** can parents see teen health data today with no tier system? **Answer: no — but the chain is counsel-gated, not launch-ready.**

**ENFORCED in-tree:**
- `011_w22_health_tracker.sql` (as amended in working tree): `health_tier_visible()` — H1 shareable wellness is tenant/Wellness-scope visible; **H2 teen-private (13+) requires an explicit teen grant or a time-boxed (≤30d), teen-notified, unappealed safety override**; **H3 legally sensitive is teen-only — no parent path, no grants, no overrides, no aggregates, no exceptions**. Tier is stamped at write from `metric_defs`, never re-derived at read.
- `012_w23_nutrition.sql`: `food_logs_diary_read` — parents of teen (or unknown-DOB) subjects get **zero diary rows**; their path is `nutrition_weekly_patterns()` aggregates only.
- Unknown DOB fails closed into the 13–15 (most restrictive) arm everywhere.
- Support-agent access (034): health / wellbeing / mood / check-in scopes are **not grantable** — the CHECK rejects them server-side; every scoped support read is audit-logged to `access_events`.
- 18+ cutover (023): `nightly_health_birthday_cutover()` (pg_cron) expires all pre-18 non-subject grants at 00:00 local; skip = `skipped_private` (panel G5 addressed); H3 excluded from transition-summary export by default.

**Caveats / residual risks:**
1. **The parent self-certifies safety overrides** (INSERT on `health_safety_overrides` with a ≥20-char reason). The override is audited and the teen is notified in-transaction — this is the panel-approved design — but there is no independent review before a parent reads H2 data. Acceptable per panel; note for counsel.
2. **H0–H3 is explicitly "DRAFT — not counsel-cleared"** (022 header; 011 amendment: "Full chain still BLOCKED on the NFR-LEGAL gate (counsel clears H0–H3)"). Do not let health modules hold real teen data before that gate clears — panel R9.
3. **`state_minor_consent_rules` ships `counsel_reviewed=false`** with nothing treating rows as authoritative — correct posture, keep it.
4. **Routine (H1) metrics are parent-visible by design** — fine under the access model, but the FAQ/support copy must not over-promise teen privacy on H1.
5. All health RLS funnels through `current_child_ids()` — correct **only after the staged `rls_foundation.sql` folds in** (in-tree 001 version has no status filter; see F6). Apply-order matters.

**Verdict: 🟢 no blanket parent visibility exists; launch-gate NOT triggered.** The remaining health work is the counsel gate (H0–H3 definitions, GA minor-consent rules) plus applying the migration chain in order.

---

## §6 — Compliance mapping of the Security Engineer's findings

**Status: PARTIAL.** The sibling's report is staged at `~/workspace/pookie-security-staging/` with a summary entry in BUILD-LOG (~04:20 EDT, "RLS + UNDER-13 BANS STAGED, RPC REVIEW COMPLETE"). A formal `docs/security/SECURITY-AUDIT-REPORT.md` still does not exist; full reconciliation when it lands.

**Already reconciled (sibling logged, this review references — not duplicated):**
| Sibling (BUILD-LOG ~04:20) | This review |
|---|---|
| P0 `log_access_event` arity mismatch (staging 8-arg overload planned, Part 5) | F1 — referenced; still not in-tree at 021 |
| `request_access` `requester_email` NOT NULL violation (P0-2) | Noted; compliance impact: access-request flow broken at runtime until fixed |
| `redeem_link_code` brute-force logic inverted (P1-1) | Noted; strengthens NFR-SEC-005 lockout requirement — current tree does not meet it |
| `generate_link_code` ignores `re_request_locked_until` (P1-2) | Noted; matches this review's §1.11 gap |
| Truncated in-tree 025 (P0 broken file) | F6 — referenced; this review adds that the staged replacement also depends on phantom `children.user_id` |
| `/verify-invite` pre-auth child PII (line 156) | F4 — referenced |
| Tutor worker scope filtering (SEC-004) | §1.9/1.10 — referenced |

**Instruction for reconciliation:** where the sibling already logged the same defect in BUILD-LOG, reference their entry rather than duplicating (per task brief). The six 🔴 items in this report's executive summary are the compliance-owned canonical list.

---

## §7 — Items needing licensed-attorney sign-off (NFR-LEGAL gates — do not ship on panel analysis alone)

Per `docs/BUILD-SPECIFICATION.md` NFR-LEGAL-001–007 and the panel §5 gates:

1. **NFR-LEGAL-001:** Terms of Service + arbitration + class waiver (11th Cir. post-*Concepcion*); parent/guardian must be the contracting party for 13–17 (minor voidability).
2. **NFR-LEGAL-002:** Mandatory-reporter program — designation, training, DFCS escalation (1-855-422-4453) — **before any human reads check-in content** (panel G7). Re-run the analysis at the first human/AI read of check-in content (checklist R12).
3. **NFR-LEGAL-003:** 18+ FERPA consent design — continuity vs pause-and-ask (checklist R3); 023 chose skip=private, needs counsel confirmation.
4. **NFR-LEGAL-004:** Cooling-off notification/retaliation matrix with **DV-advocate review** of all user-facing revoke/notify strings (panel G4 — the single most dangerous element per welfare/counselor/psychologist).
5. **NFR-LEGAL-005:** Data retention + litigation-hold procedure — including concrete per-category periods to replace "check-ins indefinite / emails TBD" (COPPA 2025, 16 CFR 312.10), the `manual_delete_only` question for <13, and the audit-trail preservation rule (fix §2.4's CASCADE wipe).
6. **NFR-LEGAL-006:** Law-enforcement / subpoena response policy — **do not build** disclosure tooling, LE portal, or approval UI before sign-off (FR-SAFETY-015).
7. **NFR-LEGAL-007:** COPPA compliance package — written retention policy, written infosec program, written vendor assurances/DPAs (Supabase, Cloudflare, OCR/AI vendors), privacy-policy overhaul per 2025 Rule (312.4/312.8 disclosures). Note: Fractional Team 1 produced issue-spotting drafts (commit `4d2b373`) — **attorney review pending, not cleared**.
8. **H0–H3 taxonomy clearance** (panel G3/R9; 022 + 011 amendment explicitly counsel-gated) + GA `state_minor_consent_rules` review before W22/W23 hold real teen data.
9. **"Parent-as-conduit" framing** (COPPA-REVIEW Q3.5) — no FTC case law; design the check-in as parent observation conservatively and get counsel's read.
10. **FTC Health Breach Notification Rule** determination for the health modules (COPPA-REVIEW Q2 flag).
11. **AI-training prohibition** (NFR-PRIVACY-010; MD decision D2): the absolute "NEVER train" promise must **not** be published until Cloudflare/AI-subprocessor DPA terms are verified (commit `76cf98f` has the DPA checklist).
12. **Both-parents COPPA rights** (§312.6) workflow design — non-creator parent's verified review/delete request honored without an app grant.
13. **State-law expansion triggers** (checklist R10): WA MHMDA, TX SCOPE, CA AB 2246/SB 1119, IL BIPA — any non-GA launch needs a state workstream.
14. **Emancipated-minor handling** (G11) — `legal_status` exists in 017/025; the adult-track-at-any-age rule needs counsel confirmation (note: 027 correctly refuses to let emancipation override COPPA <13).
15. **W24 Credit FCRA counsel sign-off + W14 family-law practitioner review** (already in BUILD-LOG as S4-BLK-002/003 — referenced, not duplicated).

---

## Appendix — verification notes & method

- Tree state changed mid-review (commit `306c8e5` renumbered migrations 024–049); all findings re-verified against the post-renumber tree. Pre-renumber reads of 018/019/020/021/016/017 map 1:1 by filename prefix.
- No live DB is reachable from this environment (per BUILD-LOG: vault hangs non-interactively, connector 403, no service-role key) — **all verdicts are static tree analysis**, not runtime proof. The F1 signature mismatch and F2/F3 phantom-column defects should be confirmed by `supabase db push --dry-run` or a staging apply before any fix is declared complete.
- Tree state changed twice mid-review (renumber commit `306c8e5`; sibling's ~04:20 staging entry + MD freeze on `supabase/migrations/`); findings were re-verified against the latest tree each time. The sibling's staged files at `~/workspace/pookie-security-staging/` were **read, not modified**.
- `docs/security/` and a formal sibling audit report did not exist at review time; §6 reconciliation is partial and continues when the formal report lands.
- Files touched by this review: this report only (plus the BUILD-LOG entry below). No code changed, nothing deployed.
