# Squad 3 — School Track 🌿 · UX Specs + Final Copy

**Status:** design-only (no code, no deploys) · **Author:** UX Designer, Squad 3 · **Date:** 2026-10-12
**Sources:** `docs/BUILD-SPECIFICATION.md` (FR-SCHOOL-001/003, FR-AI-001/002, FR-AUTH-011) · `docs/solutions/sol-ux.md` (15 screen specs) · `docs/solutions/sol-school-ai.md` (§5 calibration, §3 Study Sparks, §6.2 lab pulse, §§12–13 crisis)
**Design system:** Nebula theme — dark cosmos `#050510`, animated starfield, pink `#f472b6` accent, subtle neon glows (soft, never harsh), divine-light touches. Never flat, never harsh.
**Reading level:** all teen-facing copy targets ≤8th grade. No legalese. No em dashes in teen copy. "Pookie grows with you" is the absolute positioning line; never punitive, never "cut off" as a headline verb.

> **The old lie-detector framing is dead.** Everything in this document designs its opposite: self-discovery, teen ownership, curiosity without accusation.

---

## Contents
1. Check-in calibration UX (FR-SCHOOL-003 — PANEL-MANDATED)
2. Provenance transparency indicators (FR-SCHOOL-001)
3. Second-parent onboarding flow (FR-AUTH-011)
4. Study Sparks honest framing (FR-SCHOOL-004)
5. Muse gate for under-18 (FR-AI-002)
6. Lab-safety pulse (inside morning check-in)
7. Crisis routing UX (FR-AI-001 · FR-AI-005)
8. Cross-cutting rules (empty/error states, anti-patterns, never-do list)
9. Component inventory for the frontend engineer

---

## 1. Check-in Calibration UX — "Your Estimating Game" (FR-SCHOOL-003)

### Design intent (read before building)
The panel blocked the parent-facing lie detector. What ships is a **teen-owned metacognition tool**: the teen estimates near-term outcomes at check-in; when the synced actual grade arrives, the app shows how close the estimate was — framed as a **skill that gets sharper with practice**, never as honesty surveillance. The crisis protocol depends on truthful check-ins, and honesty that gets punished stops. So this feature must *feel* like a private game, not a test.

**Iron rules:**
- Teen-only. Never parent-visible (server-enforced: parent queries blocked; see §1.4).
- Estimates are **always optional** — the teen can skip the estimate and still finish check-in.
- Copy is about the *skill of estimating*, never about honesty, lying, or truthfulness.
- The in-product guarantee (verbatim below) appears in exactly one place: the calibration card itself.

### 1.1 Flow diagram (text)

```
Morning check-in screen (teen's Today tab)
│
├─ [Free-text check-in: "How's today feeling?"]   ← existing
│
├─ ★ NEW: Optional estimate card (collapsed by default)
│    "Quick guess — did you have a quiz or test yesterday?"
│    [Choose a class ▾]  [I think I got about:  __ % ]  [Skip]
│    Rule: only ONE estimate per day. After submit → inline confirm:
│    "Got it. Pookie will check against your actual grade when it syncs."
│    (no emoji confetti; warm, quiet)
│
└─ Check-in saved → done. Nothing else appears that day.

Later: actual grade syncs (StudentVUE)
│
└─ Calibration card in "My Check-ins" (teen's Today tab history)
     Pair appears: "You guessed 80% · Actual 72%"
     Running display: "Within ±9 pts on average — your estimates are getting sharper."
     Small-n guard (<5 paired estimates): "Need a few more guesses to see your pattern."
     Guarantee line (verbatim): "Only you see this. It never appears in anything
     your parents see, and it never affects your access."
```

### 1.2 Screen-by-screen copy (final wording)

**Estimate prompt card** (collapsed `CollapseRow`, collapsed by default; tapping expands)
- Title: "Make a guess about a quiz or test?"
- Sub: "Totally optional. Pick a recent quiz or test and guess your score before the grade comes in. It's just for you — a way to see how well you can predict yourself."
- Fields: `[Class ▾]` `[I think I got: ___ %]` `[Save my guess]` · `[Skip]` (both equal visual weight — skipping must not feel like failure)
- After save, inline: "Saved. Pookie will compare when the grade syncs. No pressure — wild guesses are fine."

