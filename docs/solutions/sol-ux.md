# UX Solutions Spec — Pookie Expert-Panel Recommendations (Screens, Flows, Copy)

**Status:** design-only (no code, no deploys) · **Author:** UX solution designer · **Date:** 2026-10-12
**Source:** `ACCESS-MODEL-REVIEW-CHECKLIST.md` (18-expert panel, Georgia starting jurisdiction)
**Design system:** Nebula theme — dark cosmos `#050510`, animated starfield, pink `#f472b6` accent, subtle neon glows (soft, never harsh), divine-light touches. Mehedi's standing rules: visuals blend seamlessly with the background (no sticker/pasted look); information collapsed by default, expandable on tap; shame-free language; plain English. Copy targets **≤8th-grade reading level** wherever the panel demands it.
**Absolute positioning rule:** *"Pookie grows with your child."* Never punitive framing. Never "your teen can cut you off."

**Visual language split (used throughout):**
- **Nebula-Celebrate** — full starfield animation, confetti, pink glow. ONLY for gaining independence, milestones, happy events.
- **Nebula-Neutral** — static dim starfield, no motion, no confetti, flat slate cards. Used for all revoke/safe-exit/sensitive flows.
- **Nebula-Boring (safe-exit sub-variant)** — the same plain system sheet any boring settings change would use: no starfield accent, no glow, no emoji, no delight copy. An abuser glancing at the screen sees "account settings," not an exit event.

Component inventory notes use these shared components: `Starfield` (animated canvas bg), `GlowCard`, `CollapseRow` (collapsed-by-default expandable), `Toggle`, `Checkbox`, `PrimaryButton`, `QuietButton`, `InfoLine` (small plain-English explainer), `Sheet` (bottom sheet), `FullPageFlow` (wizard shell), `AgeGate`, `AuditLine` (timestamped "who can see what changed" line).

---

## 1. Consent Screen (§1.2.1, hardened) — `/consent/link/{token}`

**When it appears:** after email-invite → 7-day token → matching-login verify succeeds. The teen sees this and ONLY this until they act. No dashboard sneak-peek behind it.

### Screen structure (scrollable, single screen, Nebula default)
1. **Header block:** "Welcome to Pookie" (Nebula hero text, soft glow). Sub-head, ≤8th grade: "Pookie is your personal assistant. It can also share some things with your parents — but only the things you say yes to, below."
2. **Person chip:** "Sharing with: Mom (Mehedi Kamal) — your parent" + avatar.
3. **`InfoLine` (school-transparency disclosure, always visible, not collapsible):** "Heads up: your school shares grades and attendance with your parents directly — that's between them and the school, and these settings can't change it. What you choose here only controls what *Pookie* shares."
4. **Domain sections, each as a `CollapseRow` (start collapsed except School):**

   **A. School stuff** (expanded by default)
   - ☐ *My grades, report cards, and attendance — from school records*
   - ☐ *School emails and teacher messages that come through Pookie*
   - `InfoLine` under section: "This is Pookie-only. The school still shares with your parents on its own."

   **B. Health stuff** — NEVER one "health" checkbox. Each ☐ unchecked by default, teen-readable plain labels:
   - ☐ *Basics I log myself: steps, sleep, how active I am* (maps H1 shareable wellness)
   - ☐ *What I eat and my meals* (maps H1; meal content, never calories/macros language)
   - ☐ *My check-in words and my mood answers* (maps H2 teen-private default — name check-in text + mood EXPLICITLY)
   - ☐ *Body stuff and development* (maps H3 legally sensitive — e.g., puberty, weight, reproductive topics)
   - ☐ *Medical records I add (allergies, conditions, meds)*
   - `InfoLine`: "Anything you don't check stays just with you. You can change these anytime from your Sharing screen."

   **C. Location**
   - ☐ *Where I am right now, for things like ride plans and safety features*
   - `InfoLine`: "Pookie only uses your location when you turn on a feature that needs it. No location history is kept for teens under 18."

   **D. Social**
   - ☐ *My friends list and who I hang out with*
   - `InfoLine`: "Pookie never lets teens message each other. This is only the list."

5. **Footer actions:** `PrimaryButton` "Save my choices" → consent receipt screen. `QuietButton` "No thanks — keep everything private" → decline path.
6. **Audit line at bottom:** "Pookie will never re-ask about anything you decline for 90 days. You can always say yes later in Sharing."

### Consent receipt ("verified" state) — `/consent/done`
- Checkmark hero (soft pink glow, no confetti): "All set. Here's what you chose."
- Summary list with green ✓ / grey ✕ per item. `InfoLine`: "You can change any of these anytime: Profile → Sharing."
- `PrimaryButton` "Take me to my Pookie" → dashboard.

### Decline path
- Screen: plain, no guilt copy. Headline: "No problem." Body: "Everything stays private for now. Nothing about this choice is shared with your parents."
- 90-day suppression rule (enforcement owner, not UX): backend sets `consent_reprompt_blocked_until = now + 90d`; any flow that would surface the consent screen for the same domain+person must check this. The Sharing screen still allows the teen to OPT IN manually anytime — suppression only blocks *prompts*, never the teen's own action.
- Copy contract: decline copy may not use "are you sure," may not list benefits lost, may not say "your parents won't see…" as a warning. It is a dead end, politely.

### Component inventory
`FullPageFlow`, `Starfield`, `PersonChip`, `InfoLine`, `CollapseRow` ×4, `Checkbox` ×10, `PrimaryButton`, `QuietButton`, `AuditLine`, `ConsentReceiptCard`.

