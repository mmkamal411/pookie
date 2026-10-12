# Expert Panel Round 2 — Revised Solutions for 6 Strategic Proposals

**Panel:** 7 experts (liability/ToS attorney, child-welfare specialist, COPPA/teen-privacy attorney, child psychologist, pediatrician, UX designer, municipal law-enforcement liaison)
**Date:** 2026-10-12
**Status:** Issue-spotting analysis, not legal advice. Counsel sign-off gates flagged throughout.
**Supersedes:** the initial solutions where experts required redesign (marked below).

---

## Executive summary

All 6 proposals survive expert review, but **4 require substantive redesign** and **2 are confirmed with refinements**:

| # | Proposal | Verdict |
|---|---|---|
| 1 | Break-glass emergency override | 🔄 **Redesigned** — split into teen-configured safety net + LE legal path; no civilian self-serve; revoked parents categorically excluded |
| 2 | Time-boxed access grants | 🔄 **Redesigned** — occasion-based UX, scope allowlist, anti-installment caps, teen visibility floor |
| 3 | Parent identity verification | 🔄 **Redesigned** — school-portal proof replaces emergency-contact matching; tiered IAL mapped to health tiers; "verification" glossary required |
| 4 | AI training data policy | 🔄 **Redesigned** — kill the opt-out toggle; absolute commitment + vendor contracts + data-flow audit before publishing |
| 5 | Second-parent onboarding | 🔄 **Redesigned** — eliminate the child search box; invite-from-inside primary, corroborated claim + human review fallback |
| 6 | Support staffing (AI-first, 2 agents 9–5) | ✅ **Confirmed** with UX refinements — visible handoff contract, honest after-hours messaging, crisis pattern-interrupt, teen ticket privacy |

---

## Proposal 1 — Break-glass emergency override

### Expert critiques (synthesized)

**Liability attorney:** The initial solution's 24-hour all-data access is the single worst element — under SCA §2702, content disclosure to LE without process is only permitted under the narrow emergency exception; a 24-hour all-data pass can't be stretched to fit. Verification ("badge number + report number") is hand-waved social-engineering bait. The revoked parent is the most likely abuser and isn't excluded. Critically: **refusing an unverified request is legally safe; wrongly granting one is legally catastrophic** — when in doubt, the law favors refusal. Building a formal process creates voluntary-undertaking exposure in GA — do it competently or don't hold yourself out as doing it.

**Child-welfare specialist:** Fatal structural flaw — the proposal trusts the institutions abusers weaponize. A missing-person report is a low-bar administrative act; abusers routinely file false reports to re-establish surveillance after a victim flees. "Teen missing" and "teen fled FROM the revoked parent" are indistinguishable at the report-number level — the proposal treats them as the same case. Post-facto push notification to a phone the abuser may hold can get the teen hurt.

**Psychologist:** The trust problem isn't the capability, it's the opacity. Adolescent therapy precedent: teens disclose MORE when confidentiality limits are stated explicitly up front. Break-glass must be framed as *part of* the agency architecture ("the one door you can't lock, and why"), never discovered later. The false-alarm case is the real trust test — repair must be a designed flow, not a notification. The trusted-adult channel is load-bearing: if it can default to a revoked parent, it's a backdoor.

**Mayor/civic (LE liaison):** Reality check — police need last-active + coarse location + identifiers + trusted-adult list, NOT grades/chats/health. "Verified LE" as self-serve is fantasy; real verification = callback to a published agency number. A report number as the *gate* is the most dangerous fantasy (families can't quote it that night; it's spoofable). Civilian trusted-adult trigger creates false-alarm load and a stalking vector — route civilian reports through LE. 24h is arbitrary; use 72-hour incident-bounded cap. A 9–5 support team cannot do any of this — needs a named LE-response owner and 24/7 contact path.

### Conflicts and resolutions

| Conflict | Positions | Resolution |
|---|---|---|
| Should break-glass exist at all? | Liability: "not an emergency service" is defensible; building it badly is worse than not building it | **Build it narrow.** The product holds location data on minors; having NO documented process is a reputational/moral gap. But scope it to the SCA §2702(b)(8) emergency standard, location-only, human-reviewed. |
| 12h vs 24h vs 72h expiry | Child-welfare: 12h (surveillance minimization) · Initial: 24h · Mayor: 72h incident-bounded | **Tier by path:** trusted-adult path = 12h auto-expiry; LE path = 72h incident-bounded, renewable on fresh attestation. Both require active closure with access log. |
| Can a trusted adult trigger it? | Mayor: no civilian trigger · Psychologist: trusted-adult path is PRIMARY (teen-chosen = trust-preserving) · Child-welfare: OK only if pre-designated + corroborated | **Both paths exist with different bars.** Trusted-adult: pre-designated only, corroboration required, human review, 12h, location + medical card. LE: SCA standard, callback verification, 72h. No civilian self-serve, ever. |
| Report number as gate | Initial: required · Mayor: fantasy as sole gate · Child-welfare: weakest link | **Corroborating evidence, never the sole gate.** Two-channel verification (callback + two-of-three corroborating factors). |

### Revised solution

**Product framing:** never "break-glass" in the product. Teen-facing name: **"Emergency safety access."** Framed as part of the agency architecture: "Your space, your rules — with one safety net you design."

**Two paths, never conflated:**

**Path A — Teen-configured safety net (product path):**
- Trigger: ONLY the teen's pre-designated trusted adult (designated in the teen's own session; G1/G15 infrastructure required first)
- **Hard invariant: a revoked adult can never be the break-glass contact.** Adding a revoked parent requires explicit teen action.
- Corroboration: two independent confirmations required (trusted adult attestation + second channel)
- Scope: real-time location (coarse default; precise only if reviewer documents necessity) + W19 emergency medical card. **Never:** reflections, check-ins, mood, journals, AI chats, health history H2/H3, messages, grades. Server-side invariant.
- Duration: 12-hour auto-expiry + mandatory active closure with access log
- Teen configures eligible scopes at onboarding (13+): location on, emergency info on, everything else off by default

