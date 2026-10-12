# COPPA Per-Source Retention Schedule

**Status:** ISSUE-SPOTTING DRAFT · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Gates Phase 0.** Binds to `docs/BUILD-SPECIFICATION.md` (NFR-PRIVACY-001/002, NFR-LEGAL-005/007)
and `docs/solutions/sol-legal.md` §1a / §6.
**Applies to:** all Pookie systems, starting jurisdiction Georgia, USA.
**MD updates incorporated:** D3 (WA MHMDA — health-data retention minimums align to MHMDA's
consent-bounded retention; see `MHMDA-COMPLIANCE-MAPPING.md`); D7 (location is coarse-only —
city/ZIP; precise GPS is never collected, so the location row below is coarse data).

> **NOT LEGAL ADVICE.** Issue-spotting scaffold for licensed counsel. Nothing ships without
> attorney drafting/review. All retention periods below are *proposed maximums* — the
> compliance owner and licensed counsel must confirm each window before publication. The
> one non-negotiable, fixed by FTC Rule §312.10: **no period may be indefinite or TBD.**

## 1. Policy axiom (FTC Rule §312.10)

1. **No personal information of a child under 13 is retained indefinitely.** Every
   collection path names a bounded retention period.
2. Retention periods are **maximums, not targets** — each row carries the business
   justification for the chosen window.
3. Any future data source whose schedule row is missing or unbounded
   (`indefinite` / `TBD` / blank) **fails release review and blocks that source's launch.**
4. Litigation holds suspend only *in-scope* purges, are time-bounded, and never waive
   §312.10 (see §6 of `LEGAL-POLICY-OUTLINES.md` retention+hold outline and §6 below).
5. Under-13 rows carry the **shortest defensible windows** (data-minimization posture).

## 2. Per-source schedule

Columns: `source | data class | age tier (<13 / 13–17 / 18+) | legal basis | retention
period (max) | deletion method | backup handling | purge cadence | owner`

