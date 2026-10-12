# Pookie — Health Data Solutions (Data Model & Access Logic)

**Status:** DESIGN ONLY — no code, no deploys · **Author:** health-data solution designer · **Date:** 2026-10-12
**Source:** `~/workspace/pookie-app/docs/ACCESS-MODEL-REVIEW-CHECKLIST.md` (expert panel, 2026-10-12);
`USER-FIRST-ACCESS-MODEL-SPEC.md` (Mehedi-locked 2026-10-12); migrations 011/012 (unapplied).
**Scope:** data model + access logic for health. Crisis *protocols* belong to the safety designer;
consent-screen *copy* belongs to the UX designer. This doc defines what the safety pipeline may
receive (event types, never content) and what the consent screens must enumerate (tiers, never one "health" checkbox).
**Jurisdiction baseline:** Georgia, USA.

> **Panel status matched:** G3, §1.6.2, W2, W23 were 🛑 BLOCKED. This document is the redesign,
> not a workaround. Nothing below ships until the gates in §12 are cleared.

**Sequencing:** migrations 015/016 unapplied; 017–020 planned; **021 = `access_events`**.
All health migrations below continue at **022+** and apply *after* 021 (health consent/grants,
grace, and deletion events all write to `access_events`).

---

## 0. Conflicts with other domains (resolved here, flagged for owners)

| # | Conflict | Resolution (this doc) | Owner to confirm |
|---|---|---|---|
| C1 | `USER-FIRST-ACCESS-MODEL-SPEC.md` §4 promises **18+ continuity by default** ("parents keep access, no birthday disruption"). Panel §1.6.2 **blocks** that for health: affirmative opt-in, skip = private. | **Health is a carve-out.** §2: at 18, *all* health tiers flip private immediately; parents regain visibility only via per-tier affirmative re-consent (defaults OFF). The spec's continuity stands for school/location/non-health. The spec needs a one-line amendment. | Access-model owner |
| C2 | Migration 011's `health_safety_overrides` lets a parent override *sensitive* teen metrics with no expiry and no tier ceiling — incompatible with H3-absolute and "never parent-visible incl. aggregates." | **Amended in 022 (§1.7):** overrides apply to **H2 only** (never H3, never H0), expire ≤30 days, teen notified in-transaction (kept), teen can appeal/revoke early at 16–17, every use logged to `access_events`. | Safety designer (override is a safety instrument, not general access) |
| C3 | Migration 012's `nutrition_weekly_patterns()` hands parents **calorie averages** for teen subjects — an ED-risk vector the panel blocks for <18. | **Amended in 027 (§6.7):** for subjects <18, parents receive **engagement-only** aggregates (days logged, meals recorded); calorie/macro/weight aggregates are refused server-side. | — |
| C4 | G1: crisis-language → trusted-adult alert vs. revoked parents losing all access vs. health privacy (H3 absolute, W8 never parent-visible). | **Firewall rule (§5.5):** W8/W2 emit *event metadata only* (`wellbeing_event`: teen, type, timestamp, severity — **never content**) to the safety pipeline. Safety routes to the teen's **designated trusted adult** (separate from access grants; may be a non-parent). Safety events **never widen data access** and never expose H3 records. | Safety designer |
| C5 | 011's `default_sensitivity IN ('routine','sensitive')` + `health_metric_visible()` vs. the H0–H3 taxonomy. | **Superseded in 022 (§1.7):** `metric_defs.default_sensitivity` → `metric_defs.health_tier`; `health_metric_visible()` → `health_tier_visible()`. 011/012 are unapplied, so this is an amend-before-apply, not a second migration chain. | — |

---

## 1. G3 — H0/H1/H2/H3 privacy taxonomy (CRITICAL)

W2/W8/W23 **cannot hold real teen data** until this taxonomy exists in schema + RLS + UI.
It replaces 011's two-level `routine/sensitive` split (see C5).

### 1.1 Tier definitions (normative)

- **H0 — Prohibited for minors.** Categories Pookie *never collects from, and never stores for,
  anyone under 18.* The UI refuses the entry; the API refuses with `h0_minor_refusal`
  (logged to `access_events`, no health content in the log). For 18+ users, H0-class data is
  treated as H3-equivalent: private to the user, shareable only via explicit per-record consent,
  never under a general grant.
- **H1 — Shareable wellness.** Low-sensitivity, descriptive wellness data. Visible to family
  members holding the **Wellness scope** grant (§1.4). This is the only tier that is
  family-visible by default for teens.
- **H2 — Teen-private.** Private to the teen by default at 13+. Parents see it only via the
  teen's **explicit per-tier grant** or a **time-boxed, teen-notified safety override**
  (H2 only — see C2). Under-13 stewardship: visible to steward parents.
- **H3 — Legally sensitive.** Teen-entered data relating to care a Georgia minor can consent
  to themselves (STI testing/treatment, substance-use counseling/treatment, mental-health care
  at 16+ — categories from counsel-reviewed `state_minor_consent_rules`), plus mental-health
  notes, therapy records, pregnancy/sexual-health data. **H3 is the one tier with no override:**
  teen-only at 13+, no parent path ever — no grants, no safety overrides, no aggregates,
  no emergency break-glass, no API surface for anyone but the teen. (Crisis *events* may still
  flow as metadata to the safety pipeline per §5.5 — the *records* never leave.)

### 1.2 What goes in each tier (concrete examples)

| Data | Tier | Notes |
|---|---|---|
| Steps, activity minutes, sleep hours, resting HR, HRV (device) | **H1** | Descriptive only, provenance-labeled (§4) |
| Height, water intake, meal-log *engagement* (days logged) | **H1** | Never calorie detail for <18 (§6) |
| Immunization record / GA Form 3231 on file | **H1** | Parents need this for school forms while <18 |
| Weight, BMI, body measurements | **H2** | Weight is the highest ED-sensitivity metric; never H1 |
| Blood glucose, HbA1c, blood pressure readings | **H2** | Device or manual |
| Medications list (non-SUD), allergies, doctor-visit notes, 504/IEP health accommodations | **H2** | Allergy list feeds W28 hard-blocks (§10) |
| Menstrual cycle data | **H2** | Teen-private at 13+ |
| Food diary (descriptive, <18) / calorie food logs (18+) | **H2** | Teen's diary; parents get engagement-only aggregates <18 |
| Mood journal entries, check-in text, wellbeing notes | **H2** | W8 content; aggregates never parent-visible (§5) |
| STI testing/treatment records, contraception records | **H3** | GA minor-consentable care; auto-tiered on entry (§8) |
| Substance-use counseling/treatment notes | **H3** | 42 CFR Part 2 separation applies (§8.4) |
| Mental-health therapy notes, psychiatric medication adherence | **H3** | At 16+ per GA rules; teen-entered below 16 also lands H3 |
| Pregnancy-related data | **H3** | |
| Genetic test results (e.g., 23andMe-style), predictive disease-risk scores, full-body scan reports, fertility-planning data | **H0** | Refused <18; H3-equivalent for 18+ |

**Tiering rule of thumb for future metrics:** if a reasonable teen would hesitate to have a
parent read it aloud at the dinner table, it is not H1. If it relates to consentable care, it
is H3. If the app shouldn't hold it for a minor at all, it is H0.

### 1.3 Who can see what — access matrix

Age bands: `<13` stewardship (COPPA) · `13–15` shared agency · `16–17` full agency · `18+` ownership.
Bands are computed server-side from `children.date_of_birth` (unknown DOB fails closed into the
most restrictive applicable band; emancipated minors take the adult track per G11).

| Tier | <13 | 13–15 | 16–17 | 18+ |
|---|---|---|---|---|
| **H0** | Refuse (no collect, no store) | Refuse | Refuse | User only; shareable solely via explicit per-record consent |
| **H1** | Steward parents (full) | Family per **Wellness scope** grant (default ON at link) | Same as 13–15 | User only, until per-tier affirmative re-consent (§2); then per Wellness grant |
| **H2** | Steward parents (full) | **Teen only** (default). Parent path: teen's explicit H2 grant, OR time-boxed (≤30d) teen-notified safety override (audited) | **Teen only.** Parent path: teen's explicit H2 grant. Safety override still exists but the teen can **revoke it early** (one tap, no guilt screens — full agency) | User only, until affirmative re-consent (default OFF); then per grant |
| **H3** | Refuse (not collected; parent-entered sexual-health content for <13 → H2, flagged) | **Teen only. No parent path — no grants, no overrides, no aggregates, no exceptions** | Same as 13–15 | User only; shareable solely via explicit per-record consent (never under a general grant) |

