# Squad 2 — Health Track 💚 · UX Specs

**Status:** DESIGN ONLY — no code, no deploys · **Author:** UX Designer, Squad 2 (Health Track) · **Date:** 2026-10-12
**Branch:** `staging-build` · **Sources:** `docs/solutions/sol-health.md` (§§2.2 review-18, 5 W8, 6.3 weight-neutral copy, plus §§1, 3, 4, 7, 8, 10 for tier/parent-view grounding); `docs/solutions/sol-ux.md` (§§1 consent, 2 Sharing, 3 graduation-vs-rupture, 4 adult decision, 6 cooling-off, 7 safe exit, 9 age-gating, 10 parent pending view, 11 W8 crisis ladder, copy contracts).
**Scope:** the teen-facing and parent-facing health UX contract. Server invariants (tiers, RLS, grants, cutover jobs) are owned by the health-data and access-model designers; this doc is the screen/flow/copy contract they build against. Crisis *response* protocol belongs to the safety designer.

## Global design language (applies to every screen below)

- **Nebula theme, no exceptions.** Dark cosmos `#050510`, animated starfield, subtle neon glows (soft, never harsh), divine-light touches. Pookie is a ball of light, an angel: warm, protective, never clinical.
- **Visual sub-languages** (defined in §5, used throughout): **Nebula-Celebrate** (gaining independence only), **Nebula-Neutral** (privacy decisions, revoke, crisis), **Nebula-Boring** (safe exit only).
- **Plain English, no metaphors** for navigation and labels. No "H1/H2/H3" codes in teen- or parent-facing copy. Internal tier names map to plain names:
  - H1 → **"Everyday wellness"** · H2 → **"Private health"** · H3 → **"Most personal"** · H0 → **"Never collected"**
- **Collapsed by default, expandable on tap.** Tier cards, person cards, and detail rows start collapsed; the teen/parent expands what they want. No walls of text.
- **Reading level:** ≤8th grade everywhere. Short sentences. No legalese. No em dashes in teen- or parent-facing copy (use periods).
- **Shame-free, always.** Lead with agency ("you decide"), never judgment. Never narrate the teen's feelings ("you're brave," "you did the right thing"). Never "are you sure," never "you're too young."
- **Positioning:** "Pookie grows with you." Never punitive. Never "cut off" as a headline verb (use "remove access" / "make private").
- **Name tokens:** `[Mom]`, `[Dad]`, `[Teen]` render as the actual linked adult's name + relationship ("Mom (Mehedi Kamal)"). Specs below use tokens.
- **Firewall honesty:** the school-transparency line appears at consent, Sharing, revoke confirm, and add-child — the same sentence shape everywhere so it becomes a learned truth: "Heads up: your school shares grades and attendance with your parents directly. Pookie settings only control what Pookie shares. Not what the school shares."
- **Under-13 note:** the consent screens below are teen-facing (13+). Under 13, steward parents see H1/H2 by stewardship; there is no teen consent UI (COPPA).

---

## 1. Consent screens — per-subcategory enumeration (never one "health" checkbox)

**Route:** `/consent/link/{token}` — after the anti-coercion check passes, before any dashboard. The teen sees this and ONLY this until they act. Shell (header, person chip, school-transparency line, non-health domains, receipt, decline path, 90-day no-re-ask) follows `sol-ux.md` §1. This section specifies the **Health** domain in full.

### 1.1 Health section structure

Domain header: **"Health stuff"** — collapsed like the other domains, expanded when the teen taps it. Intro `InfoLine` (always visible once expanded):

> "Health is split into groups below. Each group is its own choice. Anything you don't check stays just with you."

Then three tier cards (each a `CollapseRow`, start collapsed; expanding shows the enumeration). **Every checkbox starts UNCHECKED.** There is no "select all health" control anywhere.

### 1.2 Tier card 1 — "Everyday wellness" (H1)

Checkbox: ☐ **"Everyday wellness: steps, sleep, and activity"**

Expanded enumeration (concrete, plain):

> "This group is the basics your devices and logs record about your day:"
> - Steps and how active you were
> - Sleep hours
> - Resting heart rate
> - Height and water you logged
> - How often you logged meals (not what you ate)
> - Shot records your school needs on file
>
> **Who sees this if you check it:** "This means [Mom] can see: your step count, your sleep hours, and how active you were. The basics. Nothing more."
>
> `InfoLine`: "This is the least private group. It never includes your mood, your journal, your weight, or anything about your body changing."

### 1.3 Tier card 2 — "Private health" (H2)

Checkbox: ☐ **"Private health: the more personal stuff"**

Expanded enumeration:

> "This group is more personal. It stays just with you unless you check it:"
> - Weight and body measurements
> - Medications you take
> - Allergies
> - Doctor visit notes
> - Your food diary (what you ate — no calories are ever shown to anyone under 18)
> - Cycle data
>
> **Who sees this if you check it:** "This means [Mom] can also see the items above. One tap turns the whole group on or off."
>
> `InfoLine` (REQUIRED, W8 firewall): "Not included: your mood check-ins and your journal. Those stay just with you, always. Turning this on does not share them."

### 1.4 Tier card 3 — "Most personal" (H3) — NOT a checkbox

Static line, no toggle affordance, visually distinct (flat slate, lock glyph):

> **"Most personal: always just you."**
> "Some health records stay only with you. Always. There is no switch for this."
> "For example: records about care Georgia lets you consent to yourself, like STI testing or counseling. And notes about mental health care."
> "No one can turn this on. Not a parent. It is built this way."

No per-record counters ("3 hidden records" would leak existence — banned).

### 1.5 H0 line — informational, non-toggleable

> "Some health topics Pookie never collects from anyone under 18. Like genetic test results. You will not see a place to enter them."

### 1.6 Footer of the health section

> "Anything you don't check stays just with you. You can change these anytime from your Sharing screen. Pookie never tells anyone when you change a setting."

### 1.7 Consent receipt (`/consent/done`) — health rows

Checkmark hero (soft pink glow, **no confetti** — consent is a choice, not a celebration). Per-tier rows:

- ✓ or ✕ "Everyday wellness — [Mom] can see the basics" / "Everyday wellness — just you"
- ✓ or ✕ "Private health — [Mom] can see it" / "Private health — just you"
- Lock row (always): "Most personal — always just you"

`InfoLine`: "You can change any of these anytime: Profile → Sharing."

### 1.8 Decline path ("No thanks — keep everything private")

Headline: "No problem." Body: "Everything stays private for now. Nothing about this choice is shared with your parents." Dead end, politely. No "are you sure," no benefits-lost list, no warning framing.

### 1.9 Audit line (bottom of consent screen)

> "Pookie will never re-ask about anything you decline for 90 days. You can always say yes later in Sharing."