| # | Source | Data class | Age tier | Legal basis | Retention period (max) | Deletion method | Backup handling | Purge cadence | Owner |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Onboarding / DOB entries | Date of birth (signup DOB; child DOB at profile creation) | <13 (rejected self-signup, DOB <13) | COPPA §312.10 purpose limitation; abuse-prevention legitimate interest | **Purge ≤30 days** after rejection (fraud-pattern analysis only) | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 1 | Onboarding / DOB entries | Date of birth | 13–17 | Contract performance (age-tier enforcement) | **While account active; purge ≤30 days** of account deletion | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 1 | Onboarding / DOB entries | Date of birth | 18+ | Contract performance | **While account active; purge ≤30 days** of account deletion | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 2 | Child profiles (parent-managed) | Child name, birthdate, parent-provided attributes. **No child-authored content** (technical ban on typable fields) | <13 | Parent provision (FTC FAQ A.8); COPPA §312.10 | **While parent account active AND profile exists; purge ≤30 days** of profile removal or parent account deletion | Row delete + cascade to profile-scoped data | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 2 | Child profiles | Teen account profile data | 13–17 | Consent | **While account active; purge ≤30 days** of account deletion | Row delete + cascade | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 3 | Link codes | 6-digit code hash, issued-by/at, used-at/by | All ages | COPPA §312.10; security (anti-abuse) | **15-min TTL; purge ≤24 hours** after expiry or use | Row delete (hash destroyed) | Backup purge ≤30 days after source deletion | Hourly job | Compliance Owner |
| 4 | Check-ins / mood text | Check-in text, mood values, teen calibration notes | <13 | COPPA §312.10 | **Not collected by design.** Any inadvertently collected content: quarantine → **purge ≤7 days**, incident logged | Row delete + quarantine log entry | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 4 | Check-ins / mood text | Check-in text, mood values | 13–17 | Teen consent; G17 | **Teen-deletable anytime; rolling auto-purge default 90 days** (attorney confirms). Teen may set a shorter/longer window within a **bounded max of 1 year** | Row delete + search-index purge | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 4 | Check-ins / mood text | Check-in text, mood values | 18+ | User consent | **User-deletable anytime; rolling auto-purge default 1 year**, user-settable within a **bounded max of 3 years** | Row delete + search-index purge | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 5 | AI chat transcripts — Pookie tutor | Prompt/response pairs, session metadata | <13 | COPPA §312.10 | **No child sessions exist** (no child login). Parent-session chats are adult data: transient default; debug logs ≤30 days | Log rotation (≤30-day TTL); no persistent transcript | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner + AI Eng |
| 5 | AI chat transcripts — Pookie tutor | Prompt/response pairs | 13–17 | Teen consent; NFR-PRIVACY-010 (no-training commitment) | **Default: transient (no persistent transcript).** Teen-saved study records only: **until teen deletes or ≤1 year rolling**. Debug logs ≤30-day TTL, access-controlled, contractually excluded from model improvement | Row delete of saved records; key rotation for debug stores | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner + AI Eng |
| 5 | AI chat transcripts — Pookie tutor | Prompt/response pairs | 18+ | User consent | **Default: transient.** User-saved records: **until user deletes or ≤2 years rolling**. Debug logs ≤30-day TTL | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner + AI Eng |
| 6 | AI support chat (S2) transcripts | Pre-escalation AI session text; handoff summary cards | All ages | Contract (support); NFR-PRIVACY-010 | **Standalone AI sessions: ≤30 days then purge.** On escalation, transcript becomes part of the support ticket (row 12) | Row delete; on escalation inherits ticket schedule | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner + Support Ops |
| 7 | Health syncs (device data, W2) | Vitals, activity, sleep, H0–H3 classified data | <13 | COPPA §312.10; FR-HEALTH-001 (H0 prohibited <18) | **Not collected.** Any collected: quarantine → **purge ≤7 days**, incident logged | Row delete; crypto-shred for H3 | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 7 | Health syncs (device data) | H1–H3 health data | 13–17 | Per-subcategory teen consent (FR-HEALTH-007); MHMDA consent (D3) | **Rolling ≤2 years or teen deletion, whichever first.** H2/H3 teen-private scoping enforced. At 18: **opt-in re-consent required (FR-AGE-006); skip = private** — unconsented data purged ≤30 days after transfer | Row delete; crypto-shred for H3 | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 7 | Health syncs (device data) | H1–H3 health data | 18+ | Affirmative user consent (opt-in) | **Rolling ≤2 years or user deletion** | Row delete; crypto-shred for H3 | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 8 | School sync snapshots | Grades, attendance, assignments, teacher/counselor mail copies | <13 | Parent provision; COPPA §312.10 | **While parent account active; purge ≤30 days** of profile/account deletion | Snapshot row delete | Backup purge ≤30 days after source deletion | Monthly job | Compliance Owner |
| 8 | School sync snapshots | Grades, attendance, assignments | 13–17 | Consent; FERPA transfer rules | **Current school year live + 1 prior year archive ("school year + 1"); purge ≤90 days** after that window ends. Counselor mail: same window, restricted access (ASCA B.2) | Snapshot row delete | Backup purge ≤30 days after source deletion | Monthly job | Compliance Owner |
| 8 | School sync snapshots | Grades, attendance, assignments | 18+ | Adult-student consent (FR-AGE-005) | At FERPA transfer: **pulls pause until re-auth.** Adult chooses keep / private / "hide past too" (deletion honored ≤30 days). **Unclaimed data: purge ≤1 year** after transfer without re-auth | Snapshot row delete | Backup purge ≤30 days after source deletion | Monthly job | Compliance Owner |
| 9 | Financial photo intake (W21) | **Raw images** (bills, cards, documents) | All ages | GIPA minimization; NFR-PRIVACY-009 | **Auto-delete ≤30 days after extraction** (sooner if user confirms extraction). User "delete now" honored immediately | Secure electronic deletion per FTC Disposal Rule (attorney confirms applicability) | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 9 | Financial photo intake (W21) | Extracted metadata only (payee, amount, due date, **last-4**). Full card/account numbers are **never persisted** (design invariant) | <13 | GIPA minimization | **≤1 year or parent deletion** | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 9 | Financial photo intake (W21) | Extracted metadata (last-4 only) | 13–17 | Consent; teen's own purchase detail is teenPrivate (W11) | **≤3 years or teen deletion** | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 9 | Financial photo intake (W21) | Extracted metadata (last-4 only) | 18+ | Contract performance; tax compliance | **≤7 years or user deletion** (tax-record purpose) | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 10 | Location — **COARSE ONLY (D7)** | **City/ZIP-level only. Precise GPS is never collected** (architectural constraint) | <18 | Teen-consented; G14; D7 | **No retained history by default.** In-session coarse location only; **purge ≤24 hours** | Row delete (in-session store) | N/A — no backups of ephemeral location | Daily job | Compliance Owner |
| 10 | Location — coarse only | City/ZIP trip context | 18+ | User consent | **≤90 days rolling or user deletion** | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 11 | `access_events` audit log | Metadata only: timestamps, `granted_by`, reason codes, device/IP hashes. **No content PI** | All ages | Security (breach scoping, GA privacy); legal-defense interest | **Hot (queryable) ≤1 year; cold archive ≤2 additional years; purge ≤3 years total.** Attorney confirms final window | Row delete; purge evidence logged | Backup purge ≤30 days after source deletion | Monthly job | Compliance Owner + Security Eng |
| 12 | Support tickets (S3) | Ticket content, `ticket_events`, handoff summaries, `teen_privacy` flag | <13 | Contract (support); parent on ticket (FR-SUPPORT-005); COPPA §312.10 | **Closed tickets ≤2 years** from closure. Teen may request deletion ≤30 days (§1.6.3 SLA). **Crisis tickets: ≤1 year** from closure | Row delete + attachment purge | Backup purge ≤30 days after source deletion | Monthly job | Compliance Owner + Support Ops |
| 12 | Support tickets (S3) | Ticket content, events | 13–17 | Contract (support); teen-privacy scoping | Same as above | Same as above | Backup purge ≤30 days after source deletion | Monthly job | Compliance Owner + Support Ops |
| 13 | Notification payloads | Push/email/SMS payloads + delivery metadata. **No health-content push** (FR-AI-003; lock-screen-safe previews only) | All ages | Consent | **Payload content ≤30 days; delivery metadata ≤90 days** | Row delete | Backup purge ≤30 days after source deletion | Daily job | Compliance Owner |
| 14 | Peer tips ("Study Sparks") | De-identified tips; sourcing/de-identification evidence | All ages | Consent or provable de-identification; COPPA §312.10 | **4-week active life; purge ≤7 days** after deactivation (FR-SCHOOL-004) | Row delete | Backup purge ≤30 days after source deletion | Weekly job | Compliance Owner |
| 15 | Uploaded class files (W1) | Student/parent-uploaded documents, images | <13 | Parent provision; COPPA §312.10 | Parent-uploaded only; **purge ≤30 days** of profile deletion. **TAKE IT DOWN reports: remove ≤48 hours** of valid report | Storage object delete + DB row delete + CDN cache purge | Backup purge ≤30 days after source deletion | Daily (takedown) + monthly (routine) | Compliance Owner |
| 15 | Uploaded class files (W1) | Uploaded documents | 13–17 | Consent; TAKE IT DOWN Act | **User-deletable anytime; purge ≤1 year** after account closure or 18+ transition without re-auth. **TAKE IT DOWN reports: remove ≤48 hours** | Storage object delete + DB row delete + CDN cache purge | Backup purge ≤30 days after source deletion | Daily (takedown) + monthly (routine) | Compliance Owner |
| 15 | Uploaded class files (W1) | Uploaded documents | 18+ | User consent; TAKE IT DOWN Act | **User-deletable anytime.** **TAKE IT DOWN reports: remove ≤48 hours** | Storage object delete + DB row delete + CDN cache purge | Backup purge ≤30 days after source deletion | Daily (takedown) + monthly (routine) | Compliance Owner |