Notes:
- **Aggregates follow the tier.** There is no "but the weekly average is fine" path around H2/H3:
  W8 has *no* parent aggregate endpoint at all (§5); W23 gives parents engagement-only for <18 (§6).
- **The 7-day cooling-off / instant-revoke rules** from the access spec apply to *grants* (H1/H2
  grants the teen made); they do not create any path into H3.
- **Unknown DOB** fails closed: treated as 13–15 for tier purposes until verified.

### 1.4 Who can enter / edit

| Tier | Enter | Edit / correct | Delete |
|---|---|---|---|
| H0 | <18: refused. 18+: user only | User only | User only, ≤30 days honored |
| H1 | Parent (<13 steward), teen (13+), parent (13+, e.g., logging for family) | Enterer or teen; parent-entered rows are correctable by the teen and surface in the 18+ review–correct–seal (§2.4) | Tenant member; teen-deletable |
| H2 | Teen (13+); parent (<13 steward; 13+ only for non-sensitive logistics like appointment dates — flagged `entered_by`) | Teen; parent-entered H2 rows for 13+ are **read-only for the parent after entry** and appear in the teen's review queue | Teen only (13+); steward parent (<13) |
| H3 | **Teen only.** Server-enforced: INSERT requires child-role on the child. Parent INSERT → 403 + `access_events` entry | Teen only | Teen only, immediate tombstone, hard delete ≤30 days (§3) |

`entered_by` is stamped on every health row (already in 011/012) — it powers the 18+ review screen
and the audit trail. Corrections are UPDATEs; the app keeps an append-only correction history
(`health_corrections`: record_id, field, old, new, corrected_by, corrected_at).

### 1.5 Retention rules (per tier; see also §3 and G6)

| Tier | Raw retention | Aggregates | Backups | On request |
|---|---|---|---|---|
| H1 | 24 months rolling, then aggregate-only | Retained (anonymized at account close) | Purged ≤30 days after source deletion | Delete ≤30 days |
| H2 | While account active; **teen-configurable auto-purge** (12/24 mo); teen-deletable anytime | Tier-locked (aggregates inherit H2) | Purged ≤30 days after source deletion | Delete ≤30 days |
| H3 | **12-month rolling default** (teen can extend per record); teen-deletable anytime | **No aggregates leave the teen's scope** — server never computes cross-tier or parent-facing aggregates over H3 | Purged ≤30 days after source deletion; excluded from all backups restorable by anyone but the teen | Immediate tombstone; hard delete ≤30 days |
| H0 | n/a (<18); 18+ follows H3 | — | — | Delete ≤30 days |

Retention is enforced by nightly jobs (service_role): `purge_expired_health()` reads
`health_retention_policies` (per-child overrides) + tier defaults. **No indefinite retention
anywhere** (G6 / Category 7 🛑).

### 1.6 Database representation

**Enum + columns (migration 022):**
```sql
-- 022_health_tiers.sql (applies after 021; amends unapplied 011/012)
CREATE TYPE public.health_tier AS ENUM ('H0','H1','H2','H3');

-- metric_defs: replace default_sensitivity with the tier
ALTER TABLE public.metric_defs
  ADD COLUMN health_tier public.health_tier NOT NULL DEFAULT 'H1';
-- backfill, then drop default_sensitivity (011 unapplied: edit-in-place before apply)

-- every health content table carries its tier explicitly (defense in depth:
-- tier is stamped at write from the def, not re-derived at read)
ALTER TABLE public.health_metrics  ADD COLUMN health_tier public.health_tier NOT NULL DEFAULT 'H2';
ALTER TABLE public.food_logs       ADD COLUMN health_tier public.health_tier NOT NULL DEFAULT 'H2';
-- new tables in later migrations (wellbeing_entries, health_notes, medications,
-- cycle_data, immunizations, sud_records) all carry health_tier NOT NULL.
```

**Backfill map (routine/sensitive → tiers):** steps, sleep_hours, heart_rate_resting,
height, blood_pressure_* → **H1**; weight, blood_glucose, hba1c → **H2**.
Mental-health/therapy-adjacent content → **H3** (new tables). H0 has no metric_defs rows for minors.

**The privacy predicate** (replaces 011's `health_metric_visible()`; SECURITY DEFINER,
`search_path` pinned, no agent_reader grant):
`public.health_tier_visible(p_subject_id uuid, p_metric_key text, p_tier health_tier) RETURNS boolean`
logic:
1. Subject unknown / subject's child not in `current_child_ids()` → false.
2. Band `under13` → H1/H2 true for tenant (stewardship); H3 false (not collected); H0 false.
3. Band `teen_13_15` / `teen_16_17`:
   - H1 → true iff caller holds the Wellness scope grant for the child (default ON at link per 1.3.3).
   - H2 → true iff caller is the teen (child-role on that child) OR an **active, unexpired,
     teen-notified safety override** exists (H2-only; see §1.7) OR an active teen-made H2 grant
     names the caller.
   - H3 → true iff caller is the teen. **No other arm. Ever.**
   - H0 → false.
4. Band `adult` → true iff caller is the subject's user AND (tier = H1 with an active
   post-18 Wellness grant, or tier = H2/H3 with an active per-tier re-consent, or caller IS the
   user reading their own data — own-data read is always true). Parent rows require rows in
   `health_consent_grants` (§2.5) that are unexpired and post-date the 18th birthday.
5. `entered_by`-parent rows for 13+ do **not** widen visibility.

**RLS sketch** (per content table; `health_metrics` shown):
```sql
CREATE POLICY health_metrics_tier_read ON public.health_metrics
  FOR SELECT USING (public.health_tier_visible(subject_id, metric_key, health_tier));
-- INSERT: tenant member; H3 INSERT additionally requires child-role (policy WITH CHECK
-- calls public.health_tier_insert_allowed(...): H3 → caller is teen; H0 → band adult only)
-- UPDATE: tenant member; H3 → teen only. DELETE: none for metrics (corrections are UPDATEs);
--   wellbeing/H3 tables grant teen DELETE (tombstone path, §3).
```

**Per-tier grants table** (also used by §2 re-consent):
`health_consent_grants(id, child_id, granter_user_id, grantee_user_id, tier health_tier,
scope text DEFAULT 'wellness', status, granted_at, expires_at, revoked_at, revoked_reason)`.
Grants are **per tier, never blanket**. A general "health" grant is unrepresentable.

### 1.7 Amendments to migration 011 (edit before apply — 011 is unapplied)

1. `metric_defs.default_sensitivity` → `health_tier` (per §1.6); `health_metric_visible()` →
   `health_tier_visible()`.
2. `health_safety_overrides`: add `tier health_tier NOT NULL DEFAULT 'H2' CHECK (tier='H2')`
   (H2-only, enforced); add `expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'`
   with `CHECK (expires_at <= created_at + interval '30 days')`; add `teen_appealed_at`
   (16–17 early-revoke path). INSERT policy unchanged otherwise (parent-only, 20-char reason,
   teen-notified in-transaction kept).
3. `health_subject_age_band()`: split `'teen'` into `'teen_13_15'` / `'teen_16_17'`
   (needed by the matrix); keep `'unknown'` failing closed into the 13–15 arm.
4. `state_minor_consent_rules` stays as the counsel-gated GA rules table; 022 seeds the GA row
   with `counsel_reviewed=false` (ship-blocked until licensed-counsel review — unchanged from 011).

### 1.8 W2 unblock checklist (what "tiers exist" means, concretely)

