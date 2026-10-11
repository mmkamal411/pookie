# GATE REVIEW 1 — Design Gate Reviewer
**Reviewer:** Design Gate Reviewer (Design Lead's authority + rubric) · **Date:** 2026-10-11
**Scope:** `IA-FINAL.md` (red-team — replaces the IA-B red-team that never happened) + `PLACEHOLDER-STANDARD.md`
**Standard:** `DESIGN-DIRECTION.md` §1 (7 principles), §5 (10 kill criteria), §7 (APPROVED / APPROVED WITH NOTES / KILL)
**Consistency check:** Design Lead's DESIGN-SYSTEM.md review (APPROVED WITH NOTES, 2026-10-11 ~14:35 EDT) — verdicts below extend, never contradict, its mandatory fixes.

**Founder bar applied throughout:** *"Show it to a tired parent at 10 PM. Do they exhale?"*

---

## PART A — RED TEAM: IA-FINAL.md

Six adversarial passes. Scored 1–5 at the end.

### A1. 11 PM tired-parent walkthrough (Mehedi, one thumb, half attention)

**What works:** The walkthrough in §15 is honest — nothing-is-on-fire dusk garden, a card that closes with *"nothing needed from you tonight,"* the water tap, the signature exit. The banded Today tab (Now / This Week / Coming Up / If Needed) is the right call over a clever feed: predictability is what a tired brain can navigate.

**Cracks found:**
1. **The ritual lost its walls.** UX-HABIT-DESIGN specified *exactly 4 screens, no scrolling feeds* — a beginning, middle, and guaranteed calm end. IA-FINAL pours the ritual into a scrolling hub (GreetingHero → garden → queue → 5 grove rails → TodayStrip). On a scroll surface there is no enforced ending; a tired parent can bail mid-scroll and never reach the signature exit. UX-B's rule — *"if a session can't end calmly, that's a bug"* — has no mechanism in this IA. (Mandatory fix A-N5.)
2. **"Today's Three" vs "max 5" — the doc contradicts itself.** §2: AttentionQueue max 5. §4: "Today's Three — exactly three." A ritual named "three" that shows five is a broken promise on day one. (A-N1.)
3. **The walkthrough skips the close.** §15 narrates Garden → Today → Grow and ends — the water tap and signature exit, the actual product thesis, never appear in the narrative. If the IA's own walkthrough forgets the exit, Wave-3 will too. (A-N17.)
4. **Minor narrative slip:** §15 sends him to *If Needed* to "glance at the week ahead" — the week ahead lives in *This Week / Coming Up*. (A-N17.)

**Verdict on this pass:** structure survives, closing mechanism missing.

### A2. 3-kids stress test

**What works:** The ChildSwitcher as omnipresent, load-bearing chrome is the right call; Today grouping *by child first, urgency second* is exactly how 3 kids × 23 modules collapses from 69 items to 3 clusters. Family-vs-child scoping rules are stated. W10 as parent-only lens is correctly fenced.

**Cracks found:**
1. **One focal moment vs three trees.** §2 promises "one focal moment, not a scene to decode" — then renders one plant per child. With 3 children in different states, the garden scene is three focal moments. Wave-3 has no composition rule for this. The fix is a *spotlight plant* pattern (the child with the most attention renders full; the others rest smaller), but it must be specified, not hoped for. (A-N13.)
2. **Household scope renders nothing specified.** When the switcher is on "Household," what do the Garden rails and plant scene show? Family-scoped modules don't switch — but the hub composition section never says what a Household-scoped hub looks like. (A-N13.)
3. **"Nothing needs you for Maya today ✓"** — the doc's own example of good dopamine — has no home in the Garden composition. It belongs in the queue or the greeting hero; currently it's a §6 sentence with no surface. (Fold into A-N5/A-N13.)

### A3. Boring-Tuesday test (nothing urgent — reason to open?)

**What works:** The Quiet Morning fallback is genuinely good — *"The engine is watching 23 things — grades, health, deadlines, the mail. Go enjoy your coffee."* The trust dividend is real: no-news-is-good-news is the retention engine on quiet days.

**Cracks found:**
1. **On a truly quiet day the ritual is two moments.** Bloom reveal ("a quiet night — everything held") + water tap. That's thin for a "healthy addiction" claim. It passes — quiet days *should* be short — but Wave-3 must guarantee at least one micro-delight on empty days (a season shift, a growth-ring glint, yesterday's causality chain resurfaced) or the ritual decays into a chore the parent performs for no reward. (A-N11-ish → captured as note.)
2. **Variable reward depends on overnight syncs working.** If the sync pipeline is the thing that makes boring Tuesdays delightful, the IA should name the fallback when syncs fail silently ("still gathering — your garden is safe" exists in the direction doc; it needs a hub state). Partially covered by FRONTEND-CONSTRAINTS skeletons; noted for Wave-3.

