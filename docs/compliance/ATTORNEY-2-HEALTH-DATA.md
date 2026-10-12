# Attorney 2 — Health Data (HIPAA / 42 CFR Part 2 / MHMDA)

**REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Role:** Health Data Attorney (HIPAA / 42 CFR Part 2 / MHMDA specialist), expert consultant to the Pookie build.
**Date:** 2026-10-12. **Authorized by:** Mehedi (founder) / Managing Director.
**Status:** ISSUE-SPOTTING DRAFT. Statutory citations and requirement summaries are anchors for counsel to verify against current text. No determination here is a compliance conclusion.

**Gates owned in this memo:**
- **NFR-LEGAL-011 (proposed):** 42 CFR Part 2 SUD separation — review, policy, consent drafting.
- **H0–H3 taxonomy legal sign-off** — tiering defensibility, FR-HEALTH-007 consent language, FR-AGE-006 18+ re-consent.
- **NFR-LEGAL-009:** Multi-state review — MHMDA finalization, DSR workflow (new FR recommended), consent-withdrawal parity, per-state briefs (TX, CA, IL, AL).
- **NFR-LEGAL-010 support:** FTC Health Breach Notification Rule — PHR-vendor determination input for Attorney 1.

---

## 0. Cross-cutting honesty notes (read first)

1. **No gate below is attorney-signed.** Everything in this document is 🟡 (drafted, awaiting counsel) at best. A 🟢 appears only where the position is *counsel must confirm* — marked explicitly.
2. **Pookie is very likely NOT a 42 CFR Part 2 "program."** Part 2 binds federally assisted programs that provide SUD diagnosis, treatment, or referral for treatment. Pookie is a personal life-assistant / PHR-style app. The 030 design *voluntarily* holds SUD records to Part 2 standards. That is a defensible engineering posture and a strong privacy promise — but counsel must decide whether Pookie's public claims say "built to 42 CFR Part 2 standards" (defensible) vs. "compliant with 42 CFR Part 2" (risky if Part 2 does not technically apply, and misleading if any element deviates). Deviations I spotted are flagged in §1.
3. **The voluntary Part 2 posture creates enforceable commitments.** Once the privacy policy, FAQ, and marketing say SUD records get Part-2-grade separation, FTC Act §5 (deceptive practices) and state UDAP laws make those promises enforceable regardless of whether Part 2 itself applies. The design must then *actually meet* the promises. Several gaps below are gaps between promise and implementation.
4. **Two files share the 030 migration prefix** (`030_sud_separation.sql`, `030_safety_crisis_and_grant_tiers.sql`; APPLY_ORDER.md acknowledges this plus more duplicates at 031–036). For the SUD chain this is not cosmetic: if the SUD file fails to apply or applies out of order while other migrations assume its guarantees, separation is silently absent. See §4.

---

## 1. NFR-LEGAL-011 (proposed): 42 CFR Part 2 SUD Separation

**Proposed gate number:** NFR-LEGAL-011 (NFR-LEGAL-010 is the FTC Health Breach Rule gate). Add to `LEGAL-GATES-TRACKER.md` and `MASTER-BUILD-CHECKLIST.md` §D.

### 1.1 Review of the 030 automated separation check

**Verdict: the check is a good start but inadequate as a compliance control.** It catches the most likely accident (a function joining SUD content with other health tables) but misses several real attack/exfiltration paths and has a false-positive allowlist that can be gamed.

Findings on the check as written (`030_sud_separation.sql`, migration-time `DO $$` block):

| # | Finding | Severity | Fix |
|---|---|---|---|
| A | **RLS policies are not scanned.** A policy on another table (`health_metrics`, `wellbeing_entries`, …) could reference `sud_records` in its `USING`/`WITH CHECK` clause (e.g., a poorly scoped "family visibility" policy). The check only scans `pg_proc` bodies and view definitions. | High | Add a scan of `pg_policy` qual/with-check expressions for `sud_records` references. |
| B | **Triggers are only covered indirectly.** Trigger *functions* are in `pg_proc` and get scanned, but a trigger *definition* coupling two tables (e.g., an audit trigger on `health_metrics` writing into a table joined with SUD context) would not be caught. | Medium | Scan `pg_trigger` definitions; require that no trigger on a health table reads `sud_records`. |
| C | **The allowlist is a bypass vector.** `'rpc_export_transition_summary'` and `'enforce_sud_tier_placeholder'` are excluded by *name*. Anyone can name a new function to match an allowed name, or modify the allowed function to widen access. The comment for `rpc_export_transition_summary` admits it mentions SUD records (exclusion statement) — the check cannot distinguish "mentions to exclude" from "reads to disclose." | High | Replace name-based allowlist with an **explicit body-hash allowlist**: store SHA-256 of the approved function bodies in a `sud_separation_allowlist` table; the assertion fails if a listed name's body hash changed OR if an unlisted body references `sud_records` with health-table references. CI re-runs on every migration. |
| D | **Runs only at migration apply time.** Drift between migrations (manual `supabase db push` from a laptop, dashboard SQL edits — the APPLY_ORDER shows "Mehedi dashboard apply" is a real path) is not re-checked. | High | Make the assertion a **CI job that runs against the current schema on every PR**, plus a nightly canary query against staging. Document in the infosec program (RC-028-2). |
| E | **No foreign-key / `pg_depend` check.** A future FK from another health table to `sud_records` (or a view dependency) would couple the tables at the catalog level. | Medium | Assert: the only FK touching `sud_records` is `child_id → children(id)` and `consented_by → users(id)`. Fail on any other dependency edge. |
| F | **No scheduled-job check.** `pg_cron` jobs and any `SECURITY DEFINER` functions owned by roles that bypass RLS are not enumerated. | Medium | Enumerate `cron.job` entries and `SECURITY DEFINER` functions; fail if any reference `sud_records` outside the two approved RPCs. |
| G | **`service_role` bypasses RLS.** The SUD tables are `GRANT`ed to `authenticated` with teen-only RLS — but any service_role code path (the purge functions, future admin tools, the "Mehedi dashboard apply" path) bypasses RLS entirely. The *only* thing currently stopping `purge_tombstoned_health()` from touching SUD rows is a magic string (`'sud_records_excluded_per_42cfr_part2'`) in an array literal. A refactor that "cleans up" that string reintroduces the original violation silently. | High | (1) Move `sud_records` + `sud_disclosure_consents` into a dedicated schema (e.g., `part2`), owned by a dedicated `part2_owner` role. (2) `REVOKE ALL` from `service_role` on those tables; grant only to the two approved `SECURITY DEFINER` RPCs (executed as owner). (3) The generic purge then *cannot* touch SUD rows even if someone removes the exclusion string. Defense in depth, not defense by comment. |

