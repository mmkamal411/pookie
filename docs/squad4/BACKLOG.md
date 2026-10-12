# Squad 4 — Home & Money Track 🏡 — Backlog

**Version 1.0 — 2026-10-12 · PM: Squad 4 PM (PMP) · Branch `staging-build`**
**MD directives baked in:** D6 tiered time-boxed grants (docs/MD-DECISIONS.md); **NO PLACEHOLDERS** (Mehedi 2026-10-12) — every story ships real tables, real endpoints, real UI, real RLS; no mock data, no stubs, no TODOs. The W24/W14 "pending legal review" states are **real working states** (module fully built; gate is legal, not technical).

**Prioritization:** PANEL-ROUND2-SOLUTIONS.md §9 dependency order — Phase 1 (W20 rank 6 → W21 rank 9) → Phase 3 (W11 rank 16 → W7 rank 17 → W24 rank 18) → Phase 6 (W12 rank 24 → W14 rank 25). Cross-cutting legal-gate infra (S4-X-01) comes first because every gated module rides on it.

**Global DoD for every story:** real Supabase tables + RLS verified by attempted bypass; real API routes enforcing the access matrix server-side (NFR-SEC-007); real UI wired to real data; E2E test against seeded real data; `npx tsc --noEmit` clean; zero console.logs; zero dead code; no TODOs (Mehedi code-cleanliness rule); BUILD-LOG evidence.

---

## Epic X — Cross-cutting (build first)

### S4-X-01 — Legal-gate infrastructure (5 pts)
**FR:** NFR-LEGAL gate mechanics (sol-legal §15). **Story:** As the platform, I gate user-facing access to W21-photo-intake, W24, and W14 behind counsel sign-off rows so no gated surface reaches a real family early.
**Acceptance criteria:**
- AC1: `legal_gates` table (`gate_key`, `module`, `status` ∈ `pending|cleared|deferred_with_acceptance`, `reviewer`, `reviewed_at`, `evidence_ref`) with RLS (admin-write, read for gate checks only).
- AC2: Every gated module checks its gate server-side; `pending` renders the module's **real** "under counsel review" state (live copy from the gate row, contact path, no fake functionality).
- AC3: E2E: flip gate → module becomes visible to test user; flip back → gated again. Verified against staging data.
- AC4: MD risk acceptance (`deferred_with_acceptance`) requires Mehedi's written record filed in `docs/pm/`.

### S4-X-02 — Squad code-cleanliness sweep per milestone (3 pts)
**Story:** As QA, I run the cleanliness sweep so no shipped code carries dead code, console.logs, or TODOs.
**AC:** grep for `console\.log|TODO|FIXME|placeholder` returns zero in squad paths at each milestone exit; documented in BUILD-LOG.

---

## Epic W20 — Shopping List (🟢, live at `/household/shopping`, hardening only)

### S4-W20-01 — RLS + household-scoping hardening audit (3 pts)
**FR:** FR-MOD-W20; FR-MOD-X01 (sibling/household leakage).
**Story:** As a household member, my shopping list is visible only within my household scope.
**AC:**
- AC1: Every shopping query filters `household_id` server-side; attempted cross-household read returns 0 rows (pen-test style attempt documented).
- AC2: Per-child boundary: revoking access on child 1 leaks nothing into shopping surfaces, digests, or the child switcher (E2E with two children).
- AC3: Existing CRUD behavior unchanged; regression test green.

### S4-W20-02 — Concurrent-edit conflict handling (5 pts)
**Story:** As two shoppers editing simultaneously, neither of our updates is silently lost.
**AC:** Two sessions add/complete items concurrently against real data → both writes land, no lost updates; conflict surfacing tested E2E.

### S4-W20-03 — Data-shape robustness + a11y (3 pts)
**Story:** As a user, the list stays usable with long names, 200+ items, and assistive tech.
**AC:** 200-item list renders without jank; long names wrap; labels/keyboard nav pass NFR-A11Y-001 checks.

---

## Epic W21 — Mail, photo intake (🟡, Phase 1 rank 9)