**Verdict on this pass:** PASS with a watch item. The honesty is there; the delight budget on empty days is not yet specified.

### A4. Shame-free audit (line-by-line copy check)

**What works:** Grade bands (leaf/sunlight/gold/ember, rose reserved for safety), mission-first framing (*"Geometry is 21 points from thriving"*), the broken-streak copy (*"The sapling is still here — water it today 🌱"*), moonlit rest instead of wilting. This is the strongest part of the IA.

**Cracks found:**
1. **W10 Fairness example: *"spend on Dawson is 3× Maya's this quarter — intentional?"*** — "intentional?" is interrogative. It reads as an accusation wearing a question mark. The parent is the person this product must never judge. Rewrite curious, never prosecutorial: *"spend on Dawson is 3× Maya's this quarter — want a look at the breakdown?"* (A-N10.)
2. ***"See all ({n})"*** — a raw count on the queue's overflow link. Kill criterion #5 bans badge-count arms races; "See all (12)" at 11 PM reads as twelve things demanding the parent. Drop the count or reframe ("See the rest"). (A-N11.)
3. No other violations found. The copy discipline holds.

### A5. Thumb test

**What works:** 5-tab bottom bar in the thumb zone, one-tap approval sheets, 44px targets, intercepting routes preserving back-button.

**Cracks found:**
1. **Search entry is a reach.** ⌕ sits top-right in the header — the farthest point from the thumb on a large phone. §8 calls search "thumb-first on mobile," but the *entry point* isn't. A rescue hatch the thumb can't reach is decoration. Add a thumb-zone entry: a search row pinned at the top of Menu, and/or pull-down-to-search on Garden. (A-N7.)
2. **SOS is gesture-only.** Long-press the orb FAB is the *only* global SOS path. Long-press is undiscoverable and fine-motor-dependent — exactly wrong for a shaking hand in a panic. The Design Lead's review made SOS reachability the mandatory proof item for this gate, and a hidden gesture does not prove it. (A-N6 — the heaviest finding in this review.)
3. **Orb triple-incarnation.** Hub orb (ambient, breathing) + center tab orb + FAB on other screens = three orbs, each a glow animation. FRONTEND-CONSTRAINTS A1 bans the omnipresent animated orb; this is omnipresence by another name, and none of the three are counted in the §13 glow budget. One interactive orb per screen, max; define FAB tap vs long-press explicitly. (A-N14.)

### A6. 23-modules-in-≤3-taps scale test

**What works:** Menu tab → tile → module is 2 taps from anywhere. Search rescues the buried 18. Live modules surface on Garden rails. The "tabs never change, groves absorb" contract (§11) is the best scalability decision in the doc.

**Cracks found:**
1. **`/money#spend` is not a route.** W11 lives at a hash fragment — no deep link, degraded back-button, no per-view error boundary. FRONTEND-CONSTRAINTS §1.8: every screen a real route, no exceptions. Must be `/money/spend`. (A-N3.)
2. **`/child/:id` is referenced but not routed.** §2 sends a plant-tap to `/child/:id`; the §1 route table doesn't list it. (A-N2.)
3. **W9 counting.** "All 23 modules visible from day one" vs "W9 is not a tile anywhere." Loose language — the Menu shows 22 tiles + W9's explainer (the Today tab *is* its face). State it plainly. (A-N8.)

### Red-team scores — IA-FINAL.md

