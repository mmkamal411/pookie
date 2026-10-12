# Guidance Counselor Panel Review — Pookie Access Model & Full Feature List

**Reviewer role:** Expert high-school guidance counselor (subagent review, 19-expert panel)
**Date:** 2026-10-12 · **Jurisdiction:** Georgia (launch)
**Specs reviewed:** `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12) + `docs/FEATURE-LIST-FOR-PANEL.md`
**Companion frameworks read:** `GUIDANCE-FRAMEWORK.md` (esp. Part 7 red-flag protocol), `EDUCATION-FRAMEWORK.md`, `docs/LEGAL-REVIEW-duty-of-care.md`, `docs/reviews/FERPA-REVIEW.md`

> **Scope note:** This is professional school-counseling practice review — what actually happens in
> Georgia high schools (counselor caseloads, FERPA-in-practice, ASCA ethics, co-parenting conflict,
> crisis response) — not legal advice. Flags marked "human counsel" need a lawyer, not a counselor.
> I work with what schools do on the ground; where I couldn't verify a fact I say so.

---

## PART 1 — ACCESS MODEL: VERDICT PER SPEC SECTION

### §1 Product principles
- **⚠️ needs change.** Principle 2 ("child is the access authority; no veto by any parent") is the
  right developmental posture and I support it. But as written it is *legally absolute* — "cannot be
  vetoed or revoked by any parent" — and it has two holes a school counselor sees immediately:
  1. **Court custody orders.** In Georgia, a final divorce decree or temporary order often names one
     parent the decision-maker for education. An app's product principle cannot override a court order.
     If a non-custodial parent's teen grants them access over the custodial parent's objection, or a
     teen revokes the custodial parent's court-ordered educational decision-making access, the app is
     caught between its contract and a judge. The FERPA review flagged the in-app-only qualifier; I
     add: the spec needs an explicit **court-order review path** (submit order → human review →
     matrix adjusted per order). Self-serve revocation must never be the mechanism that defeats a
     court order, and the matrix must say so.
  2. **The school's independent channel.** Principle 2 reads to a teen as "Mom can't see my grades."
     She can — ParentVUE, report cards, the counselor's phone. This is the single most dangerous
     misunderstanding in the spec. It produces false privacy (teen discloses in check-ins believing
     parents are blind) and false grievance (parent believes the app blocked them). Fix in §1-A below.
- **Required:** qualify Principle 2 as "within Pookie" and add the court-order row to the §3 matrix.

### §2 Signup & onboarding
- **⚠️ needs change.** The 30-second onboarding is good UX, but Step 2 ("Do you want to track
  children?") is the moment a parent forms expectations the app cannot keep. Two gaps:
  1. No plain-language disclosure that in-app sharing choices do not bind the school (copy in §1-A).
  2. No **parental-consent hook for the 13–17 account itself.** As a counselor I regularly see
     14-year-olds whose parents never consented to a service holding their school data. The legal
     review flagged voidable contracts; my practice flag is simpler: when a parent adds a 13–17
     child by email, require the *inviting parent* to check "I am the parent/legal guardian of this
     child" — it won't stop fraud, but it creates the attestation schools expect and filters casual
     misuse (grandparents, older siblings, coaches adding a kid).
- **Required:** add both disclosures/attestations to onboarding Step 2.

### §3 Access authority matrix
- **⚠️ needs change.** Server-side enforcement is correct. Three counselor-driven additions:
  1. **Add a "Court order on file" column/row:** verified custody/educational-decision orders supersede
     the matrix. Without this, co-parenting conflict (W14) lands on the matrix and loses.
  2. **"Revoke access a parent granted" — teen revoking Parent A's grant to *another adult*:** the
     matrix says the teen can revoke "own grants only," a parent can revoke "own grants only." So if
     Parent A granted Grandma access, and the teen wants Grandma gone, *nobody can revoke it* — the
     teen didn't grant it, Parent A won't. Deadlock. Real families hit this constantly (step-parent
     access after divorce). Fix: the child can revoke *any* grant on their own record; the matrix's
     restriction should apply to adults revoking each other's grants, not to the child.
  3. **The revoke must be auditable by the teen** (legal review agrees): a "sharing history" log the
     teen can see — who granted what, when. This is also how a counselor verifies a teen acted
     knowingly when a parent calls the school furious.
- **Required:** deadlock fix (#2) is a ship-blocker for the matrix; #1 and #3 ship with v1.

### §4 Age tiers — 13–15 cooling-off
- **🛑 blocked as written.** Three independent problems:
  1. **Retaliation window.** "Both parents notified immediately (told, not asked)" + 7 days of no
     change = the app tells a potentially abusive parent that the child is cutting them off, then
     leaves the child exposed for a week. I have sat across from students in this exact situation.
     The legal review's safety-check replacement (§2A of that review) is the minimum. I endorse it
     and add: the safety question must be asked **before** the revoke is scheduled, in the teen's
     private session, and the delayed-notification path must be real (notification fires at day 7,
     not day 0).
  2. **Crisis-routing is undefined — direct conflict with GUIDANCE-FRAMEWORK Part 7.** Part 7's
     red-flag protocol promises: crisis language → "simultaneous parent alert bypassing quiet hours
     with verbatim quote." The access spec promises: revoked parents lose *all* future access. A
     14-year-old revokes both parents on day 0, writes crisis language on day 9 — who gets the
     Tier-3 alert? Both locked documents cannot be true at once. This is the highest-severity
     inconsistency in the whole package. My recommendation (spec change §4-B below): **at the moment
     of revoke, the teen must designate a trusted adult for safety alerts** (name + contact, teen's
     choice, can be a non-parent). Tier-3 alerts route there. It must be collected — not optional —
     because an undefined route defaults to nobody, which is how the worst case happens.
  3. **The consequence copy is honest but incomplete.** "Your grades will stop updating. Mom and Dad
     will be notified today." Add: "This only changes Pookie. Your school will still send your
     parents grades and messages directly." (§1-A copy.)
- **Required:** all three before any 13–15 user can revoke.

### §4 Age tiers — 16–17 instant revoke
- **⚠️ needs change.** Instant + reversible is developmentally right (my juniors and seniors run
  their own college process). Keep it. But the crisis-routing gap (§4-B) applies identically — a
  16-year-old in crisis with revoked parents is the same fact pattern with fewer guardrails. The
  trusted-adult designation must apply at 16–17 too, collected at revoke time.
- **Required:** §4-B (trusted-adult designation) extended to 16–17.

### §4 Age tiers — 18+ continuity default
- **🛑 blocked as written.** I concur with the legal review's 2B: **default-ON disclosure of
  education records to parents after rights transfer is the clearest violation in the spec.**
  My practice-side addition: FERPA-in-practice is messier than "rights transfer at 18" because
  Georgia districts behave inconsistently — many keep ParentVUE live for parents through graduation
  regardless of the student's 18th birthday, and schools routinely disclose to parents of
  *dependent* students under § 99.31(a)(8). So the app cannot promise the student "your parents
  are cut off at 18" either — the school may still tell them. The honest design: **at 18, Pookie
  pauses parent access and requires affirmative opt-in** (no pre-selected default; dismiss = paused,
  re-grantable), **and** the prompt discloses that the school's own parent communication is separate
  and district-controlled. Both directions of the misunderstanding must be closed.
- **Required:** replace "skip = continuity" with "dismiss = paused"; add the school-channel
  disclaimer to the 18th-birthday prompt.

### §5 Child linking methods
- **✅ clear**, with one counselor note: the consent screen's "visible data" list must include
  **check-in text and mood data explicitly** — not buried under "health." Teens differentiate
  "my grades" from "my journal." If the list says "check-ins" and the teen doesn't realize that
  means their freeform writing, the consent is not informed. Name it: "your daily check-in writing
  and mood pulses."
- **Required:** exact naming in the consent list (copy fix, not a redesign).

### §6 "Go independent"
- **⚠️ needs change.** Graduation framing is excellent adolescent psychology — autonomy as
  achievement, not rupture. Two fixes: (1) the crisis-routing designation (§4-B) must be part of
  the independence flow too — a 14-year-old with "their own Pookie" and no trusted adult on file
  is the isolated-teen fact pattern; (2) the flow should offer, not assume, continued parent
  access to *school-only* data — many of my students want Mom off their mood check-ins but are
  fine with her seeing grades. Per-category sharing (school vs. wellbeing vs. health) turns a
  binary rupture into a negotiated boundary, which is the actual developmental task.
- **Required:** per-category sharing options in the independence flow; trusted-adult designation.

### §7 "Just me" mode
- **✅ clear.** Genuinely good — no notes from the counseling side.

### §8 Database migrations
- **⚠️ needs change.** Add to the migration plan: (1) `trusted_adults` table (child_id,
  name, contact, relationship, designated_at, source 'revoke'|'independence'|'settings') —
  required by §4-B; (2) `sharing_audit_log` (actor, action, target, granted_by, timestamp) —
  required by §3; (3) a retention-policy column set at creation for check-ins/emails — indefinite
  retention of teen freeform writing is a counseling-record problem as well as a legal one: I
  would never keep unredacted student journals forever, and neither should the app.
- **Required:** the two tables before revoke/independence flows ship; retention defaults now.

### §9 API surface
- **⚠️ needs change.** Add `designateTrustedAdult(childId, {name, contact, relationship})` and
  `getSharingAuditLog(childId)` RPCs. Also: `revokeAccess` must *require* a trusted-adult
  designation (or explicit "I choose no one, and I understand Pookie will not alert anyone in a
  crisis" acknowledgment) before it executes — the API must not permit a revoke that leaves the
  crisis route undefined.

### §10 UI screens
- **⚠️ needs change.** The Sharing screen's consequence list is good informed-consent design.
  Extend per §1-A (school-channel disclaimer) and §4-B (trusted-adult picker inline at revoke).
  Add to screen 3: a persistent "who gets alerted if I'm in crisis" line — the teen should be
  able to see and change it anytime, not only at revoke.

### §11 Risks & mitigations
- **⚠️ needs change.** The table omits the risks this review identifies. Add rows 9–12:
  | # | Risk | Mitigation |
  |---|---|---|
  | 9 | Crisis-routing undefined when parents are revoked — GUIDANCE-FRAMEWORK Part 7 Tier-3 alert has no recipient | Mandatory trusted-adult designation at revoke/independence; route defined before revoke executes; disclosed in UI |
  | 10 | In-app revoke misread as legal/school cutoff — false privacy for teens, false grievance for parents | "Pookie-only" qualifier on every revoke surface; onboarding disclosure; school-channel disclaimer copy |
  | 11 | Counselor emails merged into parent-visible teacher inbox — ASCA B.2 confidentiality breach, chills student help-seeking | Segregated counselor channel, default teen-private, explicit disclosure rules |
  | 12 | AI-drafted teacher emails sent in parent's voice — misrepresentation, unintended school consequences | Parent-authored or substantially edited; no auto-send; teacher-reply routing defined |

---

## PART 2 — CONCRETE SPEC CHANGES (quote → replacement)

### Change A — New standing disclosure (applies to §1, §2, §4, §10)
**Add as a spec-wide copy block** (shown at onboarding Step 2, on the Sharing screen, in every
revoke confirmation, and in the 18th-birthday prompt):
> **Sharing choices in Pookie only change what Pookie shows.** They do not change what your school
> sends to your parents — report cards, portal access, and messages from teachers and counselors go
> out through the school's own systems no matter what you choose here. If your parent has their own
> school portal login, they will still see your grades there.

### Change B — §4: crisis-routing precedence (new subsection §4.5)
**Add after the 18+ subsection:**
> **Crisis alerts override access revocation.** The safety tripwire defined in GUIDANCE-FRAMEWORK
> Part 7 (Tier-3 crisis language → immediate alert) is a safety function, not a sharing preference,
> and it is not revoked when parent access is revoked. **Before any revoke or go-independent action
> executes**, the teen designates a trusted adult (name + contact + relationship) who receives
> safety alerts. If the teen declines to designate anyone, they check: "I understand that if I
> write something indicating I may harm myself, Pookie's crisis resources will be shown to me, but
> no adult will be alerted." The designation is visible and changeable anytime on the Sharing
> screen ("Who gets alerted if I'm in crisis"). API: `revokeAccess` and `goIndependent` require a
> completed trusted-adult step.
>
> **Rationale (counselor):** In every Georgia high school, imminent-risk disclosure overrides
> confidentiality — ASCA B.2.2, and every district crisis protocol I have worked under. An app that
> promises teens a crisis tripwire (Part 7) and then leaves the alert with no recipient after a
> revoke has built the worst of both worlds: the teen believes someone is watching, and nobody is.
> The designation preserves teen agency (they choose *who*) while keeping the safety promise
> the product already made.

### Change C — §3 matrix: fix the grandparent deadlock + court orders
**Current:**
> | Revoke access a parent granted | ✅ own grants only | ✅ own grants only | ❌ |
**Replace with:**
> | Revoke access a parent granted | ✅ any grant on own record | ✅ own grants only | ❌ |
> | Court/educational-decision order on file | Matrix adjusted per verified order (human review) | — | — |
**Add note:** "The child may revoke any grant on their own record regardless of granter; adults
may revoke only grants they made. A verified court order governing educational decision-making
supersedes this matrix; submit via Settings → Family → Legal documents (human review, not
self-serve)."

### Change D — §4 18+: affirmative opt-in (replaces continuity default)
**Current:**
> **Parents who had access keep access by default.** No birthday disruption. … Skipping = continuity.
**Replace with:**
> **At 18, parent access to the young adult's Pookie pauses** until they affirmatively opt back in.
> First login after the 18th birthday shows: "You're an adult now — your Pookie is fully yours.
> [Mom] [Dad] used to see your info. Keep sharing with them?" [Keep sharing] / [Not now]. No
> pre-selected default; dismissing without choosing = paused, re-grantable anytime in Settings →
> Sharing. The prompt includes the Change-A school-channel disclaimer, because district parent
> portals may continue independently of Pookie.
**Rationale:** FERPA rights transfer to the student at 18 (20 U.S.C. § 1232g(d)); default-ON
disclosure without affirmative consent is the spec's clearest statutory exposure, and several
Georgia districts already gate 18-year-old records behind student consent in their own portals —
the app must not be more permissive than the school.

### Change E — §8 migrations: add the two tables
Add to the migration table:
| Migration | Contents |
|---|---|
| `021_trusted_adults.sql` | `trusted_adults` (child_id, name, contact, relationship, designated_at, source); RLS: teen + parents-with-access read, teen writes |
| `022_sharing_audit_log.sql` | `sharing_audit_log` (child_id, actor_id, action, target_id, granted_by, created_at); RLS: teen reads own; append-only |

---

## PART 3 — FEATURE VERDICTS (every feature, counseling lens)

### 1. CORE PLATFORM
| Feature | Verdict | Note |
|---|---|---|
| Google OAuth + magic link | ✅ clear | — |
| Session management | ✅ clear | — |
| Onboarding flow | ⚠️ needs change | Add Change-A disclosure + guardian attestation (§2 above) |
| 5-tab navigation (plain English) | ✅ clear | Plain words are the right call for teen + parent usability |
| Child switcher | ✅ clear | — |
| Nebula theme | ✅ clear | Teen engagement is a counseling asset; keep the "alive" interactivity |
| `/verify-invite` public landing (no login) | ⚠️ needs change | Must not render the child's name, school, or photo to an unauthenticated viewer — token-gated minimal page only; verify no PII in meta tags/OG |

### 2. POOKIE AI ASSISTANT
| Feature | Verdict | Note |
|---|---|---|
| Pookie chat (warm tutor) | ✅ clear | Guidance Framework guardrails are strong; keep tier enforcement server-side |
| Muse toggle (direct, "unfiltered") | ⚠️ needs change | Framework bars Muse for under-16s — verify at worker ingress, not UI. Rename "unfiltered" → "direct": "unfiltered" is a litigation exhibit (see Character.AI cases in legal review); directness is the feature, unfiltered-ness is the liability |
| pookie-tutor worker + fallback | ✅ clear | — |
| Weekly open-ended teacher discussion threads (Muse drafts, parent approves) | 🛑 blocked | See Part 4 — must not exist as designed |
| Proactive nudges | ✅ clear | Framework's invitation-rules (one nudge/one cause/one action) are exactly right |

### 3. TODAY
| Feature | Verdict | Note |
|---|---|---|
| Morning ritual | ✅ clear | — |
| Tonight's plan | ✅ clear | — |
| Check-in cross-check (self-report vs synced data) | ⚠️ needs change | See Part 4 — rebuild as teen self-reflection, not parent lie-detection |

### 4. THE 31 MODULES
**Body & Heart**
| W2 Health (teen privacy tiers) | ⚠️ | Tiers must be explicit in the Sharing screen's what's-visible list — esp. which tier sees check-in *text* vs aggregates. Health data withheld from parents (meds, menstrual, mental-health patterns) needs a teen-facing "your parent can't see this, but your doctor/school nurse can if you show them" bridge — counselors see teens hide health info from everyone, not just parents |
| W8 Wellbeing (teenPrivate mood pulse) | ⚠️ | Direction is right and the tripwire disclosure at onboarding is required (framework has it — keep). But: the 3-week "persistent pattern → parent looped in" escalation must appear in the Sharing screen's what's-visible list or consent is uninformed. Also define what happens to the escalation when that parent is revoked — routes to trusted adult per Change B |
| W13 Meals | ✅ | — |
| W22 Activity | ✅ | — |
| W23 Nutrition (wired to Restaurants taste profile) | ⚠️ | Framework bans calorie targets/weight-loss dieting for teens — enforce at the recommender: restaurant suggestions must never filter by "low-calorie" for a teen profile. Verify this in build, not copy |
**Home & Family**
| W21 Mail intake | ✅ | — |
| W20 Shopping List | ✅ | — |
| W11 Spending (bank categorization) | ⚠️ | If a teen's own accounts are connected, their purchase detail must be teenPrivate by default — a parent-visible itemized feed of a 16-year-old's spending is a trust-killer and, frankly, none of the app's business without consent |
| W7 Money & Documents | ✅ | — |
| W24 Credit (3-bureau) | ⚠️ | Minor-identity-theft monitoring is genuinely valuable (foster and blended-family cases especially). But a teen should be *told* their credit is being monitored and why — no silent surveillance, even benevolent |
| W14 Co-parenting | 🛑 blocked | See Part 4 — needs custody-order awareness and per-household data boundaries before it coordinates anything |
| W12 Babysitters | ✅ | — |
| W10 Fairness lens | ⚠️ | Comparing children on "equity" is gasoline in sibling dynamics. Frame as parent self-reflection ("am I distributing attention?"), never as a child-visible scoreboard |
**School Days**
| W1 School (live) | ✅ | The gap-to-90 mission framing is exemplary counseling psychology — lead with agency, not verdict |
| W16 School Calendar | ✅ | — |
| W5 College & Future | ⚠️ | See Part 4 — HOPE/Zell Miller math must be GSFC-core-GPA; essays feedback-only; simulator honesty rules |
| W4 Activities | ⚠️ | Location/practice schedule of a minor must be teen-visible and teen-consented. Add GHSA eligibility tie-in: Georgia athletes must pass 5+ subjects — the app already has the grades; surfacing "eligibility at risk" is a legitimate counselor-style nudge |
| W18 Summer | ⚠️ | See Part 4 — vetting, learning-loss, transition content |
**Safe & Sound**
| W3 Safety | ✅ | — |
| W19 Emergency | ✅ | Put 988 + Crisis Text Line directly in the emergency plan, not just the AI footer |
**Growing Up**
| W6 Driving & Life Skills | ⚠️ | Must encode **Georgia TADRA rules** (Class D at 16; nighttime and passenger restrictions phase by age/license tenure) and update per state. A generic "driving progress" checklist that ignores TADRA teaches illegal driving |
| W15 Screen Time | ✅ | Co-created limits only — imposed limits get evaded; the framework's autonomy principle applies |
| W17 Friends (teenPrivate) | ⚠️ | "Social world tracking" is the highest-trust-risk non-crisis feature. Keep teenPrivate *strict*: no parent aggregates, no friend-list exports, opt-in sharing only. A parent-visible friends module will be used for surveillance and teens will know it |
**Out & About**
| W25 Fuel & Charging | ✅ | — |
| W26 Weather | ✅ | — |
| W27 Events | ⚠️ | "Family-fit" curation for events involving minors: no age-inappropriate venues in a teen's feed; date-night content must not render on a 13–15 profile |
| W28 Restaurants | ✅ | Subject to the W23 nutrition guardrail |
| W29 Trails & Parks | ✅ | — |
| W30 Flights | ⚠️ | Encode minor-traveler rules: unaccompanied-minor policies differ by airline (Delta's UM program ends at 14; a 15-year-old flies alone but with ID/documentation needs). Don't assemble a family trip that strands a teen at check-in |
| W31 Rental Cars | ⚠️ | Under-25 surcharges and minimum-age rules (21+ most agencies, 25 without fees) must be in the total-cost ranking or the "total cost" is fiction |

### 5. SCHOOL INTELLIGENCE (W1 detail)
| Feature | Verdict | Note |
|---|---|---|
| 13 data sources w/ named owners | ✅ | Ownership transparency is excellent |
| Per-class pages (gap-to-90 hero) | ✅ | — |
| Path-to-90 checkboxes → Supabase | ✅ | — |
| Daily check-in + handout uploads | ⚠️ | Check-ins feed the crisis protocol — the tripwire disclosure must live *in* the check-in UI, not just onboarding. Uploaded handouts: fine for personal study use |
| **Teacher inbox per class (teacher + counselor + Outlook 365 + Synergy merge)** | 🛑 blocked | See Part 4 — counselor mail must be segregated |
| AI practice quizzes from uploads | ✅ | Keep the "educate, never diagnose" boundary (Education Framework has it) |
| Peer tips pipeline (600/wk, 4-wk expiry) | ⚠️ | See Part 4 — de-label "peer," fence the content domain |
| SAT prep | ✅ | — |
| Daily pulls (lunch/dinner/power-up/notes/news/horoscope) | ✅ | Horoscope is entertainment; harmless. Keep it clearly labeled |
| Sync workers (StudentVUE via Playwright) | ✅ | — |
| ParentVUE/CTLS Parent/teacher Gmail pulls | ⚠️ | **Other-student privacy:** teacher emails CC'd to parents routinely mention other students' grades/behavior — those are *those students'* education records. The pull pipeline must redact or segregate content about non-linked students before it lands in any parent-visible surface. This is the FERPA-in-practice issue schools actually get sued over |

### 6. FAMILY & ACCESS
| Feature | Verdict | Note |
|---|---|---|
| Email invite → verify | ✅ | Per §5 note on naming check-in text in consent |
| Link codes | ✅ | — |
| Child access authority | ⚠️ | Per Part 1 (court orders, deadlock fix, Change-A disclosure) |
| Age tiers | 🛑/⚠️ | 13–15 🛑 (retaliation + crisis routing); 16–17 ⚠️ (crisis routing); 18+ 🛑 (affirmative opt-in) |
| Sharing screen | ⚠️ | Add Change-A disclaimer, trusted-adult line, per-category toggles |
| Access request flow | ✅ | — |
| Block list (teen blocks adult) | ⚠️ | Needs the court-order override path — a teen cannot block a parent with court-ordered educational access via self-serve; route to human review |
| Go independent | ⚠️ | Per §6 (per-category sharing + trusted adult) |
| 18th-birthday prompt | 🛑 | Per Change D |
| graduate_child_access RPC | ✅ | — |
| Claim dedupe | ✅ | — |

### 7. SETTINGS & DATA
| Feature | Verdict | Note |
|---|---|---|
| Settings → Profile/Sync/Health/Credentials/Family | ✅ | — |
| Sync console | ✅ | — |
| Credentials vault (portal logins) | ⚠️ | At 18+ opt-in (Change D), the *parent-connected* school credential must not keep feeding the parent's view — credential ownership transfers to the young adult; the data-source handoff in the spec is right, make it mandatory not guided |
| Notification preferences | ✅ | — |
| Data retention (check-ins indefinite, emails TBD) | 🛑 blocked | "Emails TBD" + "check-ins indefinite" cannot ship. Set now: check-in freeform text — teen-deletable anytime, auto-purge option (e.g., 12 months rolling, teen-configurable); merged school emails — retention tied to the school year + 1, then purge. Indefinite retention of a minor's journaling is a counseling-records problem, not just a legal one |

### 8. API PLATFORM
| Feature | Verdict | Note |
|---|---|---|
| GET /api/v1/me | ✅ | — |
| /children/[id]/school/* | ✅ | — |
| teacher-messages (+approve/send) | 🛑 blocked | Tied to the AI-teacher-thread block — no send path until parent-authorship rules ship |
| /children/[id]/college/* deadlines | ✅ | — |
| essays (+feedback) | ⚠️ | Feedback-only; hard block on full-draft generation (academic integrity — see Part 4) |
| /household/*, /invites/*, /tutor/* | ✅ | — |
| Notifications API | ✅ | — |

---

## PART 4 — FEATURES THAT SHOULDN'T EXIST AS DESIGNED (with replacements)

### 1. Weekly open-ended AI-drafted teacher discussion threads — 🛑 do not ship as designed
**The design:** "Muse drafts, parent approves" open-ended discussion threads with teachers.
**Why it fails (counselor):** (a) *Misrepresentation.* A teacher reads that email as the parent's
voice, judgment, and intent. AI-drafted "open-ended discussion" about a child manufactures tone the
parent may not hold and facts the parent hasn't verified — and the parent's "approval" is a tap,
not authorship. (b) *Unintended school consequences.* Teachers are mandatory reporters; an AI-drafted
thread musing about a teen's "motivation problems" or home stress can trigger a counselor referral,
a 504 evaluation, or a DFCS call the parent never intended. I have watched vague parent emails
escalate exactly this way. (c) *Split-access incoherence.* If the teen revoked the approving parent,
whose approval queue does the thread sit in? The spec is silent.
**Replace with:** parent-authored messages with AI *proofreading and tone-check only* (grammar,
shame-free language suggestions — the framework's voice work applies here); every draft shows its
sources ("based on: Geometry gradebook 10/11, check-in 10/10"); no auto-send ever; no send path for
a parent the teen revoked (route to the connected parent or the teen, age-appropriate). Discussion
*prompts* ("3 questions worth asking Ms. Thomason at conferences") are fine — ghostwritten
correspondence is not.

### 2. Teacher inbox merging counselor emails — 🛑 do not ship as designed
**The design:** per-class inbox merges "teacher + counselor + Outlook 365 + Synergy mail."
**Why it fails (counselor):** Under ASCA Ethical Standards B.2, the school counselor's primary
obligation is to the *student*, and confidentiality has explicit limits we disclose to the student
— it is not a parent CC line. Students tell me things (family conflict, mental health, college
essays with personal trauma content) precisely because the conversation is not parent-visible.
Merging counselor correspondence into a parent-visible "teacher inbox" (a) breaches that
confidentiality, (b) will chill help-seeking the moment students learn the app exposes it, and
(c) mislabels the relationship — a counselor is not "the teacher for the class."
**Replace with:** a segregated **Counselor channel** — default teen-private; counselor messages
render there only; any parent visibility requires the *student's* explicit per-thread share (with
the ASCA limits disclosed: "your counselor may still tell your parent or the school if safety
requires it"). Never merged into the per-class teacher inbox. This is also where the
"share with my counselor" export (Part 5, gap 1) lives.

### 3. Check-in cross-check as parent lie-detector — ⚠️ redesign
**The design:** "child's self-report vs synced data, curious non-accusatory tone."
**Why it fails (counselor):** The tone instruction is good, but the *function* is surveillance:
the product detects discrepancies between what the child said and what the data shows, and the
consumer is the parent. Operant conditioning 101 — children who learn honesty gets cross-checked
stop being honest, and then you lose the check-in as a counseling data source entirely. The
framework's own red-flag protocol depends on truthful check-ins; the cross-check undermines it.
**Replace with:** the cross-check becomes a **teen-facing self-reflection** ("You said the week
felt okay, but two assignments slipped — want to look at what happened?") delivered to the *teen*,
with the parent seeing only the aggregate pattern the framework already allows. Curiosity directed
at the child builds insight; curiosity directed at the parent builds cases.

### 4. "Peer tips" pipeline — ⚠️ de-label and fence
**The design:** 600 AI-generated "peer tips"/week, unit-tagged, 4-week expiry.
**Why it fails (counselor):** They are not peer tips — they are LLM output wearing a peer costume.
Labeling them "peer" is deceptive, and peer *advice* carries a persuasion weight that study
content shouldn't borrow. Worse, an unconstrained generator will drift into mental-health,
relationship, and body-image "tips" (the highest-engagement topics), which is exactly the content
a non-clinical AI must not dispense to 13-year-olds.
**Replace with:** label "Study strategies" (never "peer tips"); hard content fence — study skills
and unit content only, zero mental-health/relationship/body content; every tip carries a source
(unit material, curriculum standard); teen-reportable with human review; the 4-week expiry is good,
keep it.

### 5. W14 Co-parenting — 🛑 do not ship as "two-household coordination" without legal grounding
**The design:** "Two-household coordination. Directly intersects access-authority model."
**Why it fails (counselor):** Half my caseload is co-parenting conflict. A coordination module with
no custody-order awareness will (a) leak one household's data to the other beyond the child's
records (schedules, new partners, addresses in calendar events), (b) let a non-custodial parent
use the child as an information channel, and (c) become a harassment surface via shared checklists
and messaging. The access spec's "parent A cannot veto parent B" rule is actively dangerous here
without a court-order layer.
**Replace with:** ship only after Change C (court-order path) exists; per-household data
boundaries (each parent sees child records + their own household's coordination items, never the
other household's); no direct parent↔parent messaging in v1 (use structured handoffs: pickup times,
school forms — data fields, not chat); every coordination item logged. When in doubt, less
coordination surface, not more.

---

## PART 5 — GAPS (missing features a counselor expects)

1. **Counselor portal / school liaison surface (the biggest gap).** The app pulls everything *from*
   the school and sends AI-drafted emails *to* teachers, but gives the actual school counselor
   nothing. Add: a teen-controlled **"Share with my counselor"** export — one-page progress summary
   (grades, trends, check-in aggregates, never raw journal text without explicit consent) the teen
   can hand to their real counselor. Schools act on what they can see; this makes Pookie's data
   clinically useful instead of a parallel universe. *(No school-side login in v1 — keep it an
   export, not a portal; a portal is a FERPA/data-agreement project for v2.)*
2. **504/IEP accommodation tracking.** The framework says "accommodate without needing the label"
   (invisible to the child) — correct. But the *parent* needs somewhere to store the 504 plan,
   track which accommodations are actually delivered per class, and log annual-review dates.
   Georgia schools are inconsistent on delivery; this is the #1 parent-counselor friction point and
   the app has nowhere for it. Add to W1 or W19.
3. **Four-year graduation audit.** W5 simulates 50 colleges but never answers "will my child graduate
   on time?" Georgia requires 23 credits with specific distributions. A credit-accumulation tracker
   against GA graduation requirements is more urgent than the college simulator for a 9th–10th grader
   — and counselors do this manually every spring. Ship it before the simulator gets more colleges.
4. **Standardized-testing calendar.** PSAT/SAT/ACT/AP registration deadlines, fee-waiver eligibility
   (free/reduced-lunch students get waivers counselors must hand out), score-send logistics. The
   SAT prep blocks exist; the *logistics* don't.
5. **NCAA eligibility track** (for W4/W5). College-bound athletes need 16 core courses + GPA/test
   sliding scale + amateurism certification. A single missed core course kills eligibility; the app
   has the transcript data and doesn't check it.
6. **Attendance intervention workflow.** Dawson's attendance is clean; the feature isn't for him.
   For the product: Georgia's truancy line is 5 unexcused absences (O.C.G.A. § 20-2-690.1). An
   unexcused-absence counter with counselor-style outreach prompts ("3 unexcused — here's the
   school's attendance letter, here's who to call") is standard counselor work the app could do.
7. **Teacher-conference scheduler.** Conference weeks are the highest-leverage parent-school contact
   of the year and currently require replying to a Synergy email. Booking + prep (the "3 questions"
   prompts from Part 4) belongs in W1.
8. **Recommendation-letter workflow** (W5). FERPA waiver decision, brag-sheet builder, request
   tracking, thank-you prompts. Counselors chase these every fall; the app should too.
9. **Evidence-based safety plan.** Beyond the 988 footer: a teen-built safety plan (warning signs,
   coping strategies, trusted contacts — the Stanley & Brown model schools use) stored in W19,
   teen-private, portable to their real counselor via the gap-1 export. This is the single highest-
   value addition to the crisis story, and it keeps the app on the *support* side of the
   monitoring line the legal review drew.
10. **Rising-9th transition content** (W18). The highest-risk academic transition in high school is
    8th→9th grade. Summer before 9th should carry transition modules (GPA math, "9th grade counts,"
    Walton-specific orientation logistics) — the framework's 9th-grade milestone content exists;
    wire it to the calendar.

---

## PART 6 — FEATURE IMPROVEMENTS (concrete, in-scope)

1. **W5 College & Future — guidance-accuracy rules:**
   - HOPE/Zell Miller simulator must use **GSFC core-GPA math** (academic courses only; Honors/AP
     weight stripped, +0.5 restored for AP/Dual Enrollment capped at 4.0; no rounding — verified
     against GSFC-published rules 2026-10-12), **not** the school's weighted GPA. Show the formula.
     Current thresholds: HOPE 3.0 core GPA + rigor courses (2015+ grads); Zell Miller 3.7 core GPA +
     1200 SAT (math+reading, single sitting) or 26 ACT composite (single sitting), or
     valedictorian/salutatorian; Zell renewal 3.3 at 30/60/90-hour checkpoints. **Re-verify against
     gafutures.org annually** — award amounts and rules change.
   - College simulator: show **net price after aid**, never sticker price alone; flag "sticker price
     is not what most families pay" — the #1 counseling correction I make with families.
   - Essays: **feedback-only mode** (structure, clarity, voice) with a hard block on generating
     draft essays; add a disclosure line about each college's AI-use policy. Writing the essay for
     the student is an integrity violation that can rescind admission.
   - The "12-yr anesthesiologist pathway": frame as *one* modeled path with branching ("if GPA
     drops below X, here is how the path changes"), never a promised trajectory.
2. **W18 Summer:** (a) vet and label camp/activity sources — never present an unvetted camp as
   endorsed; (b) summer learning-loss nudges for at-risk students (the app knows who's at risk);
   (c) rising-9th transition modules (gap 10); (d) summer-break handling must not zero-out the
   crisis routing — the trusted adult stays designated year-round.
3. **W4 Activities:** add GHSA academic eligibility monitoring (pass 5+ subjects previous semester;
   surface "eligibility at risk" from live grades); location/practice data teen-consented and
   teen-visible.
4. **W8/W2 escalation copy:** when the persistent-pattern parent alert fires, the *teen* is told
   first ("We're letting [Mom] know your check-ins have been rough for three weeks, like we told
   you at signup") — no blindside alerts. The framework implies this; make it explicit in the
   escalation spec.
5. **Teacher-reply routing:** every parent-sent school email needs a defined reply path — replies
   land in the teacher inbox, the sending parent is notified, and (if access is split) the teen
   sees that a message was sent without necessarily seeing the full text at 13–15. Define it;
   "Muse drafts, parent approves, teacher replies into the void" is not a design.
6. **Grounded-child / high-conflict-home sensitivity** (framework names Dawson's grounding as a
   Tier-1 risk multiplier — good): extend the same sensitivity to the *sharing* surfaces. A teen
   revoking a parent mid-grounding is a high-risk moment; the revoke flow should slow down
   (extra confirmation, trusted-adult emphasis), not speed up.
7. **W6 Driving:** build the GA TADRA rule engine as data (restrictions by license phase), not copy
   — it must update when the law changes, and the module must work per-state from day one since
   the product will cross state lines.
8. **W10 Fairness:** rename the parent-facing surface "Balance check" (self-reflection framing);
   never render a child-visible equity score.

---

## PART 7 — REASSESSMENT FLAGS (come back to these)

1. **After human counsel resolves the mandatory-reporter gray zone** (legal review §0.3): reassess
   whether any staff role ever reads check-ins, and whether the trusted-adult crisis route creates
   new reporting duties. The counseling recommendation (Change B) stands regardless; the *legal*
   characterization may move.
2. **After a practicing Georgia school counselor reviews the Counselor channel** (Part 4.2): ASCA
   B.2 compliance of the per-thread teen-share model needs a second practitioner, not just this
   panel seat.
3. **HOPE/Zell Miller rules annually** — re-verify thresholds, award amounts, and rigor-course
   lists against gafutures.org before every fall semester. A stale simulator misleads families
   about money.
4. **"Muse / unfiltered" branding** — reassess before any marketing. If the word "unfiltered"
   survives to the App Store page, it becomes plaintiff's exhibit A in exactly the litigation the
   legal review describes.
5. **GHSA eligibility rules and GA TADRA** — re-verify yearly; both change.
6. **The 18-year-old portal reality check** — survey how Cobb and neighboring districts actually
   treat parent portal access at 18 before finalizing Change D's copy. The spec must describe the
   real world, not the statute alone.
7. **Reassess the 13–15 cooling-off after 6 months of live data:** how many revokes, how many
   delayed-notification paths taken, any retaliation reports. If the safety check is never used,
   it's theater; if it's used often, the 7-day default needs rethinking.
8. **Reassess W14 Co-parenting scope** after Change C ships — if court-order review becomes a
   bottleneck, the module may need to launch as read-only (shared calendar of school events only).

---

## BOTTOM LINE

The access model's heart is right — teen agency, graduated by age, is better developmental practice
than either surveillance or abandonment. But three things must change before it touches a real
family: **(1)** the crisis tripwire and the revoke cannot both be true as written — define the
trusted-adult route or the safety promise is fiction (Change B); **(2)** 18+ continuity defaults
to disclosing education records without affirmative consent — pause and ask (Change D); **(3)** the
app must stop implying its revoke binds the school — say "Pookie-only" everywhere (Change A).

On features: segregate counselor mail out of the teacher inbox, kill AI-ghostwritten teacher
emails, de-label the "peer tips," and put the graduation audit and counselor export ahead of more
college-simulator polish. The product's counseling instincts (gap-to-90 framing, shame-free voice,
no-diagnosis rule) are genuinely excellent — now make the access plumbing as careful as the voice.
