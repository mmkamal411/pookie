# Privacy Promises Audit

**Status:** ISSUE-SPOTTING DRAFT · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Authority:** GA Fair Business Practices Act, O.C.G.A. § 10-1-393(a) — privacy-policy and
marketing promises are enforceable by the AG. **Whatever Pookie promises, it must honor
in code.** This audit covers: the FAQ content standard (S1, FR-SUPPORT-001), the locked
`USER-FIRST-ACCESS-MODEL-SPEC.md`, and user-facing copy in the app (`src/app`).
**MD updates incorporated:** D2 (absolute "NEVER train" — publish only after DPA
verification — affects promise rows 13–14); D7 (coarse-only location — affects promise
rows on location).

> **NOT LEGAL ADVICE.** Issue-spotting scaffold for licensed counsel. Nothing ships without
> attorney drafting/review.

## Verdict key

- **TRUE** — the promise holds in code today (file/line cited).
- **GAP** — the promise is not yet implemented or not yet verifiable; a build blocker
  until closed.
- **FALSE** — code or a locked doc contradicts the promise today; fix required.

## Findings

| # | Promise (quoted) | Where stated | Code reality (file/line or "not implemented") | Verdict |
|---|---|---|---|---|
| 1 | "zero child PII rendered pre-authentication" (`/verify-invite`) | `docs/BUILD-SPECIFICATION.md` FR-AUTH-009, NFR-PRIVACY-005; `docs/solutions/sol-legal.md` §9 | **Violated.** `src/app/verify-invite/page.tsx` calls `get_invite_preview` pre-auth and renders `child_first_name` / `child_nickname` and `inviter_name` / `inviter_email` (`supabase/migrations/016_invite_preview.sql` lines 22–25 return all four fields). The spec allows only validity + the inviting adult's display name pre-auth — **never the child's name.** | **FALSE** — fix before any invite flow ships: strip child name fields from the pre-auth preview (validity + inviter display name only) |
| 2 | "no enumeration oracle (no 'this token is invalid because…' differentiation)" | `docs/BUILD-SPECIFICATION.md` FR-AUTH-009 | `src/app/verify-invite/page.tsx`: the `invalid` state renders one uniform message for invalid/expired/used ("isn't valid… may have expired or already been used"). Partially compliant — but finding #1 means the oracle question is moot until the preview is fixed; also `inviter_email` pre-auth is broader than the spec's "display name." | **GAP** — fix #1 first, then re-audit uniformity + rate limits + constant-time token comparison |
| 3 | "The child is the access authority over their own records. A grant made by the child cannot be vetoed or revoked by any parent." | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` §1.2, §3 | **Structure exists:** `supabase/migrations/018_access_authority.sql` adds `child_access.granted_by` ∈ `('child','parent','system')` with backfill; `021_access_events.sql` adds the append-only audit table. **Full revoke-matrix enforcement in the revoke RPC (teen revokes any grant; parents revoke only own grants; court-order path human-only) not verified in this review.** | **GAP** — pending Security Engineer verification of the revoke RPC against the §3 matrix; then TRUE |
| 4 | "All access decisions are enforced server-side. The client never derives roles." | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` §1.5 | Roles assigned by server functions per spec §3 (`cannot_invite_self` guard); `get_invite_preview` / `consume_invite()` are SECURITY DEFINER RPCs. **No client-side role derivation found in the invite flow.** Full-route audit (every `/api/v1/*` enforcing matrix + scopes, NFR-SEC-007) not verified in this review. | **GAP** — invite path TRUE; full API-surface enforcement pending Security Engineer verification |
| 5 | "Switching children purges the prior child's data from client state." | `docs/BUILD-SPECIFICATION.md` FR-AUTH-008 | `src/app/select-child/page.tsx` — **no purge/clear logic found** in the reviewed file. Child switcher exists in nav; client-state purge on switch not evidenced. | **GAP** — implement + verify (sibling-leakage risk, G26) |
| 6 | "Your grades will stop updating. Mom and Dad will be notified today." (13–15 revoke confirmation copy) | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` §4 | **Stale — contradicts the locked spec.** BUILD-SPECIFICATION FR-AGE-002 (panel-redesigned): teen chooses notify-now vs notify-at-effect (default at effect, only the revoked parent, never both); safe-exit path with suppressed notification. The access-model doc still describes the panel-**BLOCKED** design (immediate dual-parent notification — "the single most dangerous element in the spec"). | **FALSE (stale doc)** — `USER-FIRST-ACCESS-MODEL-SPEC.md` §4 must be amended to FR-AGE-002 before it is quoted anywhere user-facing |
| 7 | "Parents who had access keep access by default" (18+, incl. health) | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` §4 | **Stale for health — contradicts the locked spec.** FR-AGE-006: 18+ health requires **affirmative opt-in re-consent; skip = private.** The access-model doc's continuity-default framing for health inverts informed consent (panel G5). School/grades continuity (FR-AGE-005) is the compliant part. | **FALSE (stale doc)** — amend §4: continuity default for school data only; health = opt-in re-consent |
| 8 | "Everything a mother would be worried about — gently watched over." | `src/app/login/page.tsx` (hero H1) | **Contradicts the locked product direction** (Mehedi 2026-10-12): "Pookie is the USER's personal assistant (not 'the mother'). Parent/child oversight is an optional added feature." The login page — the first screen every user sees — frames Pookie as maternal surveillance ("gently watched over" implies monitoring), which also undercuts the child-as-access-authority promise. Per standing rule, the login page must be redesigned with every redesign. | **FALSE (identity promise)** — rewrite the login hero to the user-first framing before any user-facing milestone |
| 9 | "Privacy policy must reflect no direct data collection from under-13s." | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` §4 | **No Privacy Policy exists.** Cannot be true until the policy is attorney-drafted (NFR-LEGAL-001) and the under-13 technical guarantees are verified (sol-legal §2). | **GAP** — blocked on NFR-LEGAL-001 |
| 10 | "Pookie grows with your child — from you managing everything, to shared oversight, to their own independent assistant." / Never "your teen can cut you off." | `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` §6 (marketing rule) | No marketing site exists; no "cut you off" language found in `src` or the spec. | **GAP (not yet testable)** — add to the copy registry when marketing copy is written; the registry itself is unbuilt (sol-legal §2.6) |
| 11 | "never label signup as 'consent'" (copy audit) | `docs/solutions/sol-legal.md` §2.6 | Copy registry **not built.** Onboarding flow (§2 of the access-model spec) uses "Welcome — what should I call you?" — no "consent" labeling found in the reviewed strings, but no systematic audit exists. | **GAP** — build the copy registry; attorney approves consent vocabulary |
| 12 | Teen check-ins "never shown to parents; never accusatory; teen-deletable" | `docs/BUILD-SPECIFICATION.md` FR-SCHOOL-003 | Check-in surfaces exist under `src/app/api/v1/children/[childId]/school/checkins/`. **Parent-visibility of check-in content and the teen-delete path not verified in this review;** retention schedule row 4 sets the purge rule (90-day default, teen-deletable). | **GAP** — verify scope-filtering on the check-in read path + teen delete API; then TRUE |
| 13 | "no training on user inputs" (vendor term + user disclosure) | `docs/BUILD-SPECIFICATION.md` NFR-PRIVACY-008/010 | **No DPA executed** with Cloudflare/Workers AI (`VENDOR-ASSESSMENT-TEMPLATE.md` V-2). No user-facing disclosure exists. **D2: the absolute "NEVER train" promise must NOT be published until vendor terms are verified.** | **GAP** — blocked on V-2; publishing the promise now would be deceptive (FTC risk per D2) |
| 14 | "transient-only processing; no persistent prompt/response store except teen-saved records" | `docs/BUILD-SPECIFICATION.md` NFR-PRIVACY-010 | pookie-tutor Worker exists (`pookie-tutor.mehedikamal.workers.dev`); **transient-only behavior and the ≤30-day debug-log TTL not verified in this review.** | **GAP** — Security Engineer to verify Worker code + log retention |
| 15 | Coarse location only — "city/ZIP-level location ONLY. Never precise GPS." (architectural constraint, D7) | `docs/MD-DECISIONS.md` D7 | Decision recorded 2026-10-12. **No precise-location permission requested in the reviewed code; no geofence SDK found.** Full verification (no `geolocation.getCurrentPosition` with `enableHighAccuracy`, no precise-coordinate columns) not completed in this review. | **GAP** — code-search verification pending; then TRUE |
| 16 | "School-transparency disclosure" at add-children + consent screens ("schools share education records with custodial parents regardless of in-app settings") | `docs/BUILD-SPECIFICATION.md` FR-AUTH-005, FR-ACCESS-001 | Onboarding flow and consent screen **not yet built** (FR-AUTH-002/FR-ACCESS-001 are build items). | **GAP** — required copy at build time; add to copy registry |
| 17 | S1 FAQ: "every legally-relevant item gets an expandable plain-language (≤8th-grade) legal explanation citing the specific law AND why Pookie's policy aligns — honest about law-required vs Pookie's-choice" | MEMORY.md (Mehedi 2026-10-12); `docs/BUILD-SPECIFICATION.md` FR-SUPPORT-001 | **FAQ not built.** Migration `027_faq.sql` exists (schema only). When built, every legal accordion needs attorney editorial sign-off (FR-SUPPORT-001) — **FBPA makes each accordion's claims enforceable.** | **GAP (pre-emptive)** — this audit's verdict table becomes the FAQ legal-accordion checklist; no legal accordion ships without attorney sign-off |
| 18 | "Agents must request in-thread consent before viewing grades/health" + "every agent access audit-logged and teen-visible" | `docs/BUILD-SPECIFICATION.md` FR-SUPPORT-004/005 | Support tooling **not yet built** (S3 is a build item). RBAC structure referenced in `005_agent_access.sql` — content of enforcement not verified. | **GAP** — verify at S3 build; audit log teen-visibility required |
| 19 | "Emergency card … never gated by any grant's expiry" | `docs/BUILD-SPECIFICATION.md` FR-ACCESS-012 | Time-boxed grants (FR-ACCESS-011) reference `025_access_scopes.sql`; **emergency-card independence not verified in this review.** | **GAP** — verify in the grant-expiry sweeper logic |
| 20 | "Pookie is not an emergency response service — call 911" | `docs/BUILD-SPECIFICATION.md` FR-SAFETY-008; ToS outline | W19 module exists; **the disclaimer copy not verified on the W19 surface in this review.** | **GAP** — add to copy registry; verify placement |

## Cross-cutting findings

1. **Most urgent: finding #1 (`/verify-invite` pre-auth child-name disclosure).** The
   page violates its own locked requirement (FR-AUTH-009 / NFR-PRIVACY-005) and the
   sol-legal §9 hardening spec. This is a **build blocker for the invite flow** — fix by
   stripping child-name fields from `get_invite_preview` (validity + inviter display name
   only, per §9).
2. **`USER-FIRST-ACCESS-MODEL-SPEC.md` §4 is stale in two places** (findings #6, #7): it
   still describes the panel-BLOCKED 13–15 cooling-off notification design and the
   panel-BLOCKED 18+ health continuity default. As the "locked" spec, it will be quoted —
   amend it to FR-AGE-002 and FR-AGE-006 before it misleads a build.
3. **The login page contradicts the product identity** (finding #8) — the old
   mother-centric framing is live in `src/app/login/page.tsx` while the locked direction
   is user-first.
4. **Nothing user-facing about privacy exists yet** (no Privacy Policy, no FAQ, no
   consent screens) — which means the FBPA exposure is currently *future* exposure, but
   every promise added from this point must pass this audit's verdict table before ship.
5. **D2 gate honored:** the "NEVER train" promise is correctly *unpublished* — keep it
   that way until V-2 clears.

## Audit maintenance

- Re-run this audit **before every staging deploy that touches user-facing copy** and
  before any Privacy Policy / FAQ / consent-screen publication.
- New promises enter the table with the same four columns; a promise with no code
  reality is a GAP by default.
- The Security Engineer owns the technical-verification cells marked "pending
  verification" above.

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-12 | Initial audit; 20 promise rows; 3 FALSE findings, 17 GAPs | — (attorney review pending) |
