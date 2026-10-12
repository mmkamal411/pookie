# MHMDA Compliance Mapping (Washington My Health My Data Act)

**Status:** ISSUE-SPOTTING DRAFT · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Decision basis:** MD D3 (2026-10-12) — **full MHMDA compliance, no geofencing.** Build
state-aware from day one; do not retrofit.
**Applies to:** any Pookie user who is a Washington resident or whose health data is
processed in Washington. MHMDA's regulated-entity definition is broad (determines
purpose/means of processing consumer health data while conducting business in WA or
engaging WA residents) and its "consumer health data" definition is very broad
(past/present/future physical or mental health — including data from which health status
can be inferred). Counsel must confirm applicability scope and any exemptions.

> **NOT LEGAL ADVICE.** This mapping is issue-spotting for licensed counsel to validate.
> Statutory citations, radius figures, and damage amounts below are anchors from secondary
> sources — counsel verifies the current statutory text, applicability, and exemptions
> before any of this is treated as a compliance conclusion.

## Applicability posture (D3)

- **No geofencing, no blocking of WA users.** Pookie serves Washington and complies.
- Where a control does not yet exist, the gap names the owning FR and the build status.
- Enforcement note: MHMDA carries a **private right of action** (in addition to AG
  enforcement) — a compliance miss is directly suable, not just regulator-visible. This
  raises the stakes on every gap below.

## Mapping table

Columns: `MHMDA requirement | Pookie control | evidence (doc/file) | gap (if any) | status`

| MHMDA requirement | Pookie control | Evidence (doc/file) | Gap | Status |
|---|---|---|---|---|
| **Collection consent** — affirmative consent before collecting consumer health data (separate from sharing consent) | Per-subcategory health consent, enumerated, never one "health" checkbox (FR-HEALTH-007); consent screen at link time (FR-ACCESS-001); 13–15: teen + parent co-flow; 18+: affirmative opt-in re-consent for health, skip = private (FR-AGE-006) | `docs/BUILD-SPECIFICATION.md` FR-ACCESS-001, FR-HEALTH-007, FR-AGE-006 | Consent-withdrawal API not yet built (see "withdraw consent" row) | 🟡 in-progress |
| **Sharing consent** — separate affirmative consent before sharing consumer health data | Visibility scopes (Performance / Communications / Reflection / Wellness) + health sub-tiers H0–H3 (FR-ACCESS-006, FR-HEALTH-001); per-person × per-scope grants; all briefings/digests/nudges/API filtered server-side (NFR-PRIVACY-004); `granted_by` enforcement (FR-ACCESS-004) | `docs/BUILD-SPECIFICATION.md` FR-ACCESS-004/006, NFR-PRIVACY-004; `docs/compliance/PRIVACY-PROMISES-AUDIT.md` | H0–H3 taxonomy not yet built (**blocked**: W2 holds no real teen data until FR-HEALTH-001 ships) | 🟡 in-progress |
| **Consumer rights: access** — consumer can confirm whether data is collected/shared and access it | Teen-visible Sharing screen ("Who can see my stuff?"); "Who's looked at my stuff" (Settings → Privacy, FR-SUPPORT-004); `access_events` audit table teen-visible (FR-ACCESS-009) | `docs/BUILD-SPECIFICATION.md` FR-ACCESS-009, FR-SUPPORT-004 | Access-request fulfillment workflow (formal DSR intake, identity verification, response SLA) not yet built | 🟡 in-progress |
| **Consumer rights: delete** — consumer can request deletion of consumer health data | Teen-deletable check-ins anytime (FR-SCHOOL-003); 30-day deletion SLA at 18+ "hide past too" (FR-AGE-007); rolling auto-purge windows in the retention schedule; crypto-shred for H3 | `docs/compliance/COPPA-RETENTION-SCHEDULE.md` rows 4/7; `docs/BUILD-SPECIFICATION.md` FR-AGE-007 | Formal DSR deletion workflow (intake → verify → execute → confirm → backup purge) not yet built; processor flow-down (vendor deletion on request) not yet contractual (V-1 in vendor template) | 🟡 in-progress |
| **Consumer rights: withdraw consent** — consumer can withdraw prior consent; withdrawal must be as easy as giving consent | Revoke paths: teen may revoke any grant on own record (FR-ACCESS-005); 16–17 instant revoke, fully reversible (FR-AGE-004); 13–15 redesigned revoke with safe-exit (FR-AGE-002); health: skip = private at 18+ (FR-AGE-006) | `docs/BUILD-SPECIFICATION.md` FR-ACCESS-005, FR-AGE-002/004/006 | Dedicated consent-withdrawal surface (per-subcategory withdrawal as easy as opt-in) not yet built — **owning FR: new; recommend folding into FR-HEALTH-007 consent screen v2**. Vendor-side withdrawal propagation not contractual | 🟡 in-progress |
| **No sale without signed consent** — sale of consumer health data requires a separate signed (written) authorization; "sale" is broad (monetary or other valuable consideration) | **No-sale posture**: no student ads / no data sale guardrails (§20-2-667 theory, NFR-COMPLIANCE-007); no-training-on-inputs term (NFR-PRIVACY-008/010 — training-data use is a form of value extraction); teen purchase detail teenPrivate (W11) | `docs/BUILD-SPECIFICATION.md` NFR-PRIVACY-008/010, NFR-COMPLIANCE-007 | No-sale commitment not yet in executed vendor DPAs (V-1/V-2); no signed-authorization flow exists (none needed while posture is no-sale — **flag if any future data-sharing-for-value is proposed**) | 🟡 in-progress |
| **Consumer health data privacy policy** — distinct, clear privacy policy disclosing categories collected, purposes, sharing (third parties/affiliates), consumer rights, retention | FAQ legal-accordion standard (FR-SUPPORT-001: "Required by law" / "Our choice" badges; ≤8th-grade plain language); retention schedule published (NFR-PRIVACY-002); D2: "NEVER train" commitment (publish only after DPA verification) | `docs/BUILD-SPECIFICATION.md` FR-SUPPORT-001; `docs/compliance/COPPA-RETENTION-SCHEDULE.md` | **Privacy Policy does not exist yet.** FAQ not built. Retention schedule is draft (attorney review pending). Health-data categories section unwritten | 🔴 blocked |
| **Retention limitation** — retain only as long as reasonably necessary / per disclosed schedule; consent-bounded | Per-source retention schedule with bounded maximums; rolling auto-purge for check-ins (FR-SCHOOL-003) and health (≤2 years); 30-day backup purge; litigation-hold time-bounds | `docs/compliance/COPPA-RETENTION-SCHEDULE.md` | Schedule is draft — attorney must confirm windows (esp. health rows 7 vs MHMDA consent-bounded retention) | 🟡 in-progress |
| **Geofencing around health-care facilities** — unlawful to identify/track consumers via geofence around facilities providing health-care services (reported radius 1,750 ft — counsel to confirm) | **MOOT BY ARCHITECTURE (D7):** Pookie holds **coarse location only (city/ZIP); precise GPS is never collected.** Geofence-based identification/tracking is technically impossible — there is no precise coordinate to place inside a geofence. No geofence SDK, no precise-location permission requested | MD D7 (`docs/MD-DECISIONS.md`); `docs/compliance/COPPA-RETENTION-SCHEDULE.md` row 10 | None on this requirement — but the architectural constraint must be enforced in code review (any future precise-location need triggers a separate privacy review per D7) | 🟢 compliant-by-architecture (counsel to confirm the mootness reading) |
| **Processor obligations** — processors must assist with consumer rights, follow instructions, contractual limits | Vendor assessments require: deletion on request, breach-notification SLA, audit rights, subprocessor change notice (VENDOR-ASSESSMENT-TEMPLATE.md §2) | `docs/compliance/VENDOR-ASSESSMENT-TEMPLATE.md` | **No DPA executed with any processor yet** (V-1) — processor obligations are currently contractual vapor | 🔴 blocked |
| **Security** — reasonable safeguards for consumer health data | Written infosec program (administrative/technical/physical), encryption in transit/at rest, field-level vault encryption, never-log-plaintext, MFA on admin | `docs/compliance/COPPA-INFOSEC-PROGRAM.md` | Program is draft (attorney + security-leadership sign-off pending); vault encryption pre-condition not yet verified in staging | 🟡 in-progress |
| **Non-discrimination / no dark patterns on rights** — withdrawing consent or exercising rights must not be punished | Revoke flows: no guilt screens (FR-AGE-004); 13–15 safe-exit path (FR-AGE-002); consent screens unchecked by default, ≤8th-grade reading (FR-ACCESS-001); CA AB 2246 posture documented (NFR-PRIVACY-010) | `docs/BUILD-SPECIFICATION.md` FR-ACCESS-001, FR-AGE-002/004 | Copy registry ("never label signup as consent") not yet built (sol-legal §2.6); DV-advocate review of revoke copy pending (NFR-LEGAL-004) | 🟡 in-progress |
| **De-identification standard** — de-identified data out of scope only if it cannot reasonably be re-linked | Peer tips ("Study Sparks"): provable de-identification/aggregation or per-family consent before ship (FR-SCHOOL-004); 4-week expiry | `docs/BUILD-SPECIFICATION.md` FR-SCHOOL-004 | De-identification methodology not yet defined or QA'd (5%/week sampling QA planned) | 🟡 in-progress |