**Path B — Law-enforcement exigent request (legal path):**
- Legal spine: SCA §2702(b)(8) — voluntary disclosure where provider "in good faith believes that an emergency involving danger of death or serious physical injury requires disclosure without delay"
- Verification: callback to independently-sourced agency number + written official-channel confirmation within 24h + **two-employee approval**. Time pressure never lowers the bar.
- Scope: location only (coarse default). Read-only, one-time pull — not a feed.
- Duration: 72-hour incident-bounded cap, renewable on fresh attestation; terminate on case closure
- Court orders/warrants always honored via existing FR-SAFETY-011/012 queue (the front door, not break-glass)

**Categorical exclusions (server-side):**
- Revoked/blocked parents can never trigger, receive, or be notified via break-glass
- "Parent can't locate teen" is NOT an emergency (explicit non-examples in policy)
- Missing-person report filed BY a revoked parent = treated as suspect, requires independent corroboration

**Notification:** silent in-app "What happened while you were away" card on teen's next login (never push/SMS — abductor may hold the phone). LE-requested deferral up to 14 days max, then automatic. Never notified to revoked parents.

**Post-use repair flow:** proactive full disclosure (who, what per-scope receipts, why with report number, when) → one-tap "re-lock everything" + change trusted adult → false-alarm track with plain-language apology and process-change commitment → human support option. Safe-exit compatible (visually boring, no parent-visible traces).

**Disclosure timing (3 layers):** onboarding one-liner (13+) → full version at revoke/go-independent decision moment → persistent row on Sharing screen + FAQ.

### Open questions for Mehedi
1. **24/7 staffing:** human review required for every emergency request. Contract after-hours service, internal rotation, or SLA-only? (Single costliest decision; the mayor is blunt: a 9–5 team cannot do this.)
2. **What location data exists?** Given G14 (coarse default, no retained history <18), the honest answer to LE may be "we don't have precise location." Confirm before building a disclosure pipeline for data you don't hold.
3. **LE direct access vs "LE → Pookie support → trusted adult"?** Latter is safer; former is faster.
4. **24/7 LE phone number:** publish one? (Form-only fails the real case.)
5. **NCMEC coordination call** pre-launch? Tabletop dry-run before teen onboarding?
6. **"Never" vs "not today"** on the broader emergency posture — and 72h cap / 14-day deferral / 7-year record retention acceptable?

### Implementation notes
- Migration `022_emergency_requests`: append-only table (requester, path, verification artifacts, corroboration, reviewer, decision, scope, expiry, outcome)
- `trusted_adult_contacts` table (G15) with emergency-consent flag captured at designation
- `profiles.safe_notification_pref` (channel, delay)
- `access_events` (021) entries with `reason_code='emergency'`, teen-visible only
- Server-side scope allowlist; revoked-parent exclusion in RPC
- Internal human-review queue UI (staffing surface)
- Spoliation guard: auto-expiry kills access grants only; records go on litigation hold (7-year retention of request/verification/disclosure package)
- **Do NOT build** disclosure tooling, LE portal, or approval UI before counsel signs off (NFR-LEGAL-006). Never build LE self-serve.

---

## Proposal 2 — Time-boxed access grants

### Expert critiques (synthesized)

**Child-welfare specialist:** "Temporary" is a costume permanent surveillance can wear. No frequency cap → ten consecutive "4-hour" grants = indefinite grant without consent protections. Block circumvention: parent grants blocked Adult X a "temporary" sitter grant. Scope overreach: sitter doesn't need reflections/mood/journal. Teen blindness: parent-created grants the teen never sees = secret surveillance infrastructure. Expiry notifications with attribution ("Dawson revoked your access") = retaliation trigger.

**UX designer:** Duration presets read like a legal form — parents think in occasions ("Saturday night sitter"). "Indefinite" as a peer preset defeats the feature. Hard auto-expiry with no grace = "locked out mid-emergency" panic. No scope model. No granter/approver model for 13+. Recommend: occasion-based flow, expiry as a slope (not a cliff), saved templates + one-tap re-grant instead of auto-recurring.

### Revised solution

**Design principle:** temporary grants are narrow in scope, visible to the teen, capped in frequency, and blocks/revokes propagate through them.

**UX flow — "Share for a bit":**
1. Who's this for (name + relationship chips: sitter, grandparent, tutor, pickup)
2. Scope picker: "Sitter basics" preset (schedule/logistics, pickup authorization, emergency medical card) + locked-on emergency break-glass ("always available — never expires with the grant"). Reflection/Wellness/H2/H3 never offered.
3. Occasion presets with computed end times ("This evening — ends tonight at 11:00 PM"). "Ongoing" buried behind deliberate confirmation + 90-day review nudge.
4. Teen 13+ gets heads-up notification with one-tap change/revoke (instant for third-party grants — safety action, no cooling-off).
5. Confirmation + silent grant-template save ("Same again next Saturday?" one-tap re-grant).

**Expiry as a slope (panic killer):** T-24h parent nudge → T-1h/T-15m sitter wrap-up banner → at expiry: "All done" screen with [Request more time] + [Text parent] + 10-minute read-only grace on open screens. **Emergency card (contacts, allergies, address) is never gated by the grant** — stated explicitly on the scope screen.

**Anti-installment rules (server-side):**
- Scope allowlist: operational scopes only (schedule, pickup, emergency medical). Temporary grants REJECT Reflection/Wellness/H2/H3/full-communications at the RPC layer.
- Frequency cap: max 2 temporary grants per grantee per rolling 30 days; exceeding converts to indefinite-grant flow (teen approval at 13+).
- Pattern detection: background job flags installment behavior → teen's Sharing screen: "Jordan has had 6 temporary grants in 2 months — make this regular or stop?"
- Blocks propagate: blocked adult + household cannot receive temporary grants; 30-day re-request lockout applies; no grants during safe-exit suppression window.
- Purpose mandatory: reason code ("babysitter," "pickup," "tutor") + optional note; audited.

