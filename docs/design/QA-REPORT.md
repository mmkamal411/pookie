# QA-REPORT — Design QA Test Pass (Wave-3 Gate Screens)
**Author:** Design QA (reporting to the Design Coordinator) · **Date:** 2026-10-11 ~14:42 EDT
**Scope:** `UI-SHELL-HOME.md` · `UI-V1-MODULES.md` · `UI-PLACEHOLDERS.md` · `IA-FINAL-V2-LIFEAPP.md` · `GATE-REVIEW-1.md` (25 notes) · `DESIGN-DIRECTION.md` (10 kill criteria)
**Method:** read every screen spec end-to-end; verified each of the 25 gate notes against the screens (not the claims); walked the 11 PM tired-parent path; stress-tested edge cases; ran the 5-second test; line-checked copy for shame.

**⚠️ Moving-target warning:** these docs were amended *during* this QA pass (IA amended 24→31 modules ~14:40 EDT; MOTION-SPEC.md landed in parallel). Findings below are against the versions on disk at 14:42 EDT. The single biggest defect class in this pass is **doc drift between the three designers and the amended IA** — the founder will notice numbers that disagree.

---

## 1. The 25-note verification — CONFIRMED / GAP per note

| # | Note | Verdict | Evidence / what's missing |
|---|---|---|---|
| A-N1 | Today's Three = exactly 3 | **CONFIRMED** | Shell §1.2: "Exactly 3 `AttentionCard`s, day-ordered"; V1 §3.1–3.2 render exactly 3. **Caveat → kill list #12:** the 1–2-item case is undefined in the shell; V1 §3.3 (Maya) renders 1 card + a quiet line under a "TODAY'S THREE" header — needs a named rule. |
| A-N2 | `/child/:id` in the route table | **CONFIRMED** | IA §1 route table lists it; shell §1.2: "Tap a plant → `/child/:id` (A-N2: the child's grove view — a real route)". The screen itself isn't a gate screen — the note only required the route. |
| A-N3 | Kill the hash route | **CONFIRMED** | Shell §6: "no hash routes anywhere; Money destination = `/money`, `/money/spend`, `/money/credit`"; V1 uses real sub-routes throughout (`/school/calendar`, `/money/credit`). |
| A-N4 | One collapsed seedling expander per grove rail | **CONFIRMED** | Shell §1.2: "exactly ONE collapsed expander: *'▸ 2 more taking root 🌱'*"; §1.5 same for the childless rails. |
| A-N5 | Ritual close survives the scroll | **CONFIRMED** | Shell §1.2: the Water-the-Garden **pinned end-cap** with full behavior, both personas, all day-states; "can't end calmly = bug". V1 §3.2–3.5 narrate the close morning + evening. **Gap → kill list #7:** the 9 PM closeout (V1 §3.5) has no Garden composition in the shell. |
| A-N6 | SOS reachability proof | **CONFIRMED (spec-level)** | Shell §3.3: 3 paths; Path 1 = calm row → sheet → call = **2 taps**; 64px+ targets; gesture taught in onboarding (§4.1) with practice; Wave-3 shaking-hand test recorded as Milestone-1 acceptance criterion. **Gaps → kill list #6, #16:** (a) the visible calm row is hidden at night when rails hide — the ≤2-tap promise becomes gesture-dependent; (b) shell §7 says the SOS sheet rises in 220ms; the newer MOTION-SPEC mandates 120ms flat/instant — shell must be updated to match. |
| A-N7 | Thumb-zone search entry | **CONFIRMED** | Shell §3.1: pinned search row at the top of Groves + header ⌕; pull-down-to-search as Wave-3 proof. The note's "and/or" is satisfied by the pinned row. |
| A-N8 | W9 counting language | **GAP — doc drift** | The *design* satisfies it everywhere (W9 never a tile + the quiet explainer row). The *numbers* contradict each other: IA (amended) says **30 tiles / 31 modules / 6 groves**; shell §6 says **"28 tiles for the 29-module map"**; V1 §3.6 + §8 say **"23 tiles + the explainer row"**. Three docs, three counts. → kill list #1. |
| A-N9 | Day-0 specified | **CONFIRMED, now stale** | Shell §4: one-screen intake, seedling garden, first-bloom-≤48h, both lives — genuinely good. **Stale vs the amended IA → kill list #2, #3:** intake needs the extended fields (vehicles, home airport, loyalty, taste profile, interests, places); the childless map is now 3 groves / 17 modules, not "2 groves, 10 modules"; the W26 dawn sky line is missing from the GreetingHero spec. |
| A-N10 | W10 "intentional?" rewrite | **CONFIRMED** | Shell §2.1 + IA §4 carry the curious rewrite verbatim: *"…want a look at the breakdown?"* |
| A-N11 | Drop the count; empty-day delight | **CONFIRMED** | "See the rest →" with no count (shell §1.2, V1 §3.2); the quiet-day micro-delight is a guaranteed contract (shell §1.3), not a hope. |
| A-N12 | 360px header audit | **CONFIRMED (spec-level)** | Shell §3.1: collapse rule + the 360px arithmetic (44+44+44+gutters = 164px); §3.2 childless header minimal by construction. On-device verification is engineering's job. |
| A-N13 | 3-child spotlight + Household hub | **CONFIRMED (pattern)** | Shell §1.2: the spotlight-plant pattern (attention-heavy child full, others moonlit-resting, never compared) + the Household-scope bed composition. **Note:** the gate screens only *draw* a 2-child scene — recommend one 3-child ASCII for the record. |
| A-N14 | Orbs counted in the glow budget | **CONFIRMED, with a live conflict** | Shell §0.2: ≤3 animating glows, every screen counts; §0.4: one interactive orb/screen. **Conflict → kill list #5:** §0.4 (FAB only where the center tab isn't visible) vs §8-Q1 (FAB on mobile Today/Grow/Groves) vs V1 §10.2 (FAB stated as fact). If the FAB renders alongside the breathing center-tab orb on one mobile screen, that's two interactive orbs — an A-N14 violation. Needs the coordinator's decision, not another footnote. |
| A-N15 | "Menu" → "Groves" | **CONFIRMED** | Shell §0.3: `NAV.FIFTH_LABEL` token ships `"Groves"`. **Trivial:** UI-PLACEHOLDERS.md still says "Menu row" on all six screens → rename to "Groves row". |
| A-N16 | One queue, two lenses | **CONFIRMED** | Shell §1.2; V1 §3.1: snooze/dismiss reflected in both, same frame. |
| A-N17 | Walkthrough includes the close | **CONFIRMED in shell/V1; GAP in IA** | Shell §1.2–1.4 + V1 §3.2–3.5 all narrate the water tap and signature exit. But IA §7's "repaired" walkthrough contradicts shell §1.4: it shows *"Today's Three shows two cards"* at 11 PM while the shell says *"The queue is gone. Not collapsed — gone."* → kill list #8. |
| P-N1 | Hub-rail placeholder rule (mirror) | **CONFIRMED** | Same evidence as A-N4. |
| P-N2 | Flat routes | **CONFIRMED** | Placeholders §0: `/driving`, `/childcare`, `/emergency`, `/college`, `/safety`, `/summer` — all real, all flat. |
| P-N3 | No cold seasonal invitations | **CONFIRMED** | W18 carries the consent-gated pair (February opt-in + standard interest), both undo-able, neither ever cold. |
| P-N4 | Seed required unless documented omission | **CONFIRMED** | Placeholders §0 seed registry (real tables per module); W19's deliberate omission is documented with rationale. |
| P-N5 | W19 quiet CTA | **CONFIRMED** | Reverent consent-gated interest CTA only; seasonal-reminder variant dropped. |
| P-N6 | Seed-first ordering | **CONFIRMED** | W6 drive log above capabilities; V1 W24 "Connect your cards" first on screen. |
| P-N7 | Graduation payoff | **CONFIRMED** | Per-screen launch lines (placeholders App. F); V1 §8.1: *"Your connected cards will be here on day one, with their history already growing."* |
| P-N8 | Waves, never dates | **CONFIRMED** | "in the next wave" / "Growing in Wave 2" throughout; no calendar dates anywhere in the six. |