---

## 2. Sharing Screen ("Who can see my stuff?") — `/sharing`

**Mental model:** one screen, per person, collapsed by default. Expanding a person reveals per-scope toggles. Teen's own account default: everything visible to self; parents start at link-time defaults (Performance + Communications on; Reflection + Wellness off).

### Layout
- **Header:** "Who can see my stuff?" Sub: "You decide. Change anything, anytime. Pookie never tells anyone when you change a setting here."
- **Person cards (collapsed `CollapseRow`, one per linked adult):**
  - Row summary line shows: name, relationship ("Mom"), and a compact visibility summary: "Sees: School grades · Teacher messages" / "Sees nothing right now" — no emoji judgment.
- **Expanded person card — scope rows (each a `Toggle` with `InfoLine`):**
  1. **Performance** — "Grades, report cards, attendance, and what's due." *(school-of-record: includes firewall line below)*
  2. **Communications** — "Teacher and school messages that come through Pookie."
  3. **Reflection** — "Your check-in words, journal entries, and AI chat with Pookie." *(default OFF)*
  4. **Wellness** — "Mood answers, sleep, and activity you log." *(default OFF)*
  5. **Health sub-tiers** (only visible if Wellness is on; nested `CollapseRow` "Health details"):
     - H1 toggle: "Shareable wellness — steps, sleep, activity I log"
     - H2 line (non-toggleable text): "Mood and check-in words — always just you unless you share them one by one"
     - H3 toggle (default OFF): "Body stuff and development"
     - H0 line (non-toggleable, teen-readable): "Some health topics are never shared — not even if asked."
  6. **Travel & location** — "Where I am, for ride plans and family trips." *(own toggle, coarse-location note)*
- **The firewall line** (inside Performance + Communications sections, non-dismissible `InfoLine`, panel §1.2b.1):
  "Firewall line: your school shares grades, attendance, and official school notices with your parents directly. Pookie can't change that — it happens outside this app."
- **The NON-TOGGLEABLE safety-comms row** (panel §1.2b.3, always last, visually distinct — flat slate, no toggle affordance):
  Row title: "Safety messages — always on." Body: "Permission slips, field-trip notices, and emergency alerts from school always reach your parents. This keeps you safe and can't be turned off."
  Copy contract: never "we have to," never punitive. It is a fact, not a punishment.
- **Trusted-adult line** (top of screen, panel G1/G15): "Your trusted adult: Maya R. (aunt) — Edit." `InfoLine`: "If Pookie ever spots something unsafe, this is who we reach first — not your parents."
- **"What's visible" transparency per person:** under each expanded card, a `QuietButton` "What can Mom actually see right now?" → opens a read-only list in plain language ("She can see your Geometry grade. She can't see your check-in words."). This is the anti-suspicion affordance.

### Component inventory
`Starfield`, `GlowCard` (person cards), `CollapseRow` (person + health sub-tiers), `Toggle` ×6/person, `InfoLine`, `QuietButton`, `TrustedAdultBanner`.

**Conflict flagged:** transparency ("what can Mom see") vs safe-exit boring. Resolution: the transparency viewer is available normally; during a safe-exit or quiet-exit window it is suppressed for the revoked person (no "what can they see" while exit is processing) so an abuser can't use the teen's phone to enumerate what was cut.

---

## 3. Graduation vs Rupture UI Split (§1.5.1)

Two events, two opposite visual languages. The split is the product decision — never mix them.

### Flow A — GAINING independence ("Go independent") → `/independence/celebrate`
**Visual language: Nebula-Celebrate.** Full animated starfield, rising particles, confetti burst on final screen, warm pink glow, headline font with divine-light halo.

**Steps:**
1. **`/independence/start`** — "You're growing up with Pookie." Body (shame-free, mission framing): "Pookie grows with you. Going independent means your Pookie becomes fully yours — your space, your rules." `PrimaryButton` "Show me how it works" / `QuietButton` "Not yet."
2. **`/independence/handoff`** — Data-source handoff (panel §1.5.2): "Your school info came through your parent's login. To keep grades updating, connect your own." Options: connect my school login / skip for now (with honest consequence line: "If you skip, grades stop updating until you connect.").
3. **`/independence/trusted-adult`** — REQUIRED before anything executes (panel §1.5.3): "Name one adult you trust." (name + relationship + phone). `InfoLine`: "Only for safety — if something ever looks unsafe, Pookie reaches them first."
4. **`/independence/confirm`** — Summary of what changes, plain language. `PrimaryButton` "Yes — make my Pookie mine."
5. **`/independence/celebrate`** — Confetti + starfield bloom: "This is yours now." / "Your own Pookie, your own rules. Pookie grows with you — all the way." `PrimaryButton` "Explore my Pookie."

### Flow B — REMOVING a parent (rupture) → `/sharing/remove/{person}`
**Visual language: Nebula-Neutral.** Static dim starfield, no animation, no confetti, flat slate cards, no emoji, no glow on buttons. Deliberately calm and boring.

