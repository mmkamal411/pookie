# Squad 3 — School Track 🌿 · UX Specs + Final Copy

**Status:** design-only (no code, no deploys) · **Author:** UX Designer, Squad 3 · **Date:** 2026-10-12
**NO PLACEHOLDERS (Mehedi directive 2026-10-12):** every flow in this spec is COMPLETE and shippable — loading, empty, error, and success states all designed, all copy final. No "screen TBD," no lorem ipsum. Where Squad 3 touches another squad's surface, the Squad 3 side of the handoff is fully spec'd (§10).
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
10. Cross-squad handoffs (Squad 3's side)

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

### 1.5 Loading states + save failures
- Estimate card while classes load: shimmer fields + "Loading your classes…" — the class picker never renders empty.
- Calibration history loading: shimmer rows. **Never flash "No guesses yet" before load completes** — the empty state renders only after a confirmed empty response.
- Estimate save fails (network): inline — "Didn't save — your check-in is fine, just the guess didn't go through." [Try again] (retry keeps the entered class + number; never clears the teen's input).
- Pair arriving late (actual syncs while history open): row animates in quietly; no push, no badge.

### 1.6 Error states
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

### 2.4 Provenance tap sheets (final copy)
Tapping either badge opens a bottom sheet (Nebula-Neutral), one screen, no nested links except "Learn more" → privacy page:
- **"School record"** → headline "Why 'school record'?" Body: "This came from your school's records. Your school shares it with your parents directly — outside Pookie. Pookie settings can't change that." [Got it]
- **"Only in Pookie"** → headline "Why 'only in Pookie'?" Body: "You made this in the app. Only you see it unless you choose to share it — you control that in your Sharing screen." [Got it]
- Badges never show loading spinners: they render with the data or not at all. If origin metadata is missing, **no badge renders** — never guess, never default to the friendlier badge.

---

## 3. Second-Parent Onboarding (FR-AUTH-011) — OPEN SIGNUP

**MD decision D5 REVISED (Mehedi override 2026-10-12):** Second parents sign up straight from the main page. **No invite required.** The "Connect to my family" first-run card is fully functional at launch. Two paths: **invite-from-inside** (deep link/QR — the fastest path, but NOT the only path) and **claim path** (corroborated claim: verified sign-in + name/DOB + creating-parent email + perjury-style + custody attestations → approval request). This is consistent with the locked user-first direction (fully automated signup for any user) — an invite-only gate would recreate the "no-invite dead end" we eliminated. Panel Round 2 safeguards are non-negotiable: no enumeration oracle (rate-limited, uniform responses — existence can never be probed); no auto-grant ever; 14-day unresponsive escalation to human review; 30-day re-request lockout after rejection. Custody posture: **STAY OUT** — Pookie does not adjudicate custody; the `court_order_restriction` flag exists for verified presented orders; disputes go to human review case-by-case.

### Design intent
Three first-run cards (Just me / Add my child / Connect to my family). "Connect to my family" offers both paths with zero dead ends. **Copy discipline is critical: no screen in the claim flow may reveal whether a child exists in Pookie** — responses, waiting states, and rejections are identical whether or not a matching child profile exists. Attestation language is plain-language (≤8th grade) but carries legal weight per FR-AUTH-011 panel guidance.

### 3.1 Flow diagram (text)

```
First run — three-card screen (/onboarding/family)
├─ Card A "Just me" → dashboard, zero upsell
├─ Card B "Add my child" → guardian attestation → DOB picker → child profile → done
└─ Card C "Connect to my family" → court_order_restriction flag set?
     ├─ YES → hidden-linking state (§3.4): calm "talk to [Parent A] directly"
     │         message — NOT an error, no self-serve UI at all
     └─ NO → choose path (§3.3):
          ├─ PATH 1 — "I have an invite" (fastest)
          │    → redeem (/invite/{token}): token validates → verified sign-in
          │    → anti-coercion check → approval (under-13: Parent A / 13+: teen)
          │    → waiting / approved / declined states (§3.5)
          └─ PATH 2 — "No invite — find my child's family" (claim path)
               → verified sign-in (required) → claim form
               → uniform response: "If this child is in Pookie, we've notified
                  the parent on record." (identical whether or not a match exists)
               → rate limits + CAPTCHA → waiting state (§3.5)
               → approval: under-13 → Parent A approves (sees provided attributes,
                  never "identity confirmed"); 13+ → teen approves (anti-coercion
                  check, 30-day lockout) + fact-only notification to Parent A (no veto)
               → Parent A unresponsive 14 days → human-review escalation w/ documentary proof
               → rejection = one-time dismissible card, no reason, 30-day lockout

Parent A side — invite screen (/family/invite): QR + copy link + share + 7-day expiry
+ cancel-invite → fact-only notification on accept
```

### 3.2 Screen-by-screen copy

**Three-card first-run** (`/onboarding/family`) — Nebula default, one screen
- Headline: "How are you using Pookie?"
- Sub: "You can change this anytime in Settings."
- Card A: **"Just me"** — "My own assistant. No kids in my Pookie." → tap → "Got it — just you. Your Pookie is all yours."
- Card B: **"Add my child"** — "I'm a parent or guardian setting up a family profile." → guardian attestation (required checkbox, unchecked default): "☐ I am this child's parent or legal guardian." + school-transparency line (§2.2).
- Card C: **"Connect to my family"** — "My child's other parent already uses Pookie. I want to join."

**PATH 1 — Invite-from-inside (Parent A's app)** (`/family/invite`) — the fastest path
- Headline: "Invite the other parent"
- Sub: "They'll join your family in Pookie. You choose what they can see."
- QR block: large QR code, centered, Nebula default (inviting is a happy, cooperative action).
- Affordances (equal weight, plain labels):
  - [Copy invite link]
  - [Share…] (system share sheet — text, message, email)
  - [Show QR code] (full-screen QR for in-person scanning)
- Expiry notice (always visible, plain): "This invite works for 7 days and can be used once. After that, make a fresh one."
- `InfoLine`: "Only send this to your child's other parent. Anyone with this link can start the joining process."
- Active-invite state: "Invite sent — waiting for them to join." [Cancel invite] (one tap, no confirm; canceling invalidates the token immediately)
- Post-accept: "They're in. You can change what they see anytime in Family settings."
- `InfoLine` after generation: "When they join, you get a plain message — that's it. Teens 13+ also get a say."
- Loading: QR block shows shimmer + "Making your invite…" — a broken or half-rendered QR never displays. Generation fails: "Couldn't make the invite — try again." [Try again]

**PATH 1 — Parent B's redeem screen** (`/invite/{token}`)
- Loading (token validating): full-screen quiet state — "Checking your invite…" with soft shimmer. No data, no names, no child info renders until the token validates.
- Valid token → headline: "You've been invited to join your family on Pookie."
- Sub: "Invited by [Parent A's first name]. Here's what happens next:"
  1. "You sign in so we know it's really you."
  2. "We check it's really your choice — nobody can force this."
  3. "Your child's other parent sees a plain message when you join. Teens 13+ approve first."
- [Continue] → anti-coercion check (sol-ux §8 wording, verbatim): "One quick check — just between you and Pookie. Did you choose to join, or did someone tell you to?" → branches per sol-ux §8.
- Expired/invalid token — gentle, non-technical: "This invite doesn't work anymore." / "Invites last 7 days and work once. Ask [Parent A's first name] to send a fresh one from Family settings." [Back to my Pookie] — Parent B's own app works fully in the meantime.

### 3.3 Path chooser + claim form (PATH 2 — open signup, first-class path)

**Path chooser** — when Parent B taps "Connect to my family" (no flag, no token):
- Card (Nebula default, warm): "How do you want to connect?"
- Two big plain buttons:
  - **"I have an invite"** — "Your child's other parent sent you a link or QR code." → helper line: "Invites open right from the message — tap the link they sent you. There's no code to type in."
  - **"No invite — find my child's family"** — "Tell us about your child and we'll send a request to the parent on record." → claim form below
- `InfoLine`: "Either way, your Pookie works fully right now — your own assistant, your own space."
- Never a code-entry field (invite codes are not discoverable; no brute-force surface).

**Claim form** (`/family/claim`) — corroborated claim, verified sign-in required
- Headline: "Request access to your child's Pookie"
- Sub: "This takes a few steps. We check everything carefully — your child comes first."
- Step 1 (verified sign-in): "First, sign in so we know it's really you." [Sign in]
- Step 2 (claim form): "Tell us about your child so we can find the right profile."
  - [Your full legal name] [Child's full name] [Child's birthdate] [Parent on record's signup email]
  - Custody attestation (required checkbox): "☐ I have the legal right to access this child's information."
  - Court-order question (required radio): "Are there any court orders that limit your access to your child?"
    - ○ "No" ○ "Yes — I'll provide documents" → (yes ⇒ self-serve disabled: "Thanks for telling us. This path needs a person to review it. [Contact support]")
  - Perjury-style attestation (required checkbox): "☐ Everything I wrote above is true. I understand that lying on this form can have legal consequences."
  - [Send request]
- Step 3 (uniform response — **identical whether or not a matching child exists**): "Thanks. **If this child is in Pookie, we've notified the parent on record.** You'll hear back within 14 days."
  - No "profile not found." No "request sent to Mom." No timing or wording difference a script can probe. Rate limits + CAPTCHA behind it.
- Submit loading: button becomes "Sending…" (disabled); on failure: "That didn't go through — try again. Nothing was sent twice." [Try again]
- `InfoLine`: "While you wait, your own Pookie works fully — 'just me' mode. Nothing here changes that."

**Claim copy contract (hard — anti-enumeration):**
- Waiting, rejection, and "heard back" states are identical for match vs no-match. The requester can never distinguish "no such child" from "parent hasn't responded" — except the rejection card, which only renders after a real decline.
- Never pre-fill, hint, or confirm any child detail back to the requester ("Is this Dawson K.?" is banned).
- Attestation sentences above are the UX recommendation — legal to confirm exact wording before launch (open question #5).

### 3.4 `court_order_restriction` — hidden-linking state (NOT an error)

When the `court_order_restriction` flag is set, there is **no self-serve linking UI at all** — no invite redemption, no code entry, no claim form. What Parent B sees instead is calm and plain, never an error screen:
- Card (Nebula-Neutral — calm, no red, no alarm icon, no "error" styling): "Talk to [Parent A's first name] directly."
- Body: "Linking accounts isn't available here right now. The fastest path is a conversation with [Parent A's first name] — they can sort this out from their side."
- What it must NOT do: no error code, no "access denied," no "restricted," no explanation of the flag, no "contact support" as the headline action (support is a small quiet link below: "Questions? [Contact support]").
- Why: Pookie does not adjudicate custody (D5 — STAY OUT). The screen must not imply a judgment was made, must not leak *why* linking is unavailable, and must not create a paper trail an abuser could screenshot as leverage. It reads as a product limitation, not a verdict.
- [Back to my Pookie] — their own app continues working normally.

### 3.5 Waiting / approved / declined states (both paths)

**Waiting — invite path** (Parent B, invite pending Parent A or teen approval):
- Card: "Waiting on [first name]."
- Body: "They've got your request. This usually takes a day or two — we'll let you know either way. Meanwhile, your Pookie works normally — your own assistant, your own space."
- Quiet line: "Changed your mind? You can cancel anytime." [Cancel request] → "Request canceled. Nothing was shared." [Back to my Pookie]

**Waiting — claim path** (uniform copy, never leaks existence):
- Card: "Request sent."
- Body: "**If this child is in Pookie, the parent on record has been notified** and has 14 days to respond. If they don't respond in time, a person reviews your request with what you provided."
- "While you wait, your Pookie works normally — your own assistant, your own space."
- Quiet line: "You can cancel this request anytime." [Cancel request] → "Request canceled." (uniform — canceling a no-match request looks identical)

**Approved** (Parent B, invite accepted or claim approved):
- Success screen (Nebula default — joining family is warm, cooperative): "You're in."
- Body: "You're now connected to [child first name]'s Pookie. You can see what [Parent A first name] chose to share. Want to change what's shared? Ask them — they manage it in Family settings."
- [Explore my Pookie] → dashboard.
- `InfoLine`: "Teens 13+ approved this too — their sharing choices stay theirs."
- No auto-grant, ever: approval is a human tap (Parent A or teen) on every path.

**Declined — invite path** (one-time, dismissible, no reason):
- Card (Nebula-Neutral, no red, no alarm): "Not this time."
- Body: "This invite wasn't approved. We can't share why — that's between the people who decided. Your own Pookie still works fully."
- [Got it] — dismisses permanently; no lock-screen trace.
- Copy contract: never name the decider ("your teen said no" is banned), never give a reason, never suggest re-asking. A fresh invite from Parent A starts a new 30-day window.

**Rejection card — claim path** (one-time, dismissible, no reason)
- Card (Nebula-Neutral, no red alarm): "Your request wasn't approved."
- Body: "We can't share why — that protects your child's privacy. This decision is final for 30 days, then you can request again."
- [Got it] (dismisses permanently — never re-shown, no lock-screen trace)
- Small: "Questions? [Contact support]" — never "appeal," never a reason.
- 30-day re-request lockout enforced server-side; the claim form shows "You can request again after [date]." if attempted early — no detail beyond the date.

**Approval branches — claim path**
- Under 13: Parent A sees an "Access request" card with the attributes Parent B *provided* — labeled "what they told us," never "identity confirmed." [Approve] [Decline]. No reason shared either direction.
- 13+: the **teen** approves — anti-coercion check (sol-ux §8 wording), 30-day lockout after approval (no re-request). Parent A gets a fact-only notification: "Another parent was granted access to [first name]'s Pookie." — no veto, no reason.
- Parent A unresponsive 14 days → human-review escalation: requester sees "Your request is being reviewed by our team. We'll be in touch — this can take a few more days." Documentary proof requested via support channel, never in-app upload demands.

**Error states**
- CAPTCHA fail: "That didn't go through — try again." (no "suspicious activity" language)
- Rate limit hit: "Slow down — you can try again in a bit." (no countdown precision; no hint whether a match exists)
- `court_order_restriction` flag on file: "This needs a person to review. [Contact support]" — no explanation of the flag.
- Expired invite link: "This invite expired. Ask for a fresh one." (no countdown, no token details)
- Already-used invite: "This invite was already used. Ask for a fresh one." (identical shape to expired — no enumeration of *who* used it)
- Sign-in fails mid-redeem: "That didn't go through — try again. Your invite is still good."
- Approval screen fails to load (network): "Couldn't load this right now — nothing was decided yet. Your invite is still good." [Try again] (never default to approved or declined on error)

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
- Feed loading: shimmer cards. **Never flash the empty state before load completes.**
- Feed empty: "No sparks right now. New study ideas land here each week — and they're always about *how* to study, never about you."
- Feed error: "Couldn't load today's sparks. Your saved ones are fine." [Try again]
- Expired sparks vanish silently (4-week TTL, hard-deleted) — no "deleted" tombstones.

**Report + provenance sheets (final copy)**
- "Spotted something off? [Tell us]" → one tap → inline confirm: "Thanks — we'll take a look." (auto-dismisses; no form, no follow-up questions)
- Tapping "Made by Pookie AI · checked Oct 12" → sheet: headline "Where this came from" — "The study-skills library — techniques reviewed by teachers. Technique: retrieval practice. Review: auto-checked, teacher-sampled weekly. This spark expires Nov 9." [Got it]

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
- First enable → one-time confirm sheet: "Turn on Direct Mode?" / "Same safety rules — blunter answers. You can turn it off anytime." [Turn on] [Keep Pookie warm]
- Enabled state: "Direct Mode is on — same safety rules, blunter answers." (quiet line under the toggle; no celebration)
- Disabled: "Back to Pookie's usual style."
- The toggle flips optimistically and rolls back with "Didn't switch — try again." only on confirmed failure (never a hanging spinner).

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
- Teacher send: tap → button becomes "Sending…" (disabled, no double-tap). Success: "Sent. They'll see it as a question from you."
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

### 7.4 Trusted-adult tell — full send states
- [Tell my trusted adult] ([name]) → editable message sheet: pre-written "Hey, I'm having a really hard time and wanted you to know." (teen can edit freely) → [Send] → sending: button becomes "Sending…" → sent: "Sent. [Name] will see this soon." [Back to my check-in]
- Send fails: "Didn't send — try again. The 988 buttons above work right now." (never leave the teen with no working option)
- No trusted adult named yet: the button reads [Name a trusted adult] → inline picker (name + relationship + phone, one screen) → then the message sheet above. 988/741741 buttons always render regardless — help is never gated on the picker.

### 7.5 Abuse-disclosure handling (G10 — AI disclosure contract)

- First chat (under-18) / on topic detection — the AI says: "I'm Pookie, an AI — not a person or a therapist. Most of what you tell me stays between us, but if you tell me someone's hurting you, or you're thinking about hurting yourself, I can't keep that private. I'll bring in help — always 988 (call/text) and the Crisis Text Line (text HOME to 741741) first, and a trusted adult you choose."
- On disclosure: "Thank you for telling me — that took guts. I need to be straight with you: I can't keep this just between us, because your safety matters more than secrecy. Here's what happens now: [router steps]. You deserve support from a real person: call/text 988 anytime."
- **Banned phrases (classifier + prompt enforced):** "just between us," "I promise I won't tell," "this stays here," any absolute confidentiality claim.
- Crisis routing goes to the **teen-nominated trusted adult**, never to a revoked parent. `watch`/`urgent` ⇒ trusted-adult path; `imminent` ⇒ router's emergency path. No auto-parent-notification absent imminent risk.

### 7.6 Crisis copy rules (absolute)
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
7. **Enumeration leakage:** the claim flow is not an oracle — responses, waiting states, and rejections are identical whether or not a matching child exists. Never confirm, hint, or pre-fill child details back to the requester ("Is this Dawson K.?" is banned). Invite expired/used states are worded identically.
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
| `InviteScreen` | Parent A: QR display + copy link + share sheet + 7-day expiry + cancel-invite + generation loading | §3.2 Path 1 |
| `RedeemScreen` | Parent B: token-validating loading + valid/invalid/expired states + verified sign-in + anti-coercion check | §3.2 Path 1 |
| `ConnectPathChoice` | "I have an invite" / "No invite — find my child's family" — no code-entry field | §3.3 |
| `ClaimForm` | verified-sign-in gate → child identify fields → custody + perjury attestations → uniform response + submit loading | §3.3 |
| `ClaimWaitingCard` | uniform waiting copy ("if this child is in Pookie…") + cancel | §3.5 |
| `RejectionCard` | one-time dismissible, no reason, 30-day lockout + early-retry date line | §3.5 |
| `HiddenLinkingCard` | `court_order_restriction`: calm "talk to [Parent A] directly" — Nebula-Neutral, never error styling | §3.4 |
| `ApprovalCard` | provided attributes labeled "what they told us" (never "confirmed") | §3.5 under-13 branch |
| `SparkCard` | body + persistent `ai_label` + provenance tap + report affordance | §4 |
| `DirectModeGate` | 18+ only render; help article for <18 encounters | §5 |
| `LabPulseCard` | lab-day trigger, safety-card radio, anonymous Q box, teacher-send + confirm, skip | §6 |
| `CheckinResponder` | Rung 1 inline warm response | §7.1 |
| `PatternCard` | Rung 2, Nebula-Neutral, teen-only | §7.2 |
| `CrisisScreen` | Rung 3 full-screen: one-tap 988/741741/trusted-adult + honesty line | §7.3 |
| `TrustedAdultTellSheet` | editable pre-written message | §7.3 |

**Server-side contracts the frontend depends on (backend owners):** parent-blocked calibration queries + serializer blocklist (§1.4); invite token lifecycle (single-use, 7-day expiry, cancel invalidates; expired/used responses indistinguishable) (§3); claim flow: uniform responses regardless of match + rate limits + CAPTCHA + no auto-grant + 14-day unresponsive → human review + 30-day post-rejection lockout (§3); `court_order_restriction` suppresses ALL self-serve linking UI (§3.4); 4-week spark TTL + hard delete (§4); 18+ Direct Mode gate with API 403 (§5); lab-day trigger flags (§6); crisis event emission → router (§7).

---

## 10. Cross-Squad Handoffs (Squad 3's side)

**Rule:** no Squad 3 surface blocks on another squad's surface. If dependency data is still loading, Squad 3 renders its own content with skeleton placeholders for the dependent line — never a dead screen, never "TBD," never a seedling placeholder on a Squad 3 scope.

| Squad 3 surface | Dependency (other squad) | What the user sees while it loads |
|---|---|---|
| Calibration card (§1) | None — teen-only, zero dependency on Sharing/grants | Renders regardless; shimmer rows until data arrives |
| Provenance badges (§2) | Data origin metadata (backend) | Badge renders with the data or not at all; unknown origin → no badge (never guess) |
| Firewall line (§2.2) | Sharing screen copy (Safety/access squad owns that screen) | Squad 3 renders the identical sentence on its own surfaces; consistency is by contract, not by shared component |
| Lab pulse teacher-send (§6) | Teacher contact directory | Send button shows "Loading…" disabled while directory loads; teacher missing → fallback copy ("Add them in the School tab first") — the button never dead-ends |
| Invite/redeem/claim (§3) | Family settings + access-request state (Platform/Safety) | Squad 3's routes (`/onboarding/family`, `/family/invite`, `/invite/{token}`, `/family/claim`) render fully on their own; only token validity + approval state are read remotely, with the loading states in §3.5 |
| Crisis screen (§7) | Trusted-adult record (Safety) | If trusted adult not yet named: the [Tell my trusted adult] button becomes [Name a trusted adult] → inline picker (name + phone) → then the pre-written message sheet. The 988/741741 buttons always render — help is never gated on the picker |
| Study Sparks feed (§4) | Spark pipeline (backend) | Shimmer cards; empty state only after confirmed-empty response |

**Ownership boundary:** Squad 3 owns every string on its surfaces, including lines that describe other squads' concepts (Sharing, Family settings). If the owning squad renames a surface, Squad 3's copy contract requires a copy-review pass — the strings above are final until that review happens.

---

## Open questions for the parent agent
1. Confirm 90-day default check-in retention vs shorter 30-day default for under-16 (open in sol-school-ai too).
2. Confirm horoscope quarantine vs outright drop (open in sol-school-ai).
3. Should the claim-path 14-day unresponsive window show the requester a countdown, or keep it vague ("within 14 days") to avoid lock-screen/date leakage?
4. DV-advocate copy review (sol-ux §5 gate 4) must sign every string in safe-exit-adjacent flows before launch — schedule owner?
5. (D5 REVISED) The attestation sentences in §3.3 are the UX recommendation — plain-language with legal weight per FR-AUTH-011 panel guidance. Legal to confirm the exact perjury/custody wording before launch.

*End of Squad 3 UX specs. Frontend engineer: build against this document's copy verbatim — the strings above are final. Flag any string that can't ship as-written rather than paraphrasing it.*