### S4-W21-01 — Photo intake + OCR extraction pipeline (8 pts)
**FR:** FR-MOD-W21. **Depends:** OCR vendor assessment (Fractional Team 1, COPPA vendor assurances); `legal_gates` row for W21 photo intake.
**Story:** As a user, I photograph a bill/letter and Pookie extracts payee, amount, due date.
**AC:**
- AC1: Real `mail_items` table + storage bucket; upload → real OCR vendor call → extracted fields persisted; E2E photo→fields against real vendor response.
- AC2: On-device redaction guidance shown pre-upload ("cover the full account number — we only need the last 4 and the amount").
- AC3: Extraction failures surface a real retry path, never a silent drop.

### S4-W21-02 — Extract-then-mask, last-4 only (5 pts)
**FR:** FR-MOD-W21; NFR-PRIVACY-009 (sol-legal §12).
**Story:** As a user, Pookie never stores my full account/card numbers.
**AC:**
- AC1: Automated canary test: full 16-digit PAN in → only last-4 persisted; full number appears nowhere (DB, logs, exports).
- AC2: Masking enforced at the extraction boundary (server-side), not in UI.

### S4-W21-03 — Raw-image auto-delete ≤30 days (5 pts)
**FR:** FR-MOD-W21; NFR-PRIVACY-002.
**Story:** As a user, my raw mail photos are deleted automatically within 30 days.
**AC:**
- AC1: Scheduled purge job deletes raw images ≤30 days post-extraction; deletion evidenced in audit log; backups follow the same cadence.
- AC2: "Delete now" button deletes immediately and verifiably.
- AC3: Extracted metadata follows the per-source retention schedule (sol-legal §6); raw images never enter long-term retention.

---

## Epic W11 — Spending (🟠, Phase 3 rank 16)

### S4-W11-01 — Bank integration (Plaid or equivalent) (13 pts)
**FR:** FR-MOD-W11. **Depends:** Managing Director procures Plaid (or equiv) sandbox + prod credentials; vendor DPA (no-training-on-inputs, breach SLA).
**Story:** As a user, I link my bank and see transactions sync.
**AC:**
- AC1: Real Link/token-exchange flow; real account + transaction sync into `spending_accounts`/`spending_transactions`; E2E connect→sync in sandbox.
- AC2: Sync failures show a real reconnect path; no fake balances — an unlinked account shows "not connected," never $0.
- AC3: Credential/token material encrypted per vault rules (NFR-SEC-006).

### S4-W11-02 — Categorization engine (8 pts)
**Story:** As a user, my transactions are categorized accurately and I can correct them.
**AC:**
- AC1: Deterministic rules + learned mapping; uncategorized rate measured on a labeled seed set and recorded.
- AC2: User recategorization persists and retrains future mapping; corrections visible immediately.

### S4-W11-03 — GIPA masking to last-4 everywhere (5 pts)
**FR:** FR-MOD-W11; NFR-PRIVACY-009.
**Story:** As a user, my full account numbers appear nowhere in the app.
**AC:** Canary test across UI, API responses, logs, exports: only last-4. Never-log-plaintext verified (sol-legal §10 rule reused).

### S4-W11-04 — Teen's own purchase detail is teen-private (8 pts)
**FR:** FR-MOD-W11; NFR-PRIVACY-004 (per-scope server-side filtering).
**Story:** As a teen, my purchase line-items are mine; as a parent, I see only aggregates within my granted scopes.
**AC:**
- AC1: Parent surfaces show aggregates only; line-item detail is filtered server-side by scope (not hidden by CSS).
- AC2: Teen sees full detail on their own records. Scope-filter bypass attempts return 403 (documented test).
- AC3: Behavior is consistent across UI, digests, and API responses.

### S4-W11-05 — FTC Disposal Rule disposal path (3 pts)
**FR:** FR-MOD-W11 (sol-legal §12).
**Story:** As a user deleting financial data, disposal follows the FTC Disposal Rule.
**AC:** Deletion uses secure electronic deletion; counsel confirms applicability to each holding; deletion evidenced.

---

## Epic W7 — Money & Documents vault (🟠, Phase 3 rank 17)