**Tally: 23 CONFIRMED, 2 GAP (A-N8 doc drift, A-N17 IA contradiction) + 1 live conflict (A-N14 FAB) + staleness on A-N9.**

---

## 2. The 11 PM test — walked as an exhausted parent

**What passes.** The night Garden (shell §1.4) is the best screen in the set. Four elements — dusk hero, one tomorrow line, water tap, tab bar. No queue, no rails, no strip. *"The interface apologizes for existing"* is the right instinct, and the copy earns it: *"Sleep easy. The family's okay. I'll keep watch."* The QuietHoursBanner is dismissible and honest. The evening closeout (V1 §3.5) is three lines, no tables of numbers after 9 PM. If the founder opens this at 11 PM, he exhales. **This is the bar, and the night state clears it.**

**Where it breaks:**

1. **The SOS backup vanishes at night.** The visible calm row (`🛟 Emergency — get help fast →`) lives in Today → If Needed and the Safety grove — both hidden when the night Garden strips the rails. At 11 PM the ≤2-tap promise depends entirely on remembering the taught long-press. A panicking, exhausted parent should not have to remember a gesture. **Fix:** keep one quiet SOS row in the night composition (below the water tap, above the quiet-hours banner), or document the decision to rely on the gesture — but "the gesture is taught in onboarding" is not a panic plan.
2. **There is no 9 PM Garden.** V1 §3.5 specs the evening closeout checklist; the shell jumps from morning/quiet-day states straight to the 11 PM state. What does the hub look like at 9 PM — closeout cards? A dusk Garden? The shell must compose it, or engineering will invent it.
3. **IA §7 contradicts the shell's night rules.** IA: *"Today's Three shows two cards"* at 11 PM. Shell §1.4: *"The queue is gone. Not collapsed — gone."* One of them is wrong; the shell's version is the right one. Fix IA §7.
4. **Copy nit at 9 PM:** the closeout's *"○ Dentist call — draft still waiting."* — "still waiting" is mild guilt at the exact hour the product promises calm. Rewrite: *"○ Dentist call — the draft is ready when you are."*