**Expiry notifications:** single quiet notice, zero attribution ("Your access has ended" — indistinguishable from natural expiry vs teen-initiated). No re-request CTA in the notice.

**Recurring:** saved templates + one-tap re-grant (fresh expiry, fresh teen heads-up, fresh audit row). NOT auto-recurring — standing grants get forgotten (surveillance leak).

### Open questions for Mehedi
1. Frequency cap: is 2/grantee/30 days too strict for real life (backup sitter 3 Saturdays/month)?
2. For 13–15: parent sitter-grants — teen notification-only, or teen co-approval required? (Child-welfare leans approval for first-time non-household adults.)
3. Confirm instant (no cooling-off) teen revoke of parent-made sitter grants.
4. Sitter directory (W12) interplay: label "parent-vetted, not background-checked" visibly to the teen?
5. Recurring grants: build "repeats weekly" now, or templates-first? (Safety note: shipping without recurrence handling invites the installment workaround.)

### Implementation notes
- Migration `023`: extend `child_access` with `expires_at`, `grant_kind` ('one_time'|'recurring'|'indefinite'), `grant_purpose` (NOT NULL for non-indefinite), `recurrence_rule`
- Idempotent 5-min sweeper with partial index; `revoked_by='system'`, reason `expiry`
- `grant_templates` table for one-tap re-grant
- Server-enforced read-only grace period
- All events → `access_events` (021)
- Sharing screen: "Temporary access" section with countdown chips, purpose labels, one-tap revoke

---

## Proposal 3 — Parent identity verification (tiered)

### Expert critiques (synthesized)

**Privacy attorney:** The v1 framing is legally defensible but mislabeled — calling a checkbox "verification" is deceptive under FTC §5 / GA FBPA. The line where self-attestation stops being enough is sharper than "at scale": inadequate for H2/H3 health, precise location history of minors, non-integral third-party disclosures, disputed-identity situations, 18+ health continuity. **School emergency-contact matching: recommend against entirely** — FERPA problem (school can't disclose the corpus), circularity (matching against parent-provided data proves nothing), honeypot (minors' PII database violates 2025 minimization), purpose-expansion. **Government-ID artifacts are the liability** — never persist ID images; store decision-only. Equity: ID verification excludes adults without government ID — must be escalation path, never a gate for basic use. Failure must default to "provisional" (keep base product), never block, never label "fraud," never visible to the other parent.

**Pediatrician:** Self-attestation acceptable for H1 (steps, sleep) ONLY. Medically/ethically insufficient for H2 (weight, meds, menstrual, mood) — v1 must not expose H2 to self-attested parents at all. H3 (STI/contraception/SUD/mental-health/pregnancy) unreachable by ANY identity level. Imposter access to confidential teen care undermines GA minor-consent protections. Missing: ingestion classifier (fails into H3), `confidential_by_law` provider flag, parent-entry refusal for H3 topics, break-glass cards must exclude H3.

### Revised solution

**Glossary (required before any build):** attested (v1 checkbox) ≠ school-verified (v2 portal proof) ≠ id-verified (v2 government ID). Every UI string, policy paragraph, and internal doc uses tiered terms. Never "verified" alone. Never "consent."

**v1 — "Attested steward" (launch):**
- Guardian attestation checkbox at child creation (timestamp + IP hash, wired to verification record)
- Email ownership via existing OAuth/magic-link flow
- Attested stewards get: own account, parent-managed profiles, parent-provided data (grades via their own ParentVUE credentials, observations, uploads)
- **Gated until v2:** H2/H3 health data entry, precise location history, non-integral third-party disclosures involving child data
- Health modules ship as H1-only seedlings in v1; meds/allergies teen-entered, labeled "not verified by parent"

**v2 — Tiered verification:**
- **Primary method: school-portal proof** (replaces emergency-contact matching). Adult completes one-time login to the school's parent portal (ParentVUE/CTLS Parent) — the school did the proofing at enrollment. Store only `school_portal_verified_at` timestamp. No ID honeypot, no FERPA corpus.
- **Escalation: government ID via Stripe Identity**, decision-only retention (verified true/false, method, timestamp, vendor ref — never the image/document/template). Contract: minimum retention, no training, no onward disclosure, written 312.8 assurances.
- **Tiers:** `unverified` (v1 attested) → `school-verified` → `id-verified`. Tiers gate sensitive scopes, never the base product.
- **Just-in-time step-up:** verify only when attempting H2, never at signup. Per-parent verification. Teen sees verification status; other parent never does.
- **H3: no identity level reaches it.** Teen-only, no grants, no aggregates, no break-glass.
- **Court orders suspend even IAL2.** 18+ cutover resets everything.

**Failure path (build in v1):** fail → "provisional" (full base product, sensitive scopes gated) → bounded manual review with alternative proof menu → human decision in published SLA. Failure is private to the claimant. No "fraud" language. Repeated failures → rate limits + trust-queue alert (NOT notified to the creating parent — tip-off vector).