| Axis | Score | One-line justification |
|---|---|---|
| Intuitiveness | **4/5** | Cadence-primary matches the founder's stated mental model; dangerous triples defused; search rescue hatch. Deductions: Garden/Grow/Menu garden-overlap confusion risk; hash-route; 3-vs-5 queue inconsistency. |
| Habit-forming | **4/5** | Dawn/Sunset rituals, bloom reveals, causality chains, quiet-morning trust dividend — all present and well-specified. Deduction: the 4-screen ritual collapsed into a scroll hub has no guaranteed calm close. |
| Buildability | **4/5** | 10-point checklist self-pass is credible; real routes; motion budget respected; prefetch discipline. Deductions: hash route; uncounted orb glows; hub section count vs "no scroll past the fold" needs Wave-3 proof. |
| Scalability | **5/5** | Tabs-never-change contract, groves as shock absorbers, Today bands as the composition layer, explicit 24th-module rule. The strongest axis. |
| Multi-child | **4/5** | Load-bearing switcher, child-first briefing grouping, family/child scoping, W10 fenced, per-child privacy contracts. Deductions: 3-plant focal-moment unproven; Household-scope hub unspecified. |

---

## PART B — GATE VERDICT: IA-FINAL.md

### ✅ **APPROVED WITH NOTES**

The structure is the right one: cadence organizes the ritual surfaces, domain organizes the index, the garden is the home, the engine is a surface rather than a tab. Nothing violates a "never." The kill criteria stay killed. The notes below are **mandatory fixes, not suggestions** — Wave-3 UI work may not proceed past the gate screens until they are resolved in the doc.

**Mandatory fixes (A-N1 … A-N17):**