### 1.10 Who-sees-what matrix (plain language, also used on the Sharing screen)

| Group | If you leave it off | If you turn it on |
|---|---|---|
| Everyday wellness | Only you | You + the people you checked (per person) |
| Private health | Only you | You + the people you checked. Never your mood or journal |
| Most personal | Only you, always | There is no "on." Only you, always |
| Never collected | Nobody — Pookie refuses it | n/a |

### 1.11 Sharing screen — health section (teen's `/sharing`, per-person card)

Follows `sol-ux.md` §2 with the tier split corrected to the taxonomy (see §9 conflict register):

- **"Everyday wellness"** — Toggle. "Steps, sleep, and activity you log." Default: OFF on this screen (the teen opts in here or at consent).
- **"Private health"** — Toggle. "Weight, medications, allergies, doctor notes, food diary." Default OFF. Sub-line: "Does not include your mood or journal. Those are always just yours."
- **"Most personal"** — non-toggleable static line: "Some health records stay only with you. Always. This isn't something you can turn on."
- **"Never collected"** — non-toggleable line: "Some health topics are never collected from anyone under 18."
- Trusted-adult banner stays at top of Sharing: "Your trusted adult: [Name] — Edit." `InfoLine`: "If Pookie ever spots something unsafe, this is who we reach first. Not your parents."
- "What can [Mom] actually see right now?" → read-only plain-language list. Suppressed for a revoked person during exit windows.

---

## 2. W8 Wellbeing — the teen's private space

**Hard rule (restated):** W8 is never parent-visible, including aggregates. No parent dashboard card, no "wellbeing summary," no anonymized trend a parent can see. The module carries the **"Teen-private space"** badge permanently (already in code — keep).

### 2.1 Visual identity — "Sanctuary" treatment inside Nebula

The teen must FEEL this space is theirs alone. W8 gets a distinct-but-in-family treatment:

- **Accent:** soft violet (`#b7a6f5`, diffused glow) instead of the family pink. No pink anywhere in W8. Violet reads as "yours," pink reads as "family."
- **Background:** deeper, slower starfield drift (calm, not celebratory). No confetti, no particles that feel "watched."
- **Badge:** "Teen-private space" pill in the header, always visible. Tapping it opens one honest sheet: "Only you can see this space. Not your parents. Not your school. Not even in summaries. If you ever write that you might act on thoughts of harming yourself, Pookie will reach your trusted adult. That is the one promise it keeps."
- **No family color cues, no shared-module chrome.** W8 never shows the parent's avatar, name, or "shared with" affordances.

### 2.2 Mood pulse interaction

**Prompt (W8 home, top):** "How are you right now?"

Five glowing orbs in a row, plain words under each (no numbers shown; scores stored server-side):

**Great · Good · Okay · Low · Really struggling**

- Tap → the orb glows violet, soft haptic. One tap only. No "why" interrogation.
- Below (collapsed, expandable): "Want to add words? Only you will ever read this." → text field.
- Save → quiet confirm: "Logged. Just for you." No streak, no score, no chart pop.
- The pulse is **never** a required gate. Skipping is silent (no "you missed a check-in" copy — that would be surveillance framing).

### 2.3 Journal composer

- Hint text inside the empty composer: "What's on your mind? This is yours alone."
- **H3 auto-suggest:** if the entry touches mental-health care, self-harm, or eating/body-image topics, a gentle inline card appears (never a blocking modal):
  > "This sounds like something you might want in your most-private space. Want Pookie to keep it there? Only you can ever see it."
  > [Yes, keep it most-private] · [Keep it as a regular entry]
  > The teen confirms; the server applies H3 regardless (the teen cannot downgrade it).
- Per-entry delete anytime ("Delete this entry" — tombstone → hard delete per retention rules).
- Retention picker (W8 settings): "Delete my check-ins older than [30 days / 90 days / 1 year / keep until I delete them]." Default: 1 year rolling for words, per `sol-health.md` §5.2.

### 2.4 Crisis ladder — what the teen sees at each rung

**Rung 1 — Bad day (single low check-in):** the check-in screen itself responds warmly, in place. No new screen, no escalation UI.

> "Rough day. That counts as data, not failure."
> [Want a 2-minute reset?] (breathing / walk / music — teen picks) · [Just log it]

**Rung 2 — Pattern (low mood 3+ days in 7, or flagged words):** a gentle in-module card at the top of W8. Nebula-Neutral. No alarm styling, no red.

> "You've had a few heavy days in a row. Want to look at what's been going on?"
> [See my pattern] (private trend, teen only — soft violet line, descriptive words like "a few heavy days this week," no clinical labels) · [Talk it through with Pookie] · [Not now]
>
> `InfoLine`: "This is just for you. Nobody else sees this. Not your parents. Not your school."

**Rung 3 — Crisis signals (self-harm language, hopelessness markers, explicit ask):** full-screen, Nebula-Neutral, immediate.