**Steps:**
1. **Entry:** Sharing screen → person's card → "Remove access" (quiet red-outline button, no alarm icon).
2. **Consequence screen** (see §6 for the full cooling-off confirmation design): per-scope consequences, firewall line, alternatives.
3. **Safe-exit branch** (see §7): "Telling my parents could put me at risk" checkbox → immediate cutoff + suppressed notification + crisis resources.
4. **Confirmation:** "Done." (period, no exclamation). "Mom no longer sees your stuff in Pookie. What your school shares with her directly hasn't changed." No confetti. No celebration. No "you did the right thing" (don't narrate the teen's feelings).
5. **Post-revoke teen view:** the person's card collapses to "No access" — grey, flat, one line. Audit event recorded (teen-visible in their own audit log; never shown to the revoked parent).

**Rule (absolute):** never render Nebula-Celebrate components inside a rupture flow, and never render rupture-neutral copy inside a graduation flow. Safe exits are visually BORING by design — a celebration screen glimpsed by an abuser is a safety failure, not a design bug.

### Component inventory
Celebrate: `Starfield` (animated), `ConfettiBurst`, `CelebrateHero`, `HandoffCard`, `TrustedAdultPicker`. Rupture: `NeutralSheet`, `ConsequenceList`, `SafeExitCheckbox`, `PlainConfirmCard`. Never shared.

---

## 4. 18th-Birthday Prompt + §1.6.4 Quiet Exit

### The unavoidable decision — `/adult/decision` (not a banner, not dismissible)
**Trigger:** first app open on/after 18th birthday (or postsecondary enrollment, whichever first; emancipated minors get it at emancipation). Full-screen takeover. No X. No "later." Back button disabled. This is the one screen in the app that cannot be swiped away.

**Copy (≤8th grade):**
> "You're an adult now — your Pookie is fully yours."
>
> "Today your Pookie switches to adult mode. Here's who can see your stuff right now:"
>
> Person rows with ✓/— per scope: "[Mom ✓ grades · ✓ messages · — check-ins] [Dad ✓ grades · — messages · — check-ins]"
>
> **Health section (panel §1.6.2 — affirmative opt-in, skip = private):**
> "Your health info needs a fresh yes from you. If you skip, it stays private — nothing about your body or health is shared until you say so."
> ☐ *Keep sharing my health basics (steps, sleep, activity) with [Mom]*
> (unchecked by default; H3 body/development is a separate explicit opt-in, never bundled)
>
> **School data (panel §1.6.1):** "Your school logins were connected through your parents. To keep grades updating, reconnect them as your own." [Reconnect now] / [Do this later — grades will pause until I do]
>
> **Actions:** `PrimaryButton` "Keep as is" · `PrimaryButton`-secondary "Review sharing" (→ Sharing screen) · `QuietButton` "Make everything private quietly" (→ quiet exit, below)
>
> Footer: "You can change any of this anytime. Nothing here notifies anyone except what you choose below."

**School-credential pause rule:** ongoing parent-credential pulls MUST pause at this moment until the adult student re-auths (FERPA transfer). The screen says so plainly: "Grade updates are paused until you reconnect — your old info is still here."

### Quiet exit — "Make everything private quietly"
- **Screen:** Nebula-Neutral. No preview of who gets notified. Headline: "Make everything private quietly." Body: "This removes everyone's access to your Pookie right now — parents, family, everyone. They'll get a plain, neutral message later today. No announcement, no celebration, nothing dramatic."
- **Effects:** immediate revoke of all child_access rows (server-side, instant). Notification: delayed (e.g., +6 hours), neutral template: "Pookie update: [First name]'s sharing settings changed. Some things you used to see are no longer shared." No reason given. No timestamp of the teen's action. No celebration UI anywhere in the flow.
- **After:** teen lands on dashboard. A single quiet line in their audit log: "You made your Pookie private. 2 people were notified later with a neutral message."
- **Conflict flagged (transparency vs safety-boring):** the delayed notification is intentionally vague, which trades parent transparency for teen safety. Panel §1.6.4 + welfare explicitly require this trade. The notification must not say "quietly" or "at their request for safety" — both leak motive. Template above is final.

### Component inventory
`TakeoverFlow`, `AccessSummaryTable`, `HealthReconsentCard`, `CredentialHandoffCard`, `QuietExitSheet`, `NeutralSheet`.

---

## 5. Onboarding Flow — `/onboarding/*`

**Rule:** skippable everywhere. Every step has "Skip" except the legal gates (guardian attestation, DOB gate), which are required *only on the branch that needs them*.

### Step 1 — Welcome (`/onboarding/welcome`)
- Nebula hero: "Meet Pookie — the assistant that grows with you." Sub: "Your day, your family, your plans — in one calm place. It takes 30 seconds to start."
- `PrimaryButton` "Get started" · `QuietButton` "Skip — take me in"
- No feature list, no marketing wall. One screen.

### Step 2 — Display name (`/onboarding/name`)
- "What should Pookie call you?" [text input] · `InfoLine`: "Just a display name. You can change it anytime."
- `PrimaryButton` "Continue" · `QuietButton` "Skip"

### Step 3 — Add children? (`/onboarding/children`)
- "Do you want to add children to your Pookie?" Three big cards:
  - **"Add a child"** → child-creation sub-flow
  - **"Just me"** → dashboard, zero upsell. Screen copy after choosing: "Got it — just you. Your Pookie is all yours." (Psychologist rule: never upsell parenting to childless users. The "add child" affordance stays in Settings → Family for later, unprompted.)
  - **"Skip for now"** → dashboard
- **At "Add a child" — guardian attestation (panel §1.1.2, REQUIRED):** checkbox, unchecked default:
  "☐ I am this child's parent or legal guardian."
  Cannot continue until checked. Copy contract: no legalese; this sentence is the whole gate.