## 3. Deletion method standard

| Method | Definition | Evidence | Used for |
|---|---|---|---|
| Row delete | `DELETE` on the source row (+ cascading FK rows) | Purge-job log: date, source, rows deleted | Most DB rows (profiles, check-ins, codes, tickets) |
| Crypto-shredding | Destroy the per-record data key → ciphertext unrecoverable | Key-destruction log (key id, timestamp, authorizer) | H3 health data, credential-adjacent material |
| Secure electronic deletion | NIST 800-88-aligned purge of media/storage objects | Job log + vendor attestation where applicable | Raw financial images (FTC Disposal Rule), uploaded files |
| Log rotation | TTL-based expiry of log stores | Rotation config + attestation | Debug logs (≤30 days), notification payloads |
| Anonymization / de-identification | FTC-recognized de-identification (no reasonable re-linkability) | De-identification memo + QA sampling record | Peer-tip sourcing evidence where retained for QA |

"Deletion" ≠ "de-identification": de-identified data drops out of COPPA scope only if it
truly cannot be re-linked (counsel confirms the standard per class).

## 4. Backup & disaster-recovery handling

- **Backups are not a loophole.** Every row's `backup handling` cell above applies:
  source deletion propagates to backups **≤30 days** after source deletion.
- Cloud retention settings documented per vendor in `VENDOR-ASSESSMENT-TEMPLATE.md`
  (Supabase PITR window, Cloudflare R2/versioning if used).