**Required additions to the migration (counsel + Team 2):**
- Schema/role isolation per G.
- Body-hash allowlist per C.
- `pg_policy`, `pg_trigger`, `pg_depend`, `pg_cron` scans per A/B/E/F.
- CI job + nightly canary per D.
- Rename the file to a unique prefix (e.g., `030a_sud_separation.sql`) and fix the internal "Migration 028" comment — the apply-order ambiguity is a compliance-chain risk (see §4).

### 1.2 Assessment of the `purge_tombstoned_health()` exclusion fix

**Exclusion from the generic purge is necessary but NOT sufficient.** Under the voluntary Part-2-grade posture (and under actual Part 2, if counsel ever determines it applies), the following are required in addition to the exclusion:

1. **A separate SUD purge workflow** — its own job (`purge_tombstoned_sud()`), its own schedule, its own audit records, owned by the same restricted role as the SUD schema. A teen's SUD deletion request must never sit in the same queue as general health deletions where a future code change could co-mingle them. The separate job also needs the crypto-shred treatment: SUD ciphertext keys destroyed per-record (key-destruction log), not just row DELETE.
2. **A separate audit trail for SUD access.** `log_access_event` is shared. Metadata-only SUD access events (`sud_disclosure_consented`, `sud_disclosure_revoked`) are fine in the general log, but the *SUD audit log itself* should live in the `part2` schema with access restricted to the teen and the designated compliance reviewer — not queryable by support tooling (S1–S3 have no read path today; keep it structural, not just RBAC policy).
3. **Prohibition-on-re-disclosure notice.** 42 CFR Part 2 §2.32 requires every disclosure to be accompanied by a written statement that the information is subject to restrictions and may not be further disclosed. Draft notice in §1.4 below. Any UI/API that *executes* a `sud_disclosure_consents` instrument must attach this notice to the disclosure package (and log that it did).
4. **The medical-emergency question (§2.51).** Actual Part 2 permits disclosure without consent to medical personnel in a bona fide medical emergency. The 030 design says "break-glass: none." If Pookie holds itself to Part 2 standards, counsel must make an explicit, documented decision: (a) include a narrow medical-emergency path (Part-2-faithful), or (b) maintain the absolute ban as a company policy that *exceeds* Part 2 (defensible, and arguably safer for teen trust — but the deviation from Part 2 must be disclosed in the consent instrument so the "we follow Part 2" claim isn't false). **Do not leave this undecided.**
5. **Consent-instrument completeness.** The RPC validates recipient, purpose, expiry, and a non-empty `consent_ciphertext` — but does not validate the Part 2 §2.31 elements *inside* the instrument. Draft required elements in §1.4. The app-layer consent UI must collect and embed all of them; the RPC should reject instruments missing required element markers (at minimum: patient identity, discloser identity, recipient, purpose, extent/amount, revocation statement, signature+date, expiry).
6. **18+ transition.** SUD records are H3-absolute today (teen-only). At 18 the adult is their own authority — but the re-consent instrument for SUD records must be *separate* from the general 18+ health re-consent (per the "general consent never covers SUD" rule). Draft in §2.3.

**Bottom line:** the exclusion fixed the acute violation (SUD rows being hard-deleted by the generic job). The remaining work is the separate job, schema/role isolation, re-disclosure notices, instrument completeness, and the emergency-path decision. None of these need new product design — they are DB + RPC + copy work.

### 1.3 SUD Records Handling Policy (draft)

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Scope.** All records Pookie classifies as substance-use-disorder patient information, stored in `part2.sud_records` (recommended schema rename from `public`), and all disclosure instruments in `part2.sud_disclosure_consents`.

**Principles.**
1. **Separation is structural, not procedural.** SUD content lives in a separate schema, under a separate encryption key, owned by a separate role, purged by a separate job, audited in a separate log. No procedure, grant, override, export, or emergency path crosses the boundary except through the two approved RPCs.
2. **General consent never covers SUD records.** Not the H-tier grants, not the Wellness scope, not the 18+ re-consent toggle, not the transition-summary export, not parent stewardship, not break-glass. Each disclosure requires its own specific instrument.
3. **The teen (13–17) or the adult (18+) is the sole authority.** No parent arm, no override arm, no grant arm, no support read path, no vendor access. (Under-13: SUD records are not collected — any inadvertent collection is quarantined and purged ≤7 days per retention schedule row 7.)
4. **Disclosure is per-record, per-recipient, per-purpose, expiring, revocable.** Revocation is instant and honored in the disclosure path before any data leaves.
5. **Every disclosure carries the prohibition-on-re-disclosure notice** (§1.4) and is logged with recipient, purpose, and notice-attached confirmation.

**Access controls (stricter than H3).**
- Table access: `REVOKE ALL` from `authenticated`, `service_role`, and all app roles; access only via `SECURITY DEFINER` RPCs owned by `part2_owner`.
- RLS (defense in depth on top of the revoke): teen-only read/insert/update/delete, as in 030.
- Encryption: application-layer AES-256-GCM with a **per-user data key distinct from the general health key**; independent rotation (RC-028-1). The database never holds plaintext. Key-destruction log entries are the proof of crypto-shredding.
- Support (S1–S3), crisis vendor (D1), and all analytics/briefing pipelines: **no read path**, enforced by schema grants (not just RBAC convention).
- Exports: `rpc_export_transition_summary` and any future export explicitly exclude SUD records; the export UI lists SUD records only in a separate section with default-OFF per-record checkboxes gated on a fresh SUD-specific consent instrument.

**Separate purge workflow.**
- `purge_tombstoned_sud()`: nightly, `part2_owner`-executed. Tombstoned SUD rows (teen deleted or consent withdrawn) are hard-deleted ≤30 days; the per-record data key is destroyed (crypto-shred) at the same run; key-destruction logged in the `part2` audit log.
- SUD rows are **excluded by schema**, not by string, from `purge_tombstoned_health()` (see §1.1-G).
- Backup handling: SUD ciphertext in backups is unrecoverable after key destruction; backup purge ≤30 days per the retention schedule; any restore within the window re-runs the SUD purge before serving traffic.
- Purge evidence: per-run log (date, rows, key IDs destroyed, authorizer) retained in the `part2` audit log per retention row 11.

**Disclosure consent requirements.**
- Every disclosure requires a written (in-app signed) instrument containing the §2.31 elements (see §1.4).
- Minimum consent UI standards: the teen/adult sees the named recipient, the exact records (listed, not "all SUD records" — bulk selection is allowed only with per-record checkboxes, all default OFF), the purpose in plain language, the expiry, and the revocation statement *before* signing.
- Withdrawal: one-tap revoke in the same surface where the consent was given; revocation is effective immediately for future disclosures; disclosures already made in reliance are logged as such.
- Prohibition on re-disclosure notice attached to every disclosure (§1.4).

**Breach/ incident handling.**
- Any unauthorized access to SUD records is treated as a breach of the most sensitive tier: individual notice, FTC Health Breach Rule analysis (if PHR-vendor determination is affirmative — see §5), MHMDA analysis (SUD records are consumer health data), and counsel engagement. No "low-risk, no-notice" shortcut for SUD data.

### 1.4 Part 2 consent instrument — required elements + draft language

**Required elements of each SUD disclosure consent** (modeled on 42 CFR Part 2 §2.31 — counsel to confirm against current regulatory text):

1. Identity of the person whose records are disclosed (the teen/adult).
2. Identity of the program/person making the disclosure (Pookie / the specific feature).
3. Name of the recipient (person or program — no "and affiliates" vagueness).
4. Purpose of the disclosure, in plain language.
5. How much and what kind of information (the specific records, listed).
6. Signature of the person consenting + date signed.
7. Statement that the consent is subject to revocation at any time, except to the extent the program has already acted in reliance on it.
8. Expiration date, event, or condition.

**Draft consent language (teen-facing, ≤8th-grade; legal elements embedded):**

> **Sharing your substance-use records**
>
> You are choosing to share specific records about substance use counseling or treatment from Pookie with:
> - **Who:** [recipient name, typed or selected — no pre-filled value]
> - **What:** [listed records with dates — each checkbox OFF by default]
> - **Why:** [purpose, plain language, e.g., "So your counselor can see your treatment notes before your appointment"]
> - **Until:** [expiry date — required; suggested maximum 1 year, teen may set shorter]
>
> **This consent is only for this sharing.** It does not give [recipient] access to your other health information, and it does not change any other privacy setting in Pookie.
>
> **You can take this back anytime.** Tap "Revoke" on this screen. Revoking stops future sharing immediately. It cannot undo sharing that already happened.
>
> **Signed:** [teen name], [date]. **Method:** [in-app signature / attestation text]
>
> *Legal basis note (for the instrument, not the teen): consent subject to revocation per §2.31(a)(8); expires [date]; recipient is prohibited from re-disclosing per §2.32 (notice attached).*

**Draft prohibition-on-re-disclosure notice** (attached to every disclosure package, modeled on §2.32):

> **NOTICE — DO NOT RE-DISCLOSE.** This information has been disclosed to you from records protected by federal confidentiality rules (42 CFR Part 2), which Pookie applies to substance-use records. You may not use it to investigate or bring criminal charges, and you may not share it with anyone else unless the person it belongs to gives you specific written permission, or as otherwise permitted by 42 CFR Part 2. A general permission to share health information is not enough.

### 1.5 Gate status

**NFR-LEGAL-011 (proposed): 🔴 blocked.** The acute purge violation is fixed; the separation *system* is not yet complete (schema/role isolation, separate purge job, instrument completeness, emergency-path decision, CI enforcement — all §1.1–§1.2). Attorney must additionally decide: does Part 2 technically apply, and what public claim language is permitted.

**Blocked modules + dependency chain:**
- Any SUD-adjacent feature: W8 crisis/SUD-adjacent content routing (metadata-only firewall per sol-health §5.5 must be verified against SUD records specifically — `wellbeing_events` may carry crisis metadata but never SUD record references), S2/S3 support triage (crisis tickets must not expose SUD content to agents — scoped RBAC per 2026-10-12 support standard), W19 break-glass medical card (user-selected; must be structurally unable to include SUD records), the D1 contracted crisis vendor's API contract (vendor must have no SUD read path in the data contract).
- W2 real-data launch: the taxonomy gate (below) plus SUD separation must both clear before W2 holds any teen-entered content that could be SUD-adjacent, because free-text health entries can *become* SUD records on classification.

---

## 2. H0–H3 Taxonomy Legal Sign-Off

### 2.1 Is the tiering legally defensible?

**Yes, as a company taxonomy that maps to real legal distinctions — with two inconsistencies to resolve and one framing caution.**

| Tier | Legal anchor(s) | Assessment |
|---|---|---|
| **H0 — refused for <18; user-only (H3-equivalent) at 18+** | COPPA minimization (§312.10); company-choice refusal of high-risk categories (genetic/predictive data — sensitive under APDPA/CA Delete Act frameworks); GA minor-consent boundaries (categories a minor cannot consent to, e.g., fertility planning) | Defensible. H0 is the "we choose not to hold this" tier — the strongest legal posture is a documented business justification per category. **Inconsistency:** retention schedule row 7 has no 18+ H0 row — add one (18+ H0 = user-only, rolling ≤2 years, crypto-shred, per-record consent to share). |
| **H1 — shareable wellness** | COPPA parental rights (<13 stewardship); school-form logistics (GA Form 3231 — a real, documented state requirement); descriptive, non-diagnostic data | Defensible. H1 is the only tier where parent visibility at 13+ is default — this must be **explicitly disclosed** in the MHMDA policy (categories + purposes per category). |
| **H2 — teen-private** | Mature-minor doctrine; state minor-consent carve-outs; MHMDA consumer-health-data protections; the "dinner-table test" (sol-health §1) as a company policy line | Defensible. The 30-day teen-notified safety override is the legally sensitive edge — it must be disclosed in the policy, time-boxed, audited, and never applied to H3. Counsel must confirm the override's defensibility under GA law and MHMDA's consent requirements. |
| **H3 — legally sensitive** | 42 CFR Part 2 (SUD); GA minor-consentable care categories (STI treatment, pregnancy-related care, substance-abuse counseling — counsel to confirm current GA citations); MHMDA heightened consent; COPPA/FERPA boundaries | Defensible. H3-absolute (no parent path, no override, no aggregates) is the correct posture. **Caution:** "absolute" must survive the mandatory-reporter gate (NFR-LEGAL-002) — if a human reviewer ever sees H3 content in a crisis context, the policy must define that path *before* it happens, not after. |

**Framing caution for counsel:** H0–H3 is not statutory. Its legal power comes from (a) exceeding statutory floors, (b) becoming enforceable commitments once published in the ToS/Privacy Policy (FTC Act §5, state UDAP), and (c) server-side enforcement (NFR-PRIVACY-004). The taxonomy must therefore be **exactly true in code** — any gap between the published tier promises and the RLS/grants implementation is a deceptive-practice exposure, not just a bug. Recommend a quarterly "promises vs. code" audit (ties to `PRIVACY-PROMISES-AUDIT.md`).

**Inconsistency to resolve:** BUILD-SPECIFICATION line 90 summarizes FR-HEALTH-001 as "H0 = prohibited for <18 · H1 = shareable wellness · H2 = teen-private · H3 = legally sensitive," while sol-health §1 defines H0 as refused <18 but H3-equivalent (user-only, shareable via explicit per-record consent) at 18+. The spec summary reads as if H0 is prohibited for everyone. Counsel should pick one definition and conform all three documents (BUILD-SPECIFICATION, sol-health, retention schedule).

### 2.2 Per-subcategory consent language — FR-HEALTH-007 (draft)

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

**Design rules (binding on the UI):** enumerated subcategories, never one "health" checkbox; every box unchecked by default; ≤8th-grade language on the surface; the legal-precision layer underneath (collapsible "What the law says" line per subcategory); consent and withdrawal on the same screen with the same number of taps (MHMDA parity — §3.3).

**H1 — Shareable wellness (13–17; teen + parent co-flow at link time):**
> **Everyday wellness.** Steps, sleep hours, activity minutes, resting heart rate. Your family can see this under the Wellness scope (default ON at link time) — it's the "dinner-table" stuff.
> *Legal layer:* COPPA parental access (<13); MHMDA collection/sharing consent for consumer health data; descriptive, non-diagnostic; never sold, never used for ads, never used to train AI (D2).

**H2 — Teen-private (13–17; teen-only default):**
Subcategories enumerated separately — weight/BMI · menstrual cycle · mood journal & check-in text · medications & allergies · blood glucose/blood pressure · food diary (descriptive, no calorie detail <18) · doctor-visit notes.
> **Private to you.** Each category below is yours alone at 13+. Your parents can only see a category if you turn it on — or in a safety emergency, for up to 30 days, and you'll always be told. Nothing here is shared, sold, or used to train AI.
> *Legal layer:* per-subcategory affirmative consent (MHMDA); teen privacy vs. parental access per state minor-consent doctrine; 30-day safety override disclosed, time-boxed, audited, H2-only (never H3).

**H3 — Legally sensitive (13–17; teen-only, no parent path):**
Subcategories enumerated separately — substance-use counseling/treatment notes (Part 2 separation applies) · mental-health therapy notes · sexual-health records (STI testing/treatment, contraception) · pregnancy-related data.
> **Only you. No exceptions.** These categories are never visible to your parents — not in the app, not in summaries, not in averages. Sharing any of them takes a separate, specific permission from you, every time, naming exactly what, to whom, and why.
> *Legal layer:* 42 CFR Part 2 standards for SUD records (separate table, separate consent, re-disclosure prohibited); GA minor-consentable care; H3-absolute — no grants, no overrides, no aggregates.

**H0 — Not collected (<18):**
> **We don't keep this.** [Category, e.g., genetic test results, fertility planning.] Pookie doesn't collect or store it for anyone under 18. (18+: this becomes your most private data — see H3 rules.)
> *Legal layer:* company refusal; COPPA §312.10 minimization.

**Under-13 stewardship note** (parent-facing): H1 visible to steward parents; H2 visible to steward parents with the "logged `entered_by`, teen review at 13" rule; H3 refused (parent-entered sexual-health content for <13 → H2, flagged). This asymmetry must be in the policy — it is the COPPA §312.10 / FTC FAQ A.8 posture.

### 2.3 18+ re-consent — FR-AGE-006 (draft transfer notice + "skip = private" mechanics)

**Draft transfer notice (shown at the 18th-birthday cutover, before any health data is visible to the adult):**

> **You're 18 — your health data is yours now.**
>
> Until today, some of your health information was managed under teen rules. Now you decide, category by category.
>
> - **Keep sharing** — turn on any category below. Only what you turn on becomes visible under your sharing settings.
> - **Skip** — anything you skip stays **private to you** and is **permanently deleted within 30 days**. Skipped data is locked immediately: nobody can see or use it during those 30 days — not even you, until you change your mind (you can un-skip within 30 days).
> - **Your substance-use records** (if any) need a **separate** permission — they are never included in the categories below.
> - **Review what your parents entered** — parent-entered health rows are listed for your review: keep, correct, or seal them.
>
> [Per-subcategory toggles, all default OFF] [Keep selected] [Skip all]

**"Skip = private" mechanics (required implementation):**
1. On skip (or 30 days of inaction after notice): rows are **tombstoned immediately** (`deleted_at` set, reads blocked server-side) — the 30-day window is a *purge* window, not a *grace* window. No reads, no processing, no sharing, no AI use during the window.
2. Hard delete + crypto-shred (H3/SUD) ≤30 days after tombstoning; backup purge ≤30 days after source deletion (retention schedule rows 7/11).
3. The adult may un-skip within the 30-day window (revives the re-consent screen for those rows only); after purge, nothing revives.
4. SUD records: separate re-consent instrument per §1.4; skip = same tombstone-then-purge path through `purge_tombstoned_sud()`.
5. Transition-summary export: SUD records excluded by default; per-record default-OFF checkboxes gated on the SUD instrument (§1.3).
6. Emergency-contact re-designation is decoupled from access grants (per FR-AGE-006) — re-designating an emergency contact does not grant them health-data access.

**Is the 30-day purge window defensible?** Yes, provisionally: (a) MHMDA requires consent-bounded retention — once the adult withholds consent, continued retention beyond a disclosed, bounded purge window is hard to justify; 30 days is the disclosed window used consistently across the retention schedule (rows 1, 2, 4, 7, 8); (b) COPPA §312.10's anti-indefinite-retention rule supports bounded windows as the posture; (c) the *immediate tombstone* (read-block) is what makes the 30 days defensible — the data is not *processed* during the window, only *awaiting deletion*. Counsel must confirm 30 days (vs. shorter, e.g., 14) and confirm that the inaction-after-notice path (no response = skip) satisfies MHMDA's affirmative-consent standard — **inaction is not consent, so default-to-skip is the correct default**, but counsel should bless the notice-and-deemed-skip construction explicitly.

### 2.4 Gate status

**H0–H3 taxonomy sign-off: 🟡 in-progress (draft complete, counsel review pending).** The taxonomy is legally defensible in structure; it cannot be marked 🟢 until (a) licensed counsel resolves the H0 definition inconsistency, blesses the H2 safety-override, and confirms the GA minor-consent citations; (b) the per-subcategory consent UI ships with the parity rules in §3.3; (c) the promises-vs-code audit is instituted.

**Blocked modules + dependency chain:**
- **W2 Health: ALL real teen data** (panel 🛑) — depends on FR-HEALTH-001 taxonomy + NFR-LEGAL-011 SUD separation + NFR-LEGAL-010 PHR determination + infosec program sign-off.
- **W8 Wellbeing** (mood journal = H2; crisis-adjacent content = SUD/H3 firewall) — same chain plus NFR-LEGAL-002 (mandatory reporter) before any human reads check-in content.
- **W22 Activity** (fitness data = H1/H2) and **W23 Nutrition** (food logs = H2; ED-sensitivity rules) — taxonomy + consent screens.
- Downstream: W19 medical card (break-glass scope), W28 allergy list (H2), W1 health-document uploads, G22 immunizations (H1), S3 crisis tickets touching health content.

---

## 3. NFR-LEGAL-009: Multi-State

### 3.1 MHMDA mapping — finalization (13 requirements + 1 added)

The v0.1 mapping's 13 rows are confirmed as the right requirement set, with one addition (row 14: **inference as collection**). Status refinements:

| # | MHMDA requirement | Refined status | Note / change from v0.1 |
|---|---|---|---|
| 1 | Collection consent (affirmative, separate) | 🟡 | Consent screens drafted (§2.2). **Affirmative = freely given, specific, informed, unambiguous; no pre-checked boxes, no dark patterns.** Verify the link-time flow (FR-ACCESS-001) meets this — especially the 13–15 co-flow (teen + parent), which must not let the parent's consent substitute for the teen's on teen-consumer data. |
| 2 | Sharing consent (separate affirmative) | 🟡 | H0–H3 + scopes are the mechanism; taxonomy must ship first. |
| 3 | Access right | 🟡 | Formal DSR pipeline missing — see §3.2 (recommended new FR). |
| 4 | Delete right | 🟡 | Same; plus SUD records need the separate deletion path (§1.2). |
| 5 | Withdraw consent (as easy as consent) | 🟡 | Same-screen withdrawal surface required — see §3.3. |
| 6 | No sale without signed authorization | 🟡 | No-sale posture is right; **"sale" includes non-monetary valuable consideration** — the D2 no-training commitment is load-bearing here (training-data value extraction theory). No-sale + no-training must be in executed DPAs (currently vapor — V-1). |
| 7 | **Distinct consumer-health-data privacy policy** | 🔴 | **Biggest blocker — unchanged.** Draft section in §3.4 below. Nothing in WA may hold real health data until this exists *and* is published. |
| 8 | Retention limitation (consent-bounded) | 🟡 | Schedule is draft; counsel must confirm health rows vs. MHMDA consent-bounded retention. The 18+ "skip = private" 30-day purge (§2.3) is the consent-boundary mechanism. |
| 9 | Geofencing prohibition | 🟢* | Compliant-by-architecture (D7 coarse-only). *Counsel to confirm the mootness reading; enforce in code review (any future precise-location need → separate privacy review). |
| 10 | Processor obligations | 🔴 | No DPA executed — unchanged, still fully open. Vendor template's state-law posture column is the inventory; execution is the work. |
| 11 | Security (reasonable safeguards) | 🟡 | Infosec program draft; vault encryption pre-condition unverified in staging. |
| 12 | Non-discrimination / no dark patterns | 🟡 | Copy registry not built; DV-advocate review of revoke copy pending (NFR-LEGAL-004). The per-subcategory consent screens (§2.2) must be audited against the dark-pattern standard before ship. |
| 13 | De-identification standard | 🟡 | Methodology undefined; peer-tips QA planned. Note: de-identification is also the escape hatch for analytics — define it before any aggregate leaves the trust boundary. |
| 14 | **Inference = collection (ADDED)** | 🟡 | MHMDA's "collect" includes *infer* and *derive*. Any AI-inferred health status (from chat, check-ins, purchase metadata) is collection requiring affirmative consent. The allergy-inference ban (§10.1) is the right pattern — **generalize it**: no health inference without the corresponding subcategory consent, documented in the policy. Flag for counsel: does the Pookie tutor's health-related inference in responses count as "collection"? |

**MHMDA exceptions (counsel to map):** the statute has narrow processing exceptions (e.g., processing reasonably necessary to provide a requested product/service, security, legal compliance — counsel to confirm the current list). Pookie's posture should be: **rely on affirmative consent as the basis everywhere; treat exceptions as fallback positions documented by counsel, not as design shortcuts.**

### 3.2 DSR workflow — intake → verify → execute → confirm (recommend as new FR)

**Recommended: new FR-ACCESS-010 "Consumer DSR pipeline," owned by Platform Team 2.** This is the single workflow that satisfies MHMDA access/delete/withdraw rights, COPPA parental rights, APDPA/TDPSA/CA rights, and the 18+ "hide past too" deletion (FR-AGE-007).

**Pipeline:**
1. **Intake.** In-app (Settings → Privacy → "My data rights") + email alias (e.g., privacy@) + support-ticket path (S3). Every request gets a ticket ID and a written acknowledgment ≤5 business days. Request types: access (confirm + export), delete, withdraw consent (per-subcategory), correct.
2. **Verify.** Authenticated session = primary verification. Step-up (fresh login or email OTP) required for: delete requests, SUD-adjacent requests, and any request from a claimed parent/guardian (verify relationship via the existing child-access/claim records — D5's corroborated-claim machinery). Deny or narrow unverifiable requests in writing; do not phish for extra data to verify.
3. **Execute.**
   - *Access:* export in a portable, human-readable format; include categories, purposes, sharing history (from `access_events`), and retention windows. Exclude other persons' data (sibling/parent content redaction).
   - *Delete:* route by tier — H0–H2 via `purge_tombstoned_health()` fast path; H3 via crypto-shred; **SUD via `purge_tombstoned_sud()` only** (§1.2); propagate to vendors per DPA deletion clauses (once executed); backup purge ≤30 days.
   - *Withdraw consent:* same-screen, same-tap-count as consent (§3.3); withdrawal tombstones the data immediately; hard purge ≤30 days.
   - *Correct:* health corrections table (`health_corrections` per 023) with audit trail.
4. **Confirm.** Written confirmation per request: what was done, what was retained and why (e.g., audit-log rows per row 11, litigation hold), vendor propagation status, and how to appeal. Retain DSR records (request, verification method, outcome) per the retention schedule — recommend a new schedule row (counsel sets window; suggest ≤3 years, aligned with row 11).
5. **SLAs (proposed — counsel sets final):** acknowledge ≤5 business days; fulfill ≤45 days; one 45-day extension with written notice (the common multi-state standard). SUD and teen-safety-flagged requests: prioritize within the same SLA, never slower.
6. **No-fee, no-discrimination:** exercising rights never degrades service, triggers guilt screens, or requires re-consent to unrelated categories.

**Teen-specific rules:** 13–17 teens exercise their own DSR rights on their own records (consistent with the child-as-access-authority model). Parents of 13–17 teens may not file DSRs *against* the teen's H2/H3 records. Parents of <13 may act for the child. At 18+, the adult acts for themselves; parent DSR authority ends.

### 3.3 Consent-withdrawal parity — per-subcategory withdrawal surface

**MHMDA rule:** withdrawing consent must be as easy as giving it. **Required surface (fold into FR-HEALTH-007 consent screen v2):**

1. **Same screen, same taps.** The screen where the teen/parent granted per-subcategory consent is the screen where they withdraw it — no separate "contact us to withdraw" path, no account-deletion-as-withdrawal.
2. **Per-subcategory toggles, live.** Flipping a subcategory OFF: (a) takes effect immediately for all future collection/sharing/processing; (b) tombstones existing data in that subcategory immediately (read-block); (c) schedules hard purge ≤30 days; (d) propagates to vendors within the DPA SLA (once DPAs exist).
3. **SUD withdrawal** goes through the same surface but executes via the SUD revocation RPC + `purge_tombstoned_sud()` — the UI copy must say the records are handled under the stricter SUD path.
4. **No dark patterns:** no confirm-shaming ("Are you sure? Your family will worry"), no multi-screen retention flows, no re-asking on every login. One flip, done, confirmed in plain language.
5. **Vendor propagation:** withdrawal must propagate to processors (deletion/instruction) — currently vapor without executed DPAs (V-1). The withdrawal UI must honestly state propagation status until DPAs are signed (counsel to approve interim copy).
6. **Audit:** every withdrawal writes to `access_events` (metadata only) and, for SUD, the `part2` audit log.

### 3.4 MHMDA consumer-health-data privacy policy — draft section

> **REQUIRES LICENSED COUNSEL REVIEW BEFORE RELIANCE — issue-spotting draft, not legal advice.**

MHMDA requires a **distinct, publicly available** privacy policy for consumer health data — it cannot be a subsection buried in the general policy. Draft structure (each element below maps to the statutory policy-content requirement — counsel to verify against current text):

**Pookie Consumer Health Data Privacy Policy (draft outline + key copy)**

1. **What counts as health data here.** "Consumer health data" means information about your physical or mental health — past, present, or future — including information we can reasonably infer about your health. In Pookie this includes: device health data (steps, sleep, heart rate), health entries you type (mood journal, medications, allergies, cycle data), and any health information in check-ins or AI chats. [Categories enumerated per the H0–H3 taxonomy — the policy's category list must match the consent screen's subcategory list exactly.]
2. **What we collect, and why — per category.** [Table: category → purpose → legal basis (your consent) → retention window.] No category is collected without your affirmative opt-in, given separately for collection and for sharing.
3. **Who we share with.** [Categories of third parties and affiliates — currently: none for sale; processors listed by name once DPAs execute, e.g., Supabase, Cloudflare.] We do not sell your health data. We do not share it for advertising. We do not use it to train AI models (D2).
4. **Your rights.** Access (see what we have), delete, withdraw consent (as easy as giving it — same screen), and how to exercise each (link to the DSR surface, §3.2). Response within 45 days.
5. **How long we keep it.** Per-category retention windows from the published retention schedule; consent-bounded — when you withdraw consent or skip re-consent at 18, data is locked immediately and deleted within 30 days.
6. **Teens and parents.** Under 13: no teen health data collected. 13–17: per-subcategory consent; H2 teen-private; H3 never parent-visible. At 18: affirmative re-consent required; skip = private + 30-day deletion.
7. **Substance-use records.** Held to federal 42 CFR Part 2 standards: separate storage, separate consent for every disclosure, and recipients are legally prohibited from re-sharing. [Counsel to approve the exact public claim — see §0.2.]
8. **Changes to this policy.** Material changes notified in-app and by email ≥30 days before effect; continued use after a material change to health-data practices requires fresh affirmative consent (not deemed consent).

**Status: 🔴 blocked — this policy does not exist yet.** It is the single biggest MHMDA blocker. Recommend counsel drafts (not merely reviews) this document, given the private right of action.

### 3.5 Per-state briefs (launch-readiness memos, not full analyses)

**Method note:** summaries below are issue-spotting anchors from current secondary sources, verified by web search on 2026-10-12 for CA AB 2246, CA SB 1119, and AL APDPA. Counsel verifies statutory text, effective dates, thresholds, and exemptions before launch decisions.

#### Washington — MHMDA
- **What it is:** the broadest state health-privacy law; covers "consumer health data" (very broad, includes inferences); applies to entities conducting business in WA or serving WA residents that determine purpose/means of processing.
- **What Pookie must do:** §3.1–§3.4 above. Distinct policy (§3.4) is the gating item; DPAs the second.
- **Exposure:** private right of action + AG enforcement. Misses are directly suable.
- **Status: 🟡 in-progress** (architecture aligned; documentation/execution open).

#### Texas — SCOPE + TDPSA
- **TX SCOPE** (Securing Children Online through Parental Empowerment Act): applies to digital service providers whose products/services are used by minors. Requires age verification, **parental consent for minors' accounts**, parental supervision tools, content filtering, and data-protection restrictions for known minors.
  - **Pookie impact:** the 13–17 onboarding flow must satisfy SCOPE's parental-consent and supervision-tool requirements *in addition to* Pookie's own (stronger) teen-consent design. Tension point for counsel: SCOPE centers the parent; Pookie's model centers the teen as access authority with cooling-off protections. The two must be reconciled in the TX flow — likely: SCOPE parental consent for account creation + Pookie's per-subcategory teen consent for health data, with the H3-absolute and revoke rules preserved and disclosed.
  - **Status: 🟡** — needs a TX-specific onboarding reconciliation memo from counsel before TX launch.
- **TDPSA** (Texas Data Privacy and Security Act): VA-style; **sensitive data (including health data) requires opt-in consent**; applies to businesses without a revenue threshold (but with consumer-count thresholds and a small-business exclusion). Pookie's per-subcategory opt-in design already aligns; confirm thresholds/exemptions with counsel.
- **Status overall TX: 🟡 in-progress.**

#### California — AB 2246 + SB 1119 (+ CCPA/CPRA baseline)
- **AB 2246** (signed 2026-09-10; replaces the CA Age-Appropriate Design Code — "Youth Social Media Protection Act"): applies to online services/products/features **likely to be accessed by children** (<18). Requires: age estimation (or apply minor protections to all users), **high-privacy defaults for minors**, bans on profiling children by default, **no precise geolocation collection from minors by default**, no dark patterns steering children to surrender data or forego privacy, data minimization (collect only what is needed for the service the child is actively using), and a duty of reasonable steps to prevent foreseeable harms.
  - **Pookie impact:** mostly aligned by architecture (D7 coarse-only location moots the geolocation ban; unchecked-by-default consent screens satisfy the dark-pattern ban; H2/H3 teen-private = high-privacy defaults). **Gaps to close:** (a) formalize the "likely to be accessed by children" determination and the age-estimation method (Pookie collects DOB at signup — counsel to confirm sufficiency); (b) document the profiling analysis — Pookie's briefings/nudges/AI personalization must be assessed against the profiling ban, with the "necessary to deliver the service / safety" exception analysis in writing; (c) the duty-to-prevent-foreseeable-harm needs a written risk assessment for the teen surfaces.
  - **Status: 🟡** — needs counsel's AB 2246 applicability + profiling analysis before CA launch.
- **SB 1119** (signed 2026-09-10): **AI companion chatbot child-safety requirements** — risk assessments, independent audits, parental controls, default protections for minors, crisis protocols for self-harm queries, civil enforcement.
  - **Pookie impact:** HIGH. The Pookie/Muse AI chat (W-pookie tab) is arguably an AI companion chatbot accessible to minors. Required before CA launch: child-safety risk assessment, **independent audit** (identify qualified auditors now), crisis protocols for self-harm content (interplay with NFR-LEGAL-002 mandatory-reporter program and the H3-absolute firewall — the crisis protocol must route *metadata only*, never H3/SUD content, to human reviewers), parental controls/default minor protections.
  - **Status: 🟡** — independent-audit procurement and the crisis-protocol-vs-H3-firewall reconciliation are the long poles.
- **CCPA/CPRA baseline:** health data is sensitive personal information (opt-in consent for <16; Pookie's design exceeds this). The Delete Act / data-broker registration does not apply (no sale).
- **Status overall CA: 🟡 in-progress** — AB 2246 + SB 1119 workstreams must be scoped by counsel; SB 1119's independent audit is the critical path.

#### Illinois — BIPA
- **What it is:** Biometric Information Privacy Act — private right of action; requires **written release before collecting biometric identifiers** (faceprint, fingerprint, voiceprint, etc.), disclosure of purpose and retention length, a public retention/destruction schedule, and prohibits sale.
- **Pookie impact:** Pookie does not currently collect biometric identifiers as a product feature. **Risk surfaces to rule out with counsel:** (a) device-native biometric *unlock* (Face ID/Touch ID) where Pookie never sees the biometric — generally not "collection," but document the analysis; (b) voice data from AI chat (voiceprint extraction would be collection — **prohibit voiceprint creation** in the AI pipeline by policy); (c) any future face-scan onboarding, emotion-detection from camera, or gait analysis from activity data — each triggers BIPA's written-release flow and must go through privacy review.
- **Status: 🟢-conditional** — no BIPA-triggering feature exists today; gate any biometric-adjacent feature on counsel's BIPA review. (Mark 🟡 until counsel confirms the device-unlock and voice-data analyses in writing.)

#### Alabama — APDPA (HB 351, effective 2026-05-01)
- **What it is:** VA-style comprehensive law; applies at **>25,000 AL consumers** (standalone — no revenue coupling) or >25% of gross revenue from sale of personal data (standalone). Sensitive data includes health condition/diagnosis, sex life, sexual orientation, genetic/biometric data, **personal data collected from a known child**, and precise geolocation. Sensitive data requires opt-in consent. Small businesses (<500 employees, no sale) are exempt; HIPAA covered entities exempt.
- **Pookie impact:** (a) the **25,000-consumer threshold is low** — monitor AL user counts; crossing it triggers full APDPA duties; (b) Pookie's no-sale posture moots the revenue prong — keep it that way; (c) health data = sensitive data = opt-in consent — the per-subcategory design satisfies this; (d) "personal data collected from a known child" is sensitive — the under-13 parent-managed profile design must carry opt-in consent + the short retention windows (already in the schedule); (e) D7 coarse-only location moots the precise-geolocation sensitivity.
- **Status: 🟡** — monitor the 25k threshold; counsel confirms small-business exemption applicability and the child-data consent construction before AL launch. Effective 2027-05-01 — runway exists, but build state-aware now (D3 principle).

### 3.6 NFR-LEGAL-009 gate status

**🔴 blocked overall** (no state beyond GA is launch-ready; WA has the deepest analysis but its two 🔴 items — distinct policy, executed DPAs — are shared prerequisites for every state).

| State | Status | Gating item(s) |
|---|---|---|
| WA (MHMDA) | 🟡 | Distinct consumer-health-data policy (draft §3.4); executed DPAs; formal DSR pipeline (new FR-ACCESS-010) |
| TX (SCOPE/TDPSA) | 🟡 | Counsel's TX onboarding reconciliation memo (SCOPE parental consent vs. teen-authority model) |
| CA (AB 2246/SB 1119) | 🟡 | AB 2246 profiling analysis + risk assessment; SB 1119 independent audit procurement + crisis-protocol/H3-firewall reconciliation |
| IL (BIPA) | 🟡→🟢 conditional | Written counsel confirmation: no biometric collection (device unlock + voice data analyses) |
| AL (APDPA) | 🟡 | 25k-consumer threshold monitoring; small-business exemption confirmation; effective 2027-05-01 |

**Blocked modules:** every module serving a non-GA user — which, under the 31-module day-one shell strategy, means **the WA/CA/TX/IL/AL launch of the whole app** until the per-state gating items clear. Health modules (W2/W8/W22/W23) are additionally gated by §§1–2. Sequencing recommendation: clear WA (MHMDA) first — its controls (distinct policy, DPAs, DSR pipeline, withdrawal parity) satisfy ~80% of the other states' requirements; then TX reconciliation, CA audits, and the IL/AL confirmations.

---

## 4. What must NOT ship as designed

1. **The 030 migration pair as numbered.** Two files share the `030` prefix (and 031–036 have the same problem per APPLY_ORDER.md). For the SUD separation chain, apply-order ambiguity is a *compliance* defect, not just a hygiene defect: the separation guarantees can silently fail to apply. **Fix:** unique prefixes (`030a_`/`030b_` or renumber), fix the internal "Migration 028" comment, and add the CI assertion job (§1.1-D) before any apply.
2. **`purge_tombstoned_health()`'s exclusion-string design.** A magic string in an array literal is the only thing protecting SUD rows from the service_role purge (which bypasses RLS). **Fix:** schema/role isolation (§1.1-G) + separate `purge_tombstoned_sud()` (§1.2) before W2 holds real data.
3. **The SUD consent RPC as drafted.** It validates that an instrument is non-empty but not that it contains the §2.31 elements (patient identity, discloser identity, revocation statement, signature/date). **Fix:** app-layer instrument schema + RPC element validation (§1.4) before any SUD disclosure feature ships.
4. **Any SUD disclosure without the re-disclosure notice.** The §2.32 notice (§1.4) must be attached to every disclosure package and logged. Shipping the consent RPC without the notice pipeline makes the "Part 2 standards" claim false.
5. **The undecided medical-emergency path.** "Break-glass: none" vs. Part 2 §2.51's emergency exception is an open deviation. **Fix:** counsel's documented decision (§1.2-4) before any SUD-adjacent crisis feature ships.
6. **Health modules in WA (or any state) before the distinct MHMDA policy exists.** The policy (§3.4) is a statutory prerequisite, not a nice-to-have — and the private right of action means the exposure starts at first collection.
7. **Pre-checked consent boxes anywhere in the health flow.** MHMDA affirmative consent + AB 2246's dark-pattern ban + the no-dark-patterns row of the mapping all prohibit them. The drafted language (§2.2) assumes unchecked-by-default; verify in UI QA.
8. **The H0 definition inconsistency.** BUILD-SPECIFICATION ("prohibited for <18" reading) vs. sol-health (H3-equivalent at 18+) vs. the retention schedule (no 18+ H0 row). One definition, conformed everywhere, before the policy cites the taxonomy.
9. **Any biometric-adjacent feature** (face-scan onboarding, voiceprint, emotion detection, gait analysis) without counsel's BIPA review — including "harmless" additions to the AI chat pipeline.
10. **Precise-location collection, ever, without a new privacy review.** D7 is load-bearing for the MHMDA geofence mootness, AB 2246's geolocation ban, and APDPA's precise-geolocation sensitivity. One SDK addition can collapse three compliance positions.

---

## 5. NFR-LEGAL-010 support — FTC Health Breach Notification Rule: PHR-vendor input for Attorney 1

> Input to Attorney 1's determination memo. Not a determination.

**Question:** Is Pookie a "vendor of personal health records" (or PHR-related entity) under the FTC Health Breach Notification Rule (as amended 2024)?

**Analysis (issue-spotting):**

- **What Pookie does:** W2 stores device and manually entered health data (vitals, activity, sleep, medications, allergies) that the user controls and views — the functional definition of a PHR. W8 adds mood/wellbeing journals (mental-health information). W22 (fitness) and W23 (nutrition) add health-adjacent data the user manages. The app "offers or maintains a personal health record" for individuals.
- **2024 amendments widened the rule:** "PHR identifiable health information" now includes data provided by or on behalf of the individual *and data derived from it*; the rule also reaches PHR-related entities, health-care providers, and providers of health-care services/supplies. Pookie's AI-derived health inferences (see §3.1 row 14) would fall inside the widened definition.
- **Preliminary view:** **W2 alone very likely makes Pookie a PHR vendor**; W8/W22/W23 strengthen the determination. Pookie is not a HIPAA covered entity (no indication it provides health care or acts as a business associate), so the rule's HIPAA carve-out does not save it.
- **If the determination is affirmative, the consequences attach before W2/W8/W22 hold real data:**
  - Breach notification: notice to each affected individual and to the FTC (2024 amendments shortened the FTC deadline for large breaches — counsel to confirm current timing), plus media notice for large breaches.
  - A written breach-response runbook must exist pre-launch (detection → scoping → notification → documentation), integrated with the infosec program and the SUD incident rule (§1.3 — SUD breaches get the highest-tier response).
  - The determination interacts multiplicatively with MHMDA's private right of action: a breach of WA consumer health data is both an FTC-rule notification event and potential MHMDA litigation fuel. The infosec program sign-off is therefore load-bearing for both gates.
- **Recommended scope for Attorney 1's memo:** (a) formal vendor determination with the 2024-amendment definitions applied to each health module; (b) whether any Pookie function (e.g., the Pookie tutor giving health information) makes it a "health care provider" or "health care services" entity under the amended rule; (c) the notification timeline and content requirements under current rule text; (d) interplay with state breach-notification laws (GA, WA, CA, TX, IL, AL each have their own).

**Status: input delivered; determination is Attorney 1's gate (NFR-LEGAL-010: 🔴 blocked).**

---

## 6. Module impact summary — blocked modules per gate

| Gate | Blocked modules | Dependency chain |
|---|---|---|
| NFR-LEGAL-011 (SUD separation) | Any SUD-adjacent feature: W8 crisis/SUD routing, S2/S3 support triage on crisis tickets, W19 break-glass card, D1 crisis-vendor API contract; W2 free-text health entry (can become SUD records on classification) | Schema/role isolation → separate purge job → instrument completeness → emergency-path decision → counsel sign-off → build |
| H0–H3 taxonomy | **W2 (all real teen data)**, W8, W22, W23; downstream W19, W28, W1 health uploads, G22 immunizations | Taxonomy build (FR-HEALTH-001) → per-subcategory consent UI (FR-HEALTH-007 v2) → 18+ re-consent flow (FR-AGE-006) → promises-vs-code audit → counsel sign-off |
| NFR-LEGAL-009 (multi-state) | **Any non-GA launch of the full 31-module shell** (WA/CA/TX/IL/AL) | MHMDA distinct policy → executed DPAs → DSR pipeline (FR-ACCESS-010) → withdrawal parity → per-state items (TX memo, CA audits, IL/BIPA + AL confirmations) |
| NFR-LEGAL-010 (FTC breach rule) | W2/W8/W22/W23 real-data launch (feeds Attorney 1's memo) | PHR-vendor determination → breach-response runbook → infosec sign-off |

**Day-one shell implication:** the 31-module shell may show W2/W8/W22/W23 as seedlings (visible, no data entry) in GA while gates clear — but **no real health data flows anywhere** until NFR-LEGAL-011 + taxonomy + NFR-LEGAL-010 clear, and **no health data from WA/CA/TX/IL/AL users** until NFR-LEGAL-009's per-state items clear.

---

## 7. Open questions for Mehedi

1. **Attorney engagement:** none of these gates can clear without licensed counsel. Which firm(s) — one health-privacy boutique for §§1–2 + NFR-LEGAL-010, and multi-state counsel for §3 — and on what timeline? The MHMDA distinct policy (§3.4) should be counsel-*drafted*, not counsel-reviewed.
2. **Part 2 public claim:** do you want Pookie to say "holds substance-use records to 42 CFR Part 2 standards" (my recommendation) vs. "compliant with 42 CFR Part 2"? The stronger claim needs counsel's applicability analysis first.
3. **Medical-emergency exception for SUD records:** absolute ban (exceeds Part 2, strongest teen-trust signal) vs. Part-2-faithful narrow emergency path (§2.51)? Counsel decides; I need your policy preference to brief them.
4. **SUD treatment referrals:** will Pookie ever refer teens to SUD treatment programs or share data with them? A "yes" reopens the Part-2-program applicability analysis entirely.
5. **CA SB 1119 independent audit:** the Pookie/Muse AI chat likely triggers the companion-chatbot audit requirement for CA launch. Do you want to procure the auditor now (long pole) or sequence CA after GA/WA?
6. **Compliance Owner:** gates 5/7 and the retention schedule need an appointed owner (also flagged in LEGAL-GATES-TRACKER). The DSR pipeline (§3.2) and quarterly promises-vs-code audit need an owner too.
7. **Launch sequencing:** my recommendation is GA → WA (MHMDA controls cover ~80% of other states) → TX → CA → IL/AL confirmations. Do you agree, or is there a business reason to prioritize a different state?
8. **AL 25k threshold monitoring:** who owns the AL-consumer counter that trips APDPA duties (effective 2027-05-01)? Recommend a dashboard alert at 20k.

---

## 8. Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-12 | Initial issue-spotting draft: NFR-LEGAL-011 proposal, SUD policy + consent drafts, H0–H3 sign-off, MHMDA finalization (14 requirements), DSR workflow (proposed FR-ACCESS-010), withdrawal parity, 5-state briefs, FTC breach-rule input, must-not-ship list | — (attorney review pending) |

---

*End of Attorney-2 memo. All clearance marks are provisional pending licensed counsel review. Nothing in this document authorizes reliance, shipment, or public claims.*
