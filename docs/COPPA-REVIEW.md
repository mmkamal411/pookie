# COPPA Legal Review — Pookie User-First Access Model & Full Feature List

**Reviewer role:** Expert COPPA counsel (subagent panel review)
**Date:** 2026-10-12
**Specs reviewed:** `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12), `docs/FEATURE-LIST-FOR-PANEL.md`
**Jurisdiction:** Georgia, USA (federal COPPA analysis; GA notes at end)
**Authorities:** 15 U.S.C. §§ 6501–6506; FTC Rule 16 CFR Part 312 as amended (approved Jan 16, 2025; published Apr. 22, 2025; effective Jun. 23, 2025; **compliance deadline Apr. 22, 2026 — now passed, fully enforceable**); FTC Staff "Complying with COPPA: FAQs" (staff views, non-binding but the compliance roadmap); FTC Feb. 2026 age-verification policy statement.

> **Scope honesty:** I am an AI acting as expert counsel for panel review, not your retained attorney. Anything marked below as "flag for human counsel" needs a licensed attorney's sign-off before build decisions lock. Penalty exposure is real: **up to $53,088 per violation** (FTC FAQ B.2), and **state AGs can independently enforce COPPA** (15 U.S.C. § 6504; FTC FAQ B.3) — Georgia's AG included.

---

## Executive summary

The under-13 model's core legal theory is **correct but incompletely built**. COPPA regulates *collection of personal information **from** a child* (15 U.S.C. § 6501(5); 16 CFR 312.2). The FTC is explicit: **"COPPA only applies to personal information collected online from children"** — information about a child that a *parent or other adult provides* is not covered (FTC FAQ A.8). So "parent creates profile, no child login" is a viable compliance posture — **but it stands or falls on a technical guarantee, not a policy aspiration**: no under-13 child may ever submit data, chat, upload, or be device-tracked through Pookie, enforced server-side. The spec asserts this ("no child-prompted data collection") without defining or enforcing it. Several features as designed would puncture the A.8 exclusion (AI chat, child-interactive mood/friends modules, device-level screen-time, API exposure of child data to third parties). And the 2025 Rule amendments add hard new obligations the spec doesn't address at all: **written retention policy with specific periods (indefinite retention now prohibited), written information security program, written vendor assurances, separate parental consent for non-integral third-party disclosures, and expanded privacy-policy disclosures.**

**Bottom line: the access model is *compliant-with-changes*; the feature list has 5 blocked-as-designed items and ~20 needs-change items, concentrated in retention policy, vendor/AI disclosures, under-13 interaction bans, and parental-rights workflows.**

---

## PART 1 — The five questions asked

### Q1. Is "parent creates profile, no child login" sufficient? Does the parent's signup count as verifiable parental consent (VPC), or is a separate VPC step needed?

**Verdict: Compliant-with-changes.** The signup is **not** VPC — and no VPC is needed, for a different reason than the spec implies.

- **The parent's Google OAuth / magic-link signup is not verifiable parental consent.** VPC methods are enumerated at 16 CFR 312.5(b): signed form (mail/fax/scan), card transaction with per-transaction notice, phone/video call with trained staff, government-ID check against a database (ID then deleted), knowledge-based authentication, or face-match to verified photo ID (the last two added in the 2025 amendments; "text plus" added as an initiation method). A Google OAuth login authenticates an *adult account holder*; it verifies nothing about parenthood and matches no approved method. **Do not describe signup as consent anywhere** — that mislabeling itself is a compliance risk.
- **But no VPC is triggered in the first place**, because VPC is required only *before collecting, using, or disclosing personal information **from a child*** (15 U.S.C. § 6502(b)(1)(B); 16 CFR 312.5(a)). Under FTC FAQ A.8, data the *parent* enters about the child (name, birthdate, grades the parent reports, health notes) is not "from the child." The spec's under-13 model therefore needs **no VPC step** — provided the A.8 exclusion actually holds for every data flow.
- **Required changes to keep the exclusion intact:**
  1. Add a parent/legal-guardian **attestation checkbox** at child creation ("I am this child's parent or legal guardian"). Cheap, creates accountability, and answers the "stranger creates a child's profile" safety problem.
  2. **Server-side age gate**: `createChildProfile` must reject an email-invite flow when `birthdate` indicates under 13 (never send verification invites to an under-13's email — that would collect the child's online contact info and enable child submission). Re-evaluate the tier if birthdate is ever edited.
  3. **Server-side under-13 interaction ban** (see Q3) — the load-bearing control.
  4. Document the A.8 legal basis in the privacy policy; the spec's "policy must reflect no direct data collection from under-13s" is necessary but far from sufficient (see Gaps).

### Q2. Data minimization: what may we store about an under-13? What retention limits apply?

**What may be stored (parent-provided or school-sourced, never child-submitted):** name, birthdate, grades/assignments, health observations, photos the parent uploads. All are lawful to *hold* under COPPA because none is collected *from* the child. Constraints:

- **Collect only what is reasonably necessary** for the feature the parent chose (16 CFR 312.7 principle; 2025 amendments codify minimization). Day-precision birthdate is justifiable (age-tier boundary enforcement); re-examine any field you can't tie to a feature.
- **Biometric expansion (2025):** "personal information" now expressly includes biometric identifiers (faceprints, voiceprints, gait, DNA) and government IDs (16 CFR 312.2, 2025 amendments). A parent-uploaded photo *containing the child's image* is PI — secure it, don't disclose it to vendors beyond storage, and never use it for face recognition.
- **Retention — this is the spec's biggest hard-law failure.** The 2025 Rule (16 CFR 312.10) requires operators to (a) retain children's PI **only as long as reasonably necessary to fulfill the purpose for which it was collected**, (b) **never retain it indefinitely**, and (c) adopt a **written retention policy specifying purposes and retention periods**, deleting via reasonable measures. The feature list's **"check-ins indefinite" is now per se non-compliant** and "emails TBD" is not a policy. Replace with concrete periods *before launch* (e.g., check-ins: rolling 3 years or until 13th birthday + 1 year; teacher emails: 2 years; pick defensible numbers with counsel and write them down).
- Health data (weight, conditions, emergency medical info in W19): lawful to store parent-provided, but treat as sensitive — encryption at rest, strict minimization, no vendor disclosure beyond hosting. **Flag for human counsel:** whether Pookie's health modules make it a "PHR vendor" under the FTC's Health Breach Notification Rule (separate breach-notification duty).

### Q3. What must "no child-prompted data collection" mean in practice?

Under 16 CFR 312.2, "collection" includes **"requesting, prompting, or encouraging a child to submit personal information online."** In practice, for Pookie's under-13 tier this must mean **all** of the following, enforced server-side (spec principle 5 — "the client never derives roles" — must extend to age-tier gating):

1. **No login, no session, no authenticated surface** for under-13 children — as spec'd. Extend to: no magic-link, no link-code redemption, no invite acceptance when birthdate < 13.
2. **No child-typable fields anywhere in an under-13 context**: AI chat, check-in text boxes, mood pulses, friend-name fields, uploads, quiz inputs. If a control *can* accept a child's keystrokes, it *is* collection surface.
3. **No persistent identifiers from a child's device** tied to the child (cookies, device IDs, ad IDs). Parent's own session identifiers are the adult's — fine. Document the assumption that shared-device use is the parent's session.
4. **No device-level tracking of the child**: screen-time agents/MDM on the child's device, child wearable/fitness connections, precise geolocation attributed to the child. (W15, W22, W26 — see feature verdicts.)
5. **Parent-as-conduit framing:** the daily check-in must be labeled and designed as **parent observation** ("What did you observe today?"), never "ask your child…" prompts. If the UX solicits the child's words through the parent, an aggressive FTC reading treats the child as the source. **No FTC case law squarely addresses the conduit scenario — flag for human counsel** — so design conservatively.
6. **School-portal syncs must use parent credentials (ParentVUE), not the child's StudentVUE login.** Data pulled from the school is third-party-sourced (not "from the child"), which is clean — but having the parent operate *as* the child muddies the factual record. ParentVUE is the defensible path.
7. Audit-log every blocked under-13 interaction attempt; alert on patterns.

The check-in the parent types **about** the child is the **parent's data submission about the child** — lawful under A.8. The moment the *child* is the one typing, speaking to the AI, or tapping, it's collection *from* the child and the full VPC + direct-notice machinery (16 CFR 312.4(c), 312.5) triggers **before** collection.

### Q4. Claim-dedupe fuzzy match on name + birthdate — any COPPA issue?

**No. ✅ Clear.** Fuzzy-matching parent-provided name + birthdate server-side to link an existing parent-managed profile is internal processing of adult-provided data, not collection from a child. Hygiene notes (not COPPA violations): keep matching server-side, rate-limit it, don't expose birthdates through APIs to unauthorized callers, and note the "Is this you?" screen reveals a profile's *existence* to whoever verifies the email — acceptable at 13+ (the teen's own email), never applicable under 13.

### Q5. At the 13th birthday: what must happen to lawfully transition the profile?

**Under COPPA itself: nothing is *required* — but several things are *advisable*, and state law may require more.**

- COPPA's protections end at 13 by statute (15 U.S.C. § 6501(1): "child" = under 13). Data lawfully held before 13 (parent-provided; no VPC was ever required) may continue to be retained and used **subject to the 2025 retention limits** — COPPA imposes no re-consent at 13 for previously-collected data. New collection *from* the now-13-year-old needs no VPC (they're no longer a "child" under the statute).
- **Recommended transition (build it):** a 13th-birthday job that (1) notifies the parent that COPPA stewardship has ended and the teen may now hold their own login; (2) offers both parent and teen a **data review/deletion** moment; (3) gets the teen's own consent for continued processing (best practice; hedges against state teen-privacy laws, which now run to 16–18 in several states); (4) does **not** auto-expose previously parent-private data (e.g., historical check-ins) to the teen without notice — or vice versa.
- The spec's 13–15 cooling-off / 16–17 / 18+ designs are **product policy, not COPPA** — COPPA is silent there. ✅ Clear as designed, with one correction: at 18, FERPA rights transfer to the student and a parent's *ParentVUE* access typically ends — product "continuity" doesn't equal data continuity; set expectations in the 18th-birthday prompt.

---

## PART 2 — Spec section verdicts (access model)

| Spec § | Verdict | Basis |
|---|---|---|
| §1 Principles | ✅ Clear | Principle 5 (server-side enforcement) is the load-bearing COPPA control — extend it explicitly to age-tier gating |
| §2 Signup & onboarding | ⚠️ Needs change | Add guardian attestation; under-13 email field must not trigger invites; server-side age gate + birthdate-edit re-tiering; document A.8 basis (signup ≠ VPC) |
| §3 Authority matrix | ✅ Clear w/ flag | Matrix governs *product* access. **COPPA rights (review/delete, 16 CFR 312.6) belong to *both* parents** regardless of `granted_by` — a non-creator parent's verified COPPA request must be honored even if the creator never granted them app access |
| §4 Under-13 stewardship | ⚠️ Needs change | See replacement language below |
| §4 13–15 / 16–17 / 18+ | ✅ Clear | COPPA N/A at 13+; state teen-privacy laws vary — monitor |
| §5 Linking methods | ⚠️ Needs change | Email invite + link codes must be **13+-only**, enforced server-side; dedupe ✅ |
| §6 Go independent | ✅ Clear | COPPA N/A |
| §7 Just me | ✅ Clear | |
| §8 Migrations 017–020 | ⚠️ Needs change | Add: attestation timestamp, birthdate-edit re-tier trigger, retention-period metadata per data class |
| §9 API surface | ⚠️ Needs change | `createChildProfile` enforces under-13 invite ban + attestation; `redeemLinkCode` 13+ only |
| §10 UI screens | ⚠️ Needs change | `/verify-invite` public landing must render **zero child PI** pre-auth (no name, school, photo) |
| §11 Risks | ⚠️ Needs change | Risk #2 mitigation ("policy updated") is underspecified — see Gaps |

### Concrete spec change — §4 "Under 13 — Stewardship (COPPA)"

**Current text:**
> - Parent creates a parent-managed profile. No child login, no child-prompted data collection.
> - Creating parent = steward: full control, may grant the other parent.
> - Age gate at profile creation from `children.birthdate`.
> - Privacy policy must reflect no direct data collection from under-13s.

**Proposed replacement:**
> - Parent or legal guardian creates a parent-managed profile after checking an attestation ("I am this child's parent or legal guardian"); attestation timestamp stored. No child login exists for under-13 profiles: no credentials, no magic link, no link-code redemption, no invite acceptance — enforced by server RPCs, not UI hiding.
> - No data is ever collected *from* the child: no child-typable fields, no AI chat, no uploads, no persistent identifiers or device-level tracking (screen-time agents, wearables, precise geolocation) attributable to the child in an under-13 context. All under-13 data is parent-entered (framed as parent observation, never "ask your child") or pulled from school portals using the **parent's** credentials. Blocked under-13 interaction attempts are audit-logged.
> - Creating parent = steward: full product control, may grant the other parent. **Both parents independently retain COPPA statutory rights** (review, refuse further use, direct deletion — 16 CFR 312.6); a verified request from the non-creator parent is honored through a parentage-verification workflow even without an app grant.
> - Age gate evaluated server-side at profile creation from `children.birthdate` and re-evaluated on any birthdate edit; tier transitions are logged.
> - No verification invite or link code may ever be issued for an under-13 profile.
> - A 13th-birthday job notifies the parent, offers data review/deletion, and invites the teen to create their own login with their own consent to continued processing.
> - Privacy policy discloses: categories of under-13 data held and their sources (parent, school portals), purposes, per-category retention periods, categories of third-party/service-provider recipients, and parental rights — per 16 CFR 312.4 as amended 2025. "No direct collection from under-13s" is stated alongside these affirmative disclosures, not instead of them.

---

## PART 3 — Feature-by-feature verdicts (✅ / ⚠️ / 🛑)

### 1. Core Platform
- Google OAuth + magic link sign-in — ✅ (adult auth; not VPC, none needed)
- Supabase Auth session management — ✅ (identifiers belong to the adult account holder)
- Onboarding → optional "add children" — ⚠️ (attestation; under-13 email handling; server-side gate; §2 above)
- 5-tab navigation; child switcher — ✅
- Nebula theme — ✅
- `/verify-invite` public landing — ⚠️ **must not render any child PI to unauthenticated viewers** (16 CFR 312.8 confidentiality duty; also plain safety)

### 2. Pookie AI Assistant
- **AI chat tab + Muse toggle for under-13 child interaction — 🛑 BLOCKED.** Free-text chat *is* collection from the child (16 CFR 312.2). Server-side: reject any tutor/chat request in an under-13 child context. Parent chatting *about* their child = adult data, ✅. Muse "unfiltered" mode must be unreachable by under-13s by construction.
- **pookie-tutor (Cloudflare Worker, Llama 3.3) receiving child PI — ⚠️.** Disclosure to a third party: requires **written assurances** the vendor keeps it confidential/secure and doesn't train on it (16 CFR 312.8, 2025), privacy-policy disclosure of the recipient category (312.4, 2025), and — for any non-integral disclosure — **separate parental consent** (312.5, 2025). Recommendation: AI features on under-13 profiles default OFF; parent opts in with a clear, standalone disclosure.
- Instant-respond routing — ✅ (same envelope as chat)
- Weekly teacher discussion threads (Muse drafts, parent approves) — ✅ (internal ops; parent is sender)
- Proactive nudges to parent — ✅

### 3. Today ritual
- Morning ritual; tonight's plan — ✅ (parent-facing)
- Check-in cross-check — ⚠️ for under-13 there is **no lawful child self-report channel**; degrade to parent-observation only and strip any "ask your child" language (conduit risk, Q3.5)

### 4. The 31 modules
| Module | Verdict | Note |
|---|---|---|
| W2 Health (vitals; health-app connections) | ⚠️ | Parent-entered vitals ✅; connections must be the **adult's** apps only — a child's wearable/app = collection from child 🛑 without VPC. Possible FTC Health Breach Notification Rule exposure — counsel flag |
| W8 Wellbeing (mood pulse; **teenPrivate**) | ⚠️ (🛑 as child-interactive) | **teenPrivate is a UI visibility flag, not an access control** — enforce server-side via `child_access`. For under-13: 13+ gate it, or parent-observation-only with zero child-tappable input |
| W13 Meals | ✅ | Parent-planned |
| W22 Activity (tracker connections) | ⚠️ | Adult's device only in under-13 households |
| W23 Nutrition (food logging) | ⚠️ | Parent logs ✅; child logging → 13+ gate |
| W21 Mail (photo intake → OCR) | ⚠️ | Parent's mail ✅; OCR/AI vendor needs written assurances + no-training term; policy disclosure; child's image in a photo = PI — handle accordingly |
| W20 Shopping list; W11 Spending; W7 Money & Documents; W12 Babysitters | ✅ | Adult/household data |
| W24 Credit (3-bureau) | ✅ w/ guardrail | **Never run on a child's identity/SSN** — hard block (FCRA + minor-protection issues beyond COPPA) |
| W14 Co-parenting | ⚠️ | Both parents hold COPPA §312.6 rights; build the non-creator-parent verification + request workflow (§3 flag) |
| W10 Fairness (equity across children) | ✅ | Internal analytics of parent-provided data |
| W1 School (grades, check-ins, uploads, inbox; StudentVUE sync) | ⚠️ | Pipeline is parent/school-sourced ✅, but: **ParentVUE credentials only** (not child's StudentVUE); check-ins = parent observations; uploads = parent-only; AI quiz generation = vendor disclosure (assurances + policy); peer tips parent-facing for under-13 |
| W16 School calendar; W5 College & Future | ✅ | Parent planning for under-13 |
| W4 Activities | ⚠️ | Rosters/photos may include *other* minors' PI — parent-provided is COPPA-clear per A.8 but minimize; never publish/share |
| W18 Summer (camps) | ⚠️ | Each registration disclosing child PI to a camp = parent-directed disclosure; disclose categories in policy; require parent's per-disclosure action |
| W3 Safety (insurance) | ✅ | |
| W19 Emergency (plan, vault) | ⚠️ | May hold child's medical info — parent-provided ✅ but encrypt, minimize, no vendor disclosure beyond hosting; HBNR counsel flag |
| W6 Driving & life skills | ✅ | N/A under 13 |
| W15 Screen time | 🛑 as device-level | **Device agents/MDM on a child's device collecting usage = collection *from* the child** (persistent identifier + activity). Parent-reported rules/limits ✅; device-level for under-13 blocked without full VPC |
| W17 Friends (**teenPrivate**) | ⚠️ | Same structural fix as W8: server-side enforcement; under-13 = parent-entry only, and minimize other minors' PI (nicknames/initials preferred) |
| W25 Fuel; W27 Events; W28 Restaurants; W29 Trails; W30 Flights; W31 Rental cars | ✅ | Parent's location/data; W30 minor-traveler rules are the airline's, parent-directed |
| W26 Weather (hyperlocal) | ⚠️ | No precise geolocation tied to an under-13 profile; parent-provided city-level; device geo = parent's device only |

### 5. School Intelligence (W1 detail)
- 13 sources w/ named owners (Muse/parent/child) — ⚠️ **build-time invariant: the "child" owner set must be empty when active child < 13**; any child-sourced pipeline auto-disables
- Path-to-90 checkboxes → Supabase — ✅ (parent's actions)
- Per-class pages, collapsed cards — ✅
- Teacher inbox merge (incl. Outlook 365/Synergy) — ⚠️ retention "TBD" → set specific periods (312.10)
- Peer tips (600/wk, 4-week expiry) — ✅ (expiry is a retention control; keep parent-facing for under-13)
- SAT prep; lunch/dinner pulls; horoscope — ✅
- Windows/MacBook sync workers — ⚠️ parent credentials only; audit scraped fields; secure the queue
- ParentVUE/CTLS/teacher Gmail pulls — ✅ (parent-authorized)

### 6. Family & Access Management
- Email invite (7-day token) — ⚠️ **13+ only**, server-side enforced
- Link codes (6-digit/15-min) — ⚠️ same 13+ gate
- `granted_by` authority matrix — ✅ w/ §3 flag (statutory parental rights ≠ product grants)
- Age tiers — ⚠️ under-13 per replacement language; 13+ ✅ (COPPA N/A)
- Sharing screen; access requests; block list; go-independent; 18th-birthday prompt — ✅ (all 13+)
- `graduate_child_access` RPC — ⚠️ must respect retention policy on transition; log it
- Claim dedupe — ✅ (Q4)

### 7. Settings & Data
- Profile, sync console, notifications — ✅
- Credentials vault — ⚠️ parent credentials only; encrypted at rest; never logged; scoped access
- **Data retention policies ("check-ins indefinite, emails TBD") — 🛑 BLOCKED as specified.** 16 CFR 312.10 (2025): written policy, specific per-purpose periods, **indefinite retention prohibited**. Decide periods with counsel *before* launch; expose parent deletion (312.6) in Settings

### 8. API Platform
- `GET /api/v1/me` — ✅
- `/api/v1/children/[childId]/school/*`, `/college/*` — 🛑/⚠️ **third-party API access to under-13 data = disclosure** needing separate-consent analysis (312.5, 2025) + written vendor assurances (312.8) + policy disclosure. **Recommendation: exclude under-13 child data from v1 API scope until a consent framework exists**
- `/api/v1/household/*` — ⚠️ audit for child-PI leakage into household endpoints
- `/api/v1/invites/*` — ⚠️ 13+ gate
- `/api/v1/tutor/*` — 🛑 under-13 child contexts; ⚠️ otherwise (vendor assurances)
- Notifications API — ✅

---

## PART 4 — Gaps the specs don't address

1. **COPPA rights workflow for any verified parent** (16 CFR 312.6): review / refuse-further-use / delete — including the *non-creator* parent. No flow exists.
2. **Written information security program** proportionate to sensitivity (grades, health, photos of minors) — new 2025 duty (16 CFR 312.8).
3. **Written data retention policy** with per-purpose periods — new 2025 duty (16 CFR 312.10); "indefinite/TBD" violates it.
4. **Written assurances from every vendor** receiving child data (Supabase, Cloudflare, OCR/AI, analytics, email) — new 2025 duty (16 CFR 312.8).
5. **Privacy-policy overhaul** per 16 CFR 312.4 (2025): children's-data practices, purposes, *categories of third-party recipients*, *retention periods*, parent rights. "No direct collection" alone is insufficient.
6. **Separate-consent UX** for non-integral third-party disclosures — e.g., AI tutor processing child data, any analytics on child-data screens (16 CFR 312.5, 2025). No bundled "I agree."
7. **Server-side under-13 interaction ban + audit logging** (chat, forms, uploads, link-codes, API) — the control the whole A.8 theory rests on.
8. **Guardian attestation** at child creation (+ stored timestamp).
9. **13th-birthday transition job** (notice + review/delete offer + teen consent).
10. **Full deletion cascade** for a child profile: DB, storage buckets, backups, vendors — honoring 312.6.
11. **Analytics/ad-SDK audit**: no third-party trackers on child-data screens without separate consent; **no behavioral advertising on child data, ever**.
12. **Breach-notification plan** (state laws; HBNR analysis for health modules).
13. **Birthdate-edit re-tiering** logic.
14. **COPPA safe-harbor program** evaluation (16 CFR 312.11; 15 U.S.C. § 6503) — optional, reduces enforcement risk.
15. **Legislative monitoring**: federal COPPA 2.0/KOSPA; state teen-privacy laws (age bands now run 16–18 in several states).

## PART 5 — Reassessment flags on existing decisions

- **Risk #2 mitigation ("parent-managed only; no child login; no child-prompted collection; policy updated"):** directionally right, legally mislabeled — the basis is FTC FAQ A.8 (no collection *from* the child), not consent; "no child-prompted collection" must be a *technical* guarantee; the policy work is 80% unscoped.
- **"Creating parent = steward, may grant the other parent":** fine for product access, but don't let it become a veto over the other parent's **statutory** COPPA rights.
- **18+ continuity default:** COPPA-clean (adult). Correct the FERPA-adjacent expectation: the school's parent portal access usually ends at 18 — product continuity ≠ data continuity.
- **Invite-only → automated signup (superseded 2026-10-12):** no COPPA impact; automated signup is fine since signup was never VPC.
- **App Store/Play rating 12+:** consistent with an under-13-no-access posture; keep the under-13 ban technical so the rating stays defensible.

## PART 6 — Georgia notes

- **No comprehensive Georgia consumer privacy law exists** (2026's SB 111 was substituted/gutted — Georgia "remains a state to watch"). Federal COPPA is the operative regime.
- **GA Student Data Privacy, Accessibility, and Transparency Act (SB 89):** restricts *school-contracted operators'* disclosure of student PII — Pookie obtains data via *parent* credentials, not school contracts, so likely out of scope; note it in diligence.
- **GA SB 351** (social-media age verification + parental consent under 16; eff. 7/1/2025; **partially enjoined pending appeal**): Pookie is a life-assistant, not a social media platform — likely out of scope, but monitor the litigation if social/sharing features expand.
- State AG enforcement of COPPA itself (15 U.S.C. § 6504) is the live Georgia risk vector.

## PART 7 — Where a human attorney must sign off (ambiguity flags)

1. **Parent-as-conduit** (child dictates check-in text the parent types): no FTC case law; I recommend conservative parent-observation framing, but counsel should bless the exact UX copy.
2. **PHR-vendor status** under the FTC Health Breach Notification Rule for W2/W19 health modules.
3. Exact paragraph numbering of the 2025 amendments (90 FR Apr. 22, 2025) for policy citations — confirm against the Federal Register text.
4. Whether any planned "share" or social feature trips GA SB 351 or state teen-privacy laws as users travel interstate.
5. COPPA 2.0/KOSPA federal legislative status — re-check quarterly; passage would rewrite the under-13 analysis (proposed age 17, broader duties).
6. Per-purpose retention periods — business + counsel decision, then written into the 312.10 policy.

---

*Filed: ~/workspace/pookie-app/docs/COPPA-REVIEW.md — panel review, not legal advice. Retain counsel before locking build decisions.*