### S4-W7-01 — Encrypted vault schema + envelope encryption (13 pts)
**FR:** FR-MOD-W7; NFR-SEC-006 (sol-legal §10). **Depends:** Fractional Team 2 key-management shape (envelope encryption, KMS-held master key, rotation schedule). **Hard precondition:** no real credential persists until the encryption path is live and verified in staging (gated deploy check).
**Story:** As a user, my stored credentials/documents are encrypted before they touch the database.
**AC:**
- AC1: Field-level encryption at rest for credentials, tokens, session material; TLS in transit; envelope encryption with per-credential data keys.
- AC2: Staging gate test: attempt to store a credential with encryption off → rejected; canary credential decrypts correctly with encryption on.
- AC3: Never persist full card numbers (same masking as W21 — AC verified by canary test).

### S4-W7-02 — Vault CRUD UI on real data (8 pts)
**Story:** As a user, I add, view, and delete vault items and they round-trip correctly.
**AC:** Add → encrypted store → retrieve decrypts → delete removes; RLS self-only verified by cross-user read attempt.

### S4-W7-03 — Never-log-plaintext, rotation, cryptographic erasure (8 pts)
**FR:** NFR-SEC-006.
**AC:**
- AC1: Canary credential submitted through every path (app, sync worker, support tooling) appears in no log (CI secret-pattern scan + staging assertion).
- AC2: Rotation re-wraps data keys; old keys destroyed; evidence logged.
- AC3: Erasure deletes the data key → credential unrecoverable (verified, not assumed).

### S4-W7-04 — At-18 credential handoff (5 pts)
**FR:** NFR-SEC-006 (sol-legal §10.5).
**AC:** On FERPA transfer, the parent-connected school credential is cryptographically **retired** (not transferred); adult student adds their own; pulls stay paused until handoff completes; parent gets fact-only notification.

### S4-W7-05 — Vault retention schedule (3 pts)
**FR:** NFR-PRIVACY-002.
**AC:** Per-source retention rows implemented for vault contents; raw financial images ≤30 days; purge evidenced.

---

## Epic W24 — Credit → minor security-freeze management (🔴, Phase 3 rank 18)

**Scope lock:** 3-bureau monitoring, score tracking, bureau pulls are CUT — no FCRA-covered activity exists anywhere in the code (no stubs, no dead branches). **Legal gate:** FCRA/consumer-finance counsel sign-off on the freeze pivot + licensed-partner contract before any real-family exposure. The module is fully built and E2E-tested in staging; the gate is legal, not technical.

### S4-W24-01 — Guided minor freeze placement/lift, per bureau (8 pts)
**FR:** FR-MOD-W24 (O.C.G.A. §§ 10-1-914/914.1; sol-legal §11).
**Story:** As a parent/guardian, I place and later lift a security freeze on my minor's credit file, guided step by step.
**AC:**
- AC1: Real `credit_freezes` table: per-bureau checklist, document checklist, confirmation tracking, status timeline — all functional against real data.
- AC2: The app **guides and tracks**; it never pulls the credit file itself (no bureau API integration anywhere — verified by code audit).
- AC3: Plain-language explainer: what a freeze does/doesn't do; GA-specific rights (≤8th-grade reading level per FAQ standard).

### S4-W24-02 — Lift-before-application reminders (5 pts)
**Story:** As a parent, I'm reminded to lift the freeze before events that need credit (first job, college applications).
**AC:** Reminders fire from real schedule data; dismiss/snooze persist.

### S4-W24-03 — Credit-hygiene coaching via licensed partner (8 pts)
**FR:** FR-MOD-W24 (sol-legal §11).
**Story:** As a user, I get trustworthy credit-hygiene coaching, never personalized credit advice from Pookie.
**AC:**
- AC1: Real content store; disclaimer "Pookie is not a credit reporting agency; we do not provide credit scores or reports" on feature entry **and** every coaching surface.
- AC2: Partner contract terms enforced in code: partner receives no child PI without explicit consent; termination path for compliance failure (documented).
- AC3: No personalized credit advice anywhere — content is educational only (reviewed by counsel).

### S4-W24-04 — Age gating (3 pts)
**FR:** FR-MOD-W24 (sol-legal §11.5); WBS 3.5 (menu age-gating).
**AC:** <16: parent/guardian action only; 16–17: teen participation with guardian; 18+: self-service. Credit hidden from teen accounts (<18) per menu age-gating — hidden, not footnoted.