### Open questions for Mehedi
1. Friction tolerance: ~30–60s Stripe Identity before H2 access — conversion trade-off to own.
2. Is Stripe-Identity-alone acceptable for v2, deferring school-record-as-ID to counsel review?
3. Who pays per-verification cost? (Both experts recommend absorbing — paywalled teen health privacy is a two-tier safety model.)
4. Confirm break-glass emergency cards exclude H3.
5. v1→v2 transition: grandfather existing attested stewards into sensitive scopes, or require v2 for new grants? (Privacy attorney recommends: require v2 for new grants; don't retroactively lock.)
6. For under-13 parent-managed profiles: require IAL2 before steward enters meds/allergies?
7. Manual-review ops: who staffs it? (Triggers mandatory-reporter analysis for reviewers — G7.)

### Implementation notes
- Migration: `parent_verification` (user_id, tier, method, verified_at, attestation_ts, vendor_ref); `verification_events` append-only; extend `access_events` (021)
- `profiles.identity_assurance` enum (ial1/ial2); RPCs `requestIdentityStepUp()` + signed webhook handler
- Extend `health_tier_visible()` with IAL checks; RLS negative-test matrix (IAL1×H2→deny, IAL2×H3→deny, court-order×IAL2→deny)
- Never persist gov-ID images; no health content in push/email bodies
- **Counsel gates (do not self-clear):** COPPA package, school-portal legal theory (GA SB 89 § 20-2-667), ID-verification disclosure language, mandatory-reporter exposure for reviewers, FTC HBNR determination

---

## Proposal 4 — AI training data policy

### Expert critiques (synthesized)

**Liability attorney:** "We do not train on your data" as a bare marketing sentence is legally insufficient and actively risky. Under FTC §5 / GA FBPA, a privacy promise is measured against the entire pipeline including the vendor's. If prompts flow to Cloudflare Workers AI, the promise is only true if the contracts say so. **Audit what the worker actually logs today before publishing the sentence.** "No conversation logging to training pipelines" is vague — doesn't cover eval datasets, RLHF, embedding stores, abuse-review queues, debug logs. **Kill the opt-out toggle** — three reasons: implies default use, wrong frame for minors' private chats (should be no secondary use, period), dark-pattern risk under CA AB 2246. The crisis-review collision is undisclosed: if any human reads flagged conversations for safety, "we do not train" doesn't answer "does a human read my crisis chat?"

### Revised solution

1. **Public commitment (ToS + Privacy Policy + FAQ), binding:** "Pookie never uses your conversations with Pookie AI to train, fine-tune, or improve AI models — not ours, not our vendors'." Define "train" broadly: training, fine-tuning, RLHF, eval datasets, embedding stores.
2. **Contractual:** DPA with Cloudflare (and any AI subprocessor): explicit zero-retention-for-training, no-secondary-use, subprocessor flow-down, audit/certification rights. Documented processing regions. **30-day advance notice** before any new AI subprocessor touches chat data.
3. **Technical:** transient-only processing; no persistent prompt/response store except teen-saved records (labeled study history, never training data); debug logs ≤30-day TTL, access-controlled, contractually excluded from model improvement. Verified by real data-flow audit before the promise publishes.
4. **No training opt-out toggle** (nothing to opt out of). Separate default-OFF **opt-in** for aggregated de-identified product analytics, clearly distinguished from chat content.
5. **Disclosed safety carve-out** (teen-readable): "If you tell Pookie you may be in crisis, we may show crisis resources (988) and, in narrow safety circumstances, a trained reviewer may see that conversation. Safety review is never used to train AI."
6. **State-law posture documented:** WA MHMDA determination (treat teen wellbeing chats as consumer health data); TX SCOPE transparency; CA AB 2246 defaults-off; CA SB 1119 safety-protocol alignment; IL BIPA note if voice ships.
7. **FTC hygiene:** annual internal attestation; if any vendor term changes to permit training, the commitment is pulled BEFORE the change takes effect.
8. **Parent FAQ:** "Do my teen's chats train AI? No — never. Can I read them? No — teen-private, except the safety emergency described above."

### Open questions for Mehedi
1. What does the Llama worker log today? (Audit first, promise second.)
2. Does any human review AI conversations today? (Needs disclosure + retention rule if yes.)
3. Are prompts/responses stored persistently anywhere? (Decide retention: transient + teen-controlled deletable history + rolling purge.)
4. **"Never" vs "not today":** "never" in ToS is strong marketing but hard to reverse (unwinding = FTC event). Alternative: "we do not today; any change requires 30-day notice and your opt-in." Which?
5. Washington users: geofence, comply with MHMDA consent flows, or block? (Highest-risk state law near-term — needs deliberate decision.)
6. Budget: vendor-DPA legal review overlaps COPPA gate #7 and HBNR gate #10 — confirm counsel scope covers all three.

### Implementation notes
- **In ToS:** no-training commitment as binding promise with broad "train" definition; vendor/subprocessor list + 30-day change-notice; chat retention schedule; safety-review carve-out; state-law addenda.
- **Counsel sign-off required:** Cloudflare terms verification, WA MHMDA determination, FTC HBNR determination, COPPA vendor assurances.
- **Buildable now:** engineering data-flow audit; FAQ entry; opt-in analytics toggle design; removal of existing prompt logging; retention-schedule draft.
- **Do NOT publish** the absolute promise until vendor terms are verified.

---

## Proposal 5 — Second-parent onboarding

### Expert critiques (synthesized)

**Privacy attorney:** Name + DOB fuzzy match is not identity proofing — it's a knowledge test anyone close to the child passes (other parent's partner, estranged abusers, traffickers). As sole gate it's the highest-stakes identity hole in the product. The fuzzy-match lookup is an enumeration oracle — round-1 §1.2.3 prohibited standalone lookups; this is worse (prober is a stranger). Under-13: "Parent A approves" fails on unresponsive Parent A (limbo = weapon in high-conflict divorce) and gatekeeping Parent A (escape hatch must be slow, human-reviewed, evidence-based). 13+: teen can't evaluate the claim — needs verification-level badges, anti-coercion check, 30-day lockout. Custody-order intersection: the flow as specified is a circumvention tool — must ask custody attestation, check `court_order_restriction` flag, disable self-serve when set.

**UX designer:** "I'm the parent of a child already in Pookie" will be mis-tapped. Name+DOB lookup needs layout-identical match/no-match screens with the privacy promise before submit. Waiting state = dead end = churn → Parent B must get a fully working "just me" Pookie immediately. A permanent "DENIED" badge becomes a custody-fight screenshot → one-time dismissible card, no reason, no appeal button.

### Revised solution

**Structural change: eliminate the child search box.** Primary path is invite-from-inside; the claim path is corroborated and human-reviewed.