- **At "Add a child" — one-line school-transparency disclosure (panel §1.1.2, REQUIRED), always visible:**
  "Heads up: schools share grades and attendance with parents directly. Pookie settings only control what Pookie shares — not what the school shares."
- Child creation asks: first name, birthdate (DOB picker — drives age tiering), relationship. Birthdate is required (age tiering can't attach without it).
- **DOB gate for direct teen self-signup:** if the person signing up enters a DOB showing age 13–17 on the *self* signup path, the flow branches to teen onboarding: teen protections attach (Sharing screen, cooling-off, safe exit), and a parent-link step is offered but NOT required. Under 13 on self-signup: blocked with plain copy — "Pookie accounts are for ages 13 and up. A parent or guardian can create a family profile for you instead." (Technical guarantee per COPPA, not just policy.)

### Step 4 — Dashboard
- Lands on Home tab. First-run coach marks: one `InfoLine`-style tip, dismissible, never a tour.

### Component inventory
`FullPageFlow`, `Starfield`, `NameInput`, `ChoiceCards` ×3, `GuardianAttestationCheckbox`, `InfoLine` (school disclosure), `DOBPicker`, `TeenBranchGate`.

**Conflict flagged:** "skippable everywhere" vs required attestation/DOB. Resolution: skip is available on every *optional* step; the attestation checkbox and birthdate are *gates inside the child-creation branch only* — skipping the branch skips the gate. The teen self-signup DOB gate cannot be skipped because teen protections legally depend on age; the alternative offered is the parent-created path.

---

## 6. Cooling-Off Confirmation (§1.4.2) — ages 13–15 revoke of a parent

**Entry:** Sharing screen → person card → "Remove access" → (age 13–15) → this screen. Ages 16–17 skip cooling-off (instant, reversible).

### The confirmation screen — `/sharing/remove/{person}/confirm`
**Visual: Nebula-Neutral.** Calm, no red alarms, no guilt.

**Copy blocks (≤8th grade):**
> "Remove Mom's access?"
>
> **What changes if you do this:**
> - "Her grade updates stop. She won't see new grades, report cards, or what's due."
> - "Her teacher-message updates stop."
> - "Your check-ins, journal, and chats with Pookie stay private — they already are."
> - "Safety messages from school (permission slips, emergencies) still reach her. That part can't be turned off."
>
> **The school line (REQUIRED, panel §1.4.2):** "Pookie-only: your school still shares grades and attendance with your parents directly. This only changes what Pookie shares."
>
> **Before you decide — other options:**
> - "Narrow it instead — turn off one thing, like location, and keep the rest."
> - "Pause for 30 days — everything freezes, nothing is deleted, and it turns back on by itself unless you say otherwise."
> - "Talk it through — write down what's bothering you first. [Open a private note]"
>
> **Who gets told, and when:**
> - ○ "Tell her now" — "She gets a message right away."
> - ● "Tell her when it takes effect" (default) — "She gets a plain message in 7 days. Only her — not the whole family."
>
> ☐ "Telling my parents could put me at risk." → (safe-exit branch, §7 — immediate cutoff, no notification, crisis resources)
>
> [Keep Mom's access] · [Remove after 7 days]

**Trusted-adult gate (panel §1.5.3/G1, REQUIRED before execution):** if the teen hasn't named a trusted adult yet, the confirm button opens: "One thing first — name an adult you trust." (name + phone). "Only for safety. If something ever looks unsafe, Pookie reaches them first — not your parents." The revoke cannot execute without this OR the teen explicitly checking "I understand no adult will be alerted" (the G1 contradiction resolution — crisis alerts must have somewhere to go).

### Pending-state teen view — `/sharing` during the 7-day window
- The person's card shows a quiet status line, teen-visible ONLY: "Removing in 6 days · Cancel anytime." `QuietButton` "Cancel" (one tap, no confirm — cancellable by design).
- Countdown copy updates daily ("5 days…"). No push notifications about it (avoid lock-screen leakage).
- **Data rule during the window:** no new parent-visible syncs (frozen at pre-revoke state — see §10 for the parent view). The teen's own app keeps working normally.
- If the teen chose "tell her now," the notification goes immediately and the card shows "Mom was told today. Access ends in 6 days."
- Safe-exit choice bypasses all of this (immediate, §7).

### Component inventory
`NeutralSheet`, `ConsequenceList`, `AlternativeCards` ×3, `NotifyChoice` (radio), `SafeExitCheckbox`, `TrustedAdultGate`, `PendingStatusLine`, `CancelButton`.

---

## 7. Safe-Exit Path UI

**Entry point:** the "Telling my parents could put me at risk" checkbox inside the revoke confirmation (§6) AND a persistent, quiet entry in Settings → Safety → "If home isn't safe" (so a teen can find it without starting a revoke).

### Screens — `/safe-exit/*` — **Nebula-Boring: maximum plainness**
No starfield accent. No pink. System-default sheet styling. If someone looks over the teen's shoulder, it reads as "notification settings."

**Screen 1 — `/safe-exit/start`:**
> "If telling your parents could put you at risk, you can cut off sharing right now — quietly."
>
> "What happens:"
> - "All sharing with your parents stops immediately."
> - "They don't get a message about this."
> - "Your safety messages from school still reach them."
>
> [Cut off sharing now] · [Go back]
>
> Below the fold (small, calm): "If you're in crisis or need help right now: Call or text **988** (Suicide & Crisis Lifeline) · Text HOME to **741741** (Crisis Text Line)."

**Screen 2 — confirm (one extra tap, no typing, no password — speed matters):**
> "Cut off sharing with Mom and Dad right now?"
> [Yes, cut it off now] · [Go back]

**Screen 3 — after (`/safe-exit/done`):**
> "Done. Your sharing is off."
>
> "What you see now:"
> - "Your parents see nothing new in Pookie."
> - "No message was sent to them."
> - "Your trusted adult is [name]. Pookie can reach them if something looks unsafe."
>
> "Help, whenever you need it: **988** call/text · Text HOME to **741741** · [Find local help]"
>
> [Back to my Pookie]
>
> `InfoLine`: "This is in your private history only. It doesn't show up anywhere your parents can see."

### Design rules (absolute)
- Visually boring by design. No celebration, no confetti, no "you're brave" copy (don't narrate; don't create evidence of intent an abuser could find meaningful).
- No push notification, no email receipt, no home-screen badge from this flow.
- Audit event recorded with reason code `safe_exit`, teen-visible in their own audit log; never surfaced to the revoked parent (panel §1.3.6).
- The flow must complete in ≤3 taps from the checkbox.

### Component inventory
`BoringSheet` (system-style, no Nebula accents), `PlainList`, `CrisisResourceBlock` (988 / 741741 / local-help link), `TwoTapConfirm`.

**Conflict flagged (transparency vs safety-boring):** the audit trail (§1.3.6) says grant/revoke events are teen-visible, and parents normally get fact-only notifications. Safe exit deliberately breaks both: no parent notification at all, suppressed everywhere. Resolution per panel §1.4.1: teen safety outranks notification transparency; the DV-advocate copy review (§5 gate 4) must sign off on every string in this flow before launch.

---

## 8. Anti-Coercion Confirmation (Link Codes)

**When it appears:** in the 6-digit link-code redeem flow — AFTER the code validates, BEFORE the account links. This is the last private moment. Screen: `/link/redeem/confirm`.

**Visual:** Nebula-Neutral, calm. Not an interrogation.

**Copy (≤8th grade):**
> "One quick check — just between you and Pookie."
>
> "Did you choose to link your account, or did someone tell you to?"
>
> ○ "I chose this myself" → [Continue linking]
> ○ "Someone told me to do this" → [This wasn't my choice]

**Branch A — "I chose this myself":** continue to the consent screen (§1). The answer is logged (audit, reason code `coercion_check_passed`) and never shown to the inviting adult.

**Branch B — "Someone told me to do this":**
- The link does NOT complete. The code is consumed (can't be retried by the coercer).
- Screen (`/link/redeem/not-my-choice`), Nebula-Boring:
  > "That's okay. Nothing was linked."
  >
  > "You don't have to link your account because someone told you to. If you want to, you can do it later — on your own."
  >
  > [Talk to a trusted adult] (opens trusted-adult picker / crisis resources)
  > [Learn about your privacy choices] (→ teen-readable "what linking means" page)
  > [Leave]
  >
  > Small, calm: "Need help right now? Call or text **988** · Text HOME to **741741**."
- The inviting adult sees only: "This code was used." — never which branch the teen took, never that the teen declined.
- Optional trusted-adult ping: offered, never automatic — "Want Pookie to let [trusted adult] know someone pressured you? Only if you say so." [Yes, tell them] / [No].

### Component inventory
`NeutralSheet`, `CoercionChoice` (two big plain buttons), `NotMyChoiceScreen`, `TrustedAdultPingOffer`, `CrisisResourceBlock`.

**Related hardening (for the enforcement owner, surfaced here):** brute-force lockout on code entry; same-device redemption flagged in the audit log (welfare) — the UI shows the teen nothing about this; it must not tip off a coercer watching the screen.

---

## 9. Popup Menu Age-Gating

**Menu model:** 6 popup categories (Health, Home, School, Safety, Travel, Marketplace), 28 modules (W10/W17 removed). Age-gating applies at the module-tile level; categories remain visible.

### Gating rules table

| Module | Rule | What the teen sees |
|---|---|---|
| W24 Credit | Hidden <18. Re-scoped anyway to minor security-freeze management (O.C.G.A. §§ 10-1-914/914.1) + credit-hygiene coaching. 18+ sees the freeze-management module. | Not rendered. No placeholder, no "locked" tile (a locked tile teaches teens what they're missing and invites workarounds). |
| W30 Flights | Hidden from teen accounts entirely (13–17). Purchaser-of-record must be 18+ (server-side invariant). | Not rendered for <18. Adults see full module. |
| W31 Rental Cars | Hidden from teen accounts entirely. Under-21 → planning mode only for adults 18–20. | Not rendered for <18. |
| W6 Driving & Life Skills | Visible 13+. GA DDS rules surfaced in-module: learner's permit at 15, Joshua's Law 30-hr requirement, provisional Class D at 16 (midnight–5AM + passenger restrictions), full Class C at 18. Digital driving-log for Joshua's Law hours. Under-15 sees "getting ready" content (study guides, what to expect) — no permit actions. | Age-aware content sections; a "Your Georgia timeline" card computed from DOB. |
| W23 Nutrition | <18: weight-neutral framing only; NO calorie/protein/weight-loss logging; NEDA resources linked; clinician gate for anything beyond general food learning. 18+: full module. | <18 sees "Food & fuel" (learning + meal ideas); logging features hidden, not "locked." |
| W8 Wellbeing | All ages; marked "Teen-private space" (already in code — keep). Never parent-visible incl. aggregates (§11). | Unchanged; keep the badge. |
| W2 Health | Blocked until H0–H3 taxonomy ships (panel). After: H0 content never renders <18. | Gated behind tier completion. |
| W27 Events | 18+/21+ events filtered by default <18; audience modes (Family/Teen/Grown-up); per-event age tags. | Filter chips default to Teen/Family for <18. |
| W28 Restaurants | 21+/bar-primary excluded <18 (see §14). | Excluded silently for <18. |
| W29 Trails & Parks | No solo-hike recommendations <16; group-size/supervision guidance; dusk check. | Recommendations carry supervision labels. |
| W22 Activity | <18: no streaks, no calorie-burn display, no leaderboards; rest-day normalization. | Features hidden, not footnoted. |
| W15 Screen Time | 13+: co-set (teen proposes, parent approves) + teen appeal path. Device-level agents banned <13. | Co-set UI. |
| W26 Weather | Coarse location default <18; "not an emergency-alert system" disclaimer. | Disclaimer line. |
| W13 Meals | <18: no calorie budgeting/moralizing language. | Copy audit. |

### Empty-state: category with no visible modules
If age-gating empties a category (e.g., a 14-year-old opening Travel with W30/W31 hidden):
- The category still opens (no dead tap).
- Empty-state card, Nebula-Neutral, plain: "Nothing here for you right now." Sub: "Some parts of Pookie unlock as you get older. Pookie grows with you." — growth framing, never "you're too young" (shame-free).
- Suggest one adjacent module that IS visible ("Meanwhile, Driving & Life Skills has your Georgia permit timeline.").

### Component inventory
`AgeGate` (wrapper), `ModuleTile`, `CategoryPopup`, `EmptyCategoryCard`, `GeorgiaTimelineCard` (W6), `AudienceFilterChips` (W27).

---

## 10. Revoke Pending State — Parent View (Cooling-Off, 13–15)

**The rule:** during the 7-day cooling-off window, the parent's UI shows access as UNCHANGED. No "revoking in 6 days" banner. No countdown. No hint. The parent must not be able to distinguish "teen is revoking" from "nothing is happening."

### Exactly what the parent sees
- Dashboard, grades, messages: render exactly as before the revoke was initiated, with data frozen at the pre-revoke snapshot.
- "Last updated" timestamps: continue to display the frozen timestamp honestly (e.g., "Updated 2 days ago") — do not fake freshness, do not backdate. Staleness is allowed to look like staleness; it must not look like an event.
- Sharing/Family screens: the teen's card shows the same toggles as before, in the same positions. Tapping a toggle the parent could previously use: still works locally but the change is queued and silently held (applied only if the teen cancels the revoke; discarded if the revoke completes). The parent is never told a change was held.
- Notifications: no new parent-visible syncs during the window (data-freeze rule). No "sync paused" notice. Push digests continue on their normal schedule but with frozen data.
- What the parent does NOT see: no banner, no countdown, no "changes pending," no email, no audit entry, no change in the "what can I see" transparency view.

### Data-freeze rule (for the enforcement owner)
- At revoke initiation: snapshot `parent_visible_snapshot` per scope. All parent surfaces read from the snapshot until the window resolves.
- If the teen cancels: snapshot discarded, live syncs resume, queued parent toggle-changes apply. The parent experiences this as "nothing happened."
- If the window completes: access rows revoked; parent surfaces switch to the no-access empty state ("[Name]'s sharing changed. Some things you used to see are no longer shared." — neutral, no reason, no timestamp of the teen's action).
- The teen is told the freeze exists (their pending view says "Mom sees your old info until this takes effect — nothing new goes to her").

### Component inventory
`ParentDashboard` (unchanged), `FrozenTimestamp` (honest staleness), `HeldToggleQueue` (silent), `NoAccessEmptyState` (post-window, neutral copy).

**Conflict flagged:** honest timestamps vs undetectability. A sharp parent may notice "Updated 6 days ago" and infer something. Resolution per panel: staleness without explanation is acceptable; a banner explaining it is not. Do not add "sync delayed" copy — that copy is itself a signal.

---

## 11. W8 Wellbeing Crisis Ladder UI (Teen-Facing)

**Hard rule:** never parent-visible, including aggregates. No parent dashboard card, no "wellbeing summary," no anonymized trend the parent can see. The module carries the "Teen-private space" badge permanently.

### The ladder — what the teen sees at each rung

**Rung 1 — Bad day (single low check-in):** the check-in screen itself responds warmly, in place. No new screen, no escalation UI.
> "Rough day. That counts as data, not failure."
> [Want a 2-minute reset?] (breathing / walk / music — teen picks) · [Just log it]

**Rung 2 — Pattern (low mood 3+ days in 7, or flagged words):** a gentle in-module card appears at the top of W8 (Nebula-Neutral, no alarm styling):
> "You've had a few heavy days in a row. Want to look at what's been going on?"
> [See my pattern] (private trend, teen only) · [Talk it through with Pookie] · [Not now]
> `InfoLine`: "This is just for you. Nobody else sees this — not your parents, not your school."

**Rung 3 — Crisis signals (self-harm language, hopelessness markers, explicit ask):** full-screen, Nebula-Neutral, immediate:
> "We're really glad you told Pookie."
>
> "You don't have to handle this alone. Right now you can:"
> - [Call or text 988] (tel:988 — one tap)
> - [Text HOME to 741741] (sms:741741)
> - [Tell my trusted adult] ([name] — one tap, pre-written message the teen can edit: "Hey, I'm having a really hard time and wanted you to know.")
>
> `InfoLine` (REQUIRED, panel G2/G10 — what AI does/doesn't promise, teen-readable):
> "Pookie isn't a therapist and private spaces here aren't safety-monitored. If you tell Pookie you might act on these thoughts, Pookie will reach your trusted adult — that's the one promise it keeps. It never promises 'just between us.'"
>
> [I'm okay for now] (dismisses; pattern monitoring continues) · [Back to my check-in]

**988 integration placement:** Rung 3 is the primary surface (one-tap call/text buttons, not links). 988 also lives persistently in W8's header as a small "Get help" button and in the safe-exit flow (§7). Never as a dismissible banner.

### Retention & honesty rules
- No indefinite retention: teen-deletable entries, rolling auto-purge option in W8 settings ("Delete my check-ins older than [30/90 days]").
- The "private spaces are not safety-monitored" line appears once at W8 first run and inside Rung 3 — plain, no legalese.

### Component inventory
`CheckinResponder` (Rung 1 inline), `PatternCard` (Rung 2), `CrisisScreen` (Rung 3, full-screen), `OneTapHelpButtons` (tel:988 / sms:741741), `TrustedAdultTellSheet` (editable pre-written message), `TeenPrivateBadge`, `RetentionPicker`.

---

## 12. Morning Ritual Disclosure — "How This Was Chosen" (TX SCOPE Alignment)

**Affordance:** every morning-ritual card (and tonight's-plan card) carries a small, quiet affordance: a "Why this?" text-button under the card content (not an icon — icons get missed; not a banner — banners get dismissed).

**Interaction:** tap "Why this?" → bottom `Sheet`, Nebula-Neutral:
> "How this was chosen"
>
> Plain-language recipe list, e.g.:
> - "Because you have a Geometry test Thursday (from your school calendar)."
> - "Because you logged a rough day yesterday (your check-in — only you see this)."
> - "Because it's Tuesday — library days are usually quieter for you."
> - "Pookie didn't use: your messages, your location, anything your parents see."
>
> Footer: "Nothing here is an ad. Pookie doesn't sell your data."

**Design rules:**
- The disclosure lists *actual inputs used*, in plain language, with source labels ("from your school calendar," "your check-in"). No "our algorithm" hand-waving.
- The "didn't use" line is required — it teaches the privacy boundary every morning.
- Reading level ≤8th grade. One sheet, no nested links except "Learn more" → privacy page.

### Component inventory
`WhyThisButton`, `ChoiceDisclosureSheet`, `InputSourceLine` (icon + plain text + source tag).

---

## 13. Child Switcher Data Hygiene

**The rule (panel Category 1):** per-child data purge on switch. The next child's data must never render inside the previous child's frame — no bleed-through, no flash of the wrong grades.

### What the user perceives
1. **Tap switcher → immediate full-screen loading state.** Not a spinner on the old screen — the old child's content is *replaced instantly* by a Nebula loading veil (dim starfield + "Switching to [Name]…" + soft shimmer). The old data is unmounted before the veil lifts. There is no moment where Child A's grades sit under Child B's name.
2. **Veil copy:** "Switching to [Name]…" — first name only. No data preview, no skeleton of the incoming content (skeletons of the wrong shape leak structure).
3. **Veil duration:** minimum 600ms (prevents flicker-bleed on fast switches), lifts only after the new child's data is bound AND the old child's in-memory store is cleared.
4. **After:** the new child's Home renders fresh. Scroll position resets to top. Any open sheets/cards from the previous child are closed.
5. **Failure case:** if the new child's data fails to load, the veil shows: "Couldn't load [Name]'s space. [Try again]" — never falls back to showing the previous child's data.

### Perceived-performance note
Purge-then-load is slower than crossfade. That's the trade, stated plainly: correctness (no bleed-through) beats speed here. The 600ms veil makes the wait feel intentional rather than broken.

### Component inventory
`ChildSwitcher`, `SwitchVeil` (full-screen, unmounts old content first), `InMemoryStorePurge` (enforcement owner), `SwitchErrorState`.

---

## 14. W28 Restaurant Card Safety

### Card anatomy (Nebula theme, collapsed detail by default)
- **Header:** name, cuisine, distance, price band. "Verified live listing" check-line (small, with timestamp: "Listing verified today" — panel: no hallucinated restaurants).
- **GA DPH inspection score placement:** directly under the header, always visible (not collapsed): "Health inspection: 92/100 · Fulton County · Mar 2026" with a `QuietButton` "What does this mean?" → plain-language explainer. Missing score: "No inspection score on file —" stated plainly, never hidden.
- **Allergen hard-block messaging:** if the teen's health allergy list intersects the restaurant's known allergens/flags: a hard-block banner (NOT a warning): "Heads up: you listed a peanut allergy. This kitchen handles peanuts — Pookie can't confirm it's safe for you." Plus: "Call ahead: (555) 014-2233." **Never** "allergy-safe," never a safety claim, never inferred allergens (panel: hard-blocks from the health allergy list only, never inferred).
- **21+/bar-primary exclusion <18:** excluded silently. The restaurant simply doesn't appear in teen results. No "hidden for your age" placeholder, no filter chip the teen can toggle off. (Same philosophy as W24/W30/W31: don't teach the boundary by displaying it.)
- **Teen night-safety bias affordance:** for teen accounts, a toggle in the module header: "Prefer well-lit, busy areas after dark" (default ON for <18). When on, results bias toward high-traffic, well-lit areas in the evening; the card shows a small moon-icon line: "Busy area after dark ✓." Turning it off is allowed (teen agency) but shows one honest line: "You can turn this off — Pookie will still avoid 21+ spots for you."

### Component inventory
`RestaurantCard`, `VerifiedLine` (with timestamp), `InspectionScoreRow`, `AllergenHardBlock` (banner + call-ahead), `NightSafetyToggle`, `SilentExclusionFilter` (server-side).

---

## 15. W19 Emergency Disclaimer + Break-Glass

### Disclaimer placement (panel: "not an emergency response service")
- **Module header, always visible, plain text under the title:** "Pookie is not an emergency service. In an emergency, call 911 first." — not a banner, not dismissible, not buried in settings. It sits above all module content on every visit.
- **W26 weather cross-reference:** severe-weather cards carry "Pookie isn't an emergency-alert system — follow official alerts" (mayor), linking the NWS alert + timestamp.
- Preloaded resources list (Cobb/GA): 911, Poison Control (1-800-222-1222), 988, GA Crisis & Access Line (1-800-715-4225) — one-tap call buttons.

### Break-glass medical info (independent of parental access)
**The problem:** in an emergency, a teen's allergies/conditions/meds must be reachable even if parents revoked, offline, or unreachable — and reachable by a *responder*, not just the teen.

**The access gesture — "Emergency info" from the lock-adjacent surface:**
1. **In-app:** W19 header has a persistent "Emergency info" button (medical-cross icon, high contrast). One tap → **no login re-prompt if the device session is active**; if the session expired, a 4-digit device PIN the teen set at W19 first run (NOT the parent's PIN, NOT the account password — a responder can't ask a seizing teen for a password).
2. **The break-glass card:** full-screen, high-contrast, boring-system styling (readable to a stranger, not Nebula-pretty): name, DOB, blood type (if provided), allergies (from health allergy list), conditions, current meds, emergency contacts (trusted adult first, then parents), insurance card photo (if stored). Big "Call 911" button pinned at top.
3. **QR option:** the teen can generate a printed QR ("for my backpack / phone case") encoding the same card, offline-readable. Copy: "Anyone who scans this sees your emergency info — only print it for places you trust."
4. **Independence from parental access (panel, internal medicine):** this card reads from the teen's own health record, NOT from parent-granted scopes. Revoking a parent never touches break-glass. A parent cannot disable another person's break-glass card. Audit-logged when generated/viewed (teen-visible).

### Component inventory
`EmergencyDisclaimer` (persistent header line), `ResourceCallList` (911/poison/988/GCAL), `EmergencyInfoButton`, `DevicePinGate`, `BreakGlassCard` (high-contrast, system styling), `QRGenerator`, `Call911PinnedButton`.

---

## Cross-Cutting Conflict Register

| # | Conflict | Resolution |
|---|---|---|
| C1 | Transparency ("what can Mom see") vs safe-exit boring | Transparency viewer suppressed for the revoked person during exit windows (§2). Safety wins. |
| C2 | Honest "last updated" timestamps vs parent undetectability during cooling-off | Staleness without explanation is fine; explanatory copy ("sync delayed") is itself a signal and is banned (§10). |
| C3 | "Skippable everywhere" onboarding vs required attestation/DOB gates | Gates live inside optional branches only; the teen DOB gate is unskippable because protections legally depend on age (§5). |
| C4 | Audit-trail completeness vs safe-exit notification suppression | Safe exit breaks the notification norm deliberately; DV-advocate review (§5 gate 4) must sign every string (§7). |
| C5 | Delayed neutral 18+ notification vs parent transparency | Intentionally vague template; must not leak motive (§4). Welfare requirement. |
| C6 | Consent unbundling (≤8th grade) vs enumerating clinical health subcategories | Plain-language labels map to H-tiers behind the scenes; the teen never sees "H2" (§1). |
| C7 | Celebration vs rupture | Absolute visual split; never mixed (§3). |
| C8 | Purge-on-switch performance vs no-bleed correctness | 600ms veil; correctness wins (§13). |

## Copy Contracts (Global)

1. **Reading level:** ≤8th grade everywhere the panel demands (consent, revoke, crisis, onboarding). No legalese, no "pursuant," no em dashes in teen-facing copy.
2. **Shame-free:** lead with agency ("you decide"), never judgment ("are you sure?", "you're too young", "your parents won't like this").
3. **Positioning:** "Pookie grows with your child / with you." Never punitive, never "cut off" as a headline verb (use "remove access" / "make private").
4. **Firewall honesty:** the school-transparency line appears at consent (§1), Sharing (§2), revoke confirm (§6), and onboarding add-child (§5) — the same sentence shape everywhere so it becomes a learned truth, not a surprise.
5. **No promises Pookie can't keep:** never "just between us" (G10); private spaces "aren't safety-monitored" (G2); school sharing "happens outside this app."
6. **Crisis copy:** 988 placement is one-tap call/text, never a link; the trusted-adult promise is the single safety guarantee stated; everything else is honest about limits.

---

*End of UX solutions spec. Enforcement owners (access logic, health taxonomy, legal) build the server-side invariants; this document is the screen/flow/copy contract they build against.*