**Empty states**
- No estimates yet (never guessed): "No guesses yet. Next time you check in, you can guess a quiz score — or not. It's always optional."
- Estimates exist but no actuals yet: "You guessed 80% on the Geo quiz. Still waiting for the grade to sync — check back after your teacher posts it."
- Fewer than 5 paired estimates: "You've got 3 matched guesses so far. Make 2 more and Pookie can show your pattern."
- No quizzes this week: "Nothing to guess on right now. This shows up when you have recent quizzes or tests."

**Calibration display** (inside teen's check-in history, collapsed row per estimate + summary line at top)
- Summary (rolling, last 10): "Within **±9 pts** on average — your estimates are getting sharper."
- Framing bands (about the skill, never honesty):
  - Error shrinking: "Your guesses are getting closer. That's a real skill — good estimators tend to study smarter."
  - Steady: "Pretty steady. You've got a good read on yourself."
  - Still calibrating: "Still finding your range. More guesses = sharper guesses."
- Pair row: "You guessed **80%** · actual **72%** — off by 8." (Facts, no judgment. Never "you were wrong" as a headline; "off by 8" is a number, not a verdict.)
- Footer (verbatim guarantee, always visible on the calibration card): **"Only you see this. It never appears in anything your parents see, and it never affects your access."**

**Copy contract (hard):** the words *honest, honest-*, *lying, lie, truthful, caught* never appear anywhere in this feature. Estimates are "guesses." Accuracy is "sharpness." Nothing is "checked against you."

### 1.3 Retention-setting picker + delete affordances

- Location: Settings → Data → "My check-ins" (teen-owned, changeable anytime).
- Picker copy: "How long should Pookie keep your check-ins?"
  - ○ "90 days, then auto-delete" (default)
  - ○ "1 year, then auto-delete"
  - ○ "Keep until I delete them"
  - `InfoLine`: "Minor-generated content is never kept forever. Even 'keep until I delete' shows you a yearly nudge: keep or clean up?"
- Yearly nudge (manual_delete_only): "You have about 2 years of check-ins saved. Want to keep them all, or clean house?" [Keep everything] [Delete older than 1 year]
- Per-check-in delete: swipe/long-press any check-in → "Delete this check-in?" → "Deleted. It's gone from your history and can't be recovered." Parents cannot delete or restore the teen's check-ins.
- Paired estimates: deleting a check-in deletes its estimate pair too. Deleting calibration data does not delete check-in words (separate row), and vice versa.

### 1.4 Data-flow guarantee (for the enforcement owner — UX contract)

The guarantee line above is only truthful if the query layer holds it. UX contract with backend:
- `calibration_scores` and `checkin_estimates` are SELECT-blocked for every parent role, no service path, no briefing query may reference them.
- Parent-visible API serializer keeps an explicit blocklist (`calibration_scores.*`, `checkin_estimates.*`, `checkins.body` beyond granted scope).
- CI asserts a parent-scoped JWT gets 403/empty on every calibration endpoint.
- The parent's briefing is generated from a separate allowlisted projection — it cannot "accidentally" join calibration data.
- Error state if the guarantee can't be shown (backend failure): the calibration card hides itself rather than rendering without the guarantee. Never render calibration without the guarantee line.

### 1.5 Error states
- Actual grade never syncs (stale > 48h): the pair row shows "Grade hasn't synced yet — no comparison." No retry nag.
- Estimate outside 0–105 bounds: inline "Pick a number between 0 and 100." No snark.
- Weights invalid (forecast engine refuses): calibration still works (it's estimate-vs-actual only) — the two features don't share a failure.

---

## 2. Provenance Transparency Indicators (FR-SCHOOL-001)

### Design intent
The teen must always be able to tell *school-of-record* data (the school shares it with parents directly, outside Pookie) from *app-generated* data (child-authority, governed by their sharing choices). The indicators must be subtle, teen-readable, and consistent — the same sentence shape everywhere so it becomes a learned truth, not a surprise.

### 2.1 The two badges

| Badge | Meaning | Where it appears |
|---|---|---|
| 🏫 **"School record"** (small slate tag, no glow) | From the school. "Your school shares this with your parents directly — that's between them and the school, and Pookie settings can't change it." | Grades, attendance, report cards, official school notices, synced assignment lists |
| ✨ **"Only in Pookie"** (small soft-glow tag) | App-generated. "Only you see this unless you choose to share it." | Check-ins, mood answers, calibration, estimates, AI chats, practice content, teen's what-if simulator |

### 2.2 Placement rules (verbatim firewall line)
The firewall sentence appears at: consent screen school section · Sharing screen (Performance/Communications) · revoke confirmation · onboarding add-child step. Exact shape:
> "Heads up: your school shares grades and attendance with your parents directly. Pookie settings only control what Pookie shares — not what the school shares."

- Teen copy version (above). Parent version: "Grades and attendance shown here come from school records. Your school shares these with parents directly; Pookie settings only control what Pookie shares."
- **Never** "secure," "private," or "safe" about school data. Never imply the app can hide school records.

### 2.3 School-issued account disclosure (G28)
Before any school credential is connected (vault-add flow), and as a compact tag wherever school mail renders:
> "School accounts aren't private from your school. Your school email and files can be monitored by the district — Pookie can't change that. Keep personal stuff in your personal accounts."

Inbox header compact tag: **"School-monitored account."**

---

## 3. Second-Parent Onboarding (FR-AUTH-011)

### Design intent
Three first-run cards (Just me / Add my child / Connect to my family). Primary path = invite-from-inside (zero enumeration surface). Fallback claim path is hardened: verified sign-in required, perjury-style + custody attestations, uniform non-committal response, rate limits + CAPTCHA, no auto-grant ever. Every step must reassure without leaking whether a child profile exists.

### 3.1 Flow diagram (text)

```
First run — three-card screen (/onboarding/family)
├─ Card A "Just me" → dashboard, zero upsell
├─ Card B "Add my child" → guardian attestation → DOB picker → child profile → done
└─ Card C "Connect to my family" → choose path:
     ├─ PATH 1 (primary): "I was invited by my child's other parent"
     │    → "Ask them to send you an invite from inside their Pookie."
     │    → invite screen: [deep link + QR] (see §3.3)
     │    → Parent B redeems → verified sign-in → under-13? Parent A approves
     │      / 13+? teen approves (verification badges + anti-coercion check + 30-day lockout)
     │      → fact-only notification to Parent A (no veto)
     │      → Waiting state (§3.4) / Rejection card (§3.5)
     └─ PATH 2 (fallback): "I don't have an invite — request access"
          → verified sign-in (required) → claim form (§3.3)
          → uniform response: "If this child is in Pookie, we've notified the parent on record."
          → rate limits + CAPTCHA → same waiting/rejection states
          → Parent A unresponsive 14 days → human review w/ documentary proof
          → court_order_restriction flag → self-serve disabled entirely (contact support)
```

### 3.2 Screen-by-screen copy

**Three-card first-run** (`/onboarding/family`) — Nebula default, one screen
- Headline: "How are you using Pookie?"
- Sub: "You can change this anytime in Settings."
- Card A: **"Just me"** — "My own assistant. No kids in my Pookie." → tap → "Got it — just you. Your Pookie is all yours."
- Card B: **"Add my child"** — "I'm a parent or guardian setting up a family profile." → guardian attestation (required checkbox, unchecked default): "☐ I am this child's parent or legal guardian." + school-transparency line (§2.2).
- Card C: **"Connect to my family"** — "My child's other parent already uses Pookie. I want to join."

**PATH 1 — Invite-from-inside (for Parent B, inside Parent A's app)** (`/family/invite`)
- Headline: "Invite the other parent"
- `InfoLine`: "This link is private. Only send it to your child's other parent."
- [Show QR code] [Copy invite link] — deep link, single-use, 7-day expiry.
- Revoke affordance: "This invite hasn't been used yet." [Cancel invite]
- `InfoLine` after generation: "When they join, you get a plain message — that's it. Teens 13+ also get a say."

**PATH 2 — Claim path** (`/family/claim`) — hardened, reassuring
- Headline: "Request access to your child's Pookie"
- Sub: "This takes a few steps. We check everything carefully — your child comes first."
- Step 1 (verified sign-in): "First, sign in so we know it's really you." [Sign in]
- Step 2 (claim form): "Tell us about your child so we can find the right profile."
  - [Your full legal name] [Child's full name] [Child's birthdate] [Parent on record's signup email]
  - Custody attestation (required checkbox): "☐ I have the legal right to access this child's information."
  - Court-order question (required radio): "Are there any court orders that limit your access to your child?"
    - ○ "No" ○ "Yes — I'll provide documents" → (yes ⇒ self-serve disabled: "Thanks for telling us. This path needs a person to review it. [Contact support]")
  - Perjury-style attestation (required checkbox): "☐ Everything above is true. I understand giving false information can have legal consequences."
  - [Submit request]
- Step 3 (uniform response — **identical whether or not a matching child exists**): "Thanks. If this child is in Pookie, we've notified the parent on record. You'll hear back within 14 days."
  - No "profile not found." No "invite sent." No difference a script can probe. Rate limits + CAPTCHA behind it.
- `InfoLine`: "While you wait, your own Pookie works fully — 'just me' mode. Nothing here changes that."

**Waiting state** (`/family/waiting`)
- Card: "Request sent."
- Body: "The parent on record has been notified. They have 14 days to respond. If they don't, a person reviews your request with the documents you provided."
- "While you wait, your Pookie works normally — your own assistant, your own space."
- Quiet line: "You can cancel this request anytime." [Cancel request]

**Rejection card** (one-time, dismissible, no reason)
- Card (Nebula-Neutral, no red alarm): "Your request wasn't approved."
- Body: "We can't share why — that protects your child's privacy. This decision is final for 30 days, then you can request again."
- [Got it] (dismisses permanently — never re-shown, no lock-screen trace)
- Small: "Questions? [Contact support]" — never "appeal," never a reason.

**Approval branches**
- Under 13: Parent A sees the claim in their app: "Access request" card with verified attributes (name, DOB, relationship — labeled as what the requester *provided*, never "identity confirmed"). [Approve] [Decline]. Decline ⇒ rejection card above. No reason shared either direction.
- 13+: the **teen** approves — verification badges ("signed in with a verified email," "name matches"), anti-coercion check (sol-ux §8 wording), 30-day lockout after approval (no re-request). Parent A gets a fact-only notification: "Another parent was granted access to [first name]'s Pookie." — no veto, no reason.

**Error states**
- CAPTCHA fail: "That didn't go through — try again." (no "suspicious activity" language)
- Rate limit hit: "Slow down — you can try again in a bit." (no countdown precision)
- `court_order_restriction` flag on file: "This needs a person to review. [Contact support]" — no explanation of the flag.
- Expired invite link: "This invite expired. Ask for a fresh one."

---

## 4. Study Sparks — Honest Framing (FR-SCHOOL-004)

### Design intent
"Peer tips" is dead — "peer" on AI content is fabricated social proof. **Study Sparks** = short, labeled, study-skill micro-content. No spark ever claims a human wrote it. Content fence: study techniques only (spaced repetition, retrieval practice, interleaving, elaboration, dual coding, organization, exam logistics, help-seeking scripts). Never curriculum facts, health, relationships, or named people.

### Screen copy

**Spark card** (collapsed by default in the Learn feed)
- Card body (example): "Stuck on vocab? Try writing the word from memory *before* you peek at the definition. Getting it wrong first actually helps it stick."
- Tappable AI label (every card, persistent): "Made by Pookie AI · checked Oct 12" → opens provenance: origin ("study-skills library, reviewed by teachers"), technique tag ("retrieval practice"), review status.
- Card footer: "Study techniques that work — from the study-skills library, reviewed by teachers. Not from other students."

**Opt-in / empty states**
- Feed empty: "No sparks right now. New study ideas land here each week — and they're always about *how* to study, never about you."
- Expired sparks vanish silently (4-week TTL, hard-deleted) — no "deleted" tombstones.

**Copy contract (hard):**
- Never "students like you found this helpful." Never "your classmates." Never "top students do X."
- Never "science says" without the provenance tap resolving to a real source.
- Wrong answers are possible on any AI content: sparks carry "Spotted something off? [Tell us]" — one tap, no account needed to report.

---

## 5. Muse Gate — Under-18 Explanation (FR-AI-002)

### Design intent
Under-18: the mode **does not exist in the UI** (not shown, not footnoted, not "ask your parent"; API 403s regardless). The explanation below appears ONLY if the teen somehow encounters the concept (e.g., hears about it, finds an old reference) — e.g., a help-center article. It must be clear, non-punitive, and never dangle the feature.

**Help article: "What is Direct Mode?"**
- "Direct Mode is a blunter way of talking to Pookie — shorter answers, no softening. It's only for adults (18+)."
- "Why not for teens? Because blunter answers are more likely to land wrong when you're still learning how to learn. Pookie's normal mode gives you the same help — just with more care in how it's said."
- "The safety rules are identical either way. The difference is tone, not what Pookie is allowed to say."
- Growth framing: "When you turn 18, it's there if you want it. Pookie grows with you."

**Copy contract (hard):** the word **"unfiltered" never appears** — not in copy, not in code comments, not in docs. It is retired. "Direct Mode" is the only name. Never "locked," never "restricted," never "ask a parent to unlock."

**18+ opt-in toggle** (Pookie tab settings, adults only): "Direct Mode — blunter answers. Safety rules don't change." Reversible, one tap.

---

## 6. Lab-Safety Pulse (inside morning check-in)

### Design intent
One question, day-of-lab, inside the morning check-in. Teen-visible. The free-text box is Reflection-scoped (never parent-visible). A "send my question to my teacher" button routes with the teen's explicit tap — never auto-forwarded. Links the W19 lab-emergency quick-card.

### Screen copy (renders only on lab days, above the fold of check-in)

**Pulse card**
- "Lab today in **{class}**. Quick check:"
- "Did you read the safety card?" ○ "Yes" ○ "Not yet" ○ "There's no card"
- "Anything you're unsure about? (goggles, gloves, chemicals, heat)" — [free-text box]
- Sub (verbatim): "Only you see what you write here — unless you send it to your teacher below."
- [Send my question to my teacher] → confirm sheet: "Send this to {teacher name}?" → "Sent. They'll see it as a question from you." (routes through the teacher-discussion flow)
- [Skip] — always present, equal weight.
- Below: quiet link — "Lab emergency quick-card" → W19 card (what to do if something goes wrong in lab).

**When it triggers:** `class_schedule` lab-day flags or teacher announcement keyword ("lab tomorrow") — morning of, before school. If no trigger, the card simply doesn't render (no "no lab today" noise).

**Empty/error states**
- Teacher send fails: "Didn't send — check your connection and try again. Your question is saved here."
- No teacher contact on file: the send button doesn't render; instead: "Want to ask your teacher? Add them in the School tab first."

---

## 7. Crisis Routing UX (FR-AI-001 · FR-AI-005)

### Design intent
Check-in text matching crisis patterns routes to the crisis protocol — supportive, never alarming, teen-safe. Follows sol-ux §11 (W8 crisis ladder) and sol-school-ai §§12.3, 16. The teen is never told "we detected crisis language." The ladder:

- **Rung 1 (bad day):** in-place warm response on the check-in screen. No new screen.
- **Rung 2 (pattern):** gentle in-module card in W8, teen-only.
- **Rung 3 (crisis signals):** full-screen, Nebula-Neutral, immediate, one-tap help.

### 7.1 Rung 1 — in-place (check-in screen)

When a single check-in reads low:
> "Rough day. That counts as data, not failure."
> [Want a 2-minute reset?] (breathing / walk / music — teen picks) · [Just log it]

No escalation UI. No "are you okay?" interrogation. The check-in still saves normally.

### 7.2 Rung 2 — pattern card (W8 Wellbeing top)

When low mood 3+ days in 7, or flagged words (Nebula-Neutral, no alarm styling):
> "You've had a few heavy days in a row. Want to look at what's been going on?"
> [See my pattern] (private trend, teen only) · [Talk it through with Pookie] · [Not now]
>
> "This is just for you. Nobody else sees this — not your parents, not your school."

### 7.3 Rung 3 — crisis screen (full-screen, Nebula-Neutral)

When self-harm language, hopelessness markers, or explicit ask:
> "We're really glad you told Pookie."
>
> "You don't have to handle this alone. Right now you can:"
> - [Call or text 988] (tel:988 — one tap, not a link)
> - [Text HOME to 741741] (sms:741741 — one tap)
> - [Tell my trusted adult] ([name] — one tap; pre-written message the teen can edit: "Hey, I'm having a really hard time and wanted you to know.")
>
> "Pookie isn't a therapist and private spaces here aren't safety-monitored. If you tell Pookie you might act on these thoughts, Pookie will reach your trusted adult — that's the one promise it keeps. It never promises 'just between us.'"
>
> [I'm okay for now] (dismisses; pattern monitoring continues) · [Back to my check-in]

**988 placement:** one-tap call/text buttons here; also a persistent small "Get help" button in the W8 header; also in the safe-exit flow. Never a dismissible banner.

### 7.4 Abuse-disclosure handling (G10 — AI disclosure contract)

- First chat (under-18) / on topic detection — the AI says: "I'm Pookie, an AI — not a person or a therapist. Most of what you tell me stays between us, but if you tell me someone's hurting you, or you're thinking about hurting yourself, I can't keep that private. I'll bring in help — always 988 (call/text) and the Crisis Text Line (text HOME to 741741) first, and a trusted adult you choose."
- On disclosure: "Thank you for telling me — that took guts. I need to be straight with you: I can't keep this just between us, because your safety matters more than secrecy. Here's what happens now: [router steps]. You deserve support from a real person: call/text 988 anytime."
- **Banned phrases (classifier + prompt enforced):** "just between us," "I promise I won't tell," "this stays here," any absolute confidentiality claim.
- Crisis routing goes to the **teen-nominated trusted adult**, never to a revoked parent. `watch`/`urgent` ⇒ trusted-adult path; `imminent` ⇒ router's emergency path. No auto-parent-notification absent imminent risk.

### 7.5 Crisis copy rules (absolute)
- Never alarming: no red flashing, no "ALERT," no siren iconography.
- Never narrate the teen's feelings ("you're brave") or create evidence of intent an abuser could find meaningful.
- Dismissal ("I'm okay for now") is always available and never guilt-tripped. Pattern monitoring continues quietly.
- The Rung 3 screen is never parent-visible, including aggregates.

---

## 8. Cross-Cutting Rules

### 8.1 Empty & error states (global patterns)
- **Empty:** state what *isn't* there, one honest next step, growth framing ("Pookie grows with you" — never "you're too young," never "nothing to see here").
- **Error:** plain cause + one action + what was preserved. Never blame the user. Never technical jargon ("sync failed" → "Couldn't update — your saved stuff is fine. [Try again]").
- **Stale data:** honest timestamps ("Updated 2 days ago"), never fake freshness, never explanatory copy that leaks state ("sync delayed" is banned during cooling-off — §10 of sol-ux).

### 8.2 Collapsed-by-default
Every informational surface starts collapsed: estimate card, spark details, calibration pairs, provenance sheets, "Why this?" disclosures. Tap to expand. Chunky walls of text are a bug, not a style.

### 8.3 The "Never Do This" list (anti-patterns — panel-mandated)

1. **Accusatory copy:** never "are you sure?", "you were wrong," "lying," "caught," "honest" as a test word, "your parents won't like this."
2. **Parent-visible calibration:** calibration/estimates never appear in parent surfaces, briefings, digests, or nudges. Ever. (Server-blocked, not just hidden.)
3. **Fake social proof:** never "students like you," "your classmates," "peer tips," "top students do X." Study Sparks are labeled AI, always.
4. **"Unfiltered" language:** the word is retired everywhere — copy, code comments, docs. "Direct Mode," tone-only, 18+.
5. **Promises Pookie can't keep:** never "just between us," "I promise I won't tell," "this stays here"; never imply Pookie can hide school records from parents.
6. **Judgment framing:** lead with gap-to-90 (mission), not raw grade (judgment). Shame-free, curious, never accusatory — in check-in cross-checks especially.
7. **Enumeration leakage:** claim-path responses identical whether or not a child profile exists. No "not found" vs "invite sent" difference.
8. **Celebration in rupture flows:** Nebula-Celebrate components never render inside revoke/safe-exit/quiet-exit flows. Safe exits are visually boring by design.
9. **Motivation-narrating:** never "you're brave," "you did the right thing," confetti for exits. Don't narrate the teen's feelings.
10. **Dark patterns:** no benefit-listing on decline screens, no "are you sure" on privacy choices, no re-asking declined consent for 90 days, no locked-tile teasers for age-gated modules (hidden, not "locked").
11. **Notification leakage:** no push/email/badge from safe-exit or calibration; lock-screen payloads generic ("Pookie has a nudge for you" — no grades, names, health).
12. **Ghostwritten school mail:** AI proofreads parent drafts (tracked changes); it never drafts, never adds claims, never inserts deadlines.

### 8.4 Copy contracts (recap, global)
- ≤8th-grade reading level wherever the panel demands (consent, revoke, crisis, onboarding, claim path).
- Shame-free: agency-first ("you decide"), never judgment.
- Firewall honesty: the same school-transparency sentence shape at consent, Sharing, revoke confirm, onboarding add-child.
- No em dashes in teen-facing copy.

---

## 9. Component Inventory (build instructions for the frontend engineer)

Shared with sol-ux: `Starfield`, `GlowCard`, `CollapseRow`, `Toggle`, `Checkbox`, `PrimaryButton`, `QuietButton`, `InfoLine`, `Sheet`, `FullPageFlow`, `AgeGate`, `AuditLine`, `NeutralSheet`, `BoringSheet`, `CrisisResourceBlock`, `TwoTapConfirm`.

New components this spec introduces:

| Component | Props | Used in |
|---|---|---|
| `EstimateCard` | `classOptions, onSave, onSkip` — collapsed by default, one estimate/day | §1 check-in |
| `CalibrationCard` | `pairs[], summary, smallNGuard` — always renders guarantee line; hides if guarantee unavailable | §1 |
| `RetentionPicker` | `options: 90d/365d/manual, yearlyNudge` | §1.3, Settings → Data |
| `ProvenanceTag` | `variant: 'school-record' \| 'only-in-pookie'` + tap → explainer sheet | §2, all data surfaces |
| `FirewallLine` | static `InfoLine` variant, non-dismissible | §2.2, consent/Sharing/revoke/onboarding |
| `FamilyChoiceCards` | three cards: Just me / Add my child / Connect to my family | §3.2 onboarding |
| `InviteQRScreen` | deep link + QR + expiry + cancel-invite | §3.2 Path 1 |
| `ClaimForm` | verified-sign-in gate → fields → attestations → custody radio → uniform response | §3.2 Path 2 |
| `WaitingCard` | status + cancel-request | §3.2 waiting |
| `RejectionCard` | one-time dismissible, no reason, 30-day lockout | §3.2 rejection |
| `ApprovalCard` | verified attributes labeled as *provided* (never "confirmed") | §3.2 under-13 branch |
| `SparkCard` | body + persistent `ai_label` + provenance tap + report affordance | §4 |
| `DirectModeGate` | 18+ only render; help article for <18 encounters | §5 |
| `LabPulseCard` | lab-day trigger, safety-card radio, anonymous Q box, teacher-send + confirm, skip | §6 |
| `CheckinResponder` | Rung 1 inline warm response | §7.1 |
| `PatternCard` | Rung 2, Nebula-Neutral, teen-only | §7.2 |
| `CrisisScreen` | Rung 3 full-screen: one-tap 988/741741/trusted-adult + honesty line | §7.3 |
| `TrustedAdultTellSheet` | editable pre-written message | §7.3 |

**Server-side contracts the frontend depends on (backend owners):** parent-blocked calibration queries + serializer blocklist (§1.4); uniform claim-path responses + rate limits (§3); no auto-grant (§3); 30-day lockout + one-time rejection (§3); 4-week spark TTL + hard delete (§4); 18+ Direct Mode gate with API 403 (§5); lab-day trigger flags (§6); crisis event emission → router (§7).

---

## Open questions for the parent agent
1. Confirm 90-day default check-in retention vs shorter 30-day default for under-16 (open in sol-school-ai too).
2. Confirm horoscope quarantine vs outright drop (open in sol-school-ai).
3. Should the claim-path 14-day unresponsive window show the requester a countdown, or keep it vague ("within 14 days") to avoid lock-screen/date leakage?
4. DV-advocate copy review (sol-ux §5 gate 4) must sign every string in safe-exit-adjacent flows before launch — schedule owner?

*End of Squad 3 UX specs. Frontend engineer: build against this document's copy verbatim — the strings above are final. Flag any string that can't ship as-written rather than paraphrasing it.*