---

## Epic W12 — Babysitters (🟡, Phase 6 rank 24)

**D6 tiered caps apply throughout:** 8 grants/grantee/30d for recurring/trusted grantees (previously approved, no blocks on record); 2/30d for first-time grantees; installment detection active for **both** tiers; teen co-approval (13–15) required for **NEW grantees only** — renewals of existing grantees within cap do NOT re-prompt the teen. (docs/MD-DECISIONS.md D6.)

### S4-W12-01 — Sitter directory with honest labeling (5 pts)
**FR:** FR-MOD-W12; FR-ACCESS-011.
**Story:** As a parent, I keep a vetted sitter directory; as a teen, I can see the label too.
**AC:**
- AC1: Full CRUD on `sitters` (real table, RLS); every sitter profile shows "parent-vetted, not background-checked by Pookie" — visible to teen viewers as well (per Proposal 2 open question; default to visible).
- AC2: Emergency card (contacts, allergies, address) is reachable from the directory and is **never gated by grant state**.

### S4-W12-02 — "Share for a bit" time-boxed grant flow (13 pts)
**FR:** FR-ACCESS-011 (Proposal 2); D6. **Depends:** the time-boxed-grant column migration on `child_access` (`expires_at`, `grant_kind`, `grant_purpose`, `recurrence_rule`) — Platform Team 1 (see DEPENDENCY-MAP.md D-01; D6 caps already in 018 RPCs). **Fallback:** S4-W12-F.
**Story:** As a parent, I share sitter-basics access for one evening with occasion-based expiry.
**AC:**
- AC1: Occasion presets with computed end times ("This evening — ends tonight at 11:00 PM"); purpose + reason code mandatory (`babysitter|pickup|tutor`), audited.
- AC2: Scope allowlist enforced **at the RPC layer**: temporary grants REJECT Reflection/Wellness/H2/H3/full-communications (attempted grant with forbidden scope → 403, documented).
- AC3: "Ongoing" requires deliberate confirmation + schedules the 90-day review nudge.
- AC4: E2E against real `child_access` rows with real `expires_at`.

### S4-W12-03 — Tiered frequency caps + installment detection, server-side (8 pts)
**FR:** FR-ACCESS-011; D6.
**AC:**
- AC1: Trusted tier (previously approved grantee, no blocks on record): max **8 grants/grantee/rolling-30d**; first-time tier: max **2/grantee/rolling-30d**. Exceeding converts to the indefinite-grant flow (teen approval at 13+).
- AC2: Installment detection (split grants evading caps) runs for **both** tiers; flagged patterns surface on the teen's Sharing screen ("Jordan has had 6 temporary grants in 2 months — make this regular or stop?").
- AC3: Blocks propagate: blocked adult + household cannot receive temporary grants; 30-day re-request lockout; no grants during safe-exit suppression window.
- AC4: Cap-bypass attempts fail at the RPC layer (documented tests for both tiers).

### S4-W12-04 — Teen co-approval (13–15) for NEW grantees only (5 pts)
**FR:** FR-ACCESS-011; D6.
**AC:**
- AC1: First-time grantee (13–15 teen): teen gets heads-up notification with one-tap change/revoke; **co-approval required before the grant activates**.
- AC2: Renewal of an existing grantee within cap: **no teen re-prompt** — grant activates, teen gets the standard visibility entry only.
- AC3: Teen revoke of a parent-made sitter grant is instant (no cooling-off — safety action).

### S4-W12-05 — Expiry as a slope + attribution-free notices (5 pts)
**FR:** FR-ACCESS-011 (Proposal 2).
**AC:**
- AC1: T-24h parent nudge → T-1h/T-15m sitter wrap-up banner → at expiry "All done" screen with [Request more time] + [Text parent] + 10-minute read-only grace on open screens.
- AC2: Expiry notice is a single quiet notice with **zero attribution** ("Your access has ended" — indistinguishable from natural expiry vs teen-initiated); no re-request CTA in the notice.

### S4-W12-06 — Saved grant templates, one-tap re-grant (3 pts)
**FR:** FR-ACCESS-011.
**AC:** "Same again next Saturday?" template → fresh expiry, fresh teen heads-up, fresh audit row. **No auto-recurring** (standing grants are a surveillance leak).