- Purge evidence: each backup-purge cycle logs date, scope, and confirmation; retained
  in the audit log per row 11.

## 5. Exceptions & overrides (all time-bounded)

| Exception | Rule | Time bound | Owner |
|---|---|---|---|
| Litigation hold | Suspends **only in-scope** purges; out-of-scope purges continue | Hold is bounded; re-authorized by counsel at a fixed cadence (attorney sets; never "until further notice") | Compliance Owner + counsel |
| Law-enforcement preservation (TAKE IT DOWN / criminal referral) | Preserve per counsel direction while removing from public serving | Per counsel's written preservation order | Compliance Owner + counsel |
| Safety disclosures (break-glass / mandatory-reporter) | Access/disclosure logs retained per row 11 (3 years) | Bounded by row 11 | Compliance Owner |

**Hard constraint:** COPPA §312.10's ban on indefinite retention is not waived by a hold —
a hold that is itself unbounded **is** the prohibited indefinite retention by another name.

## 6. Validation rule — release-review gate

**Rule V-RET-001:** A data source ships only if this schedule contains a row for it with a
bounded `retention period` (no `indefinite`, no `TBD`, no blank). The check is enforced at
release review (CI checklist or Managing Director sign-off gate).

**Rule V-RET-002:** Under-13-adjacent rows must carry the shortest window among the age
tiers for the same source; a reviewer must justify any exception in writing.

**Rule V-RET-003:** Annual attestation — the Compliance Owner certifies (dated, signed)
that no under-13 data class lacks a bounded schedule, aligned with the vendor-assessment
cycle (`VENDOR-ASSESSMENT-TEMPLATE.md`).

## 7. Change control

Any change to this schedule requires **Compliance Owner + licensed attorney review**;
versioned, dated, append-only change log below. The schedule version is referenced in the
Privacy Policy (FBPA-enforceable — promises must be true in code; see
`PRIVACY-PROMISES-AUDIT.md`).

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-12 | Initial issue-spotting draft | — (attorney review pending) |

## 8. Open questions for counsel (do not resolve on panel analysis)

1. Confirm each proposed maximum above, especially the audit-log window (row 11),
   financial metadata windows (row 9), and the 7-day quarantine windows (rows 4/7).
2. Confirm §312.10 interpretation for parent-managed under-13 profiles (FTC FAQ A.8
   theory) and the deletion-method sufficiency standard.
3. Confirm the 30-day backup-purge window adequacy.
4. Confirm MHMDA consent-bounded retention interplay for health rows (see
   `MHMDA-COMPLIANCE-MAPPING.md`).
5. Confirm the FTC Disposal Rule applicability to raw financial images and extracted
   metadata.