**v1:**
1. **Primary path — no lookup:** first-run screen offers "Connect to my family" → "Ask the parent already using Pookie to invite you: they can send an invite from Settings → Family in under a minute." Shareable deep link / QR generated by the existing parent. Zero enumeration surface. Handles cooperative co-parents (the majority).
2. **Fallback claim path** (Parent A won't/can't invite):
   a. Verified sign-in required before any claim (kills drive-by probing)
   b. Claimant provides: full legal name, child's name + DOB, **creating parent's signup email** (quiet corroborating factor — real co-parents usually know it), perjury-style attestation (parent/guardian; no limiting court orders; false statements → termination + referral)
   c. Custody attestation: "Are there any court orders limiting your contact with or access to this child?" If `court_order_restriction` flag set → self-serve fully disabled → human review only
   d. **Uniform response regardless of match:** "Thanks — if this child is in Pookie, we've notified the parent on record." No existence signal.
   e. Rate limits + CAPTCHA + probing-pattern logging; no timing oracles
   f. **No auto-grant, ever.** <13 → Parent A approves (sees claimant's verified attributes: "email verified; attestation signed" — NOT "identity confirmed"). 13+ → teen approves (verification badges, anti-coercion check, 30-day lockout) + fact-only notification to Parent A (no veto).
   g. Parent A unresponsive (14 days, reminders day 3/7/12) → human-review escalation with documentary proof of parentage. Published SLA.
3. **Three-card first-run:** "Just me" (default) / "Add my child" ("You'll create their profile") / "Connect to my family" ("…already uses Pookie… instead of starting over"). Unmistakable branching.
4. **Parent B gets working Pookie immediately** — the request is one Family card ("Waiting… requested Oct 12" + cancel). No dead end.
5. **Rejection:** one-time dismissible card — "Not connected — [child]'s family didn't approve this time… the app won't say why." No reason, no appeal, 30-day lockout, support link. Nothing screenshot-worthy.

**v2** (with Proposal 3 verification tiers): ID-verified claimants get fast lane (corroborated claim + ID match → Parent A/teen approval with "government-ID confirmed" badge, human review skipped absent red flags). Custody-order ingestion workflow (G9/R4).

### Open questions for Mehedi
1. **Human review ops:** fallback claim path + gatekeeping escape hatch need trained reviewers. Accept headcount at launch, or narrow v1 to invite-from-inside only? (Reviewers trigger mandatory-reporter analysis — G7.)
2. Creating-parent's-email corroboration: acceptable friction, or blocks legitimate non-custodial parents? (Fallback: documentary human-review path.)
3. **Custody posture:** read and enforce court orders (G9 design), or permanently route disputed cases to "resolve outside the app"? (Still needs attestation + flag-check so the app isn't a circumvention tool.)
4. Teen deny UX: neutral "not approved at this time" vs revealing the teen denied? (Privacy attorney recommends neutral + teen's wording choice — loyalty-bind protection.)
5. When 13–15 teen approves Parent B: fact-only notification to Parent A? (UX recommends yes.)
6. Grandparents/step-parents: same path with relationship chip?

### Implementation notes
- Migration: `second_parent_claims` (claimant, child, relationship, attestations, custody attestation, status, reviewer, decision reason); `court_order_restriction` (child, order type, restrictions, verifier) — shared with W14; extend `access_requests` (020) or separate table (recommend separate — different evidentiary standard)
- All claim events → `access_events` (021); uniform-response invariant in RPC; match scores never leave server
- Anti-enumeration: rate limits, CAPTCHA, constant-time-ish responses, trust-queue alerting
- `blocked_requesters` for 30-day re-invite ban
- **Counsel sign-off:** custody-order workflow, attestation language, gatekeeping escape-hatch (DV-advocate copy review), mandatory-reporter exposure for reviewers, denied-claim retention rule

---

## Proposal 6 — Support staffing (Mehedi-locked: 2 agents, 9–5 ET daily)

### Expert review (UX designer)

**Confirmed with refinements.** The model is sound; the initial solution needed operational precision:

- "4 business hours" is meaningless for 7-day operation → the clock is **"4h within 9 AM–5 PM ET, 7 days"** (11 PM ticket → first response by 1 PM next day)
- "AI can't resolve" isn't observable → defined escalation tripwires (see below)
- "Respond at 9 AM" overpromises → "by 1 PM ET at the latest"
- Fake queue positions destroy trust → status + SLA, never rank
- **Teen-privacy hole in the initial solution:** nothing said whether parents are told about a teen's ticket → **explicit zero-parent-notification** for teen tickets (except imminent-safety)

### Revised solution

**Escalation tripwires (observable, not vibes):** AI creates a ticket when: (a) confidence below threshold after 2 attempts, (b) user types "human"/"agent"/"person", (c) safety/crisis keywords fire, (d) legal/compliance topic detected, (e) account-access or billing issue.

**Visible handoff contract:** AI shows 3–5 bullet summary card ("what I'll hand them so you don't repeat anything") → [Looks right] [Add something] → ticket # created → "A support agent will reply right here, within 4 hours — 9 AM–5 PM ET, every day." User can keep troubleshooting with AI meanwhile. Human replies in-thread: "Hi, I'm [first name] — I read everything above."

**After-hours (5 PM–9 AM ET):** honest banner ("Our team is offline until 9 AM ET — you'll hear back by 1 PM ET at the latest") + AI keeps working + "Notes for the agent" scratchpad. **Crisis = pattern interrupt:** AI stops troubleshooting → big [Call 988] [Text 741741] [GA Crisis Line] buttons + "help me tell a trusted adult" + stays present → ticket filed quietly second. Honesty line: "I can't keep this just between us if someone's safety is at stake — but I won't tell your parents unless someone could get seriously hurt."

**Teen tickets:** explicit banner — "This stays between you and Pookie support. We won't tell your parents you wrote to us, or what you asked." Agents must request in-thread consent before viewing grades/health; every access audit-logged and visible to the teen at Settings → Privacy → "Who's looked at my stuff." Lock-screen-safe push previews.

**Ticket tracking:** status pills (Open → With [name] → Answered → Closed) with timestamps + real presence ("Maya is looking at this now") + SLA line. No queue numbers. Two-person team framed as "the same small team every time," never an apology.

**Agent RBAC (least-privilege):** ticket content + user contact + relevant module context only. Never health/grades without in-thread teen consent. Teen-approved break-glass grants (24h TTL) for exceptional cases. All agent access audited. Under-13: parent must be on the ticket.

### Open questions for Mehedi
1. Holiday coverage: 7-day promise year-round, or adjusted SLA copy on holidays?
2. Agent empowerment: resolve billing/refunds and access exceptions, or triage to you?
3. Crisis keyword sensitivity: tiered (soft vs explicit) recommended — confirm bar.
4. Confirm zero parent-notification for teen tickets except imminent-safety.
5. The 24/7 emergency-review question from Proposal 1 interacts here: do support agents cover the break-glass human-review queue, or is that a separate on-call function?

### Implementation notes
- Schema: `support_tickets` (id, user_id, child_id nullable, category, priority, status, assigned_agent, sla_due, teen_privacy flag, created_at) + `ticket_events` (append-only: messages, status changes, agent views)
- Window-aware SLA arithmetic (business-hours-only clock)
- `teen_privacy` enforced at API layer (invisible to parent accounts, not just UI-hidden)
- Crisis classifier tier with `tel:`/`sms:` resource sheet
- Agent shift-change re-intros ("Maya handed your ticket to Jordan — here's where things stand")
- **Build order:** ticket schema + handoff + SLA engine first (crisis path is launch-blocking per G2)

---

## Cross-proposal conflicts and resolutions

| # | Conflict | Positions | Resolution |
|---|---|---|---|
| C1 | Break-glass: build or not? | Liability: "not an emergency service" is defensible; bad process > no process | Build NARROW: SCA §2702(b)(8) standard, location-only, human-reviewed, disclosed upfront. The alternative (no process) is a moral/reputational gap the product can't defend once it holds minors' location. |
| C2 | Break-glass duration | Child-welfare: 12h · Mayor: 72h · Initial: 24h | Tier by path: trusted-adult 12h; LE 72h incident-bounded + renewable. Both: auto-expire + active closure + access log. |
| C3 | Civilian trigger for break-glass | Mayor: never · Psychologist: trusted-adult primary · Child-welfare: only pre-designated + corroborated | Both paths exist: trusted-adult (pre-designated, corroborated, human-reviewed, 12h) + LE (SCA, callback, 72h). No self-serve civilian trigger, ever. |
| C4 | Report number as gate | Initial: required · Mayor: fantasy · Child-welfare: weakest link | Corroborating evidence only. Two-channel verification (callback + 2-of-3 factors). |
| C5 | AI training opt-out toggle | Initial: include · Liability: kill it (3 reasons) | Killed. Absolute commitment + default-OFF opt-in for aggregated analytics. |
| C6 | School emergency-contact matching | Initial: v2 option · Privacy atty: recommend against (FERPA/honeypot/circularity) | Dropped. Replaced with school-portal proof. |
| C7 | Name+DOB child lookup | Initial: fuzzy match · Privacy atty: enumeration oracle · UX: same | Eliminated. Invite-from-inside primary; corroborated claim + human review fallback. |
| C8 | "Verification" language | Privacy atty + pediatrician | Glossary required: attested ≠ school-verified ≠ id-verified. Never "verified" alone. Never "consent." |
| C9 | H3 health data + break-glass | Pediatrician: exclude · Initial: silent | H3 excluded from ALL break-glass scopes, all identity levels, all paths. Teen-only, always. |
| C10 | Teen notification of break-glass | Initial: notify after · Child-welfare: push can endanger · Liability: silent = deception | Silent in-app card on next login (never push/SMS); LE-requested deferral ≤14 days; DV-advocate-reviewed copy. |
| C11 | Support SLA "business hours" | Initial: 4 business hours · UX: meaningless for 7-day | "4h within 9 AM–5 PM ET, 7 days" — window-aware arithmetic. |
| C12 | Teen tickets → parents told? | Initial: silent · UX: explicit hole | Explicit zero-parent-notification banner (except imminent-safety). API-layer enforcement. |

---

## Module complexity ranking & dependency-ordered build sequence

**Mehedi requirement 2026-10-12:** every module ranked by implementation complexity with documented dependencies, sequenced least → most dependent. 31 modules (28 + S1/S2/S3 Support).

**Complexity key:** 🟢 Simple · 🟡 Moderate · 🟠 Complex · 🔴 Very Complex

### Phase 0 — Foundation (no module dependencies; everything else builds on these)

| Rank | Module | Complexity | Why | Key dependencies |
|---|---|---|---|---|
| 1 | S1 Help Center & FAQ | 🟢 Simple | Static content + search; no user data | None (content authoring only) |
| 2 | Access model core | 🟢 Simple* | *Conceptually simple; security-critical* — migrations 015–023, RLS, grant/revoke RPCs | Supabase; counsel sign-off on matrix |
| 3 | Onboarding flow | 🟡 Moderate | Multi-step, branching, age gates | Access model; profiles table (017) |
| 4 | Popup menu (6+1 categories) | 🟢 Simple | Renders from `modules.ts`; search + recent + age-gating | Modules registry; age-gate rules |

*Foundation items aren't modules but must ship first. Listed for sequencing.*

### Phase 1 — Standalone data modules (no cross-module deps)

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 5 | W26 Weather | 🟢 Simple | External API (NWS/NOAA); coarse location only | Location permission; NWS API key |
| 6 | W20 Shopping List | 🟢 Simple | CRUD + household sharing | Household scope |
| 7 | W13 Meals | 🟢 Simple | Meal-plan CRUD | None |
| 8 | W3 Safety (insurance) | 🟢 Simple | Document storage + forms; never interpret coverage (liability) | Document vault pattern |
| 9 | W21 Mail | 🟡 Moderate | Photo intake + OCR + GIPA extract-then-mask | OCR vendor; 30-day auto-delete |
| 10 | W22 Activity | 🟡 Moderate | Fitness-tracker integrations (HealthKit, Health Connect) | Device APIs; H1-only until taxonomy |

### Phase 2 — Modules depending on Phase 0/1

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 11 | W23 Nutrition | 🟡 Moderate | Food logging; age-gated (<18 restrictions per panel) | W13 meal data; H1 taxonomy; W28 allergy list (reverse dep — see note) |
| 12 | W28 Restaurants | 🟡 Moderate | Verified listings; allergen hard-blocks; DPH scores | W23 allergy list; location (W26); <18 filters |
| 13 | W29 Trails & Parks | 🟠 Complex | 🛑 as designed — vetting, supervision guidance, sunset warnings, "share my plan" | W26 weather/conditions; G23 outing-sharing; trusted-adult infra |
| 14 | W27 Events | 🟠 Complex | 🛑 as designed — curation policy, vetting, age tags, audience modes | Municipal sources; age-gate engine |
| 15 | W16 School Calendar | 🟢 Simple | Lives inside W1 | W1 |

### Phase 3 — Financial (compliance-heavy)

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 16 | W11 Spending | 🟠 Complex | Bank integrations; categorization; GIPA masking; teen purchase privacy | Bank API (Plaid or equiv); NFR-SEC-006 vault |
| 17 | W7 Money & Documents | 🟠 Complex | Encrypted vault; never persist full PANs | NFR-SEC-006; retention schedule |
| 18 | W24 Credit | 🔴 Very Complex | 🛑 as 3-bureau monitoring — re-scoped to freeze management (O.C.G.A. §§ 10-1-914/914.1) | FCRA counsel sign-off (NFR-LEGAL); licensed partner |

### Phase 4 — Support (new category)

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 19 | S2 AI Support Chat | 🟠 Complex | Tutor-worker infra; crisis classifier; escalation tripwires; teen-privacy | PoKIE tutor worker; G2 crisis protocol; no-training commitment (Prop 4) |
| 20 | S3 Support Tickets | 🟠 Complex | Ticket schema; RBAC; SLA engine; agent UI; teen-privacy API enforcement | S2 escalation; agent staffing (Mehedi: 2 agents 9–5 ET) |

### Phase 5 — Health (compliance-gated)

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 21 | W8 Wellbeing | 🟠 Complex | Teen-private; mood data; crisis ladder (G2); H-tier mapping | H0–H3 taxonomy (FR-HEALTH-001); crisis protocol |
| 22 | W2 Health | 🔴 Very Complex | 🛑 until taxonomy exists; device ingestion; no-diagnosis rule; HBNR determination | H0–H3 taxonomy; NFR-LEGAL-010; device APIs |
| 23 | W15 Screen Time | 🟡 Moderate | Co-set flow (teen proposes, parent approves); teen appeal; no covert monitoring | Age band logic; transparency requirement |

### Phase 6 — Family & access features

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 24 | W12 Babysitters | 🟡 Moderate | Directory (parent-vetted label); time-boxed grants (Proposal 2) | `expires_at` (023); grant templates |
| 25 | W14 Co-parenting | 🔴 Very Complex | 🛑 for high-conflict — parallel-parenting mode; custody-order awareness; immutable log | Court-order flag (G9); FR-SAFETY-012; family-law review (R5) |
| 26 | W6 Driving School | 🟡 Moderate | GA DDS rules engine (Joshua's Law hours log); per-state from day one | DDS rules data; W19 emergency overlap |

### Phase 7 — School (most complex, most dependencies)

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 27 | W4 Activities | 🟡 Moderate | Practice/game web | W16 calendar; school data |
| 28 | W18 Summer | 🟢 Simple | Camp/plan tracking | W16 calendar |
| 29 | W5 College & Future | 🟠 Complex | 50-college simulator; GSFC-exact methodology; HOPE/Zell Miller | W1 grades; GSFC data |
| 30 | W1 School | 🔴 Very Complex | 13 data sources; sync workers (StudentVUE); provenance rules; AI quizzes (fail-closed); teacher inbox segregation; check-in redesign | Sync infrastructure; FR-SCHOOL-001–019; AI guardrails |

### Phase 8 — Travel rules engines

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 31 | W25 Fuel & Charging | 🟢 Simple | External APIs; family-aware routing default | Location; fuel/charge APIs |
| 32 | W30 Flights | 🔴 Very Complex | 🛑 — 18+ purchaser invariant (server-side); UM rules engine; custody travel-restriction profile | FR-TRAVEL-001; airline rules data; FR-SAFETY-012 |
| 33 | W31 Rental Cars | 🟠 Complex | Hard age-gate; hidden from teen accounts; surcharge math | Age-verification; rental rules data |

### Phase 9 — Safety & emergency (integrates everything)

| Rank | Module | Complexity | Why | Dependencies |
|---|---|---|---|---|
| 34 | W19 Emergency | 🟠 Complex | "Call 911 first" (not a response service); break-glass medical card; resource preloading; Proposal 1 integration | Trusted-adult infra (G15); Proposal 1 (break-glass); NFR-LEGAL-006 |

### Critical path

```
COPPA package (NFR-LEGAL-007) + ToS (NFR-LEGAL-001)
  → Migrations 015–023 (access model + audit + verification + emergency + grants)
    → H0–H3 taxonomy (FR-HEALTH-001) + retention schedule (NFR-PRIVACY-002)
      → Trusted-adult infra (G15) + crisis protocol (G2)
        → W1 School rebuild (FR-SCHOOL) + W2 Health (gated)
          → W19 Emergency + Proposal 1 break-glass (counsel sign-off)
            → QA & launch gates
```

**Critical-path blockers requiring Mehedi:** DB access for migrations (external dependency); 24/7 emergency-review staffing decision (Proposal 1, Q1); counsel engagement (10 legal gates); "never" vs "not today" on AI training (Proposal 4, Q4).

### Dependency notes
- **W23 ↔ W28 circularity:** Nutrition needs the allergy list; Restaurants needs nutrition data. Resolved: allergy list is a standalone `health_allergies` table both read; neither module blocks the other.
- **Support (S2/S3) before W19:** the crisis path (G2) is launch-blocking; ticket schema + escalation must ship before Emergency module marketing.
- **Proposal 2 (`expires_at`) before W12:** time-boxed grants are a W12 requirement, not a nice-to-have.
- **Proposal 3 (verification) before H2 surfaces:** IAL2 gates health tier 2; build the tier checks with the taxonomy.

---

## New requirements for BUILD-SPECIFICATION.md

The following items are added (existing numbering untouched):

**FR-SAFETY (new):**
- FR-SAFETY-013 | Break-glass Path A (teen-configured safety net): pre-designated trusted adult only; corroboration required; human review; 12h auto-expiry; location (coarse default) + W19 medical card only; revoked parents categorically excluded; teen-configured scopes at onboarding. | Prop 1
- FR-SAFETY-014 | Break-glass Path B (LE exigent): SCA §2702(b)(8) standard; callback verification; two-employee approval; 72h incident-bounded + renewable; location-only; silent in-app teen notification ≤48h (LE deferral ≤14d). Court orders via FR-SAFETY-011/012, not break-glass. | Prop 1
- FR-SAFETY-015 | Break-glass invariants: no civilian self-serve trigger; scope fixed in policy (never Reflection/Wellness/H2/H3/chats/grades); spoliation guard (litigation hold on records); "not an emergency response service — call 911" posture in ToS. Counsel sign-off (NFR-LEGAL-006) before any disclosure tooling. | Prop 1

**FR-ACCESS (new):**
- FR-ACCESS-011 | Time-boxed grants: `expires_at` + `grant_kind` + `grant_purpose` on `child_access` (023); occasion-based UX ("Share for a bit"); scope allowlist (operational only — never Reflection/Wellness/H2/H3); frequency cap 2/grantee/30d with installment detection; blocks/revokes/safe-exit propagate; teen visibility + one-tap revoke; attribution-free expiry notices; saved templates (no auto-recurring). | Prop 2
- FR-ACCESS-012 | Emergency card independence: contacts/allergies/address never gated by any grant's expiry — a grant lapsing can never block a 911 call. Stated explicitly on the scope picker. | Prop 2

**FR-AUTH (new):**
- FR-AUTH-010 | Parent identity tiers: glossary (attested ≠ school-verified ≠ id-verified); v1 attestation + email; v2 school-portal proof (primary) / Stripe Identity decision-only (escalation); just-in-time step-up for H2; failure → provisional (never blocked, never labeled, never visible to other parent); per-parent verification; teen sees status. School emergency-contact matching DROPPED. | Prop 3
- FR-AUTH-011 | Second-parent onboarding: three-card first-run (Just me / Add my child / Connect to my family); invite-from-inside primary (deep link/QR, zero enumeration); corroborated claim fallback (verified sign-in + name/DOB/creating-parent-email + perjury-style + custody attestations; uniform response; no auto-grant); Parent A/teen approval with verified-attribute badges; 14-day unresponsive escalation to human review; one-time dismissible rejection card; 30-day re-request lockout. `court_order_restriction` disables self-serve. | Prop 5

**NFR-PRIVACY (new):**
- NFR-PRIVACY-010 | AI training prohibition (strengthens NFR-PRIVACY-008): binding "never train" commitment with broad "train" definition (training, fine-tuning, RLHF, evals, embeddings); DPA with zero-retention-for-training + no-secondary-use + flow-down + audit rights; 30-day advance notice on subprocessor changes; transient-only processing; debug logs ≤30-day TTL; NO opt-out toggle (nothing to opt out of); separate default-OFF opt-in for aggregated analytics; disclosed safety-review carve-out; WA MHMDA / TX SCOPE / CA AB 2246 / SB 1119 posture documented; annual attestation. Do NOT publish until vendor terms verified. | Prop 4

**FR-SUPPORT (new section):**
- FR-SUPPORT-001 | S1 FAQ: 9-section tree (~90 articles); legal-accordion component with "Required by law" / "Our choice" badges; ≤8th-grade plain language; attorney editorial workflow; 4 written examples in sol-support. | Mehedi 2026-10-12
- FR-SUPPORT-002 | S2 AI support chat: 24/7; escalation tripwires (confidence <threshold after 2 attempts, "human" request, safety/crisis keywords, legal topic, account/billing); visible handoff contract (summary card → [Looks right]); crisis pattern-interrupt (988/741741/GA Crisis Line + "help me tell a trusted adult" + stays present). | Prop 6
- FR-SUPPORT-003 | S3 tickets: `support_tickets` + `ticket_events` schema; window-aware SLA (4h within 9–5 ET 7d; 11 PM ticket → due 1 PM next day); status pills + real presence (no queue numbers); after-hours honest banner + AI continuity + agent scratchpad; shift-change re-intros. | Prop 6
- FR-SUPPORT-004 | Teen ticket privacy: explicit zero-parent-notification banner (except imminent-safety); `teen_privacy` flag enforced at API layer; in-thread consent before agent views grades/health; all agent access audit-logged and teen-visible ("Who's looked at my stuff"); lock-screen-safe push previews. | Prop 6
- FR-SUPPORT-005 | Agent RBAC (least-privilege): ticket content + contact + relevant module context only; teen-approved break-glass grants (24h TTL) for exceptional cases; under-13 requires parent on ticket; all access audited. | Prop 6, sol-support
- FR-SUPPORT-006 | Agent empowerment scope (Mehedi decision needed): billing/refund authority and access-exception authority — resolve in-ticket or triage? Holiday coverage: 7-day promise year-round or adjusted copy? | Prop 6, open

**Traceability additions:**
| New ID | Source |
|---|---|
| FR-SAFETY-013/014/015 | Proposal 1 (liability, child-welfare, psychologist, mayor) |
| FR-ACCESS-011/012 | Proposal 2 (child-welfare, UX) |
| FR-AUTH-010 | Proposal 3 (privacy atty, pediatrician) |
| FR-AUTH-011 | Proposal 5 (privacy atty, UX) |
| NFR-PRIVACY-010 | Proposal 4 (liability atty) |
| FR-SUPPORT-001–006 | Proposal 6 (UX) + Mehedi 2026-10-12 |

---

*End of Round 2 synthesis. All expert reports on file. Counsel sign-off gates unchanged — these solutions do not clear any NFR-LEGAL gate.*