### S4-W12-F — Fallback: directory + manual revoke ships first (5 pts) *(only if 023 is late)*
**Story:** As a parent, I manage sitter access fully even before time-boxed grants land.
**AC:** Directory + indefinite grant + one-tap revoke are complete, working features (not a stub). S4-W12-02…06 unlock when the time-boxed-grant column migration lands. See DEPENDENCY-MAP.md.

---

## Epic W14 — Co-parenting → parallel-parenting mode (🔴, Phase 6 rank 25)

**Scope lock:** High-conflict co-parenting as originally designed is 🛑. Target design = parallel-parenting mode. **Launch = read-only/logistics-only** until family-law practitioner review (R5). The module is fully built and E2E-tested in staging; the legal gate controls real-family exposure, not technical completeness.

### S4-W14-01 — Parallel-parenting surfaces (13 pts)
**FR:** FR-MOD-W14 (sol-access/coparenting; EXPERT-SOLUTIONS G16).
**Story:** As a co-parent, I coordinate logistics on my own surface with no shared messaging to screenshot.
**AC:**
- AC1: Separate per-parent surfaces; logistics data (schedule, handoffs, expenses) visible to both; **no shared messaging primitive exists in the codebase** (verified by audit).
- AC2: Each parent's private notes/strategy are invisible to the other parent (server-side enforcement, bypass attempt documented).

### S4-W14-02 — Immutable, uneditable log (8 pts)
**FR:** FR-MOD-W14.
**AC:**
- AC1: Append-only `coparent_log` table; UPDATE/DELETE revoked at the DB role level — edit attempts fail with a permission error (documented test).
- AC2: Log is teen-visible where age-appropriate; exportable for court with integrity evidence (hash chain or equivalent).

### S4-W14-03 — Custody-order awareness (8 pts)
**FR:** FR-MOD-W14; FR-SAFETY-011; FR-SAFETY-012.
**Story:** As a parent with a court order, the app respects it without auto-enforcing law.
**AC:**
- AC1: `court_order_restriction` flag + human-review queue (WBS 7.6): flagged orders route to human review; the app **never auto-enforces** custody terms.
- AC2: Travel-restriction profile (FR-SAFETY-012) links to W14: restricted travel scenarios surface a real warning from the custody profile.
- AC3: The teen is told plainly why access changed when a court order alters it (FR-SAFETY-011).

### S4-W14-04 — Read-only/logistics-only launch surface (8 pts)
**FR:** FR-MOD-W14; R5.
**Story:** As a launching user, co-parenting covers scheduling, handoffs, and expense logging — nothing more.
**AC:**
- AC1: Handoff scheduler, shared calendar entries, expense log: all functional against real data.
- AC2: No messaging, no negotiation tools, no sentiment features — expansion requires the family-law review gate to clear (legal_gates row).

### S4-W14-05 — Neutral teen-facing coaching + pattern flags (5 pts)
**FR:** FR-MOD-W14.
**AC:** Teen sees neutral, non-blaming coaching copy; pattern flags (e.g., repeated late handoffs) are factual and bilateral — never framed as one parent's fault.

### S4-W14-06 — No child-as-courier (3 pts)
**FR:** FR-MOD-W14.
**AC:** Audit of all message/task/approval flows: **no** flow routes a parent-to-parent communication through the child's account (verified; test documents every communication path).

---

## Story-point summary

| Epic | Stories | Points |
|---|---|---|
| X Cross-cutting | 2 | 8 |
| W20 Shopping (hardening) | 3 | 11 |
| W21 Mail | 3 | 18 |
| W11 Spending | 5 | 37 |
| W7 Vault | 5 | 37 |
| W24 Credit freeze | 4 | 24 |
| W12 Babysitters | 6 + fallback | 43 (+5 fallback) |
| W14 Co-parenting | 6 | 46 |
| **Total** | **34** | **224** (+5 fallback) |

**Build order:** S4-X-01 → W20 → W21 → W11 → W7 → W24 → W12 → W14, per §9 dependency order. W24 and W14 build fully but stay behind their `legal_gates` rows until counsel clears them.