- **A-N1 — Harmonize the hub queue count.** "Today's Three" (§4) vs "max 5" (§2). Decision: **3 on the hub**, the rest waits in Today. Rename or recopy so the ritual's name is never a lie.
- **A-N2 — Route table completeness.** Add `/child/:id` (child grove) to the §1 route skeleton. A referenced route that isn't in the table is a spec hole.
- **A-N3 — Kill the hash route.** `/money#spend` → **`/money/spend`** as a real sub-route (deep-link, back-button, per-view error boundary per FRONTEND-CONSTRAINTS §1.8).
- **A-N4 — Cross-doc conflict: taking-root seedlings on the Garden hub.** IA-FINAL §2/§12 (single collapsed *"N more taking root 🌱"* expander per grove rail) contradicts PLACEHOLDER-STANDARD §1 (excluded from hub rails entirely). **Decision: IA-FINAL §12 wins** — one collapsed expander per grove keeps the full vision visible without rebuilding the card grid. Update PLACEHOLDER-STANDARD §1 to match. (Mirrored in P-N1.)
- **A-N5 — Define the ritual close on a scroll hub.** UX-B's "the session always ends at the signature exit" must survive the scroll. Specify the mechanism: the water tap + signature calm sentence as a pinned end-cap section of the Garden hub (rendered once the queue is handled or dismissed), *or* a guided 4-step "morning check" overlay the hub offers. "Quiet Wins" acknowledgment and Maya's *"nothing needs you today ✓"* dopamine need their surfaces named here too.
- **A-N6 — Prove SOS reachability (heaviest finding; answers the Design Lead's mandatory proof item).** Long-press-only fails the panic test. Required: (a) teach the gesture in onboarding; (b) one *visible*, calm backup path — SOS row inside the Safety grove tile and Menu; (c) confirm the Garden in-scene orb honors the same long-press (one gesture everywhere); (d) panic path ≤ 2 taps with no fine-motor dependence; (e) Wave-3 must panic-test it with shaking-hand conditions. Visible calm ≠ anxiety dashboard — one quiet row, not a red button.
- **A-N7 — Search needs a thumb-zone entry.** The header ⌕ is a reach on large phones. Add a search row pinned at the top of Menu and/or pull-down-to-search on Garden. The rescue hatch must be reachable by the thumb.
- **A-N8 — Fix the W9 counting language.** "All 23 modules visible" vs "W9 is not a tile anywhere" → state: Menu shows 22 tiles + a W9 explainer row; the Today tab is the engine's face.
- **A-N9 — Specify the Day-0 Garden.** First-run is absent from the IA: no child yet, no data yet. Specify the add-child ritual, the seedling-state garden, and the first-bloom-within-48h engineering (UX-B Q5). The founder's bar includes the first open.
- **A-N10 — Rewrite the W10 nudge.** *"spend on Dawson is 3× Maya's this quarter — intentional?"* → curious, never interrogative. Proposed: *"…want a look at the breakdown?"*
- **A-N11 — Drop the queue count.** *"See all ({n})"* → "See the rest" (no raw count; no badge-count arms race at 11 PM). Boring-Tuesday watch item rides along: Wave-3 must guarantee one micro-delight on empty days.
- **A-N12 — Header density audit at 360px.** ChildSwitcher + Role badge + SyncDot + ⌕ is four chrome elements on a calm product. Wave-3 must prove it fits without crowding (switcher + role may need to collapse into one element).
- **A-N13 — Prove the 3-child garden.** Wave-3 must show the garden scene with 3 children in different states and keep "one focal moment" — specify the spotlight-plant pattern (attention-heavy child full, others resting smaller). Also specify what the Garden hub renders under Household scope.
- **A-N14 — Count the orbs in the glow budget.** Hub orb + center-tab orb + FAB: one interactive orb per screen max; all orb glows counted against the ≤3 mobile animating-glow budget; FAB tap vs long-press behavior defined explicitly (tap → /pookie; long-press → SOS confirm).
- **A-N15 — Tab label: "Menu" → "Groves."** "Menu" is hamburger-word; the product's wayfinding metaphor is garden paths. Decide in Wave-3; default to "Groves."
- **A-N16 — State the "one queue, two lenses" engine contract explicitly.** The hub AttentionQueue and Today's Now band are one W9 engine, two lenses — snooze/dismiss in one place reflects in the other. Intent is present; the contract must be written.
- **A-N17 — Repair the §15 walkthrough.** Fix the "If Needed → week ahead" band slip; narrate the water tap and signature exit — the IA's own walkthrough must model the product thesis.

**Consistency with the DESIGN-SYSTEM.md review (APPROVED WITH NOTES):** consistent. The triples rules (note 4) are adopted verbatim in IA §1; the "one queue, two lenses" rule (note 3) is honored in intent and hardened by A-N16; GrowthRing hierarchy (note 5) and the light-theme decision (note 1) plus the `dapple` token conflict (note 2) are Wave-3/motion scope — carried as dependencies, not contradicted. The SOS reachability proof this review demanded (A-N6) is now specified.

---

## PART C — GATE VERDICT: PLACEHOLDER-STANDARD.md

### Red-team notes

**What the standard gets right (and it gets a lot right):** The 11 PM test — *"I cannot wait," never "not done yet"* — is the correct bar, and the anatomy earns it: promise hero with a concrete vignette, the honest "how it will know" data-source line, seed-it-now forms that write real rows the future module reads, cross-links that forbid dead ends, wave placement with no dates. The copy blocklist ("coming soon," "under construction," "you haven't set up…") is excellent. The bright line — *if it looks interactive, it IS interactive* — is the single most important visual rule in the doc and it is correct. The W6/W12/W19 worked examples prove the standard isn't aspirational; W19's deliberate seed omission and reverent tone rules show genuine judgment.

**Cracks found:**
1. **Route pattern contradicts the FINAL IA.** §1 routes placeholders as `/grove/driving` — IA-FINAL §1 ships `/driving`, `/money`, `/health`. The IA is final; the placeholder doc is stale here. (P-N2.)
2. **The W18 open question is already decided — against the recommendation.** §7 recommends a one-time February invitation *without* registered interest. That contradicts IA-FINAL §9 ("only with the parent's opt-in interest registered, never cold"), the consent-gated launch rule (§2.5), and UX-HABIT-DESIGN's notification anti-list (no marketing pushes). A season trigger does not override consent. Close it: **NO cold seasonal invitations; the "remind me in February" opt-in is the path.** (P-N3.)
3. **Seed-it-now: "optional but strongly preferred" vs kill criterion.** The kill criteria say a placeholder that skips an honest seed form = KILL, but §2.3 calls the section optional. Harden it: the seed section is **required unless a W19-style deliberate-omission rationale is documented** in the module's spec. (P-N4.)
4. **W19's interest CTA is ambiguous.** §5.3 bans "remind me" for W19 while §2.5 requires one interest CTA. Clarify: W19 keeps the quiet "tell me when this grove opens" (consent-gated, reverent copy); only the seasonal-reminder variant is dropped. (P-N5.)
5. **Seed buried under capabilities.** For modules where the seed IS the ritual (W6's drive log), the one real action sits two viewports below three capability cards. Allow seed-first ordering when the seed is the module's core value — aliveness before explanation. (P-N6.)
6. **Graduation payoff missing.** When a placeholder graduates, the launch notification should show the seeded data carried over (*"your 12 logged drives are here"*). That is the "growth you can see" principle applied to the roadmap — currently unspecified. (P-N7.)
7. **"Dated, honest update" wording (§7).** A wave that passes without its module gets an honest update — clarify it names the *new wave*, never a calendar date. Dates are promises; waves are intentions (the doc's own rule). (P-N8.)

### Scores — PLACEHOLDER-STANDARD.md

| Axis | Score | One-line justification |
|---|---|---|
| Intuitiveness | **5/5** | Real routes, Planting pill as the single honest signal, no dimming/locks/"coming soon." A parent always knows what they're looking at. |
| Habit-forming | **4/5** | Seed-it-now converts "not built" into "already started" — a genuine hook. Placeholders never interrupt the ritual (correctly excluded from queue/notifications). |
| Buildability | **5/5** | Static art only, transform/opacity motion budget, real Supabase writes, no fake UI. Entirely buildable as specified. |
| Scalability | **5/5** | Wave-graduation path defined; interest registry is consent-gated; every placeholder carries its wave so nothing lingers silently. |
| Multi-child | **4/5** | Child-visible safety read required; seeds scoped per child tenant; W19 tone rules. Per-child seed conflict UX (two teens, one driving module) unaddressed — minor. |

### ✅ **APPROVED WITH NOTES**

The standard guarantees "wow, I can't wait" and forbids "not done yet" — structurally, not just tonally. The mandatory fixes:

- **P-N1 — Harmonize hub-rail rule with IA-FINAL §12** (mirror of A-N4): placeholders appear on Garden hub rails only as the single collapsed *"N more taking root 🌱"* expander per grove. Update §1.
- **P-N2 — Adopt IA-FINAL's flat routes.** `/grove/driving` → `/driving` (etc.). The IA is final.
- **P-N3 — Close the W18 open question: NO cold seasonal invitations.** Consent-gated only, consistent with IA-FINAL §9 and the notification anti-list. The "remind me in February" opt-in is the mechanism.
- **P-N4 — Seed section: required unless a documented deliberate omission** (W19 pattern). "Optional but strongly preferred" is too soft for a kill-criterion-backed rule.
- **P-N5 — Clarify W19's CTA.** Quiet interest CTA stays (reverent copy); seasonal-reminder variant dropped.
- **P-N6 — Allow seed-first ordering** when the seed is the module's core ritual (W6 drive log above capabilities).
- **P-N7 — Specify the graduation payoff.** Launch notification shows seeded data carried over; the seed visibly becomes the module.
- **P-N8 — "Dated update" wording.** Names the new wave, never a calendar date.

---

## PART D — WHAT THE FOUNDER WOULD NOTICE (the brutal summary)

If Mehedi read these two docs tonight, the things that would make him stop and ask questions:

1. **"Where's the first open?"** Neither doc specifies Day 0. He will open the app exactly once for the first time, and the IA starts mid-story.
2. **"How do I call for help?"** SOS is a hidden long-press. He has a 15-year-old learning to drive; this is the first thing he'd test and the first thing that would fail him.
3. **"Three or five?"** The ritual is called "Today's Three" and shows five cards. He notices numbers.
4. **`/money#spend`.** He won't know what a hash route is, but the back button breaking on the Spending view is the kind of paper cut that erodes "it just works."
5. **Two docs disagree about the home screen.** IA says seedlings get a rail expander; the placeholder standard says they're excluded. Somebody has to be wrong, and it's decided above (A-N4/P-N1).

None of these are fatal to the architecture. All of them are fatal to trust if they ship unresolved — which is why they are mandatory notes, not observations.

---

*Gate Review 1 complete. Both verdicts: **APPROVED WITH NOTES**. Next gate: Wave-3 gate screens (shell chrome + home/garden + nav; V1 module screens; placeholder screens) against the 17 IA notes and 8 placeholder notes above.*