> "We're really glad you told Pookie."
>
> "You don't have to handle this alone. Right now you can:"
> - **[Call or text 988]** — one tap, `tel:988` (big button, not a link)
> - **[Text HOME to 741741]** — one tap, `sms:741741`
> - **[Tell my trusted adult]** — [Name], one tap. Opens an editable pre-written message: "Hey, I'm having a really hard time and wanted you to know."
> - Small line: "GA Crisis and Access Line: 1-800-715-4225"
>
> `InfoLine` (REQUIRED — what Pookie does and doesn't promise):
> "Pookie isn't a therapist, and private spaces here aren't safety-monitored. If you tell Pookie you might act on these thoughts, Pookie will reach your trusted adult. That's the one promise it keeps. It never promises 'just between us.'"
>
> [I'm okay for now] (dismisses; pattern monitoring continues) · [Back to my check-in]

### 2.5 988 integration placement

- **Primary surface:** Rung 3 — one-tap call/text buttons, never links.
- **Persistent:** a small **"Get help"** button in the W8 header, always visible, never a dismissible banner.
- **Secondary surfaces:** safe-exit done screen (§5), NEDA card ("In crisis: call or text 988").
- Never as a popup the teen must dismiss to continue. Never buried in Settings.

### 2.6 Honesty + retention rules (W8)

- First-run line (once): "Pookie isn't a therapist, and private spaces here aren't safety-monitored."
- No indefinite retention: teen-deletable entries + rolling auto-purge option (§2.3).
- Viewing help resources (NEDA card, 988) is never logged anywhere parent-visible. Help-seeking is itself sensitive.
- W8 emits **event metadata only** to the safety pipeline (teen, event type, timestamp, severity). Journal content, mood history, and metric values never leave the teen's scope.

### 2.7 Component inventory (W8)

`SanctuaryBadge` ("Teen-private space" pill + honesty sheet), `MoodPulse` (5 orbs + optional words), `CheckinResponder` (Rung 1 inline), `PatternCard` (Rung 2), `CrisisScreen` (Rung 3 full-screen), `OneTapHelpButtons` (`tel:988` / `sms:741741`), `TrustedAdultTellSheet` (editable pre-written message), `H3SuggestCard` (most-private suggestion), `RetentionPicker`, `JournalComposer`.

---

## 3. W23 / W13 weight-neutral copy system (<18)

**Design principle:** food is fuel and life, never a moral test. The app talks about *patterns and energy*, never quantity, never virtue. For anyone under 18, numbers about food (calories, macros) and numbers about bodies (weight-loss targets, BMI framing) do not exist in the UI — they are unrepresentable by schema, and the copy never implies they should exist.

### 3.1 Vocabulary framework

**Allowed (<18, everywhere in W23 / W13 / W22 / W28):**
fuel · energy for your day · variety · regular meals · hunger and fullness cues · food groups · real-food-first · balanced plate · family favorites · "Did you eat enough to feel good today?" · "Did you eat regularly today?" · "How was your energy?" · move your body · fresh air · strength · fun · rest ("Rest day. Muscles rebuild when you rest.")

**Banned (<18 — enforced by copy-lint, see §8):**
calories · burn / burned / torched / worked off · deficit · cheat meal · clean eating · guilt-free · earn your food · "being good today" · good/bad foods · bikini body · before/after · weight-loss goals · BMI-based framing · "light" (as weight-control framing) · streak / "don't break the chain" · leaderboard / ranked comparisons · "no pain no gain" · punish · diet / skinny / guilt-free (as food tags) · fasting schedules · "allergy-safe" or any safety claim (W28).

**Copy-lint rule:** the banned list is a string-lint in the engineering handbook. Banned words may not appear in UI strings, API responses, push copy, or empty states for <18 subjects. "Light" is allowed only in non-food senses ("light mode").

### 3.2 W23 Nutrition — the <18 experience ("Food & fuel")

Per age-gating: under 18 sees **"Food & fuel"** (learning + meal ideas). Logging features are **hidden, not "locked"** — no lock icons, no "unlock at 18" teasers (a locked tile teaches teens what they're missing and invites workarounds).

**Meal check-in flow** (descriptive only — the schema has no calorie/macro/weight columns, so a teen cannot log what the app cannot hold):

1. "Did you eat regularly today?" → meal chips: **Breakfast · Lunch · Dinner · Snack** (multi-select)
2. "What food groups were in there?" → plain-word chips, multi-select: **Grains · Veggies · Fruit · Protein · Dairy** (+ "Not sure" — always an allowed answer)
3. "How hungry were you before?" → 1–5 scale: **Not at all · A little · Medium · Hungry · Very hungry**
4. "How full after?" → 1–5 scale: **Not full · A little · Comfortable · Full · Very full**
5. "How was your energy?" → short free text, optional
6. Confirm: **"Logged. Nice and regular."** No numeric summary. No judgment. No "score."

Framing lines used across the module:
- "Regular meals keep your energy steady."
- "All food groups count. Variety is the goal."
- "Skipped a meal? No stress. The next one is a fresh start." (shame-free recovery — never "you missed.")

**What never appears <18:** calorie budgets, per-meal caps, macro/protein targets, "lightened-up" recipes framed as weight control, moralizing ("we're being good this week"), fasting schedules. Any *numeric* nutrition target requires the clinician gate (licensed MD/DO/NP/PA/RD/LD, verified NPI) — the teen or parent enters the clinician's info from visit paperwork; Pookie checks it against the public registry.

**Clinician-gate copy** (shown only if a numeric target is attempted):
> "Some goals need a clinician's note. If your doctor set a nutrition goal with you, add their info and Pookie will check it."
> [Add clinician info] · [Never mind]

### 3.3 W13 Meals — meal planning (<18)

- **Allowed:** "Tonight's dinner ideas" · "Balanced plate" · "Family favorites" · grocery lists · leftover plans · cultural-food celebration ("Food from home counts as balanced.").
- **Banned <18:** calorie budgets, per-meal calorie caps, "lightened-up" framed as weight control, moralizing, fasting schedules.
- W13 stores **meal plans, not food logs**. The plan view never displays calories — even if an 18+ diary has them, the <18 UI never queries calorie columns.

### 3.4 W22 Activity — movement framing (<18)

- "Move your body." "Energy." "Fun." "Strength." "Fresh air." Never "work off," "earn your food," "punish," "no pain no gain."
- **Rest-day normalization:** rest days render as complete and positive — green check + "Rest day. Muscles rebuild when you rest." Never "missed," never red, never a gap in a visual chain. Rest is *training*, not absence.
- No streaks, no calorie-burn display, no leaderboards for <18 — the features are **absent, not hidden** (server strips the fields; the client has no streak component for minors). No "don't break the chain" copy anywhere.
- 18+: streaks/calorie-burn/leaderboards exist only via explicit opt-in in Settings → Activity (default OFF). Leaderboards never include minors.

### 3.5 W28 Restaurants — food framing (<18)

- Filter tags `low-cal`, `diet`, `skinny`, `guilt-free`, `light` are **suppressed** from results, filters, and copy for <18 diners.
- "Healthy" filters are re-labeled **"balanced options"** with no calorie numbers shown.
- Allergen hard-blocks keep their safety copy (unchanged): "Heads up: you listed a peanut allergy. This kitchen handles peanuts. Pookie can't confirm it's safe for you." Plus "Call ahead: [phone]." Never "allergy-safe," never a safety claim.

### 3.6 NEDA resources — always visible, never buried

**Card copy (exact, all surfaces):**

> **Worried about food, eating, or body image?**
> You deserve support, and support works.
> **NEDA Helpline: 1-800-931-2237** (call or text) · Text **NEDA to 741741**
> In crisis: call or text **988**.

**Placement rules:**
- Persistent card in **W23** (under 18 AND 18+), pinned near the top for <18.
- In **W8** resources row.
- Injected inline when an `ed_signal` fires (eating/body-image pattern), with a gentle line — never a diagnosis:
  > "Pookie noticed some patterns around food lately. No judgment. Support is here if you want it."
  > [NEDA card] · [Talk it through with Pookie] · [Not now]
- **Never** a modal the teen must dismiss to continue logging (no shame interrupt).
- **Always one tap** from any W23/W8 surface.
- Viewing NEDA resources is **never logged anywhere parent-visible.**
- Dismissible, but returning (it comes back after a cooldown — support stays findable).

### 3.7 ED-signal response — what the teen sees (never a parent notification)

Server-side pattern detection (≥3 skipped meals in 7 days with low-energy notes; body-image distress language in journal) emits metadata only. The teen sees §3.6's inline card. **Never** "we think you have an eating disorder" (a diagnostic claim *and* a privacy breach). **Never** a parent notification or digest entry.

### 3.8 Component inventory (nutrition)

`MealCheckinFlow` (5 steps, no numbers), `FoodGroupChips`, `HungerScale` (1–5, word-labeled), `NedaCard` (persistent), `EdSignalCard` (inline, gentle), `ClinicianGateSheet`, `RestDayRow` (positive rest rendering), `BalancedOptionsFilter` (W28 <18).

---

## 4. 18th-birthday health review flow

**What already happened:** at midnight local on the 18th birthday, the cutover job ran whether or not the user logged in — all parent visibility into every health tier ended immediately (including H1), pre-18 grants expired, device sync tokens paused. Privacy did not wait for a login.

**Flow order at first login ≥18:** `/adult/decision` (general adult takeover: who-sees-what, school credential handoff, quiet-exit option — per `sol-ux.md` §4) runs **first**, then `/health/review-18` (this section, the health chapter, blocking). The dashboard waits behind both.

**Route:** `/health/review-18` — blocking interstitial. "Remind me later" is allowed, but it re-prompts every login until completed or explicitly skipped. **Skip = private**, recorded as an affirmative choice (`skipped_private`) so the prompt stops.

**Visual rule for this flow:** the milestone header gets gentle warmth (soft glow, calm starfield — this *is* a growing-up milestone). **Every privacy decision component renders Nebula-Neutral** (flat slate cards, no glow on buttons, no confetti). Celebration never surrounds a privacy choice — a glowing default would make "off" feel like the wrong answer.

### 4.1 Step 1 — Header + per-tier cards

**Header copy (exact):**

> "You're 18. Your health information is now private to you."
>
> "Until today, [Mom] could see parts of your health info. That access ended last night. Nothing is shared unless you turn it on below."

**"Who currently sees what" panel** (directly under the header):

> "Right now: **nobody but you.**"

**Per-tier grant cards — three separate toggles, ALL DEFAULT OFF. Never one "health" checkbox.**

**Card 1 — Everyday wellness (H1)** — Toggle OFF.
> "Steps, sleep, heart rate from your devices."
> "[N] readings from the last year."
> Toggle label (per parent): "Let [Mom] see my everyday wellness."

**Card 2 — Private health (H2)** — Toggle OFF.
> "Weight, medications, allergies, doctor notes, food diary."
> "[N] records from the last year."
> Toggle label (per parent): "Let [Mom] see my private health."
> Sub-line: "Does not include your mood or journal. Those are always just yours."

**Card 3 — Most personal (H3)** — NOT a toggle. Static line:
> "Records about care you consented to yourself (like STI testing or counseling) stay only with you. Always. There's no switch for this."

Re-consent is **per parent** — [Mom] and [Dad] are separate toggles (parallel-parenting safe). The adult can change these anytime later in Settings → Sharing → Health.

### 4.2 Step 2 — Review–correct–seal queue

Header: "Let's check what [Mom/Dad] entered."

**Review queue:** every health row with `entered_by` ≠ the user (parent-entered H1/H2, pre-18 device readings synced under a parent's token), grouped by category: **Vitals · Weight · Medications · Notes · …**

Each row shows: what was entered, when, and **who entered it** ("Entered by Mom · Mar 2025"). Per row, three actions:

- **[Keep]** — accept as-is; row sealed.
- **[Correct]** — inline edit; writes a correction history entry (what changed, when, by whom); then sealed.
- **[Delete]** — removed immediately.

Footer `InfoLine`: "After you finish, these become read-only history. They're part of your story, but nobody sees them unless you say so."

**Seal semantics (teen-facing copy):** before any sharing toggle in Step 1 takes effect on old records, one default-OFF checkbox:

> ☐ "Include records from before I turned 18."
> "Records from before today stay just with you unless you check this."

This prevents a new H2 grant from silently re-exposing parent-entered history the adult hasn't reviewed.

### 4.3 Step 3 — Transition summary export ("Take to your new doctor")

Offered here and anytime later from Settings → Health → "My health summary."

> **"Take to your new doctor."**
> "A clean summary of your health info. Handy for a new doctor, a college health form, or your own files."
>
> **What's inside:** conditions · current medications (name, dose, schedule) · allergies · shot records · recent vitals trends · emergency contacts · insurance card (masked).
>
> [Download PDF] · [Download JSON]
>
> `InfoLine`: "Your most-personal records are **not** included. You can add them one by one below — each one is your choice."
> Per-record opt-in (default OFF): ☐ "Include my counseling records" · ☐ "Include my [record]" …

Every export is logged (visible in the adult's own audit log).

### 4.4 Step 4 — Emergency contacts (decoupled from access)

> "Who should be called in an emergency?"
> [Contact picker: Mom · Dad · sibling · friend · + Add someone]

Directly beneath, the decoupling line (exact):

> "Emergency contact is not the same as access. If you list Mom here, she can be **called** in an emergency. She still can't **see** your health information unless you turn that on above."

"Called ≠ can see" is stated in plain words, not implied. Emergency contacts and sharing grants are separate lists; changing one never changes the other. The break-glass medical card (allergies, conditions, meds — for responders) is filled from what the *adult* selects, independent of any parent's access.

### 4.5 Step 5 — Confirm

- `PrimaryButton` **"Save my choices"** → writes one grant row per tier per person, marks review complete, logs to the audit trail.
- `QuietButton` **"Skip. Keep everything private."** → identical privacy outcome, recorded as an affirmative choice so the prompt stops appearing.

Closing line (both paths): "Done. Your health info is yours."

### 4.6 Component inventory (review-18)

`Review18Flow` (blocking shell), `TierGrantCard` (H1/H2 toggle cards with counts), `H3StaticLine`, `SeesWhatPanel` ("Right now: nobody but you"), `ReviewQueueRow` (what/when/who + Keep/Correct/Delete), `SealConfirm` ("Include records from before I turned 18"), `TransitionSummaryCard` (PDF/JSON + H3 per-record opt-ins), `EmergencyContactPicker`, `DecouplingLine` ("called ≠ can see").

---

## 5. Graduation-vs-rupture visual split

Two events, two opposite visual languages. The split is the product decision. **Never mix them.**

### 5.1 Nebula-Celebrate — gaining independence ONLY

**Where:** `/independence/*` ("Go independent"), milestones, happy events. **Never** in consent, revoke, safe-exit, crisis, or privacy-decision flows.

**Visual spec:**
- Full animated starfield, rising particles, confetti burst on the final screen only.
- Warm pink glow (`#f472b6`, soft and diffused), divine-light halo on the headline.
- Headline font with halo; warm, mission-framed copy.

**Copy voice (exact strings):**
- "You're growing up with Pookie."
- "Pookie grows with you. Going independent means your Pookie becomes fully yours. Your space, your rules."
- Final: "This is yours now." / "Your own Pookie, your own rules. Pookie grows with you. All the way."

**Components (Celebrate set — never imported by rupture flows):** `Starfield` (animated), `ConfettiBurst`, `CelebrateHero`, `HandoffCard`, `TrustedAdultPicker`.

**States:** loading → starfield shimmer veil ("Getting your space ready…"); error → "Something didn't save. [Try again]" (warm, calm); every step has a working Back. No dead ends.

### 5.2 Nebula-Neutral — privacy decisions, revoke, crisis, quiet exit

**Where:** consent screens, Sharing revoke confirmations, cooling-off, 18th-birthday privacy cards, W8 Rung 2/3, quiet exit.

**Visual spec:** static dim starfield (no motion), no confetti, flat slate cards, no glow on buttons, calm copy. No red alarms. No guilt.

**Copy voice (exact strings):**
- Revoke done: "Done." (period, no exclamation) "Mom no longer sees your stuff in Pookie. What your school shares with her directly hasn't changed."
- No "you did the right thing." Never narrate the teen's feelings.

**Components (Neutral set):** `NeutralSheet`, `ConsequenceList`, `PlainConfirmCard`, `PendingStatusLine`, `PatternCard`, `CrisisScreen`.

### 5.3 Nebula-Boring — safe exit ONLY (sub-variant of Neutral)

**Where:** `/safe-exit/*` and any "removing a parent where safety is a factor" path.

**Visual spec:** maximum plainness. System-default sheet styling. **No starfield accent. No pink. No glow. No emoji. No delight copy.** If someone looks over the teen's shoulder, it reads as "notification settings."

**Copy voice (exact strings):**
- "If telling your parents could put you at risk, you can cut off sharing right now. Quietly."
- "All sharing with your parents stops immediately." / "They don't get a message about this." / "Your safety messages from school still reach them."
- Done: "Done. Your sharing is off."
- Below the fold, small and calm: "If you're in crisis or need help right now: Call or text **988**. Text HOME to **741741**."

**Rules (absolute):** ≤3 taps from the checkbox to done. No push, no email receipt, no home-screen badge from this flow. No "you're brave" copy (don't create evidence of intent an abuser could find meaningful). Audit event recorded with reason code `safe_exit`, teen-visible only.

**Components (Boring set):** `BoringSheet`, `PlainList`, `TwoTapConfirm`, `CrisisResourceBlock`.

### 5.4 The absolute rule

**Never render Nebula-Celebrate components inside a rupture flow. Never render rupture-neutral copy inside a graduation flow.** Safe exits are visually boring by design — a celebration screen glimpsed by an abuser is a safety failure, not a design bug. Enforced by component import rules: the Celebrate set and the Boring set share no components.

### 5.5 Health-specific applications

| Moment | Visual language | Why |
|---|---|---|
| Teen turns OFF a parent's H1/H2 grant in Sharing | Neutral | A privacy choice. Calm confirm, no guilt, no celebration |
| Safe exit from health Sharing ("telling my parents could put me at risk") | **Boring** | Safety path. Maximum plainness |
| 18th-birthday review header ("You're 18…") | Warm-neutral | Milestone acknowledged with gentle warmth; **all decision cards render Neutral** — celebration never surrounds a privacy choice |
| "Go independent" flow | **Celebrate** | Gaining independence. Confetti only on the final screen |
| Quiet exit ("Make everything private quietly") | Neutral | Deliberately undramatic; delayed neutral parent notification |
| Cooling-off revoke confirm (13–15) | Neutral | Calm, no red alarms, alternatives offered |
| W8 Rung 3 crisis screen | Neutral | Urgency without alarm styling |

### 5.6 Interaction contracts (no dead buttons)

Every consequential action (revoke, safe exit, grant toggle, re-consent save) implements three states:
- **Working:** button shows "Working…" and disables. No double-tap duplicates (idempotent writes).
- **Done:** explicit confirmation copy ("Done." + what changed). Never a silent state change.
- **Failed:** "Something didn't save. [Try again]" — the UI snaps back to the true server state. A toggle never displays a lie.

---

## 6. Parent-facing health views

**Principles:** honest boundary labels on everything; no phantom data (every revoked/empty/grace state has designed copy — nothing renders as an eternal spinner or a chart with missing series); no judgmental gaps; the parent never sees W8, H3, or H0 content in any form.

### 6.1 H1 parent card — "Everyday wellness"

**Header:** "Everyday wellness — [Teen]'s"

**Boundary label (REQUIRED, renders whenever the card renders):**
> "You see this because [Teen] shared it."
> "Shared [date]. [Teen] can change this anytime."

**Content:** totals and trends the teen's H1 grant covers — steps, sleep hours, activity minutes, resting HR. **Provenance on every reading** (first-class, never missing):
- "From [Teen]'s Apple Health · iPhone · 7:42 AM"
- "Entered by [Teen]"
- "Entered by you"

**Persistent footer (every visit):** "Pookie shows what devices recorded. It doesn't diagnose or predict anything about health."

**For <18 subjects** the card shows totals and trends only. Streaks, calorie-burn, and leaderboards are stripped server-side by the subject's age band — the parent's card has no streak component, no "burn" numbers, no rankings. Rest days render positive: green check + "Rest day."

**Data binding:** reads `health_metrics` through RLS (`health_tier_visible()`); the client renders exactly what the API returns. The client never fabricates, interpolates, or backfills.

**States:**
- **Loading:** shimmer rows (no fake numbers, no skeleton charts with invented shapes).
- **Empty (no data yet):** "No readings yet. When [Teen] connects a device or logs, they'll show up here." — neutral, no nudge copy ("ask them to log!" is banned).
- **Error:** "Couldn't load this right now. [Try again]" — retry re-fires the query. No cached-stale data presented as fresh.

### 6.2 W23 parent view (<18) — engagement only

**Content:** "Meals logged: 5 of 7 days." Days-logged bars. **Never** calories, macros, or weight — the amended `nutrition_weekly_patterns()` returns engagement only for minor subjects; the parent UI has no calorie/macro/weight components to render.

**Boundary label:** "You see this because [Teen] shared it. This shows how often [Teen] logged — not what they ate."

**Empty week:** "No meals logged this week." — neutral. Never "0 days — encourage them to log!" (no coaching the parent into surveillance).

**States:** loading shimmer / empty copy above / error with retry — same pattern as §6.1.

### 6.3 H2-with-grant parent view

Renders only when the teen holds an active H2 grant naming this parent. **Boundary label:**
> "Shared by [Teen] on [date]. [Teen] can change this anytime."

**Content:** the granted H2 rows — weight, medications, allergies, doctor notes, food diary (descriptive <18). Plain values, same no-diagnosis footer as §6.1. **Explicit exclusion line (REQUIRED):**
> "This doesn't include mood or journal. Those are always just [Teen]'s."

Allergy rows feed the W28 hard-block copy the parent already sees; the parent's allergy *view* is read-only (edits are the teen's or steward's).

**States:** loading / empty ("Nothing shared here right now.") / error-with-retry, per §6.1.

### 6.4 Immunizations (H1, <18) — parent view

Shot record table (vaccine, dose, date) + GA Form 3231 status. Reminder copy (parent-facing, logistics framing):
> "[Teen]'s GA immunization certificate expires [date]. Ask the pediatrician for an updated Form 3231."
- 90 / 30 / 7-day reminders. Never medical advice, never nagging (dismissible).
- Export ("for school forms") is parent- or teen-initiated, logged. No automatic sharing with schools.

### 6.5 W8 — no parent surface at all

The parent's Health category **does not render a W8 tile**. No "wellbeing summary," no anonymized trend, no "locked" placeholder (a locked tile teaches the boundary and invites workarounds). Absent, not hidden. The teen's H2 grant explicitly does not cover `wellbeing_entries` (teen-only RLS, no parent arm) — the parent UI reflects this by having nothing to show.

### 6.6 Grace period — what the parent sees

When a grant ends, a 30-day grace covers **historical records only** (nothing new). The parent's card:
- Continues to render pre-revoke data with **honest frozen timestamps**: "Updated 3 days ago." Staleness looks like staleness. No "sync delayed" copy (that copy is itself a signal — banned).
- No banner, no countdown, no "revoking" hint. The parent cannot distinguish grace from normal.
- The teen sees the truth on their Sharing screen: "[Mom] can still see records from before [date] until [date]."
- **After grace expires:** the card switches to the neutral empty state (§6.8). No per-record tombstones.

**Data binding:** `health_grace` rows (viewer, tier, `grace_expires_at`) feed the teen-facing copy and the predicate. The parent client needs no grace logic — RLS simply stops returning rows.

### 6.7 Cooling-off freeze (13–15 revoke) — parent view

During the 7-day window the parent's UI shows access as **unchanged**: dashboard, grades, messages render exactly as before, data frozen at the pre-revoke snapshot. Tapping a toggle the parent could previously use still works locally, but the change is queued and silently held (applied only if the teen cancels; discarded if the revoke completes). The parent is never told a change was held. No banner, no countdown, no "changes pending," no email, no audit entry, no change in any transparency view.

### 6.8 Revoked / ended — neutral empty states (no phantom data)

When sharing ends (revoke complete, grace expired, "hide past too," 18+ cutover with no re-consent), every parent health surface renders:

> **"Health sharing ended."**
> "Some things you used to see are no longer shared."

- No reason given. No timestamp of the teen's action. No per-record tombstones (a tombstone leaks *what* was hidden — welfare risk).
- No broken charts, no eternal spinners, no "0" values implying failure. The card is replaced by the empty state, not left half-rendered.
- **"Hide past too":** identical copy. The parent cannot tell *what* was hidden or *when* the teen acted.

### 6.9 What parents are told about the never-shared tiers (honesty without disclosure)

On the parent's Sharing/Family view, one static line in the health section:
> "Some health records stay only with your teen. Like care Georgia lets teens consent to themselves. This isn't something you can turn on. It's how Pookie is built."

No counters, no existence signals, no per-record hints.

### 6.10 Component inventory (parent views)

`BoundaryLabel` ("You see this because [Teen] shared it." + shared-date + change-anytime), `ProvenanceLine` (source label on every reading), `NoDiagnosisFooter`, `EngagementCard` (W23 <18), `FrozenTimestamp` (honest staleness), `HeldToggleQueue` (silent, cooling-off), `NoAccessEmptyState` ("Health sharing ended."), `H2ExclusionLine` ("This doesn't include mood or journal."), `ImmunizationTable`, `Form3231Reminder`.

---

## 7. Implementation contracts — per screen (no placeholders)

Every screen below is specified as a shippable implementation: real data source, real loading state, real empty-state copy, real error state with retry, and exact tier-aware rendering. Where the backend is another team's (migrations 022–028 per `sol-health.md` Appendix A; consent RPCs per Platform Team 1), the contract names the spec'd interface. Nothing renders lorem ipsum, "coming soon," or a stubbed interaction.

### 7.1 Consent — `/consent/link/{token}` (health section)

- **Reads:** link-token validation (access-model, Platform Team 1); existing `health_consent_grants` for this (granter, grantee) to render "already shared" state on re-consent — all checkboxes still start unchecked for *new* choices.
- **Writes:** `health_consent_grants` rows `(tier ∈ {H1,H2}, status active)` via the consent-submit RPC (Platform Team 1; same shape as `rpc_health_reconsent_submit`). No row = no access. H3/H0 are never written — no code path exists.
- **Loading:** full-screen Nebula veil, "Setting up your choices…" (old content unmounted first — no bleed).
- **Empty:** n/a (the screen is the content). If the teen has no linked adult yet, the health section reads "You'll pick who this applies to next."
- **Error:** "We couldn't load this invite. The link may have expired." [Ask for a new link] — retry re-validates the token.
- **Tier-aware rendering:** 13–17 sees all three tier cards (§1.2–1.4). Under-13 never sees this screen (stewardship). 18+ never sees this screen (uses `/health/review-18`).

### 7.2 W8 home + MoodPulse

- **Reads:** `wellbeing_entries` (teen-only RLS) — latest entry for "last check-in" line + last 30 for the private pattern view.
- **Writes:** INSERT `wellbeing_entries (mood_score, mood_label, journal_text, tags, health_tier)`. Draft text is preserved locally across errors — a failed save never eats the teen's words.
- **Loading:** violet shimmer on the pulse row only; the rest of the module renders.
- **Empty (first run):** "This is your private space. Check in whenever you want. Nothing here is shared. Ever." + the honesty line (§2.1). Real copy, real badge, real pulse — functional from the first tap.
- **Error (save failed):** "Couldn't save that. Your words are still here. [Try again]" — inline, no data loss, no navigation away.
- **Tier-aware rendering:** entries default H2; H3-suggested entries (§2.3) render with the violet lock marker "Most-private." No parent arm exists in any query.

### 7.3 Crisis ladder (Rung 2 / Rung 3)

- **Reads:** teen's own `wellbeing_entries` for the pattern view ("See my pattern" — soft violet trend, descriptive words, no clinical labels).
- **Writes:** Rung 3 "Tell my trusted adult" writes `access_events (event='trusted_adult_notified', metadata only)` and routes the teen-edited message through the safety pipeline. Declining records the G1 acknowledgment ("I understand no adult will be alerted").
- **Loading:** pattern view shows shimmer; Rung 3 renders instantly (crisis UI never waits on network — the help buttons are `tel:`/`sms:` links that work offline).
- **Empty:** n/a — Rung 3 always renders fully.
- **Error:** if the trusted-adult message fails to send: "That didn't send. Your trusted adult wasn't notified. [Try again]" + the 988 buttons remain one tap away. The failure is honest and the teen is never left without an option.

### 7.4 W23 "Food & fuel" (<18)

- **Reads:** `meal_checkins` (teen's own) for the rhythm view ("You logged 5 of 7 days" — engagement only, no quantities).
- **Writes:** INSERT `meal_checkins (meal, food_groups, hunger_before, fullness_after, energy_note, health_tier='H2')`.
- **Loading:** shimmer on the check-in card.
- **Empty:** "No check-ins yet. When you log meals, you'll see your rhythm here." — no guilt, no "get started" pressure framing.
- **Error:** "Couldn't save. [Try again]" — selections preserved.
- **Tier-aware rendering:** <18 never queries calorie columns (they don't exist for minors by schema). 18+ food diary renders from `food_logs` with uncertainty ranges, teen-private H2.

### 7.5 Review-18 — `/health/review-18`

- **Reads:** `rpc_health_review_queue()` (parent-entered rows awaiting review, with `entered_by` attribution); per-tier counts ("[N] readings from the last year"); `health_reconsent_status`.
- **Writes:** `rpc_health_reconsent_submit(grants)` / `rpc_health_reconsent_skip()`; `rpc_health_record_correct(record_id, table, patch)`; `rpc_health_record_delete(...)`; `rpc_export_transition_summary(format)` (PDF/JSON, streamed, never persisted).
- **Loading:** per-step skeleton (tier cards shimmer; queue rows shimmer).
- **Empty (review queue):** "Nothing to review. Everything here was entered by you." — the step completes honestly with zero rows.
- **Error:** per-action inline retry ("That didn't save. [Try again]"). Export failure: "Couldn't make the file. [Try again]" — no partial downloads.
- **Tier-aware rendering:** H1/H2 toggle cards (default OFF, per-parent); H3 static line (never a toggle); sealed-history checkbox default OFF (§4.2). "Remind me later" re-prompts each login until `complete` or `skipped_private`.

### 7.6 Teen Sharing — health section

- **Reads:** `health_consent_grants` (active rows, per tier per grantee) → toggle states + "Shared [date]" labels.
- **Writes:** revoke → `revoked_at=now()` (+ `health_grace` rows via the ending-event function); create → new grant row. All idempotent; double-taps don't duplicate.
- **Loading:** toggle-row shimmer.
- **Empty (no grants):** person card shows "Sees nothing right now." — one honest line, no judgment.
- **Error:** "That didn't save. [Try again]" — the toggle snaps back to the true server state. A toggle never displays a lie.
- **Tier-aware rendering:** H1/H2 toggles; H3/H0 static lines (§1.11). The "What can [Mom] actually see right now?" viewer is suppressed for a revoked person during exit windows.

### 7.7 Parent health surfaces (§6)

- **Reads:** `health_metrics` (RLS `health_tier_visible()`), `nutrition_weekly_patterns()` (engagement-only <18), `immunizations`, `health_grace` (teen-facing copy only — the parent client holds no grace logic).
- **Writes:** none on parent health surfaces (read-only; the allergy view is read-only for parents of 13+).
- **Loading / Empty / Error:** per §6.1 — shimmer rows, real empty copy, "Couldn't load this right now. [Try again]" with retry. No cached-stale data presented as fresh; frozen grace data keeps honest timestamps.
- **Tier-aware rendering:** H1 card only with H1 grant; H2 section only with H2 grant (+ exclusion line); W8 never rendered; H3/H0 never rendered, never counted, never hinted.

### 7.8 Gated/seedling state (before §12 gates clear)

Until the health build gates clear (migrations applied + RLS tests green + counsel review + safety sign-off, per `sol-health.md` §12), health modules render a **real, designed Seedling state** — not "coming soon":

- **Reads (integration contract — backend to provide):** `rpc_health_module_status()` → `{ tier_ready, counsel_reviewed, safety_signed_off }`. If any is false, the module renders Seedling.
- **Copy:** "Health is still growing." / "Pookie is setting up private spaces and safety checks first. Health opens when they're ready." / [Notify me when it opens] (a real preference toggle — writes a notification preference row) / [See what Health will do] (expands the real module list: Everyday wellness, Private health, Wellbeing, Food & fuel — with the real privacy lines).
- **No data entry** in Seedling state (inputs disabled with the honest reason above — not greyed-out mysteries). No fake data, no sample charts, no lorem ipsum.

---

## 8. Copy-lint word lists (health)

Enforced as string-lint rules in the engineering handbook. Scope column: `teen` = teen-facing strings; `parent` = parent-facing strings; `all` = every surface including API responses and push copy.

### 8.1 Banned — weight/appearance moralizing (<18, scope: all)

| Banned | Use instead |
|---|---|
| calories, calorie | (absent — no replacement; talk about meals, not numbers) |
| burn / burned / torched / worked off | move your body, energy |
| deficit | (absent) |
| cheat meal | (absent — all meals are regular meals) |
| clean eating, guilt-free, "being good today" | balanced plate, variety |
| good/bad foods | food groups |
| earn your food | fuel for your day |
| bikini body, before/after | (absent) |
| weight-loss goals, "light" (food framing), diet/skinny (food tags) | (absent) |
| streak, "don't break the chain" | rhythm, "nice and regular" |
| leaderboard, ranked, "you're #3" | (absent for <18) |
| "no pain no gain", punish | rest is training |
| fasting schedules | regular meals |

### 8.2 Banned — clinical/diagnostic claims (scope: all, W2/W8/W23)

diagnose · disorder · condition · abnormal · risk (as a health claim) · "your pattern suggests" · "allergy-safe" / "allergen-free guarantee" (safety claims — use the hard-block copy) · "we think you have an eating disorder" (use the ED-signal card, §3.7).

### 8.3 Banned — coercive / shaming / promise-breaking (scope: teen)

"are you sure" · "you're too young" · "your parents won't like this" · "just between us" (use the G10 honesty line) · "we have to" (safety-comms row) · "you're brave" / "you did the right thing" (never narrate feelings) · "you missed a check-in" · "encourage them to log" (parent-facing surveillance nudge) · "sync delayed" (cooling-off signal) · em dashes in teen/parent-facing copy (use periods).

### 8.4 Required strings (must appear verbatim where specified)

- School-transparency line (§1, global): "Heads up: your school shares grades and attendance with your parents directly. Pookie settings only control what Pookie shares. Not what the school shares."
- W8 honesty line (§2.1 badge sheet + first run): "Only you can see this space. Not your parents. Not your school. Not even in summaries."
- Rung 3 promise line (§2.4): "Pookie isn't a therapist, and private spaces here aren't safety-monitored. If you tell Pookie you might act on these thoughts, Pookie will reach your trusted adult. That's the one promise it keeps. It never promises 'just between us.'"
- H2 exclusion line (§1.3, §1.11, §6.3): "This doesn't include mood or journal. Those are always just [Teen]'s." / "Not included: your mood check-ins and your journal. Those stay just with you, always."
- H3 static line (§1.4): "Some health records stay only with you. Always. There's no switch for this."
- Review-18 header (§4.1): "You're 18. Your health information is now private to you."
- Emergency decoupling (§4.4): "Emergency contact is not the same as access. If you list Mom here, she can be called in an emergency. She still can't see your health information unless you turn that on above."
- NEDA card (§3.6): "Worried about food, eating, or body image? You deserve support, and support works. NEDA Helpline: 1-800-931-2237 (call or text). Text NEDA to 741741. In crisis: call or text 988."
- W2 footer (§6.1): "Pookie shows what devices recorded. It doesn't diagnose or predict anything about health."
- Parent boundary label (§6.1): "You see this because [Teen] shared it." + "Shared [date]. [Teen] can change this anytime."
- Revoked empty state (§6.8): "Health sharing ended." / "Some things you used to see are no longer shared."
- Never-shared honesty (§6.9): "Some health records stay only with your teen. Like care Georgia lets teens consent to themselves. This isn't something you can turn on. It's how Pookie is built."

---

## 9. Conflict register — sol-ux vs sol-health reconciliations

| # | Conflict | Resolution (this spec) |
|---|---|---|
| C-A | `sol-ux.md` §2 Sharing shows an "H3 toggle (default OFF)" for "Body stuff and development." | **No H3 toggle exists.** H3 is absolute per `sol-health.md` §§1.3/8.1 — no grants, no overrides, no exceptions. The Sharing health section renders H3 as a static non-toggleable line (§1.11). |
| C-B | `sol-ux.md` §1 consent lists ☐ "Body stuff and development (maps H3 — e.g., puberty, weight, reproductive topics)." | **Removed as a checkbox.** Weight/body measurements are H2 (enumerated in the Private-health card); consentable-care topics are H3 (static line, §1.4). No checkbox maps to H3. |
| C-C | `sol-ux.md` §2 "Wellness (default OFF)" vs `sol-health.md` §1.3 "H1 default ON at link." | **Consent/link screen: all health checkboxes start unchecked** (affirmative opt-in, per the build directive). The access-spec default-ON applies to under-13 stewardship and to post-link state only after the teen opts in. Access-model owner to confirm the one-line amendment. |
| C-D | `sol-ux.md` §2 "Wellness — mood answers, sleep, and activity" mixes H1+H2 in one scope. | **Split.** "Everyday wellness" (H1: steps/sleep/activity) and "Private health" (H2) are separate toggles; mood/journal are excluded from both by the REQUIRED exclusion line (W8 firewall). |
| C-E | `sol-ux.md` §1 "What I eat and my meals (maps H1)." | **Corrected.** The teen's food diary is H2; parents see engagement-only ("how often you logged — not what you ate," §6.2). Consent copy says exactly that. |
| C-F | `sol-ux.md` §4 `/adult/decision` vs `sol-health.md` §2.2 `/health/review-18` — two "18th birthday" blocking screens. | **Sequenced:** `/adult/decision` (general: who-sees-what, school credential handoff, quiet exit) runs first; `/health/review-18` (health chapter) runs second, blocking. Dashboard waits behind both. |
| C-G | MD "no placeholders" vs `sol-health.md` §12 gate 6 (health ships as seedlings until gates clear). | **Seedling is a real designed state** (§7.8): real copy, real "notify me" preference, real feature list, inputs honestly disabled — never "coming soon," never lorem ipsum. |

---

## 10. Acceptance criteria (testable UX gates)

1. **Unchecked by default:** on first paint of `/consent/link/{token}`, every health checkbox renders unchecked (automated DOM test; no pre-checked boxes, no "select all").
2. **No H3 grant affordance:** no toggle, button, or link that grants H3 exists in the DOM on consent, Sharing, or review-18 (component-tree test). H3 renders only as the static line.
3. **Never one "health" checkbox:** the health domain always renders ≥2 separate tier checkboxes (H1, H2); a single blanket health control fails the test.
4. **Celebrate/rupture split:** Celebrate components (`ConfettiBurst`, `CelebrateHero`) never render inside consent, revoke, safe-exit, crisis, or review-18 flows; Boring components never render in `/independence/*` (import-graph + render test).
5. **Copy-lint:** banned word lists (§8.1–8.3) pass against all teen/parent-facing strings, API response copy, and push copy. Required strings (§8.4) match verbatim.
6. **Reading level:** Flesch-Kincaid ≤ 8 on consent, crisis, revoke, safe-exit, and review-18 strings (CI check).
7. **988 one-tap:** Rung 3 renders `tel:988` and `sms:741741` as one-tap buttons (not links); the W8 header "Get help" button is present on every W8 render.
8. **NEDA one-tap:** the NEDA card is reachable within one tap from W23 home and W8 home for <18; it never blocks logging (no modal).
9. **Boundary labels:** every parent health surface that renders data also renders its `BoundaryLabel`; every reading renders its `ProvenanceLine`.
10. **No phantom data:** revoked/grace-expired/hidden states render the neutral empty state (§6.8) — no chart with missing series, no eternal spinner, no "0" implying failure (visual regression per state).
11. **Grace honesty:** the teen-facing grace line shows correct dates sourced from `health_grace` rows; the parent view shows honest frozen timestamps with no event-signaling copy.
12. **No lying toggles:** every grant toggle implements working/done/failed states; on failure the toggle snaps back to server truth (§5.6).
13. **Exclusion line present:** the H2 consent card, Sharing H2 row, review-18 H2 card, and parent H2 view all render the mood/journal exclusion line.
14. **Seedling honesty:** in gated state, health modules render the §7.8 Seedling (real copy + working notify toggle); no "coming soon," no lorem ipsum, no dead inputs.

---

*End of Squad 2 Health Track UX specs. Design-only. No code, no deploys. Integration contracts in §7 name the spec'd interfaces (migrations 022–028, consent/re-consent RPCs); backend owners provide them per `sol-health.md` Appendix A/B.*