---

## 3. Edge cases

**3 kids.** The spotlight pattern (shell §1.2) is specified, not just hoped for — attention-heavy child full, others moonlit-resting, never ranked or compared. The Household-scope bed is composed. What's missing: (a) a drawn 3-child scene for the record; (b) the Today's Three ordering rule across 3 children — does the spotlight child's queue dominate, or does day-ordering interleave? Unspecified.

**0 kids — parenting leakage.** The childless Garden (§1.5), header (§3.2), briefing (V1 §3.3), and Grow contract are genuinely clean — no greyed doors, no "child" in navigation. **But the name "Maya" is used for two different humans** (see kill list #4), which will read as a leak/confusion bug to the founder. Also stale: the amended IA gives her 3 groves / 17 modules and a W26 dawn line; the shell still draws 2 groves / 10.

**Empty states.** Seedling garden (§4.2) is excellent — absence, never apology; the 48h rule (*"Resting. It'll be here when you are."*) is the product's moral center. Today bands have warm honest silence. Shopping has SeedlingEmpty. **Missing:** (a) `/school` with the portal not connected — what renders? (b) Grow on Day 0 for Maya — "never an empty parenting trophy case" is stated, but her *own* Day-0 Grow is not composed; (c) mail with zero snaps is covered by the snap card — fine.

**Extremely long module names.** "Driving & Life Skills" on a 120×120 rail tile (sigil + name + one-line state) has no truncation/wrapping rule — it will wrap to 3 lines and crowd the state line. Groves index rows are fine (full-width rows). **Fix:** one line-clamp rule for rail tiles (e.g., 2-line clamp, `text-small`, state line always visible).

**Failed states.** Staleness: the TopBannerSlot (§3.4) is honest (*"Last updated 2h ago — the garden may have grown since."* + Sync now) — good. OCR: pending ✓, low-confidence ✓ (*"I read $142.18 — is that right?"*). **Missing:** (a) OCR total failure — the photo is unreadable or isn't mail at all; the card can't breathe forever; (b) the Garden hero itself shows no staleness — three cards rendered from 3-day-old data with no age signal on the hub; (c) school portal disconnected (above).

**Accessibility.**
- **Contrast:** cannot verify hex values from prose specs — but **the light theme ("morning-mist light") is not designed in any gate screen.** Kill criterion #9 requires both themes designed, not derived. Closest thing to a gate-blocker in this report.
- **Touch targets:** SOS 64px+ ✓, ChildSwitcher 44px ✓, intake rows 64px ✓, seedling forms ✓. **"Not now" links have no specified target** — as drawn they're small text links, likely <44px. Every "Not now" must be a 44px-min target; it's the most-tapped control on the most-tapped cards.
- **Screen-reader order:** the sacred composition order (§1.1) is the right foundation; GrowthRing has an `aria-label` ✓; fireflies are `aria-hidden` ✓. **Missing:** decorative glyphs (☀️ 🌙 ✦ 🌱) not marked `aria-hidden`; the SOS long-press has no announced alternative on the orb itself (the visible row covers it — fine, but say so).
- **Reduced motion:** honored everywhere, and MOTION-SPEC §6 makes it first-class. ✓

---

## 4. The 5-second test — Facebook-fluent adult

| Screen / element | Verdict |
|---|---|
| "Snap the mail" (big camera card) | **PASS** — a grandmother knows what this does. |
| "Approve payment" / approval sheet | **PASS** — exact action, exact words, consequence list. |
| "See the rest →" | **PASS** — and the no-count discipline holds. |
| "Not now" | **PASS** (copy); target size → kill list #9. |
| "🌱 Taking root" / "Planting" pill | **PASS** — reads as "growing, not broken." |
| "Connect your cards →" | **PASS** |
| "Quiet hours — nudges rest until 6:00 AM" | **PASS** |
| "✦ NEEDS A LOOK" eyebrow | **PASS** |
| **"Groves" tab (grid icon)** | **FAIL — the #1 risk in the chrome.** A Facebook-fluent adult has no mental model for "groves" as "where everything lives." The grid icon helps; the word doesn't. The `NAV.FIFTH_LABEL` token exists precisely for this — **user-test "Groves" vs "Menu" with real adults before Milestone 1, and keep the swap one token flip.** |
| "Water the garden" (first encounter) | **BORDERLINE.** Is it a game? A ritual? The Day-0 seedling garden teaches it, and by day 3 it's the product's signature. Keep, but it's the second thing to user-test. |
| "How Pookie picks your moments" (W9 explainer row) | **PASS** — plain curiosity, plain answer. |
| "The Summer grove wakes in February 🌱" | **PASS** — countdown, consent-gated, no cold push. |
| "SproutMeter" vocabulary | Internal only; the user sees "Sapling 🌱" + "3-day streak" — **PASS**. |

---

## 5. Shame-free audit — quote, verdict, rewrite

The copy discipline is the strongest part of this design package. Line-checked against Direction §1.2 ("Mission, never judgment") and the Guidance never-say list. Findings:

1. **`"69 ··· F"` (V1 §2.1, class hero).** The F is the school's label rendered in warm ember as a rally, led by the gap-first mission line — and the founder's own standing rule requires numeric + letter side by side, visible on open. **Verdict: KEEP.** The designers' open question #1 (soften to the band word at a glance?) is correctly routed to the founder.
2. **`"○ Dentist call — draft still waiting."`** (V1 §3.5, 9 PM closeout). "Still waiting" is a mild guilt-trip at the hour that promises calm. **Rewrite:** *"○ Dentist call — the draft is ready when you are."*
3. **`"↓ 4 this week — the two missing assignments look like the cause."`** (V1 §2.1). Honest delta, cause-paired, no verdict. **KEEP.**
4. **`"If something happened to you tomorrow, would the right people know what to do?"`** (W19 hero). Heavy by design; reverent, unhurried, no exclamation marks — the tone law holds. **KEEP**, but note: this is the one screen a parent might open at 11 PM and feel the weight. That's the module's job; don't soften it into meaninglessness.
5. **`"Chase at 31% — pay $400 by Friday to stay under 30."`** (W24). Coaching, specific, no judgment. **KEEP** — this is the voice.
6. **`"Sleep: 3 short nights — the lever might be bedtime, not willpower."`** (Today band). Exemplary — interpretation, not data-dump; absolves instead of accuses. **KEEP.**
7. **V1 §3.2 briefing card 3** renders the eyebrow as *"Tonight"* instead of *"✦ NEEDS A LOOK"* — a grammar break, not a shame issue, but while here: the quiet-card variant needs a definition (→ kill list #13).

No "at-risk," no "failing," no "you haven't," no red-on-human anywhere. The W10 rewrite landed. **The shame-free audit passes.**

---

## 6. Kill list — specific, actionable

Ordered by founder-noticeability.

1. **Module-count drift across the three designers.** IA (amended): 30 tiles / 31 modules / 6 groves. Shell §6: "28 tiles for the 29-module map." V1 §3.6 + §8: "23 tiles + the explainer row." **Action:** one canonical module registry (single source of truth); update shell §6, V1 §3.6/§8, and the shell's childless map to the amended counts. The founder *will* spot three different numbers.
2. **Shell §1.5 childless map is stale.** "2 groves, 10 modules" vs amended "3 groves, 17 modules (16 tiles + W9)". **Action:** redraw with the 🌍 Out & About rail and the W26 dawn sky line under the GreetingHero (*"Sunny, 75° — no jacket needed."*).
3. **Shell §4.1 intake is stale.** Four tiles vs the amended extended intake (vehicles, home airport, loyalty, taste profile, interests, places). **Action:** update the intake spec.
4. **"Maya" is two different humans.** The childless persona is *Maya, 29, Austin* (shell §1.5) — but the parent's second child is also "Maya" (shell §1.2: *"Maya's fern"*; IA §3.1: *"Dawson's tree · Maya's tree"*; V1 §5: *"☑ Bread — Maya · claimed ✓"*; W10: *"spend on Dawson is 3× Maya's"*). Meanwhile IA §6 calls the dad's kids **Liam and Ella**. **Action:** one naming pass — rename the second child (or the persona) and fix IA §6. The founder, a single dad of Dawson, will notice a second child named Maya.
5. **Orb/FAB conflict (A-N14).** Shell §0.4 vs §8-Q1 vs V1 §10.2 disagree on whether the FAB renders alongside the breathing center-tab orb on mobile Today/Grow/Groves. Two interactive orbs on one screen violates A-N14. **Action:** coordinator decides; one rule, written once, referenced everywhere.
6. **Night SOS visibility.** The visible calm row hides with the rails at night; the ≤2-tap promise becomes gesture-dependent. **Action:** keep one quiet SOS row in the night Garden composition, or document the decision.
7. **No 9 PM Garden composition.** V1 §3.5's closeout has no hub state in the shell. **Action:** spec the 9 PM Garden (dusk closeout) between quiet-day and 11 PM.
8. **IA §7 contradicts shell §1.4.** "Today's Three shows two cards" at 11 PM vs "the queue is gone." **Action:** fix IA §7 to the shell's (correct) version.
9. **"Not now" touch targets unspecified.** The most-tapped control on the most-tapped cards. **Action:** 44px minimum on every "Not now," no exceptions.
10. **Rail-tile truncation rule missing.** "Driving & Life Skills" on 120×120. **Action:** one line-clamp rule (2-line clamp, state line always visible).
11. **Failed states missing.** OCR total failure; `/school` with portal disconnected; Grow Day-0 for Maya. **Action:** spec each — "Still gathering — your garden is safe" is the direction's line; give it surfaces.
12. **Sub-3 queue undefined.** V1 §3.3's 1-card + quiet line under "TODAY'S THREE" needs the shell's blessing as a named rule.
13. **V1 §3.2 card-3 grammar break.** "Tonight" eyebrow vs the fixed AttentionCard grammar. **Action:** fix, or define the quiet-card variant.
14. **Light theme not designed.** Kill criterion #9. Every gate screen is dark-theme only. **Action:** spec the morning-mist light theme per screen, or explicitly defer with a named wave — don't let it be "derived."
15. **Placeholders: "Menu row" → "Groves row"** (6 occurrences). Trivial; do it with the next edit.
16. **Shell §7 SOS timing vs MOTION-SPEC.** Shell says 220ms rise; MOTION-SPEC (newer) mandates 120ms flat/instant for the panic path. **Action:** update shell §7 to match.
17. **BUILD-LOG claims `UI-PLACEHOLDERS-W25-W31.md` was delivered — the file is not on disk.** **Action:** verify the write landed or re-deliver; the merge with UI-PLACEHOLDERS.md is blocked until it exists.
18. **Shell's 70ms stagger lacks the cap.** MOTION-SPEC sets `--stagger-cap: 8 items` (container animates once past 8). **Action:** shell §7 should cite the cap — a 20-tile Garden must not cascade for 1.4s.

**What is NOT on the kill list (deliberately):** the "69 ··· F" (founder's rule, shame-free framing holds); the W19 heaviness (intentional); "Water the garden" (borderline 5-second, but the ritual earns it); the W18 dual CTA (consent pair, correct per P-N3/P-N5); "See the rest" (correct).

---

## 7. Verdicts per document

- **`UI-SHELL-HOME.md` — SHIP WITH FIXES.** The shell is the strongest piece: the glow budget, the tab contract, the night rules, the ritual close, the Day-0. Fixes: #1 (counts), #2 (childless map), #3 (intake), #5 (orb/FAB decision), #6 (night SOS), #7 (9 PM Garden), #9 ("Not now" targets), #10 (tile truncation), #12 (sub-3 queue), #14 (light theme), #16 (SOS timing), #18 (stagger cap). Plus #4 (naming — shared with V1).
- **`UI-V1-MODULES.md` — SHIP WITH FIXES.** Seven real screens plus the seedling plus the 7:12 AM moment — the interconnection storyboard is the best proof the architecture works. Fixes: #1 (counts), #4 (Maya collision in §5), #9, #11 (failed states), #13 (card grammar), #14 (light theme). The three open questions for the founder are correctly routed — especially #1 (the F at Engage).
- **`UI-PLACEHOLDERS.md` — SHIP WITH FIXES.** The six screens clear the "I cannot wait" bar; the bright line (if it looks interactive, it IS interactive) holds on all six; the W19 restraint is genuine judgment. Fixes: #15 (Groves row rename). That's it — the tightest doc in the set.
- **`IA-FINAL-V2-LIFEAPP.md` — SHIP WITH FIXES.** The amendment (31 modules, 6th grove, ritual-surface pattern, money-movement constraint) is sound and the extensibility rule is the right call. Fixes: #4 (Liam/Ella + Maya's tree), #8 (§7 walkthrough), and keep the §5 table in lockstep with future amendments — it drifted once already today.

**Overall:** nothing here fails the founder's bar ("calm glowing garden showing my day"). The night Garden, the ritual close, the shame-free copy, and the 7:12 AM moment are the real thing. What would embarrass us in front of him is all fixable in prose: three docs disagreeing on how many modules exist, one name belonging to two humans, and an orb that might be in two places at once. Fix the list, then ship to the founder.

---

*Design QA complete. Logged in BUILD-LOG.md 2026-10-11.*

---

## 8. FIXES-APPLIED — Design Fix-up Specialist, 2026-10-11 ~15:10 EDT

All 18 kill-list items applied in place across the four docs. Renumber note: the shell's new 9 PM evening state shifted **UI-SHELL-HOME §1.4 (11 PM) → §1.5** and **§1.5 (childless) → §1.6**; references in this report's §1/§2 to the old numbers map to the new ones.

| # | Kill-list item | Fix |
|---|---|---|
| 1 | Module-count drift (30/29/23 tiles) | Canonical count is **31 modules / 6 groves / 30 tiles + the W9 explainer row** everywhere. Fixed: shell §6 A-N8 row (was "28 tiles for the 29-module map"); V1 §0 (childless: 17 modules / 3 groves), §3.6 + §8 gate rows (were "23 tiles"). IA already correct. |
| 2 | Shell §1.5 childless map stale (2 groves, 10 modules) | Redrawn as §1.6: **3 groves, 16 tiles + W9 row = 17 modules**; 🌍 Out & About rail added (seedlings expander *"▸ 7 more taking root 🌱"*); the **W26 dawn line** (*"Sunny, 75° — no jacket needed."*) rides under the GreetingHero. |
| 3 | Shell §4.1 intake stale (4 tiles) | Redrawn with **7 tiles**: mail, money & credit, meals, health, **getting around** (vehicles, home airport, loyalty), **going out** (taste profile, interests, drive radius), **the sky** (places her day happens — feeds the W26 dawn line). Seedling garden (§4.2) gains the matching seedlings. |
| 4 | "Maya" is two humans | **Maya stays the childless persona (29, Austin).** The parent's second child is **Ella** everywhere: shell §1.2 (*Ella's fern*), shell §2.1 + §6 A-N10 + IA §1/§5 A-N10 (W10 quote), IA §3.1 (*Dawson's tree · Ella's tree*), IA §3.2 (privacy line), V1 §5.1 (shopping tags). The dad's §6 kids are now **Dawson + Ella** (was Liam/Ella — Liam→Dawson for persona consistency). The babysitter is **Priya** (IA §4.11, placeholders W12) — no third Maya. |
| 5 | Orb/FAB conflict (A-N14) | **DECIDED (Design Coordinator):** one interactive orb per screen — Garden: hero orb; other tab screens: the breathing center-tab orb, **no FAB**; non-tab screens (modules, sheets, intake): FAB at z-55. Written once in shell §0.4, referenced in §8-Q1 (closed as decided), V1 §10.2, IA §1-③. |
| 6 | SOS visible row hidden at night | The quiet calm row (`🛟 Emergency — get help fast →`) now renders **below the water tap, above the QuietHoursBanner, at every hour including 11 PM** — shell §1.5 ASCII + night rules + §3.3 Path 1 + IA §3.2. The ≤2-tap promise is never gesture-dependent. |
| 7 | No 9 PM Garden composition | **New shell §1.4 — EVENING state (9 PM closeout):** dusk hero, closeout checklist (V1 §3.5 lives here), "the garden grew today 🌱", tomorrow preview line, rails hidden, water tap → the evening signature. The 10 PM transition carries the tap + SOS row into the night state. |
| 8 | IA §7 vs shell §1.4 night contradiction | IA §7 rewritten: at 11 PM the queue is gone (shell §1.5's rule — "not collapsed, gone"); the single tomorrow line + water tap + always-visible SOS row. IA §5 A-N17 row updated. |
| 9 | "Not now" targets unspecified | **44px minimum on every "Not now," no exceptions** — shell §1.2 AttentionCard spec + V1 §3.1 card grammar. |
| 10 | Rail-tile truncation rule | Shell §1.2 Grove rails: **2-line clamp on the tile name, state line always visible** ("Driving & Life Skills" wraps to two, never three). |
| 11 | Failed states | Three spec'd: **OCR total failure** (V1 §4.2 — calm manual card, "I couldn't read this one," two honest doors, never rose); **`/school` portal disconnected** (V1 §1.5 — *"Still gathering — your garden is safe"* + seed-it-now); **Maya's Day-0 Grow** (shell §1.6 — *"Your story starts here,"* three seedling rings + first-win promise, never a parenting trophy case). |
| 12 | Sub-3 queue undefined | **The quiet-fill rule (named)** in shell §1.2: 1–2 items render under the `TODAY'S THREE` header + one quiet line (*"The rest of today is clear — go enjoy your coffee."*). Blesses V1 §3.3's composition. |
| 13 | V1 §3.2 card-3 eyebrow ("Tonight") | Fixed to the fixed grammar: **`✦ NEEDS A LOOK`**. |
| 14 | Light theme not designed (kill criterion #9) | **Designed, not derived.** New shell **§0.5 — Morning-mist light theme**: every dark token → its light equivalent (`#f3f7f2` page, `#ffffff` surfaces, deep-canopy ink, deepened band hues), the neon-firefly law kept, restful; **the night is always dark** ("rest is a color"). Per-screen notes in V1 §11; placeholders + IA §8 reference the spec. |
| 15 | Placeholders "Menu row" | All 6 headings + the global-rules line renamed to **"Groves row"** / "Groves rows" (UI-PLACEHOLDERS.md). |
| 16 | Shell §7 SOS timing (220ms) vs MOTION-SPEC | Updated to **120ms flat/instant, no rise** — the panic path is instant per MOTION-SPEC §5, accepts input from frame one. |
| 17 | BUILD-LOG claims UI-PLACEHOLDERS-W25-W31.md delivered — not on disk | **Verified, no action needed:** the seven specs (W25–W31, lines 324–494) are merged into UI-PLACEHOLDERS.md Part 2 (BUILD-LOG 2026-10-11 ~14:52 merge entry). The standalone file was consumed by the merge; nothing is missing, and the catalog-merge is unblocked. |
| 18 | Shell's 70ms stagger lacks the cap | Shell §7 now cites **`--stagger-cap: 8 items`** — past 8, the container animates once (a 20-tile Garden never cascades for 1.4s). |

**Also applied while in the docs:** shame-free copy sweep — *"draft still waiting"* → *"the draft is ready when you are"* (V1 §3.5 closeout + §3.2 strip); no other guilt-pattern siblings found ("hasn't/haven't/overdue" scan clean). Night-SOS decision documented per the panic-path mandate. **MOTION-SPEC.md** §1.4→§1.5 cross-reference updated for the shell renumber (one line, mechanical).

**Verdict:** all four docs are SHIP-ready. The founder-facing risks from the kill list (three different module counts, two humans named Maya, the orb in two places at once) are resolved in prose. Open item that is NOT a design fix: the "Groves" vs "Menu" tab label — QA's 5-second test failed "Groves"; per the task, a DECISION BOX in IA-FINAL-V2-LIFEAPP.md frames it as **the founder's call** (default stays "Groves" per the gate; the `NAV.FIFTH_LABEL` token keeps it a one-token flip before Milestone 1).
