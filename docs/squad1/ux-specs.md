# Squad 1 — Safety Track: UX Screen Specs ⛑️

**Author:** UX Designer (Squad 1) · 2026-10-12
**Status:** build-ready spec for the frontend engineer — implement pixel-for-pixel.
**Branch:** `staging-build`. Do NOT deploy.
**Sources:** `docs/solutions/sol-safety.md` (design), `docs/solutions/sol-ux.md` (visual language).
**Visual language split (from sol-ux.md — absolute rule):**
- **Nebula-Celebrate** — full animated starfield, confetti, pink glow. ONLY for gaining independence / milestones / happy events.
- **Nebula-Neutral** — static dim starfield, no motion, no confetti, flat slate cards. All revoke/sensitive flows.
- **Nebula-Boring (safe-exit sub-variant)** — plain system sheet: no starfield accent, no pink, no emoji, no delight copy. An abuser glancing at the screen sees "account settings," not an exit event. **Never mix Celebrate into a rupture flow, or rupture-neutral copy into a graduation flow.**

**Global rules (apply to every screen below):**
1. Reading level ≤8th grade, plain words. No legalese. No em dashes in teen-facing copy.
2. Shame-free language: lead with agency ("you decide"), never judgment.
3. Positioning: "Pookie grows with you." Never punitive framing; never "cut off" as a headline verb (use "remove access" / "make private").
4. Reduced motion: every animated element ships a static equivalent honored by the OS `prefers-reduced-motion` setting. Nothing below the safe-exit/decline screens animates at all (they are motionless by design).
5. No push notification, no email receipt, no home-screen badge ever originates from a safe-exit, decline, or quiet-exit flow (lock-screen leakage is a safety failure).
6. All crisis/safety copy strings below are flagged for **DV-advocate review (Appendix C gate #1)** before launch — flagged inline as **[DV]**.

---

## 1. Trusted-Adult Screens A / B / C

Route: `/safety/trusted-adult/*` · Visual: **Nebula-Neutral**. Used anywhere the trusted-adult gate triggers: before any revoke / go-independent execution (§3 of sol-safety), at first crisis-surface use, and from Settings → Safety → "My trusted adults".

### Screen A — "Why you're here"
**Layout:** FullPageFlow, centered content, max-width 560px, calm slate card on dim static starfield.

**Copy (verbatim):**
> "Before this change goes through, you need one adult Pookie can reach in a real emergency. This adult does **not** get to see your Pookie — they only get a safety alert if you're in danger. You choose them. You can change this anytime."

**Button hierarchy:**
1. `PrimaryButton` (pink, full width, first): **"Choose an adult"** → Screen B.
2. `QuietButton` (text-only, below, smaller): **"I don't want to name one"** → decline path (§2 below). Equal tap target is NOT required here — decline is the secondary option — but the decline path itself carries the anti-dark-pattern guarantees (see §2).

**Reduced motion:** none (no animation on this screen).

### Screen B — Nominate
**Layout:** form card. Fields top to bottom:
1. **Name** — text input. Label: "Their name" (example placeholder: "Aunt Rosa").
2. **Relationship** — chip row (single-select): Parent · Relative · Counselor · Coach · Faith leader · Neighbor · Other.
3. **How to reach them** — phone input (preferred for crisis speed) + email input. Microcopy under the contact field (verbatim): "We'll text them a short message to confirm this number is really theirs."
4. **Note** — optional text input, ≤140 chars. Label: "Note for them (optional)".

**Actions:** `PrimaryButton` "Send confirmation" (enabled when name + one contact channel valid) · back link "← Back" (top-left).

**Validation copy:** "Add a name and a phone number or email so we can reach them."

### Screen C — Verification pending
**Layout:** status card with neutral waiting state (static — no spinner animation; use a flat progress line or nothing at all).

**Copy (verbatim):**
> "We sent a text to [name]. They need to tap the link to confirm. You can finish choosing later — your request is saved as a draft."

- `[name]` = display_name the teen entered.
- Actions: `PrimaryButton` "Done for now" (saves draft, returns to origin screen) · `QuietButton` "Use a different adult" (→ Screen B, replaces pending nomination).
- Adult-side verification happens on the zero-PI public page `/verify-adult` (6-digit code, 15-min expiry, 5-attempt lockout). Same-room flow adds the adult anti-coercion tap: "Did [teen name] ask you to be their safety contact, freely?" [Yes] / [No].

### 48h-unverified nudge (one time, in-app only)
If `verification_status` is still `pending`/`unverified` after 48h:
- One in-app banner on the teen's Home (Nebula-Neutral, quiet, dismissible):
> "[Name] hasn't confirmed yet. You can send it again, pick a different adult, or continue without naming one."
> Buttons: **"Send again"** · **"Pick a different adult"** · **"Continue without naming one"** (→ §2 decline path).
- The teen may **continue unverified-with-acknowledgment** — identical mechanics to the decline path (checkbox + two equal buttons), recorded as `crisis_alert.declined_path`.
- **No push notification for the nudge** (no lock-screen leakage). Exactly one nudge; never repeated.

**Component inventory:** `FullPageFlow`, `GlowCard` (muted), `RelationshipChips`, `PrimaryButton`, `QuietButton`, `PendingStatusCard`, `InfoLine`.

---

## 2. Decline Path — "I don't want to name one"

**This is anti-dark-pattern safety infrastructure. Boring is the feature. Do NOT add delight, illustrations, mascots, animation, or motivational copy here.**

### Layout — `/safety/trusted-adult/decline`
**Visual: Nebula-Boring** (same plain system sheet as safe-exit — no starfield accent, no pink, no emoji).

**Copy (verbatim):**
> "If you don't name an adult, here's what happens in an emergency:
> • Pookie will still show you crisis help (988, Crisis Text Line) right in the app.
> • **No adult will be told.** Not your parents, not anyone.
> • You can name someone later anytime in Settings → Safety.
>
> ☐ I understand no adult will be alerted if I'm in crisis."
> (checkbox, **unchecked by default** — hard requirement, never pre-checked)

**Button hierarchy — the anti-dark-pattern core (exact spec):**
- Both buttons: **identical size, identical weight, identical color treatment** (both neutral/plain — neither is pink/primary). Side-by-side on desktop, stacked full-width on mobile with **24px vertical gap** and equal padding (min 48px touch height each).
- Left/first: **"Go back and choose"** → returns to Screen A. Right/second: **"Continue without naming anyone"** → disabled (greyed, 50% opacity) until the checkbox is checked; enabled state has **no** extra emphasis vs the other button.
- **Order note:** "Go back" first (left/top) — the safe default sits in the primary reading position.
- **Banned:** guilt copy ("are you sure?", listing what they lose, "your parents won't know…" as a warning), countdown pressure, benefit reminders, any visual cue that marks one button as "wrong" (no red on continue, no warning icon).

**Spacing:** 32px between the bullet list and the checkbox; 24px between checkbox and buttons; card padding 24px; content centered, max-width 520px.

**Effect:** records `access_events(crisis_alert.declined_path)` with the checkbox text version pinned; teen-visible only, never parent-visible. Crisis routing = in-app resources only. The revoke/go-independent flow may then proceed.

**Reduced motion:** none — nothing animates, ever, on this screen.
**[DV]** — entire decline string set flagged for DV-advocate review.

**Component inventory:** `BoringSheet`, `PlainList`, `AcknowledgmentCheckbox` (unchecked default), `EqualWeightButtons`.

---

## 3. Crisis Card

### Design rules (absolute)
- **High contrast: no neon-on-neon.** Solid deep-navy or white card, dark text on light (or light text on solid dark) — never pink glow text on dark, never light text on translucent glass for this component. One-tap `tel:`/`sms:` links, min 48px tap targets.
- Never a modal — modals get dismissed. Inline and persistent.
- Copy (verbatim, US / Georgia launch):
> "If you're thinking about hurting yourself, you don't have to face it alone.
> **Call or text 988** — free, 24/7, confidential.
> **Text HOME to 741741** — Crisis Text Line.
> If you might act right now, **call 911**."

### Placement (four surfaces)
1. **Pinned above the mood pulse** (Wellbeing module): persistent card, L3 = dismissible per session (re-surfaces next session); L4 = **non-dismissible** until 911 or 988 is tapped or the session ends. **[DV]** — this dismiss interaction is DV-advocate reviewed.
2. **AI chat:** inline resource block *inside* the conversation thread (not a modal, not a banner). Renders at the T2/T1 response position and persists in scrollback.
3. **Check-in screen footer:** appears when L1+ detected on that check-in ("Want support options?" → expands to full crisis card).
4. **Settings → Safety → "Get help now":** always available, full card, no trigger needed.

### Teen-controlled "tell a trusted adult" action (part of the card at L1+)
- Button: **"Let [adult first name] know I'm having a hard time"**.
- Teen picks message tier: (a) "I'm having a hard time" (presence only), or (b) + their own typed note (max 280 chars).
- **Preview-before-send screen** showing exactly what the adult receives. Copy honesty line (verbatim): "This sends a text from Pookie to [name]. It won't share your check-ins or chats."
- Sent via teen's chosen channel; logged teen-visible.

### "Private spaces are not safety-monitored" explainer (Settings → Safety → "How safety works", + first-run of Wellbeing/check-in/chat — one-time, dismissible, re-findable)
Copy (verbatim):
> **"Your private spaces are yours.** Your moods, check-ins, and chats with Pookie are private to you — not even your parents can see them.
> **But they're not watched over.** Pookie doesn't read everything you write looking for problems. If you use words that sound like you might hurt yourself, Pookie will show you help options and — only then — may alert the trusted adult you chose. Nothing else you write is ever sent to anyone.
> **If you need help now:** call or text 988."
**[DV]** — flagged.

**Component inventory:** `CrisisCard` (high-contrast, 4 placements), `OneTapHelpButtons` (tel:988 / sms:741741 / tel:911), `TellAdultAction` flow, `SafetyHowItWorks` explainer.

---

## 4. Cooling-Off Flow — Steps 0–6-safe

Visual: **Nebula-Neutral** throughout (static dim starfield, flat slate cards, no animation, no confetti, no emoji, no glow buttons). Word choice: **"Remove access"** (never "Revoke" — less adversarial). Entry: Sharing screen → person card → "Remove access".

### Step 0 — Entry
Person card → quiet red-outline button "Remove access" (no alarm icon).

### Step 1 — Scope & consequences — `/sharing/remove/{person}/scope`
Per-scope list in plain words:
> "Remove Mom's access?"
>
> "What changes if you do this:
> • Her grade updates stop. She won't see new grades, report cards, or what's due.
> • Her teacher-message updates stop.
> • Your check-ins, journal, and chats with Pookie stay private — they already are.
> • Safety messages from school (permission slips, emergencies) still reach her. That part can't be turned off."
>
> "Pookie-only: your school still shares grades and attendance with your parents directly. This only changes what Pookie shares."
>
> "Before you decide — other options:
> • Narrow it instead — turn off one thing, like location, and keep the rest.
> • Pause for 30 days — everything freezes, nothing is deleted, and it turns back on by itself unless you say otherwise.
> • Talk it through — write down what's bothering you first. [Open a private note]"
- `PrimaryButton` (neutral, not pink): **"Continue"**.
- **[DV]** — flagged.

### Step 2 — Trusted-adult gate
The §1 Screen A/B/C flow. Must end with a **verified** `revoke_guardian`-role adult OR an **informed decline** (§2) before the flow can proceed. Back button allowed (no data changed yet).

### Step 3 — Notification choice — `/sharing/remove/{person}/notify`
> "When should [Parent name] find out?
> ○ **When it takes effect** (recommended) — they see the change after it's done.
> ○ **Tell them now** — they get a message as soon as you confirm.
> Only [Parent name] is told. Your other parent isn't notified."
- Radio default: **at-effect** pre-selected. InfoLine: "During the waiting period, what they see doesn't change."
- `PrimaryButton`: "Continue".

### Step 4 — Safety screen (safe-exit branch) — `/sharing/remove/{person}/safety`
> "One more thing — your safety matters more than any setting.
> ☐ **Telling my parents about this could put me at risk.**
> If you check this: access ends **right now**, no message is sent, and we'll show you support options. You can always undo this later if things change."
- Checkbox **unchecked by default**. If checked → jump to **Step 6-safe** (immediate). If unchecked → Step 5.
- Buttons (equal weight, neutral): "Continue" · "Go back".
- **[DV]** — flagged.

### Step 5 — Confirm (pending state begins, standard path) — `/sharing/remove/{person}/confirm`
> "You're removing [Parent]'s access to [scopes]. This takes effect [date, 7 days]. Until then, nothing they see changes. You can cancel anytime in Sharing."
- Buttons (equal weight, neutral): **"Keep [Parent]'s access"** · **"Remove after 7 days"**.
- 16–17: same screens, but executes **immediately** (Step-3/Step-4 choices intact; notify default still at-effect = now).

### Pending-state teen view (during the 7-day window)
- Person card shows quiet, teen-visible-only status line: **"Removing in [N] days · Cancel anytime."** with a one-tap `QuietButton` "Cancel" (no confirm — cancellable by design). Countdown updates daily ("5 days…").
- If "tell them now" was chosen: "Mom was told today. Access ends in 6 days."
- **No push notifications about the pending revoke** (no lock-screen leakage).
- Teen's own app works normally. Teen is told: "Mom sees your old info until this takes effect — nothing new goes to her."

### Step 6-safe — Safe exit (immediate) — `/safe-exit/*`
**Visual: Nebula-Boring — visually boring by design.** Plain system sheet, neutral gray palette, no pink, no starfield accent, no animation, no confetti, no emoji. If someone looks over the teen's shoulder it reads as "account settings."

**Screen 1 — `/safe-exit/start`:**
> "If telling your parents could put you at risk, you can cut off sharing right now — quietly.
>
> What happens:
> • All sharing with your parents stops immediately.
> • They don't get a message about this.
> • Your safety messages from school still reach them.
>
> [Cut off sharing now] · [Go back]
>
> If you're in crisis or need help right now: Call or text **988** (Suicide & Crisis Lifeline) · Text HOME to **741741** (Crisis Text Line)."

**Screen 2 — confirm (one extra tap; no typing, no password — speed matters):**
> "Cut off sharing with Mom and Dad right now?
> [Yes, cut it off now] · [Go back]"

**Screen 3 — after (`/safe-exit/done`):**
> "Done. Your sharing is off.
>
> What you see now:
> • Your parents see nothing new in Pookie.
> • No message was sent to them.
> • Your trusted adult is [name]. Pookie can reach them if something looks unsafe.
>
> Help, whenever you need it: **988** call/text · Text HOME to **741741** · [Find local help]
>
> [Back to my Pookie]"
>
> Small line: "This is in your private history only. It doesn't show up anywhere your parents can see."

**Design rules (absolute):**
- Max 3 taps from the Step-4 checkbox to done. No celebration, no confetti, no "you're brave" copy (don't narrate the teen's feelings; don't create evidence of intent).
- No push, no email receipt, no badge from this flow.
- Audit event `safe_exit.executed` recorded — **teen-visible only, excluded from any parent-facing surface**.
- **Undo:** teen may re-grant later; re-grant after safe-exit triggers a gentle confirm: "Are you sure? You can keep them removed." (anti-coercion).
- **[DV]** — every string in Steps 1–6-safe + notification copy flagged for DV-advocate review.

### Visual contrast: safe-exit (boring) vs go-independent (celebration)
| | Safe-exit / rupture | Go-independent |
|---|---|---|
| Theme | **Nebula-Boring**: system gray sheet, no starfield, no pink, no emoji, no motion | **Nebula-Celebrate**: full animated starfield, confetti, pink glow, divine-light halo |
| Headline tone | "Done. Your sharing is off." (period, no exclamation) | "This is yours now." / "Your own Pookie, your own rules." |
| After-feel | Indistinguishable from a settings change | Confetti burst on final screen |
| **Why it matters** | An abuser may see this screen — it must not read as an exit event | Celebration is safe here because the teen chose visibility |
| Rule | Never render Celebrate components in a rupture flow | Never render rupture-neutral copy in a graduation flow |

**Component inventory:** `NeutralSheet`, `ConsequenceList`, `AlternativeCards` ×3, `NotifyChoice` (radio), `SafeExitCheckbox`, `TrustedAdultGate`, `PendingStatusLine`, `CancelButton`, `BoringSheet`, `PlainList`, `CrisisResourceBlock`, `TwoTapConfirm`.

---

## 5. Screen Time Co-Set (13+)

Principle (verbatim, shown on the module landing): "Screen Time in Pookie is a deal you both can see. [Teen name] proposes, [Parent] approves, and everyone sees the same rules. Pookie never watches secretly — if it's limited, it's listed here."

**Hard product rule:** no parent-only dashboard, no secret reports. What is NOT built: keystroke logging, content surveillance, location-gated enforcement, or any "parent sees what teen typed." Under-13: no device agent, no MDM, no background monitoring (OS-native guidance + parent-run routines only).

### Layout A — Teen proposes — `/screentime/propose`
- Teen sets: **bedtime wind-down** (time picker), **daily app-category budgets** (per-category hour/min steppers), **homework focus blocks** (day/time ranges).
- Shared plan card (see below) renders live as the teen edits: "This is what Mom will see."
- `PrimaryButton`: **"Send my plan to [Parent]"**.

### Layout B — Parent reviews — `/screentime/review`
- Parent sees the teen's proposal in the **identical shared plan card** (same numbers, same order, same wording).
- Three actions, equal weight: **"Approve"** · **"Suggest changes"** (adjustments return to the teen as a counter-proposal — never silently applied) · **"Decline with reason"** (requires a written reason, teen-visible).
- Copy under actions: "If you change anything, [Teen name] sees your version and can respond. Nothing applies until you both agree."

### The shared plan card (both sides see the SAME numbers)
A flat slate card, identical component on teen and parent views, rendered from the same data:
> "**[Teen name]'s screen time plan**
> Bedtime wind-down: 10:30 PM — apps quiet down
> Daily budgets: Social 1h · Games 1h · Video 2h
> Homework focus: Mon–Thu 4:00–6:00 PM
> Status: [Proposed by teen · Waiting on Mom] / [Active — you both agreed] / [Change requested]
> Last change: [date] by [who]"
- No parent-only fields. No hidden enforcement toggles. If it's limited, it's listed here.

### Layout C — Active plan (identical on both sides) — `/screentime`
- The shared plan card + enforcement state per rule ("Instagram paused until 6:00 PM" — teen sees the same line the parent sees).
- Teen: `QuietButton` **"Ask for a change"** → writes reason → parent responds in-app (approve/deny with reason).
- Parent: "Respond" to the appeal inline.

### Layout D — Appeal history — `/screentime/appeals`
- Chronological list, visible to **both**: teen's request + reason, parent's response + reason (or "No response yet"), timestamps.
- If a parent ignores appeals, the plan keeps running (no auto-escalation); teen sees "No response yet." — honest, not weaponized.

**Component inventory:** `SharedPlanCard` (single component, both roles), `ProposeForm`, `ReviewActions`, `AppealThread`, `AppealHistoryList`.

---

## 6. Explorer Setup (Out & About gate, 13–15)

Triggers on first open of Events / Trails / Restaurants for 13–15. Weather (W26) is exempt (informational) but shows the safety footer. Route: `/explorer/setup/*`. Visual: Nebula-Neutral.

### Screen 1 — Trusted-adult contact check
> "Who should get your plans when you go out?"
- Picker from existing `trusted_adults` (outing_contact role) + "Add someone new" (→ §1 Screen B/C). Required to proceed for 13–15; 16–17 optional-but-encouraged.

### Screen 2 — Safety Basics: four 45-second interactive cards
**One-tap acknowledgment pattern:** each card shows its content + a demo/interactive element + a single acknowledgment button at the bottom. Cards advance on tap; progress dots (1–4, static, no animation). Reading level ≤8th grade.

**Card 1 — Share your plan**
> "Before you go: where, with whom, when you'll be back. Pookie can text it to your trusted adult in one tap."
- Interactive: demo "Share my plan" button (sends nothing in setup — shows the preview it would send).
- Ack button: **"Got it — I'll share my plan"**

**Card 2 — Public places, daylight**
> "Stick to public, populated places. Parks close at dusk — plan to be out well before dark. Trust your gut; leaving is always okay."
- Ack button: **"Got it — public places, home before dark"**

**Card 3 — Check in**
> "Set a check-in timer. If you miss it, Pookie nudges *you* first — then your trusted adult if you don't respond."
- Interactive: teen sets a sample timer (shows the nudge preview).
- Ack button: **"Got it — I'll set check-in timers"** (teen controls the timer — stated in the card)

**Card 4 — If something feels wrong**
> "Call 911 first, then your trusted adult. Your live plan is on your phone even with no signal."
- Interactive: offline plan card preview ("This works with no signal").
- Ack button: **"Got it — 911 first"**

Completion recorded (`explorer_setup_completed_at`). **Under-16: non-dismissable** — no X, no skip, no "do this later"; the module stays gated until all four cards are acknowledged. 16–17 get a 60-sec refresher, skippable after first view.
**[DV]** — Safety Basics content flagged for DV-advocate review (Appendix C gate #1).

### Screen 3 — Family-aware defaults (until 16)
> "Your safety defaults — you can loosen these at 16:"
- "Share my plan" pre-filled on every plan (teen taps send — never auto-sent).
- Events default to Family/Teen audience.
- Coarse location only; no location history kept.
- Dusk guard on (90-min sunset warning).
- `PrimaryButton`: **"Start exploring"**.

**Reduced motion:** progress dots are static; card transitions are instant cuts (no slide animation), or a fade only when `prefers-reduced-motion` is off. Static equivalent: numbered list "1 of 4".

**Component inventory:** `SetupFlow`, `SafetyBasicsCard` ×4, `AckButton`, `DemoShareButton`, `TimerDemo`, `OfflinePlanPreview`, `StaticProgressDots`, `DefaultsSummary`.

---

## 7. W19 Emergency Module

### Positioning (verbatim banner — persistent, NOT dismissible)
At the top of the Emergency module, above all content, on every visit:
> **"Pookie is not an emergency service. In an emergency, call 911 first — then use this page."**
- Plain text under the module title — not a banner, not dismissible, not buried in settings.
- Module subtitle: "Your info, ready when you need it. Not a replacement for 911."

### Resource list (Georgia launch seed)
One-tap call buttons, high-contrast rows:
- **911** — Emergency — call 911
- **Poison Control** — 1-800-222-1222 (call or text)
- **988 Suicide & Crisis Lifeline** — call/text 988
- **Georgia Crisis & Access Line** — 1-800-715-4225
- **Crisis Text Line** — text HOME to 741741
- **DFCS child-abuse reporting** — 1-855-422-4453 — "If a child is being hurt or is unsafe"
- Cobb County non-emergency police line (verify number at seed time)
- Honesty line under the list (verbatim): "Numbers verified [date]. If one doesn't work, call 911."

### Break-glass QR generation screen — `/emergency/break-glass`
> "Make an emergency card anyone can read — no Pookie login needed."
- Teen picks fields via checkboxes (teen controls what's on the card): name, emergency contact (trusted adult), blood type, top-3 allergies, "full info: scan QR".
- `PrimaryButton`: **"Generate 24-hour QR code"** → shows QR + 6-digit code, valid 24h, single-viewer.
- Copy (verbatim): "Anyone who scans this sees your emergency info — only print it for places you trust."
- Every view audit-logged (`access_events(emergency.break_glass_viewed)`), teen-visible.
- Works regardless of parent access state (reads the teen's own record).
- **In-app path:** "Emergency info" button in the W19 header (medical-cross icon, high contrast) → no re-login if session active; expired session → 4-digit device PIN the teen set at first run (NOT the parent's PIN, NOT the account password).

### Lock-screen card preview
Wallet-pass-style card preview (works with phone locked, no Pookie login): teen name, emergency contact (trusted adult), blood type, top-3 allergies, "full info: scan QR". Big **"Call 911"** button pinned at top of the break-glass card. Break-glass card itself: **high-contrast, boring-system styling** — readable to a stranger, not Nebula-pretty.

### Lab emergency quick-card (per lab class)
One-tap card: teacher name, room, school nurse/front-office number + universal lab rules ("goggles on, spill = tell teacher immediately, eyewash location — ask your teacher day one"). Lives in Emergency module + linked from the class page.

### Action-plan templates
Teen-fillable: severe allergy, asthma, seizure response — "my signs → my meds → who to call → what to tell 911". Stored encrypted, printable, shareable via break-glass QR at teen's discretion. Informational scaffolding only — no diagnostic language.

**Component inventory:** `EmergencyDisclaimer` (persistent header line), `ResourceCallList`, `EmergencyInfoButton`, `DevicePinGate`, `BreakGlassCard` (high-contrast system styling), `QRGenerator`, `FieldPicker` (checkboxes), `Call911PinnedButton`, `LabQuickCard`, `ActionPlanTemplate`.

---

## 8. Copy Deck — All Strings, Verbatim

Organized by screen. **[DV]** = needs DV-advocate review (Appendix C gate #1).

### Trusted-adult A/B/C (§1)
- A: "Before this change goes through, you need one adult Pookie can reach in a real emergency. This adult does **not** get to see your Pookie — they only get a safety alert if you're in danger. You choose them. You can change this anytime."
- A buttons: "Choose an adult" / "I don't want to name one"
- B microcopy: "We'll text them a short message to confirm this number is really theirs."
- B button: "Send confirmation"; validation: "Add a name and a phone number or email so we can reach them."
- C: "We sent a text to [name]. They need to tap the link to confirm. You can finish choosing later — your request is saved as a draft."
- 48h nudge: "[Name] hasn't confirmed yet. You can send it again, pick a different adult, or continue without naming one." / "Send again" / "Pick a different adult" / "Continue without naming one"
- Adult same-room check: "Did [teen name] ask you to be their safety contact, freely?" / Yes / No
- Trusted-adult management screen (§4.4): "Trusted adults — the grown-ups Pookie can reach if you're in danger. They **can't see your Pookie**. You choose them, and you can remove them anytime."

### Decline path (§2) [DV]
- "If you don't name an adult, here's what happens in an emergency: • Pookie will still show you crisis help (988, Crisis Text Line) right in the app. • **No adult will be told.** Not your parents, not anyone. • You can name someone later anytime in Settings → Safety."
- Checkbox: "☐ I understand no adult will be alerted if I'm in crisis." (unchecked by default)
- "Go back and choose" / "Continue without naming anyone"

### Crisis card (§3) [DV]
- "If you're thinking about hurting yourself, you don't have to face it alone. **Call or text 988** — free, 24/7, confidential. **Text HOME to 741741** — Crisis Text Line. If you might act right now, **call 911**."
- "Let [adult first name] know I'm having a hard time"
- "This sends a text from Pookie to [name]. It won't share your check-ins or chats."
- "Your private spaces are yours. Your moods, check-ins, and chats with Pookie are private to you — not even your parents can see them. But they're not watched over. Pookie doesn't read everything you write looking for problems. If you use words that sound like you might hurt yourself, Pookie will show you help options and — only then — may alert the trusted adult you chose. Nothing else you write is ever sent to anyone. If you need help now: call or text 988."
- AI disclosure (first chat use + Safety settings): "If you tell Pookie someone is hurting you: Pookie will listen and help you find support (like 988 or a trusted adult). Pookie won't promise to keep it secret — and won't tell your parents automatically. If you're in immediate danger, Pookie will try to get help to you fast."
- AI required line (never "just between us"): "I'm not a person and I can't keep secrets the way a friend can — but what you tell me stays in your private space unless you're in danger."

### Cooling-off Steps 0–6-safe (§4) [DV]
- Entry: "Remove access"
- Step 1: "Remove Mom's access?" / consequence bullets / "Pookie-only: your school still shares grades and attendance with your parents directly. This only changes what Pookie shares." / alternatives row / "Continue"
- Step 3: "When should [Parent name] find out? ○ When it takes effect (recommended) — they see the change after it's done. ○ Tell them now — they get a message as soon as you confirm. Only [Parent name] is told. Your other parent isn't notified." / "During the waiting period, what they see doesn't change."
- Step 4: "One more thing — your safety matters more than any setting. ☐ Telling my parents about this could put me at risk. If you check this: access ends right now, no message is sent, and we'll show you support options. You can always undo this later if things change."
- Step 5: "You're removing [Parent]'s access to [scopes]. This takes effect [date, 7 days]. Until then, nothing they see changes. You can cancel anytime in Sharing." / "Keep [Parent]'s access" / "Remove after 7 days"
- Pending: "Removing in [N] days · Cancel anytime." / "Cancel" / "Mom was told today. Access ends in 6 days." / "Mom sees your old info until this takes effect — nothing new goes to her."
- Safe-exit 1: "If telling your parents could put you at risk, you can cut off sharing right now — quietly. What happens: • All sharing with your parents stops immediately. • They don't get a message about this. • Your safety messages from school still reach them. [Cut off sharing now] · [Go back] If you're in crisis or need help right now: Call or text 988 (Suicide & Crisis Lifeline) · Text HOME to 741741 (Crisis Text Line)."
- Safe-exit 2: "Cut off sharing with Mom and Dad right now? [Yes, cut it off now] · [Go back]"
- Safe-exit 3: "Done. Your sharing is off. What you see now: • Your parents see nothing new in Pookie. • No message was sent to them. • Your trusted adult is [name]. Pookie can reach them if something looks unsafe. Help, whenever you need it: 988 call/text · Text HOME to 741741 · [Find local help] [Back to my Pookie] This is in your private history only. It doesn't show up anywhere your parents can see."
- Re-grant anti-coercion: "Are you sure? You can keep them removed."
- Revoke-gate error: "Name a trusted adult (or choose 'no adult') first — this keeps a safety channel open."
- At-effect notification (to revoked parent only): "An update on Pookie: [Teen first name] has changed their sharing settings, and you no longer have access to [their/them] Pookie records. School records are unaffected — contact the school directly for grades and official messages."

### Screen Time co-set (§5)
- "Screen Time in Pookie is a deal you both can see. [Teen name] proposes, [Parent] approves, and everyone sees the same rules. Pookie never watches secretly — if it's limited, it's listed here."
- "Send my plan to [Parent]"
- "If you change anything, [Teen name] sees your version and can respond. Nothing applies until you both agree."
- Shared card labels: "[Teen name]'s screen time plan" / "Bedtime wind-down" / "Daily budgets" / "Homework focus" / "Status" / "Last change"
- "Ask for a change" / "No response yet."

### Explorer Setup (§6) [DV]
- "Who should get your plans when you go out?"
- Card 1: "Before you go: where, with whom, when you'll be back. Pookie can text it to your trusted adult in one tap." / "Got it — I'll share my plan"
- Card 2: "Stick to public, populated places. Parks close at dusk — plan to be out well before dark. Trust your gut; leaving is always okay." / "Got it — public places, home before dark"
- Card 3: "Set a check-in timer. If you miss it, Pookie nudges *you* first — then your trusted adult if you don't respond." / "Got it — I'll set check-in timers"
- Card 4: "Call 911 first, then your trusted adult. Your live plan is on your phone even with no signal." / "Got it — 911 first"
- "Your safety defaults — you can loosen these at 16:" / "Start exploring"

### W19 Emergency (§7)
- "Pookie is not an emergency service. In an emergency, call 911 first — then use this page."
- Subtitle: "Your info, ready when you need it. Not a replacement for 911."
- "Numbers verified [date]. If one doesn't work, call 911."
- "Make an emergency card anyone can read — no Pookie login needed."
- "Generate 24-hour QR code"
- "Anyone who scans this sees your emergency info — only print it for places you trust."
- DFCS label: "If a child is being hurt or is unsafe"

---

## 9. Component Inventory (for the frontend engineer)

| Component | Used in | Notes |
|---|---|---|
| `FullPageFlow` | Trusted-adult A/B/C, Explorer Setup | Wizard shell, Nebula-Neutral |
| `BoringSheet` | Decline path, safe-exit, quiet exits | System-style sheet; no starfield, no pink, no emoji, no animation |
| `NeutralSheet` | Cooling-off Steps 1–5, notify choice | Dim static starfield, flat slate cards |
| `PlainList` / `ConsequenceList` | Decline, Step 1, safe-exit | Bullet lists, 24–32px rhythm |
| `AcknowledgmentCheckbox` / `SafeExitCheckbox` | Decline (§2), Step 4 | Always unchecked by default |
| `EqualWeightButtons` | Decline §2 | Identical size/weight/color; 24px gap; min 48px targets |
| `RelationshipChips` | Screen B | Single-select: Parent/Relative/Counselor/Coach/Faith leader/Neighbor/Other |
| `PendingStatusCard` / `PendingStatusLine` | Screen C, pending revoke | Teen-visible only |
| `CrisisCard` | 4 placements (§3) | High-contrast; L3 dismiss-per-session, L4 non-dismissible |
| `OneTapHelpButtons` | Crisis card, Rung 3, break-glass | tel:988 / sms:741741 / tel:911 |
| `TellAdultAction` | Crisis card | Message-tier pick → preview → send |
| `SafetyHowItWorks` | Settings → Safety | "Private spaces" explainer, dismissible, re-findable |
| `CrisisResourceBlock` | Safe-exit, decline, quiet exit | 988 / 741741 / local help |
| `TwoTapConfirm` | Safe-exit screen 2 | One extra tap; no typing/password |
| `NotifyChoice` | Step 3 | Radio; at-effect default |
| `AlternativeCards` ×3 | Step 1 | Narrow / pause-30 / talk-it-through |
| `SharedPlanCard` | Screen Time | Single component, identical both roles |
| `SafetyBasicsCard` ×4 + `AckButton` | Explorer Setup | One-tap ack; static progress dots |
| `EmergencyDisclaimer` | W19 header | Persistent, verbatim, not dismissible |
| `BreakGlassCard` | W19 | High-contrast system styling |
| `QRGenerator` + `FieldPicker` | Break-glass screen | 24h validity; teen-picked fields |
| `Call911PinnedButton` | Break-glass card top | Pinned |

**Shared rules across components:** ≤8th-grade copy; `prefers-reduced-motion` honored everywhere (static equivalents: numbered "1 of 4" instead of animated dots, instant cuts instead of slide transitions, no spinners — flat progress lines or static states); min 48px touch targets on all safety actions; no push/email/badge from decline, safe-exit, quiet-exit, or revoke-pending flows.

---

## 10. Open Questions / Blockers for the Squad Coordinator

1. **[DV] Appendix C gate #1:** every string marked [DV] needs DV-advocate review before launch (revoke/notify/safe-exit strings, crisis protocol strings, Safety Basics content, retaliation matrix). Needs scheduling as a milestone dependency — reported per instructions.
2. Cobb County non-emergency police line number must be verified at W19 seed time.
3. `per-`[date] in "Numbers verified [date]" — confirm whether the date is auto-rendered from the seed migration or manually maintained.
4. sol-safety §1.5 places the decline path as Screen B's secondary button; sol-ux §8 covers coercion, not this decline — no conflict found; both consistent.
5. No conflicts with the graduation-vs-rupture split in sol-ux.md: safe-exit uses Nebula-Boring, standard revoke uses Nebula-Neutral, go-independent keeps Nebula-Celebrate — the three-tier split (Boring < Neutral < Celebrate) is consistent across both docs.

*End of Squad 1 UX specs.*