W2 may hold real teen data when: 022 applied; `health_tier_visible()` covered by RLS tests
(deny-by-default proven per tier × band in staging); the 18+ cutover job (§2) live; the
wellbeing-event emission contract (§5.5) signed off by the safety designer. Until then, W2
ships as a **seedling placeholder** (per the 31-module shell rule) with no data entry.

---

## 2. §1.6.2 — 18+ health re-consent (was 🛑 BLOCKED)

**Panel requirement:** health needs **affirmative opt-in re-consent; skip = private.**
Body & development requires a fresh explicit grant (default off). Add review–correct–seal of
parent-entered data, transition-summary export, and emergency-contact re-designation decoupled
from access grants.

**What happens at 18 (normative, overrides the access spec's continuity default for health — C1):**
at 00:00 local on the 18th birthday, **all parent visibility into every health tier ends
immediately** — including H1. Pre-18 teen-made grants expire by `expires_at`. There is no
grandfathering, no grace read of *new* data. The 30-day grace in §3 covers *historical*
records only. The re-consent screen (first login ≥18) can restore access per tier, all defaults OFF.

### 2.1 The cutover job (runs whether or not the user logs in)

`nightly_health_birthday_cutover()` — pg_cron nightly, SECURITY DEFINER / service_role:
1. Find children whose 18th birthday was today (or emancipated minors newly flagged — G11 adult track).
2. For each: expire all `health_consent_grants` where `grantee_user_id ≠ subject user`
   (`expires_at = now()`), insert `access_events` rows (`event='health_cutover_18'`,
   per-tier detail, no health content), create `health_grace` rows (§3) for historical access,
   and set `children.health_reconsent_status='pending'`.
3. Pause parent-connected **device sync tokens** for the subject's wearables
   (`health_device_tokens.status='suspended_pending_reauth'`) — the adult re-authorizes their
   own HealthKit/Health Connect feed; the parent's token never resumes.
4. Queue the re-consent prompt for next login (blocking interstitial, not a dismissible banner).

Privacy cannot wait for a login: steps 1–3 execute at midnight local regardless.

### 2.2 The 18th-birthday health review screen (first login ≥18)

Route: `/health/review-18` — a **blocking interstitial** (the dashboard waits behind it;
"Remind me later" is allowed but re-prompts every login until completed or explicitly skipped —
and **skip = private**, which is itself a recorded choice, `health_reconsent_status='skipped_private'`).

**Screen structure (copy owned by UX; content spec here):**
1. **Header line:** "You're 18. Your health information is now private to you."
   Sub-line: "Until today, [Mom/Dad] could see parts of your health info. That access ended
   last night. Nothing is shared unless you turn it on below."
2. **Per-tier grant cards — three separate toggles, ALL DEFAULT OFF, never one "health" checkbox**
   (per checklist 1.2.1: health subcategories enumerated):
   - **Everyday wellness (H1)** — OFF. Lists *what*: "Steps, sleep, heart rate from your devices."
     Shows counts: "142 readings from the last year." Toggle: "Let [Mom] see my everyday wellness."
   - **Private health (H2)** — OFF. "Weight, medications, allergies, doctor notes, food diary."
     Shows counts. Toggle per parent.
   - **Most personal (H3)** — **not a toggle.** Static line: "Records about care you consented to
     yourself (like STI testing or counseling) stay only with you. Always. There's no switch for this."
3. **Who-currently-sees-what panel:** "Right now: nobody but you." (Because cutover already ran.)
4. **Review–correct–seal** (§2.4) — second step of the flow.
5. **Transition summary export** (§2.5) — offered, not forced.
6. **Emergency contacts** (§2.6) — re-designated here, explicitly decoupled.
7. **Confirm:** "Save my choices" → writes `health_consent_grants` rows (one per tier per grantee),
   sets `health_reconsent_status='complete'`, logs to `access_events`.
   "Skip — keep everything private" → `status='skipped_private'`; identical privacy outcome,
   recorded as an affirmative choice so the prompt stops appearing.

**Defaults rationale:** the panel is explicit — *skip = private*, and Body & development needs a
*fresh explicit grant, default off*. H1 also defaults OFF (stronger than the 13–15 default-ON),
because the legal subject of the data has changed from child to adult.

### 2.3 Toggle semantics (server-side)

- Each toggle maps to exactly one `health_consent_grants` row: `(child_id, granter=adult user,
  grantee=parent, tier)`. No row = no access (deny by default in `health_tier_visible()`).
- Grants created here carry `granted_at ≥ 18th birthday` and `expires_at = NULL`
  (revocable anytime by the adult, one tap, instantly reversible).
- H3 never gets a row: `health_tier_visible()` has no grant arm for H3 (invariant from §1.3).
- Re-consent is **per parent**: Mom and Dad are separate toggles (parallel-parenting safe — W14).
- The adult can change these anytime later in Settings → Sharing → Health (same per-tier toggles).

### 2.4 Review–correct–seal of parent-entered data

**Review queue:** all health rows for the subject with `entered_by ≠ subject user`
(parent-entered H1/H2, including pre-18 device readings synced under a parent's token).
Presented as a list grouped by category (Vitals, Weight, Medications, Notes…), each row showing
what was entered, when, and by whom.

Per row, three actions:
- **Keep** — accept as-is; row marked `sealed_at=now()`, `sealed_by=user`.
- **Correct** — inline edit; writes a `health_corrections` row (old/new/corrected_by/at);
  the corrected row is then sealed.
- **Delete** — tombstone immediately (§3 deletion pipeline).

**Seal semantics:** after the review step completes, every surviving parent-entered row carries
`sealed_at`. Sealed rows are **read-only history**: they are visible to the user, included in the
user's own trends, but **excluded from any sharing grant until the user explicitly includes
sealed history** (a separate, default-OFF checkbox: "Include records from before I turned 18").
This prevents a pre-18 H2 grant from silently re-exposing parent-entered history the adult
hasn't reviewed.

### 2.5 Transition-summary export

**"Take to your new doctor"** — offered at the end of the review flow and anytime from
Settings → Health → "My health summary."
- **Contents:** conditions (user-maintained list), current medications (name, dose, schedule —
  descriptive, never dosing *advice*), allergies (from the allergy list, §10), immunization
  record (Form 3231 data, §9), recent vitals *trends* (descriptive ranges, provenance-labeled,
  with the "not a medical device" footer), emergency contacts, insurance card (masked per W7 rules).
  H3 records are **excluded by default**; the user may opt specific H3 records in with an explicit
  per-record checkbox ("Include my counseling records" — default OFF).
- **Formats:** printable PDF (single-page clinical summary + appendices) and machine-readable
  JSON download. Both generated server-side via RPC `rpc_export_transition_summary()`
  (service_role render; the PDF never persists — streamed and discarded).
- **Audit:** every export logged to `access_events` (`event='transition_summary_export'`).

### 2.6 Emergency-contact re-designation (decoupled from access)

W19 emergency contacts are **contact info, not access grants.** The review screen includes:
"Who should be called in an emergency?" — the adult picks contacts (Mom, Dad, sibling, friend).
Directly beneath, in plain language:

> "Emergency contact is not the same as access. If you list Mom here, she can be *called* in an
> emergency. She still can't *see* your health information unless you turn that on above."

**Technical decoupling:** `emergency_contacts` (W19) and `health_consent_grants` are separate
tables with no foreign-key or trigger relationship; no code path derives one from the other.
The **break-glass medical card** (W19: allergies, conditions, medications — the lock-screen/QR
card per G25) is populated from H1/H2 the *user* selects, independent of parental access —
internal medicine's requirement that break-glass work "independent of parental access" is met
because the card belongs to the adult, not to any grant.

### 2.7 RPCs & migration (023)

**Migration `023_health_reconsent.sql`:** `health_consent_grants` table (§1.6),
`health_corrections` table, `health_device_tokens.status` lifecycle,
`children.health_reconsent_status` enum
(`'not_due'|'pending'|'complete'|'skipped_private'`), the cutover function +
pg_cron schedule, RLS (grants readable by granter + grantee; writable by granter only via RPC).

**RPCs:**
- `rpc_health_reconsent_submit(grants jsonb)` — validates tiers ∈ {H1,H2}, grantee is a linked
  adult, caller is the adult subject; writes grant rows; sets status complete.
- `rpc_health_reconsent_skip()` — sets `skipped_private`; no grants written.
- `rpc_health_review_queue()` — returns the parent-entered rows awaiting review/correct/seal.
- `rpc_health_record_correct(record_id, table, patch jsonb)` / `rpc_health_record_delete(...)`.
- `rpc_export_transition_summary(format)` — PDF/JSON, audit-logged.

---

## 3. §1.6.3 — Historical health data (grace, hide-past, deletion)

**Panel requirement:** 30-day grace then auto-restrict for health; teen can request "hide past too"
(FERPA); deletion honored within 30 days. (Backups purged ≤30 days after source deletion —
Category 7.)

### 3.1 The 30-day grace — mechanics

On **any** health-access-ending event (teen revokes a parent's H1/H2 grant; 16–17 instant revoke;
13–15 cooling-off completes; 18th-birthday cutover; go-independent):
1. The ending event writes `health_grace` rows:
   `health_grace(id, child_id, viewer_user_id, tier, grace_expires_at, created_from_event)`.
   One row per (viewer, tier) the viewer previously held.
2. **During grace**, `health_tier_visible()` gains a narrow arm: the viewer may read records
   with `recorded_at < <revoke timestamp>` in the graced tiers — **historical only, never new
   records**. The UI labels this state: "[Mom] can still see records from before [date] until
   [grace_expires_at]." No new writes are visible; no new grants can extend it.
3. **Auto-restrict:** nightly `sweep_health_grace()` (pg_cron, service_role) deletes expired
   rows; expiry is enforced in the predicate (`grace_expires_at > now()`), so even a missed
   sweep run fails closed — the predicate, not the job, is the enforcement point.
4. Every grace creation/expiry/hide-past writes to `access_events` (teen-visible; never shown
   to the revoked viewer — welfare/FERPA).

**H3 and grace:** H3 records are never graced — no parent ever held them, so there is nothing
to grace. The 18th cutover creates no H3 grace rows.

### 3.2 "Hide past too" — the teen's FERPA lever

Settings → Sharing → Health → **"Hide my past health data too"** (plain language;
≤8th-grade copy owned by UX):
- Calls `rpc_hide_past_health()` — immediately deletes all `health_grace` rows where the
  caller is the subject (all viewers, all tiers). Effect is instant; the predicate arm closes
  on next read.
- Confirmation is explicit and non-guilted: "This hides health records from before today from
  [Mom/Dad], right away. They'll see a neutral 'no longer shared' — not what you hid."
- Available at 13+; at 18+ it is part of the review screen ("Also hide records from before
  today"). Logged to `access_events` as `hide_past_health`.
- **Neutral viewer experience:** the revoked viewer sees "Health sharing ended" — never a
  per-record tombstone that leaks *what* was hidden (welfare: no retaliation surface).

### 3.3 Deletion pipeline (honored within 30 days)

`rpc_request_health_deletion(scope jsonb)` — scope ∈ {`tier:H2`, `tier:H3`, `category:wellbeing`,
`record:<id>`, `all_health`}. Flow:
1. **Immediate:** rows tombstoned (`deleted_at=now()`, content nulled for H3; H1/H2 keep
   tombstone metadata only). Reads exclude tombstoned rows instantly.
2. **≤30 days:** hard `DELETE` by `purge_tombstoned_health()` (nightly job); storage objects
   (nutrition photos, 3231 PDFs, check-in attachments) deleted from buckets in the same run.
3. **Backups:** Supabase PITR + storage backups — the infosec program (G6) documents the
   backup-purge runbook: tombstoned-then-hard-deleted rows are excluded from restores after
   the 30-day window; any restore within the window re-runs the purge before serving traffic.
   **Backups purged ≤30 days after source deletion** (Category 7 requirement).
4. **Audit:** `access_events` keeps an anonymized stub (`event='health_deletion'`,
   scope, timestamp — no content, no record IDs that resolve to content).
5. **H3 fast path:** H3 deletions hard-delete on the *next* nightly run (not 30 days) —
   shortest-lived by policy.

**Migration `024_health_grace_and_deletion.sql`:** `health_grace`, tombstone columns
(`deleted_at`) on all health tables, `sweep_health_grace()` + `purge_tombstoned_health()`
+ pg_cron schedules, RPCs above, RLS (grace rows readable by subject + viewer; writable only
via the event functions / RPC).

### 3.4 What the parent keeps (spec alignment)

"Parent keeps what they saw" (spec §1.6.3) is implemented as the §3.1 grace — 30 days of
*historical* visibility, then auto-restrict. It is **not** a data export: the parent cannot
bulk-export the teen's health history during grace (no export endpoint honors graced reads;
`rpc_export_transition_summary()` is subject-only). Screenshots are outside our control;
the design minimizes the window and the surface.

---

## 4. W2 Health module (was 🛑 until tiers exist)

**Panel requirement:** consumer-device data is **descriptive only, provenance-labeled, never
diagnostic** (internal medicine; FDA wellness boundary). Unblocked by §1 (tiers exist).

### 4.1 Ingestion pipeline (with provenance labels)

**Sources:** Apple HealthKit (iOS companion → Edge Function), Google Health Connect (Android →
Edge Function), manual entry. No other sources in v1.

```
Device (HealthKit / Health Connect)
  → OS-level user consent (system sheet; <13: no device sync at all — COPPA, §4.4)
  → POST /api/health/ingest  (Edge Function, per-user token, rate-limited)
  → validate: metric_key ∈ metric_defs allowlist; value within sane range;
    recorded_at = device timestamp (not ingest time); dedupe on (subject, metric, recorded_at, source)
  → stamp: provenance ('apple_healthkit' | 'google_health_connect' | 'manual'),
    device_name, app_version, health_tier (from metric_defs; weight→H2 etc.)
  → anomaly screen (§4.3) → INSERT health_metrics
```

**Schema additions (022):** `health_metrics.provenance text NOT NULL DEFAULT 'manual'
CHECK (provenance IN ('manual','apple_healthkit','google_health_connect','provider_import'))`,
`device_name text`, `anomaly_flag boolean NOT NULL DEFAULT false`,
`anomaly_reviewed_at timestamptz`.

**Provenance is UI-visible everywhere:** every chart, reading, and trend carries its source
("From Apple Health · iPhone · 7:42 AM"). Manual entries are labeled "Entered by you" /
"Entered by Mom". No reading ever appears sourceless — provenance is a first-class column,
not metadata.

**What is NOT ingested:** anything the device reports that maps to a diagnosis, risk score, or
H0 category (genetic risk, AFib classification, etc.) is refused at the Edge Function
(`h0_minor_refusal` <18; 18+ requires explicit per-metric opt-in). The allowlist is the
enforcement point — the app cannot receive what it cannot store.

### 4.2 "Not a medical device" — disclaimers (persistent, not one-time)

- **W2 header (persistent, every visit):** "Pookie shows what your devices recorded. It doesn't
  diagnose, treat, or predict anything about your health."
- **Per-chart footnote:** "Not a medical device. For medical advice, talk to a clinician."
- **Onboarding consent for device sync:** "Your [Apple Health / Health Connect] data is
  descriptive only — steps, sleep, heart rate as recorded. Pookie won't tell you what it means
  medically."
- **FDA wellness boundary (design rule):** only *general wellness* presentations — trends,
  ranges, "you slept more this week than last." **Never:** disease claims ("your HR pattern
  suggests…"), risk scores, triage advice, or "normal/abnormal" labels. The words
  *diagnose, disorder, condition, abnormal, risk* do not appear in W2 UI or API responses
  (string-lint rule for the engineering handbook).

### 4.3 When data looks alarming — the no-diagnosis path

**Detection (server-side, counsel-reviewed thresholds table, not hardcoded diagnoses):**
`health_alert_thresholds(metric_key, warn_low, warn_high, counsel_reviewed, reviewed_at)` —
e.g., resting HR sustained <40 or >120, SpO2 <90%, single weight swing >10% week-over-week
(anomaly, not diagnosis). Rows ship with `counsel_reviewed=false` and the pipeline treats
unreviewed thresholds as inert (same counsel-gate pattern as 011's `state_minor_consent_rules`).

**When a reading trips a threshold, the app MUST:**
1. **Not diagnose.** Never name a condition, never say "abnormal."
2. Show the teen: **"This reading looks unusual. Devices can be wrong — if you feel unwell,
   talk to a clinician or urgent care."** Plus one-tap resources: 911 / poison control /
   988 / GA Crisis & Access Line (1-800-715-4225) as appropriate to the module context.
3. Offer (never auto-trigger) **"Tell a trusted adult"** — teen taps, teen picks *which*
   trusted adult from their designated list (G15 infrastructure). This is a *notification*
   ("[Name] flagged an unusual health reading and wanted you to know"), **not** data access —
   the adult sees no readings, no trends.
4. **Never auto-alert parents.** No push, no email, no digest entry, no lock-screen content.
   (Panel: no health-content push — lock-screen leakage; C4 firewall.)
5. Emit `wellbeing_event` type `health_anomaly_flag` (metadata only: teen, metric_key,
   timestamp, severity — **no values**) to the safety pipeline for the safety designer's
   escalation ladder.

**Parent view of an anomaly:** nothing. The parent's W2 shows the reading (if H1 and granted)
with the same neutral provenance label; the anomaly flag is **not** parent-visible
(it would be a backdoor health alert). The teen owns the decision to loop in an adult.

### 4.4 Age rules for device sync

- **<13:** no device sync (COPPA — no direct collection from the child). A steward parent may
  manually log H1/H2 readings for the child.
- **13–17:** device sync requires the **teen's own** OS consent + in-app confirm; the parent
  cannot enable sync on the teen's device from the parent's phone.
- **18+:** the adult re-authorizes after cutover (§2.1); parent-connected tokens are suspended
  at midnight on the 18th birthday and never resume.

---

## 5. W8 Wellbeing — data side

**Panel:** teenPrivate is correct; add crisis-escalation ladder (bad day → pattern → crisis
triggers → ED signals); **never parent-visible including aggregates**; no indefinite retention; 988 integration.
The ladder's *response* is the safety designer's; this section defines the *data* that feeds it.

### 5.1 Data model & absolute teen-privacy

**Migration `025_wellbeing.sql`:** `wellbeing_entries(id, child_id, entered_at, mood_score,
mood_label, journal_text, tags text[], health_tier DEFAULT 'H2', deleted_at)` —
mood/journal content is **H2 minimum**; entries the teen marks as relating to mental-health
care, self-harm, or disordered eating are **H3** (auto-suggest + teen confirm, §8).

**RLS — the strongest in the health surface:**
```sql
CREATE POLICY wellbeing_teen_only_read ON public.wellbeing_entries
  FOR SELECT USING (
    child_id = ANY (public.current_child_ids())
    AND EXISTS (SELECT 1 FROM public.child_access ca
                WHERE ca.user_id = auth.uid() AND ca.child_id = wellbeing_entries.child_id
                  AND ca.role = 'child')
  );
-- INSERT/UPDATE: teen only. DELETE: teen only (tombstone → §3 pipeline).
-- No parent arm. No override arm. No service_role read path for product code
-- (jobs use SECURITY DEFINER functions that return metadata only).
```

**Aggregates: there is no parent aggregate endpoint.** Unlike W23 (which has a constrained
parent RPC), W8 ships **no** `wellbeing_weekly_patterns()` for parents — the panel's "never
parent-visible *including aggregates*" is enforced by absence, not by policy text. Any future
aggregate RPC requires a new migration + panel re-review. Server-side pattern detection (§5.3)
runs in SECURITY DEFINER functions that return **event metadata only**.

### 5.2 Retention / purge (no indefinite retention — G6)

- **Default:** 12-month rolling retention on `journal_text` (raw); mood scores/tags kept
  24 months as H2 aggregates-for-self (the teen's own trends).
- **Teen controls:** "Auto-delete my journal entries after [30 / 90 / 365 days]" setting;
  per-entry delete anytime (tombstone → hard delete next nightly run for H3-flagged, ≤30 days otherwise).
- **Enforcement:** `purge_expired_wellbeing()` nightly (service_role); backups ≤30 days (§3.3).
- **Check-in text** (Category 5): same rule — teen-deletable + rolling auto-purge option, never indefinite.

### 5.3 Crisis-escalation ladder — the data events W8 emits

W8 **emits events; it does not act on them.** Each emission writes to `wellbeing_events`
(`id, child_id, event_type, severity, created_at` — **no content, no scores, no journal text**)
and notifies the safety pipeline (owned by the safety designer). Event types:

| Event | Trigger (data-side) | Severity |
|---|---|---|
| `mood_critical` | Teen selects the crisis-level mood / taps "I need help now" | high |
| `pattern_flag` | Server-computed: 3+ consecutive days of lowest-band mood, or 7-day deteriorating trend — computed in a SECURITY DEFINER function that returns only the flag | medium |
| `self_harm_disclosure` | Teen self-reports self-harm ideation/behavior in journal or via structured check-in (keyword assist + teen confirm — never auto-classified silently) | high |
| `ed_signal` | Journal/check-in signals of disordered eating (restriction, purging, body-image distress) — teen-confirm where possible; also fires from W23 anomaly patterns (§6.6) | medium→high |
| `health_anomaly_flag` | From W2 §4.3 (device reading trips counsel-reviewed threshold) | medium |

**What the event carries:** teen identity, event type, timestamp, severity. **What it never
carries:** journal content, mood history, metric values, or any H2/H3 record. The safety
designer's ladder (988/Crisis Text Line surfacing, teen-controlled "tell a trusted adult,"
documented AI self-harm protocol, "private spaces are not safety-monitored" copy) consumes
these events. **Safety events never widen data access** (C4): responding to a crisis does not
grant anyone H2/H3 reads, and the trusted adult receives resources + the teen's chosen
message, not health records.

### 5.4 988 integration hooks (data side)

- `wellbeing_events` rows with severity=high trigger the safety pipeline's 988/Crisis Text Line
  surfacing (safety designer owns copy/UX): 988 call/text, Crisis Text Line (text HOME to 741741),
  GA Crisis & Access Line (1-800-715-4225).
- **"Tell a trusted adult"** is a first-class action on every high-severity surface —
  teen-initiated, teen-chosen recipient from their G15 trusted-adult list, logged to
  `access_events`. If the teen declines, the G1-mandated acknowledgment
  ("I understand no adult will be alerted") is recorded — copy owned by UX, event owned here.
- **NEDA hook:** `ed_signal` additionally surfaces NEDA resources in-module (§6.5).

### 5.5 Conflict note (C4, for the safety designer)

The panel simultaneously demands (a) W8 never parent-visible incl. aggregates and (b) a crisis
ladder that can reach an adult. The resolution built here: **metadata-only emission + trusted-adult
routing.** The safety pipeline must not request, and the health schema must not provide, record
content in response to a crisis event. If the safety design needs more (e.g., imminent-risk
break-glass), that is a new panel decision — not something this schema silently permits.

---

## 6. W23 Nutrition (was 🛑 BLOCKED for <18) + W13 Meals

**Panel requirement:** no calorie/weight-loss features <18; weight-neutral framing; NEDA resources;
clinician gate. Food/protein logging as designed = documented ED risk vector — redesigned below.

### 6.1 Feature matrix (<18 vs 18+)

| Feature | <18 | 18+ |
|---|---|---|
| Calorie logging / calorie display | ❌ **Blocked** — UI absent; API refuses (`nutrition_minor_calorie_refusal`); schema trigger (§6.7) | ✅ with mandatory uncertainty ranges (kept from 012) |
| Weight-loss / deficit targets | ❌ **Unrepresentable** — `target_kind` has no deficit kind (kept from 012); server refuses | ✅ only behind the clinician gate (§6.4) |
| Descriptive meal check-ins (no numbers) | ✅ teen-private H2 (`meal_checkins`) | ✅ |
| Food diary with calories | ❌ | ✅ private H2; teen's diary |
| Macro/protein targets | ❌ <18 (any numeric target needs the clinician gate) | ✅; deficit-adjacent needs clinician gate |
| Real-food-first swaps, meal ideas | ✅ weight-neutral only | ✅ |
| Parent visibility | **Engagement only** (days logged, meals recorded — no calories/macros/weight) via `nutrition_weekly_patterns()` amended (§6.7) | Per re-consent (§2); diary stays H2 |
| NEDA resources | ✅ Always-visible card (§6.5) | ✅ In resources |
| ED-signal detection → safety pipeline | ✅ (§6.6) | ✅ |

### 6.2 The <18 experience: `meal_checkins` (no numbers by schema)

New table **`meal_checkins`** (migration 027): `(id, subject_id, logged_at, meal text
CHECK (meal IN ('breakfast','lunch','dinner','snack')), food_groups text[],
hunger_before smallint CHECK 1–5, fullness_after smallint CHECK 1–5, energy_note text,
logged_by, health_tier DEFAULT 'H2')`.
**There are no calorie, macro, or weight columns.** A minor cannot log what the schema cannot
hold. Framing: "Did you eat regularly today?" / "How was your energy?" — pattern and
regularity, never quantity.

For 18+, `food_logs` keeps 012's uncertainty-range design (calories_low/high NOT NULL for 18+).

### 6.3 Weight-neutral copy framework (applies to W23, W13, W28 for <18)

**Allowed:** fuel · energy for your day · variety · regular meals · hunger/fullness cues ·
food groups · real-food-first · balanced plate · family favorites · "Did you eat enough to
feel good today?"
**Prohibited (<18, enforced by copy-lint in the engineering handbook):** calories · burn/burned ·
deficit · cheat meal · clean eating · guilt-free · earn your food · "being good today" ·
good/bad foods · bikini body · before/after · weight-loss goals · BMI-based framing ·
"light" (as weight-control framing).

**W13 Meals** (meal planning — panel: ✅ with no calorie budgeting/moralizing for <18):
- Allowed: "Tonight's dinner ideas," "balanced plate," "family favorites," grocery lists,
  leftover plans, cultural-food celebration.
- Prohibited <18: calorie budgets, per-meal calorie caps, "lightened-up" recipes framed as
  weight control, moralizing ("we're being good this week"), fasting schedules.
- W13 stores **meal plans, not food logs** — no linkage to `food_logs` calorie data for <18
  (the plan view cannot display calories even if the 18+ diary has them; the <18 UI never
  queries calorie columns).

### 6.4 The clinician gate

**What it is:** any *numeric* nutrition target for <18, and any deficit/weight-loss-adjacent
target at 18+, requires a verified clinician's order recorded in the app.

**Table `clinician_gates`** (027): `(id, subject_id, target_id, clinician_name,
credential text CHECK (credential IN ('MD','DO','NP','PA','RD','LD')),
npi text NOT NULL, verified_at, verification_method DEFAULT 'npi_registry',
scope_note text, expires_at)` — one gate per target; gates expire after 12 months.

**Verification (how):** at target-creation, the route calls the **CMS NPI Registry public API**
(free, no key) to confirm the NPI is active and the taxonomy matches the credential; the NPI,
taxonomy, and verification timestamp are stored. No NPI → no gate → target creation refused.
(The clinician does not need a Pookie account; the *parent or teen* enters the clinician's
details from the visit paperwork, and the registry check is the verification.)

**Who:** licensed MD/DO/NP/PA/RD/LD. Coaches, trainers, influencers, and "nutritionists"
without a license do not satisfy the gate.

**Teen agency:** a 16–17 teen can complete the gate with *their* clinician (e.g., pediatrician);
the parent sees the *target* (H1) but never the diary (H2).

### 6.5 NEDA resources — where they surface (always, not buried)

Persistent, dismissible-but-returning card in W23 (<18 and 18+), in W8, and on any `ed_signal`:
> **"Worried about food, eating, or body image?** You deserve support — and support works.
> NEDA Helpline: **1-800-931-2237** (call or text) · text **NEDA to 741741**.
> In crisis: call or text **988**."

Design rules: never a modal the teen must dismiss to continue logging (no shame interrupt);
always one tap from any W23/W8 surface; the card does not log "teen viewed NEDA resources"
anywhere parent-visible (viewing help-seeking is itself sensitive).

### 6.6 ED-signal detection (data side → safety pipeline)

Server-side, SECURITY DEFINER, metadata-only (same pattern as §5.3):
- `meal_checkins` pattern: ≥3 skipped meals in 7 days with low-energy notes → `ed_signal` (medium).
- `food_logs` (18+): rapid calorie-range collapse or purge keywords in descriptions → `ed_signal`.
- Journal text (W8): body-image distress / restriction language → `ed_signal` (teen-confirm where possible).
Each emits to `wellbeing_events` (§5.3) → safety ladder + in-module NEDA surfacing. **Never**
a parent notification, never a "your teen may have an eating disorder" digest (that would be a
diagnostic claim *and* a privacy breach).

### 6.7 Schema amendments to 012 (edit before apply — 012 is unapplied)

1. `food_logs`: make `calories_low/high` **nullable**; add trigger
   `enforce_no_calories_minor()` BEFORE INSERT/UPDATE: if
   `health_subject_age_band(subject_id)` ∈ (`under13`,`teen_13_15`,`teen_16_17`,`unknown`)
   and any calorie/macro column is non-NULL → `RAISE EXCEPTION 'nutrition_minor_calorie_refusal'`.
   (Route-level check first; the trigger is the backstop.)
2. `nutrition_targets`: add `clinician_gate_id uuid REFERENCES clinician_gates(id)`;
   CHECK: `target_kind='medical_recovery'` OR subject 18+ with deficit-adjacent target
   → `clinician_gate_id IS NOT NULL`. Add `target_kind='weight_loss'`? **No** — keep the 012
   invariant (no deficit kind <18, unrepresentable by schema). For 18+ deficit targets, add kind
   `'clinician_supervised'` (requires gate; the only deficit-adjacent kind in the system).
3. `nutrition_weekly_patterns()`: amend — if subject band is minor, return **engagement only**
   (`week_start, days_logged, entries, meals_by_type`) and **refuse** calorie/macro averages
   (return them as `null` with `detail='engagement_only_minor'`). 18+ with re-consent: full output.
4. New tables: `meal_checkins`, `clinician_gates` (this section).

---

## 7. W22 Activity — age-conditional UI rules

**Panel:** no streaks for <18, no calorie-burn display, rest-day normalization, no teen leaderboards.
Enforcement is **server-side** (the API strips fields by age band); the client cannot re-enable
them with a flag.

### 7.1 The rules (<18)

| Rule | Implementation |
|---|---|
| **No streaks** | `activity_feed` / `activity_summary` RPCs omit `streak_days`, `streak_badges`, flame icons for band <18. UI has no streak component rendered for minors (not hidden — absent). No "don't break the chain" copy anywhere in the minor experience. |
| **No calorie-burn display** | `calories_burned` / `active_calories` fields stripped server-side for <18 (even if HealthKit reports them — dropped at ingest for minor subjects). Copy "burn," "torched," "worked off" banned by copy-lint. |
| **Rest-day normalization** | Weekly view renders rest days as **complete and positive**: green check + "Rest day — muscles rebuild when you rest." Never "missed," never red, never a gap in a visual chain. Copy rule: rest is *training*, not absence. |
| **No teen leaderboards** | No ranked comparisons among <18 users. No family leaderboard that includes a minor's activity (an adult-only leaderboard excludes minor members server-side). No "you're #3 in the family." |
| **Movement framing** | "Move your body," "energy," "fun," "strength," "fresh air." Never "work off," "earn your food," "punish," "no pain no gain." |

### 7.2 The rules (18+)

- Streaks/calorie-burn/leaderboards become available **only via explicit opt-in** in Settings →
  Activity (default OFF for all new adults; the 18+ review screen does not prompt for these).
- Leaderboards are 18+ only, opt-in, and never include minors — a family leaderboard silently
  excludes <18 members (no "hidden" shaming; they simply aren't in the pool).
- Rest-day normalization copy stays for all ages (good design doesn't expire at 18).

### 7.3 Data notes

Activity metrics (`steps_daily`, `sleep_hours`, active minutes) are **H1** (shareable wellness) —
parents may see the teen's step counts via the Wellness scope. But *presentation* follows §7.1:
a parent viewing a teen's activity sees totals and trends, never streaks, never calorie burn,
never rankings. The age band applied is the **subject's**, not the viewer's.

---

## 8. GA minor health-consent handling + 42 CFR Part 2

**Context:** in Georgia, minors can consent to certain care themselves — STI testing/treatment,
substance-use counseling/treatment, and mental-health care at 16+ (categories per the task brief;
exact statutes and age edges live in counsel-reviewed `state_minor_consent_rules`, which ships
`counsel_reviewed=false` until licensed counsel signs — the 011 counsel-gate, unchanged).

### 8.1 How teen-entered consentable-care data is handled

1. **Entry-time tiering:** when a teen logs health data in a consentable-care category
   (STI testing/treatment, contraception, substance-use counseling, mental-health therapy at 16+,
   pregnancy-related), the row is tiered **H3 automatically** — the UI suggests it
   ("This looks like care you can consent to yourself in Georgia — we'll keep it only with you")
   and the teen confirms; the server applies H3 regardless (the teen cannot *downgrade* it to H2).
2. **Who can see it:** the teen only — §1.3 matrix, H3 column. Default and only setting.
3. **The explicit rule (normative):** *A parent's access grant NEVER includes H3 data the teen
   entered about consentable care.* This is structural, not policy text:
   `health_tier_visible()` has no grant arm, no override arm, and no break-glass arm for H3.
   No RPC, view, or export in the system accepts a caller who is not the teen for H3 rows.
   State it in the codebase as an invariant comment so no future feature can "just add" a path.
4. **Below-16 mental-health entries:** also land H3 (teen-entered = teen-owned), even where GA
   minor-consent age is 16+ — the app's posture is the *more* protective of the two (teen privacy
   vs. state floor).
5. **Parent-entered content in these categories for a 13+ teen:** refused at write
   (`h3_parent_write_refusal`) — a parent cannot create H3 rows *about* the teen, which would
   otherwise launder parent surveillance into the teen's most protected tier.

### 8.2 What parents are told (honesty without disclosure)

The Sharing screen's health section carries the firewall line (copy owned by UX; content spec):
"Some health records — like care Georgia lets teens consent to themselves — stay only with
your teen. This isn't something you can turn on; it's how Pookie is built." No per-record
existence signals (no "3 hidden records" counters — existence is itself disclosure).

### 8.3 Counsel-gated GA rules table (operational)

- `state_minor_consent_rules` row for GA is seeded in 022 with the STI / substance-use /
  mental-health-16+ categories, `as_of` date, and source citations — **`counsel_reviewed=false`**.
- **Nothing in the health module treats the row as authoritative until counsel flips it.**
  The H3 auto-tiering in §8.1 keys off *category tags the teen applies*, not off the rules row —
  so the privacy protection works on day one and the legal precision arrives with counsel.
- Annual re-review: `as_of` + 12 months triggers a counsel re-review task (compliance owner, G7).

### 8.4 42 CFR Part 2 — technical separation for SUD content

Part 2 (federal confidentiality for substance-use-disorder patient records) prohibits disclosure
without specific written consent and **prohibits relying on a general medical consent** for SUD
records. Pookie is a personal health record, not a Part 2 program — but the panel requires a
commitment to never co-mingle SUD content under general consent. The design **exceeds** the legal
minimum deliberately:

**Migration `028_sud_separation.sql`:**
- **Separate table:** `sud_records(id, child_id, recorded_at, content_ciphertext, content_nonce,
  health_tier DEFAULT 'H3', key_version, deleted_at)` — content is **application-layer encrypted**
  with a per-user data key (distinct KMS/Vault key from general health data; key rotation
  independent). The DB never sees plaintext.
- **Separate access path:** RLS teen-only (same shape as §5.1, no exceptions). No view, RPC, or
  join in the system touches `sud_records` together with general health tables — enforced by
  code review rule + a migration-time assertion (a test queries `pg_depend`/function bodies for
  cross-references and fails the build).
- **Explicit per-disclosure consent:** `sud_disclosure_consents(id, child_id, record_ids,
  recipient, purpose text, expires_at, revoked_at, consent_ciphertext)` — each disclosure names
  *what records, to whom, for what purpose, expiring when*, revocable anytime. **A general
  health grant, a Wellness-scope grant, an 18+ re-consent toggle, or a transition-summary
  export never covers `sud_records`.** The export UI lists SUD records separately with their own
  default-OFF per-record checkboxes.
- **No co-mingling in logs/backups-visibility:** `wellbeing_events` may carry `ed_signal`-style
  metadata for SUD-adjacent crises (type only, per §5.3) but never record references; support
  tooling (S1–S3) has no read path to `sud_records` (scoped RBAC per the 2026-10-12 support standard).
- **Break-glass:** none. There is no emergency override for `sud_records` — consistent with H3-absolute.

---

## 9. G22 — Immunization management

### 9.1 Data model (migration `026_immunizations.sql`)

`immunizations(id, subject_id, vaccine_code text NOT NULL` — **CVX codes**
(CDC standard; e.g., HPV=62/118/165), `dose_number smallint, administered_at date,
provider text, lot_number text, source text CHECK (source IN ('manual','provider_import','ga_grits')),
doc_path text` — Form 3231 PDF in the private `health-documents` bucket, `form_3231_on_file boolean`,
`form_3231_expires date` — GA 3231 certificates carry expiration dates; provisional certificates expire,
`health_tier DEFAULT 'H1'`, `verified_by_parent boolean)`.

**Tier:** H1 while <18 (parents need it for school forms — legitimate stewardship use); at 18 it
follows the §2 cutover like all health data (re-consent required). The 3231 PDF inherits the row's tier.

### 9.2 Reminder logic

- **Form 3231 expiry:** 90 / 30 / 7-day reminders to the parent (<18) or adult (18+) before
  `form_3231_expires` — "Dawson's GA immunization certificate expires [date]. Ask the
  pediatrician for an updated Form 3231."
- **School-entry requirements:** per-grade requirement checklist seeded from GA DPH published
  schedules (counsel-reviewed reference data, not legal advice): rising-7th Tdap/MCV4, etc.
  Missing-dose nudges are **parent-facing for <18** (H1) and framed as logistics, not medical advice.
- **College immunization requirements:** per-college table (`college_immunization_reqs`:
  college_id, required_vaccines CVX[], forms, deadline_notes, source_url, verified_at) seeded
  from public college-health pages with **"verify at the college's health site"** disclaimer and
  date-stamps (same pattern as the W5 GSFC methodology rule). W5 College & Future links to the
  immunization checklist; transfer-for-college = the §2.5 transition summary includes the 3231 record.
- **HPV catch-up:** if subject is 11–17 and the HPV series is incomplete → **annual** reminder,
  clinician-deferring framing only: "HPV vaccination is a routine adolescent vaccine — worth a
  conversation with your pediatrician at the next visit." **Never** a medical recommendation,
  never repeated nagging (once per year, dismissible, teen-appropriate version for 13+ shown to
  the teen themselves: "You can ask your doctor about this — it's your call").

### 9.3 Who sees it

Parents (<18, via H1/Wellness scope), the teen (always), and — on explicit initiation — a
school/college form export (PDF of the 3231 record + dose history). No automatic sharing with
schools; the export is parent- or teen-initiated, logged to `access_events`.

---

## 10. W28 Restaurants — health tie-in

### 10.1 Allergy-list data structure

**Table `allergy_list`** (022 or 026): `(id, subject_id, allergen text NOT NULL` —
controlled vocabulary: FDA top 9 (milk, eggs, fish, shellfish, tree nuts, peanuts, wheat,
soybeans, sesame) + free-text `allergen_custom`, `severity text NOT NULL
CHECK (severity IN ('intolerance','allergy','anaphylaxis'))`,
`source text CHECK (source IN ('teen_entered','parent_entered','clinician_verified'))`,
`verified_at, health_tier DEFAULT 'H2', created_at)`.

- **Tier H2:** teen-private at 13+ (allergy lists are health data; a teen's allergy is their
  information). Under-13: steward-visible. At 18: re-consent.
- **Never inferred:** the list is populated only by explicit entry (teen, parent for <13, or
  clinician-verified import). Order history, cuisine preferences, and "you avoided X twice"
  heuristics **never** create or modify allergy rows — inference is banned by schema
  (no inference columns, no inference jobs).
- **Anaphylaxis flag:** `severity='anaphylaxis'` drives the strongest UI treatment (§10.2)
  and is included in the W19 break-glass medical card (user-selected, §2.6).

### 10.2 Hard-block logic in restaurant recommendations

The recommendation RPC (`rpc_restaurant_recommendations`, W28) takes the diner's subject_id:
1. Load the subject's `allergy_list` (RLS: the *diner's* list — a parent planning for a teen
   uses the teen's list only if the teen's H2 grant covers it; otherwise the parent plans
   from their own entered list for <13).
2. For each candidate restaurant/dish with **allergen data from a verified menu source**:
   if any listed allergen is present → **exclude** (not downrank) the dish; if the restaurant
   cannot serve the party safely (e.g., peanut-oil fryer + peanut anaphylaxis), exclude the
   restaurant with reason code `allergen_block`.
3. **Allergen info unavailable** → the restaurant is labeled "allergen info unavailable —
   call ahead," never assumed safe. Absence of data is never treated as absence of allergen.
4. **Copy ban:** the words "allergy-safe," "allergen-free guarantee," or any safety claim are
   **prohibited** (panel: never "allergy-safe" claims). Required footnote on every W28 result:
   "We filtered out dishes listing [peanut]. Menus and kitchens change — always confirm with
   the restaurant, especially for severe allergies."
5. **No weight-loss dietary framing for <18** (§6.3): filter tags `low-cal`, `diet`, `skinny`,
   `guilt-free`, `light` are **suppressed** from results, filters, and copy for <18 diners;
   "healthy" filters are re-labeled "balanced options" with no calorie numbers shown.

### 10.3 Verification standard (panel: verified live listings)

Allergen data must come from the restaurant's published menu/allergen guide or a licensed
nutrition-data provider (same server-side pattern as 012's Nutritionix/USDA) — never from
reviews, never LLM-inferred. GA DPH inspection scores display per the panel's W28 row.

---

## 11. G27 — "Power-up" daily pull: decision

**Recommendation: CUT as a health/supplement concept. Do not define it — remove it.**

**Reasoning:**
1. **Undefined data source, undefined owner.** Every other daily pull (news, weather, quote…)
   has a named source and a pull mechanism (checklist Category 5 audit). "Power-up" has neither —
   it cannot pass the daily-update audit (source → pull → storage → render with zero manual intervention).
2. **If supplement-related, it is a health-claim liability surface.** Supplement recommendations
   implicate FDA structure/function claim rules and FTC substantiation; the panel's health coach
   flagged it for exactly this. Pookie's posture elsewhere (W2: never diagnostic; W23: clinician
   gate) is incompatible with an unowned supplement nudge.
3. **The user need is already served.** The morning ritual (Category 3, ✅) owns the "start the
   day" moment. A separate "power-up" is redundant surface area.

**If Mehedi wants the *ritual* element** (a morning spark), fold it into the existing Morning
Ritual as a non-health "intention" card — quote, focus word, or habit nudge — with **zero**
health claims, zero supplement content, and a named source (e.g., the existing quote feed).
**Any future supplement-related feature** requires, before design: (a) licensed-counsel
health-claim review, (b) a named authoritative source, (c) FDA/FTC claim vetting in the
copy-lint rules. Until then, the concept stays cut.

---

## 12. Build gating & dependencies

**Nothing in §§1–10 holds real teen health data until ALL of these clear:**
1. **Migrations 022–028 applied to staging** (after 021 `access_events`), with RLS tests proving
   deny-by-default per tier × age band (automated test matrix, run in CI).
2. **Licensed-counsel review:** `state_minor_consent_rules` GA row (`counsel_reviewed=true`);
   `health_alert_thresholds` rows reviewed; FTC **Health Breach Notification Rule** applicability
   determination documented (checklist §10 item 10) — is Pookie a PHR vendor? Answer before W2 holds data.
3. **Safety designer sign-off** on the `wellbeing_events` contract (§5.3–5.5): event types,
   metadata-only invariant, trusted-adult routing, and the C4 firewall.
4. **UX designer delivery** of the consent/review-screen copy (≤8th-grade, per-tier enumeration,
   firewall line, NEDA card, "not a medical device" disclaimers).
5. **Infosec program (G6):** written retention schedule (this doc is the health input),
   backup-purge runbook (§3.3), vendor assurances (Supabase, Cloudflare), encryption-at-rest
   confirmation for `sud_records`' separate key.
6. **R9 compliance:** health modules stay **seedlings** in the 31-module day-one shell until
   1–5 clear — visible in nav, no data entry, "growing soon" state. No undifferentiated launch.

## Appendix A — Migration plan (022+)

| Migration | Contents | Depends on |
|---|---|---|
| `022_health_tiers.sql` | `health_tier` enum; tier columns on all health tables; `health_tier_visible()` replacing `health_metric_visible()`; `health_consent_grants`; `allergy_list`; 011 amendments (override expiry ≤30d, H2-only, age-band split); GA `state_minor_consent_rules` seed (unreviewed) | 021 |
| `023_health_reconsent.sql` | `health_reconsent_status`; cutover job `nightly_health_birthday_cutover()`; `health_corrections`; `health_device_tokens` lifecycle; re-consent RPCs | 022 |
| `024_health_grace_and_deletion.sql` | `health_grace`; tombstone columns; `sweep_health_grace()`; `purge_tombstoned_health()`; `rpc_hide_past_health()`; `rpc_request_health_deletion()` | 022, 023 |
| `025_wellbeing.sql` | `wellbeing_entries` (teen-only RLS); `wellbeing_events` (metadata only); retention `purge_expired_wellbeing()`; pattern-detection functions | 022, 024 |
| `026_immunizations.sql` | `immunizations` (CVX, 3231 tracking); `college_immunization_reqs`; reminder scheduling; `health-documents` bucket | 022 |
| `027_nutrition_agegate.sql` | 012 amendments (nullable calories + minor-refusal trigger; engagement-only `nutrition_weekly_patterns()` for <18; `clinician_supervised` kind); `meal_checkins`; `clinician_gates` | 022 (amends 012 pre-apply) |
| `028_sud_separation.sql` | `sud_records` (app-layer encrypted, separate key); `sud_disclosure_consents`; cross-reference build assertion | 022 |

## Appendix B — RPC inventory (new)

`rpc_health_reconsent_submit` · `rpc_health_reconsent_skip` · `rpc_health_review_queue` ·
`rpc_health_record_correct` · `rpc_health_record_delete` · `rpc_export_transition_summary` ·
`rpc_hide_past_health` · `rpc_request_health_deletion` · `rpc_restaurant_recommendations`
(amended: allergen hard-blocks) · `nutrition_weekly_patterns` (amended: engagement-only <18) ·
`health_tier_visible` (predicate, not directly called by clients).

## Appendix C — Panel items closed by this document

G3 (tiers defined) · §1.6.2 (re-consent flow) · §1.6.3 (grace/hide-past/deletion) · W2 (unblocked
by tiers; ingestion + no-diagnosis path) · W8 data side (teen-only RLS, retention, event types) ·
W23/W13 (<18 age-gate, copy framework, NEDA, clinician gate) · W22 (age-conditional UI rules) ·
GA minor-consent + Part 2 separation · G22 (immunizations) · W28 allergy hard-blocks ·
G27 (cut with reasoning). **Still owned elsewhere:** crisis *response* protocol (safety designer),
consent-screen *copy* (UX designer), counsel sign-offs (§12.2), access-spec §4 amendment (C1).