## Cross-cutting gaps (highest urgency)

1. **No privacy policy exists.** MHMDA's distinct consumer-health-data privacy policy is a
   standalone requirement — the FAQ (FR-SUPPORT-001) is planned but unbuilt and the
   retention schedule is draft. **This is the single biggest MHMDA blocker.**
2. **No executed DPAs.** Processor obligations, deletion flow-down, and the no-sale /
   no-training terms are paper until signed (V-1, V-2 in the vendor template).
3. **No formal DSR workflow.** Access / delete / withdraw-consent requests need an
   intake → verify → execute → confirm pipeline with SLAs (recommend: new FR, owned by
   Platform Team 2).
4. **Consent-withdrawal parity.** Withdrawal must be as easy as consent — the current
   revoke flows cover grants, but per-subcategory health-consent withdrawal needs its own
   surface (recommend: fold into FR-HEALTH-007 consent screen v2).

## Interaction with other state laws (NFR-LEGAL-009)

MHMDA compliance does not satisfy TX SCOPE, CA AB 2246/SB 1119, or IL BIPA — each needs
its own workstream before a non-GA launch. The vendor template's **state-law posture**
column is the starting inventory. D7 (coarse-only location) also simplifies CA AB 2246's
geolocation limits for <18.

## Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-12 | Initial mapping (D3); D7 geofence-mootness recorded | — (attorney review pending) |

## Open questions for counsel

1. Confirm MHMDA applicability to Pookie (regulated-entity analysis; any exemption).
2. Confirm the geofence provision's scope and that coarse-only architecture moots it.
3. Confirm "consumer health data" classification of: check-in mood text, AI-chat
   content mentioning health, school absence notes with health reasons, purchase
   metadata with health inferences.
4. Set the DSR response SLA and the consent-withdrawal parity standard.
5. Confirm the private-right-of-action exposure timeline (retrospective risk on data
   already held).
