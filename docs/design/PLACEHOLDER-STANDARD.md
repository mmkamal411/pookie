# THE PLACEHOLDER STANDARD — Pookie
**"The unplanted bed still belongs in the garden."**

**Author:** Information Architect B · **Date:** 2026-10-11 · **Status:** FOR DESIGN LEAD GATE REVIEW
**Authority:** founder direction 2026-10-11 — the full 23-module shell ships NOW with elegant placeholders for unbuilt modules.
**Inputs:** PRODUCT-SCOPE.md (V1 gate + V2/V3 waves) · UX-MENTAL-MODELS.md (23 modules ≠ 23 destinations; W9 = delivery layer, W10 = lens) · UX-HABIT-DESIGN.md (anti-guilt architecture, SeedlingEmpty spirit) · DESIGN-DIRECTION.md (7 principles, garden grammar, kill criteria) · DESIGN-SYSTEM.md (component library: AppShell, ModuleHeader, LivingCard, SeedlingEmpty, StatusPill, grove map) · FRONTEND-CONSTRAINTS.md (every screen a route; ≤5 tabs + hub + overflow index; buildability checklist).

---

## 0. The thesis

A placeholder is not a hole in the product. It is a **promise rendered beautifully** — a grove the garden has marked out, with its soil turned and its sign planted, where the parent can already see *what will grow there* and, in some cases, start planting seeds the real module will use on day one.

**The standard, in one test:** a parent opens an unbuilt module at 11 PM and thinks "I cannot wait for this," never "this isn't done yet." If any placeholder reads as scaffolding, apology, or marketing tease — it fails the gate.

**Three iron rules:**

1. **Honest, never fake.** Every CTA on a placeholder does something real today (registers interest, navigates to a built module, captures seed data that persists). A button that does nothing is a lie. Lies kill trust faster than absence.
2. **Concrete, never vague.** The placeholder names the *specific future value* in the parent's own words: "practice tests from the real Georgia manual," not "amazing driving features." Vagueness is how products admit they don't know what they're building. We know.
3. **Inviting, never shaming.** An unbuilt module must never read as the parent's failure ("you haven't set up driving yet" — no). The garden is *planting this for you*. The posture is the mother's, not the vendor's.

---

## 1. Where placeholders live in the IA

- **They exist as real routes.** Every module gets its route on day one (`/grove/driving`, etc.), per FRONTEND-CONSTRAINTS §6 rule 1: every screen is a route. Deep links, share links, and the Menu index all work. A placeholder is never a 404 or a dead tile.
- **They appear in the Menu grove index** with a small `Planting` pill (sunlight tint — see §4). The parent sees the full 23-module map and learns where the product is going. This is deliberate: hiding the roadmap undersells the product; a well-marked planting bed *sells* it.
- **They NEVER appear in:** the AttentionQueue (§3.1 of the system spec — the queue is earned attention only), notifications, the Today tab's plan surface, or badge counts. An unbuilt module has no right to demand attention.
- **They are excluded from the Garden Hub's GroveSections rails** (the hub shows what matters *today*; the full map lives in Menu). Exception: a seasonal placeholder may surface a one-time gentle invitation at its natural season (W18 Summer in February — "planning season opens soon, want a reminder?") — only with the parent's opt-in interest registered, never cold.

### 1.1 Placeholder vs. dormant vs. empty — three different screens

These are constantly confused. They are not the same:

| State | Meaning | Example | Screen behavior |
|---|---|---|---|
| **Placeholder** | Module not yet built | W6 Driving in V1 | The Placeholder Standard (this doc) |
| **Dormant** | Built, but seasonally quiet | W18 Summer in November | Collapses out of the way; wakes with a next step, never a blank page ("Summer planning opens in February — want a reminder?") |
| **Empty** | Built, no data yet | W2 Health before first entry | `SeedlingEmpty`: "No check-ins yet — plant the first seed with a 60-second check-in." + one real CTA |

A placeholder must never *become* a dormant screen or an empty screen by accident. Each has its own copy, its own CTAs, its own visual treatment.

---

## 2. Anatomy of a placeholder screen

Top to bottom, mobile-first. Every section below is required unless marked optional. Component names reference DESIGN-SYSTEM.md §2.

```
┌─────────────────────────────────────────┐
│ AppShell: TopBannerSlot → AppHeader      │  (unchanged — ChildSwitcher,
│ (ChildSwitcher, SyncDot, search)        │   SyncDot all live; placeholder
│                                         │   is still the app)
├─────────────────────────────────────────┤
│ ModuleHeader (§3.4)                     │  sigil + title + subtitle +
│  [sigil]  Driving & Life Skills         │  Planting StatusPill + Freshness
│           The road to the license,      │  shows "Planting" (not stale —
│           watched over step by step.    │   see §4). No SyncNow button.
│           [🌱 Planting]                 │
├─────────────────────────────────────────┤
│ HERO — The Promise (§2.1)               │  LivingCard, halo-tinted.
│  "When this grove opens…"              │  One vivid paragraph + one
│  + signature visual (static garden     │  concrete vignette of the future
│    art: mist over turned soil)         │  in action. Static art only —
│                                         │  never fake UI screenshots.
├─────────────────────────────────────────┤
│ WHAT IT WILL WATCH OVER — 3 cards (§2.2)│  Three LivingCards, each: icon,
│  ┌──────┐ ┌──────┐ ┌──────┐             │  capability name, 2-line concrete
│  │ Cap 1│ │ Cap 2│ │ Cap 3│             │  description, "how it will know"
│  └──────┘ └──────┘ └──────┘             │  line (data source, honest).
├─────────────────────────────────────────┤
│ SEED IT NOW (§2.3) — optional but       │  Where the module's value does
│ preferred. One real, useful action      │  NOT depend on the unbuilt
│ the parent can take TODAY that the      │  integration. Manual entry that
│ real module will use on day one.        │  persists. This is what makes a
│                                         │  placeholder feel alive.
├─────────────────────────────────────────┤
│ WHILE YOU WAIT — cross-links (§2.4)     │  2–3 built modules that answer
│  "School is watching grades today…"    │  the adjacent need NOW. Never
│                                         │  a dead end: a placeholder with
│                                         │  no onward path fails the gate.
├─────────────────────────────────────────┤
│ ARRIVAL (§2.5)                          │  Honest wave placement ("Growing
│  Wave: V2 · Tell me when it opens [btn] │  in Wave 2") + ONE interest CTA.
│                                         │  Interest registers a real row.
└─────────────────────────────────────────┘
```

**Layout rules:**
- Single column, `max-w-2xl`, page padding `px-4`. The placeholder is a reading surface, not a dashboard.
- Entrance: `animate-bloom` with the standard 70ms stagger, capped at 8 items (the 3 capability cards + hero + seed + links + arrival = ≤7).
- No scrolling past two viewports to understand the module. If it takes longer, the copy is too long.

### 2.1 The Hero — the promise

- **Component:** `LivingCard` with a `halo` tint (this is a blessed future, not a task). No `AttentionCard` styling — nothing here needs a look *now*.
- **Content:** one paragraph (≤3 short sentences) naming the future in the parent's words, ending on the feeling. Then ONE concrete vignette — a 2-sentence scene of the module working, with specific nouns (the Georgia manual, the DDS affidavit, the good-student discount packet). The vignette is what makes "I can't wait" happen; abstract feature lists don't.
- **Visual:** static garden art — soft mist over a turned bed, a closed bud with a small "planting" marker. Transform/opacity-safe (a slow `dapple` drift at ≤40% opacity is within budget; no animated blur, no particles). **Never** a mock screenshot of the unbuilt UI — fake UI is a promise the build team didn't make and a lie the founder will see through.
- **Copy posture:** "We are planting this grove for you." Not "We're working hard behind the scenes" (vendor voice). Not "Exciting features are coming!" (marketing voice).

### 2.2 The three capabilities

Exactly three `LivingCard`s. Each card:

1. **Capability name** — a plain verb phrase ("Practice tests from the real manual").
2. **Two lines** — what it does, concretely, for *this family's* reality.
3. **"How it will know"** — one honest line naming the data source ("Built from the official Georgia DDS manual — the same questions, linked to the source"). This line is the product's honesty signature: where the source is a partnership or manual entry, say so. Never imply a live integration that doesn't exist (PRODUCT-SCOPE §5 hard NOs apply to placeholders too).

The three capabilities are chosen per module from AI-MOTHER-VISION.md's "mother-tracking ideation" / trigger lists — the highest daily-ritual-leverage three, not a feature dump.

### 2.3 Seed it now — the aliveness rule (optional but strongly preferred)

**The rule:** if any part of the module's value can be captured *today* without the unbuilt integration, the placeholder captures it. The seed data persists to Supabase under the child's tenant and the real module reads it on day one. This is the single highest-leverage placeholder pattern — it converts "not yet built" into "already started."

Examples:
- **W6 Driving:** "Which state?" (Georgia preselected from profile) + "Where is Dawson on the road to the license?" (Not started / Studying / Has permit / Logging hours). Plus: "Start the drive log now" — manual parent-co-signed hour logging works today (the vision doc's trust model is manual logging anyway). The log the parent keeps now *becomes* the DDS affidavit export later.
- **W12 Childcare:** "Who might need coverage?" (per-child ages pre-filled from profiles) + typical windows (after-school, date nights, breaks). No fake sitter profiles — a directory of invented people is a lie. The seed is the *family's need profile*, which the real matching engine will use.
- **W19 Guardianship:** none. This module's value is the vault + documents; asking a parent to "pre-enter" guardianship designations into a placeholder is emotionally wrong (see the W19 worked example §5.3). **The absence of a seed section is itself a design decision — document it.**

When no honest seed exists, the section is omitted entirely — never a fake form.

### 2.4 While you wait — cross-links

2–3 `LivingCard` rows (compact) linking to **built** modules that serve the adjacent need today. Each row: sigil, module name, one line on what to do there now.

- The cross-links are chosen from the adjacency map (UX-MENTAL-MODELS §5): W6 → W1 School ("the good-student discount packet starts with the GPA trend"); W12 → W16 School Calendar ("early-release Wednesdays are where coverage gaps start"); W19 → W21 Mail ("court dates and legal mail land here today").
- **Gate rule:** a placeholder with no honest cross-link is a dead end and fails. Every module in the taxonomy has at least one built neighbor — the IA must find it.

### 2.5 Arrival — honest placement + one interest CTA

- **Wave line:** "Growing in Wave 2 — after the morning ritual is solid." Plain words, no quarters-as-promises. The wave names come from PRODUCT-SCOPE.md (V2 "The mother starts advising", V3 "Life admin, expanded"). Never a date. Dates are promises; waves are intentions.
- **One CTA:** `btn-angel` — "Tell me when this grove opens." Tap → registers `placeholder_interest(child_id, module, created_at)` → toast "Noted — you'll be the first to know 🌱" (Completion pattern §3.3: firefly burst, no confetti). The parent may also pick a seasonal reminder where relevant ("Remind me in February" for W18). One row, quiet.
- **Interest is consent-gated launch contact:** the module's launch notification fires ONLY to parents who registered interest. No cold "it's here!" pushes to everyone. This respects the notification anti-list (UX-HABIT-DESIGN §4.3 #5: no marketing pushes).
- **After registering:** the CTA becomes a quiet `StatusPill` — "We'll tell you 🌱" — with an undo ("never mind"). No nag to re-register, ever.

---

## 3. Copy rules — the placeholder voice

All placeholder copy obeys the DESIGN-SYSTEM §4.1 shame-free copy law plus these placeholder-specific rules:

### 3.1 Banned phrases (the placeholder blocklist)

These go into the copy-lint alongside the garden bans:

- "Coming soon" / "Stay tuned" / "Something exciting is on the way" — marketing fog.
- "Under construction" / "This page isn't ready yet" / "We're still building this" — apology voice; the garden is never apologetic.
- "You haven't set up X yet" — shame-adjacent; the module isn't the parent's homework.
- "Be the first to try" / "Early access" / "Beta" — the product is not a startup demo to the parent.
- "In the meantime, check out…" — filler voice; cross-links get their own honest framing (§2.4).
- Any fake specificity: "arriving this spring," "90% complete," progress bars for build progress. The build team's burn-down is not the parent's business.
- Em dashes in UI copy (standing copy rule). Use short sentences.

### 3.2 Required frames

- **The planting frame:** "This grove is still being planted." / "We're turning the soil for…" — the garden metaphor does the explaining; no further apology needed.
- **The concrete future:** every capability names a real artifact the parent will touch ("the pre-filled DDS affidavit," "the emergency handoff packet the sitter receives," "the school emergency-card pre-fill each fall"). Artifacts beat adjectives.
- **The honest source line:** "Built from…", "Reads from…", "You enter… once." Where the honest architecture is manual entry + verification (Common App, College Board, Quest labs — PRODUCT-SCOPE §5), the placeholder says so plainly: "You'll enter scores once from the official report — we'll verify them against the upload." Honesty about manual steps *increases* desire because it proves the team knows what it's building.
- **The feeling close:** the hero ends on the feeling the module will deliver ("so the question 'are we covered?' never keeps you up"). Feeling is the product (§0 of this doc's inputs: the parent must FEEL life is under control).

### 3.3 Length discipline

- Hero: ≤ 60 words. Capability cards: ≤ 35 words each. Seed section: the form IS the copy — labels do the work. Cross-links: one line each. Arrival: two lines + CTA.
- Read the whole placeholder aloud. If it takes more than 45 seconds, cut.

---

## 4. Visual rules — which components, how much is real

### 4.1 Component allowlist (from DESIGN-SYSTEM.md)

| Use | Don't use |
|---|---|
| `AppShell` + `AppHeader` (fully live) | `AttentionCard` (nothing here needs a look) |
| `ModuleHeader` with sigil + subtitle | `FreshnessChip` with a stale tone — placeholders show a `Planting` StatusPill instead ("Planting 🌱", sunlight tint) |
| `LivingCard` (hero + 3 capabilities + cross-links) | `GrowthRing` / `SproutMeter` / `DeltaLine` with invented data — progress visuals require real data, always |
| `SeedlingEmpty` visual language for the hero art (sprout in halo glow) | `StatCard` with placeholder numbers |
| `btn-angel` for the interest CTA; `btn-dapple` for seed-form submit | `btn-danger` (nothing destructive here); rose anywhere |
| `StatusPill` "Planting" (`bg-sunlight-400/15 text-sunlight-300 border-sunlight-400/30`) | Numeric badges, counts, red dots |
| `Toast` on interest registration ("Noted — you'll be the first to know 🌱") | Modal popups announcing the placeholder |

### 4.2 Real vs. illustrative — the bright line

- **Real:** the shell, the header, the child switcher, the Menu position, the cross-links (all navigate to live modules), the seed form (writes real rows), the interest CTA (writes a real row), the wave placement (real roadmap).
- **Illustrative:** the hero garden art (a bed being planted — clearly atmospheric, not UI), the capability cards (descriptions of future function, never screenshots).
- **Forbidden:** anything in between — fake charts, sample data tables, greyed-out buttons that look clickable, "preview" UI that doesn't work. If it looks interactive, it IS interactive. This is the single most important visual rule in this document.

### 4.3 Motion budget (per FRONTEND-CONSTRAINTS §2)

- Hero art: one slow `dapple` drift (transform-only, ≤40% opacity) OR a static gradient + `breathe` on the sprout sigil. Not both. Ambient budget: ≤2 animating elements on the screen.
- Entrance: `animate-bloom` stagger, ≤8 items, 70ms steps.
- Completion (seed submit / interest tap): firefly burst ≤900ms, toast `animate-rise`. Then stillness.
- `prefers-reduced-motion`: art goes static, entrances become fades. Same as everywhere.

### 4.4 The Menu presentation

In the Menu grove index, placeholder modules render as normal `LivingCard` rows with:
- the module sigil (its permanent icon — assigned now, never changed casually, per the `MODULE_SIGILS` map),
- the name,
- the `Planting` pill (sunlight tint, right-aligned),
- the one-line subtitle ("what this grove will watch over").

No dimming to 40% opacity (that reads as disabled/broken). No lock icons (locks imply paywalls). The pill is the entire signal — calm, warm, honest.

### 4.5 Child-visible placeholders

The child (teen) sees the same Menu. Placeholder copy must pass the child-safety read: no worry-list leakage (Group C labels never render — UX-MENTAL-MODELS finding), no "your parent is worried about…" framing. The teen's read of a placeholder should be "cool, that's coming" — and for child-private modules (W8-full, W17), the placeholder states the privacy contract up front (§3.6 of the system spec): "Your space — details stay with you."

---

## 5. Worked examples

### 5.1 W6 · Driving & Life Skills (V2, wave 1 — the founder's demo module)

**Why this one matters:** Dawson is permit-eligible NOW with zero prep logged. This placeholder will be opened by the founder himself. It must be perfect.

**ModuleHeader:** sigil `car` · Title "Driving & Life Skills" · Subtitle "The road to the license — and everything after it — watched over step by step." · `[🌱 Planting]`

**Hero (halo-tinted LivingCard):**
> "Dawson is eligible for his learner's permit today. This grove will walk him from the first practice test to the full license — the state rules, the study plan, the hour log, the insurance discount his grades have already earned him. Picture this: the night before the DDS visit, every document checked, every practice test passed, the affidavit already filled. That is what this grove is for."

**Three capabilities:**
1. **Practice tests from the real manual.** "Unlimited practice built from the official Georgia DDS manual — the same 40 questions, the same 75% bar, linked to the source. You'll know he's ready before the examiner does." *How it will know: the state manual, linked as the source of truth — never paraphrased.*
2. **The hour log that becomes the affidavit.** "Every supervised drive logged with one tap — day and night hours split automatically. At the end, the log becomes the pre-filled sworn affidavit Georgia requires." *How it will know: you and Dawson log drives; the math is ours.*
3. **The good-student discount packet.** "His GPA trend, packaged as the proof packet insurers ask for. Good grades literally pay for the insurance." *How it will know: reads the grade trend from School — the cross-module pride moment.*

**Seed it now (live form — writes to `driving_seed`):**
- "Which state?" → Georgia (preselected from profile; changeable)
- "Where is Dawson on the road?" → segmented: Not started / Studying / Has permit / Logging hours
- **"Start the drive log today"** → `btn-dapple` "Log the first drive" opens the real logging sheet (date, minutes, day/night, supervisor initial). The log persists; the affidavit export arrives with the module. Copy: "The hours you log now count later. Nothing is wasted."

**While you wait:**
- School → "The GPA trend that earns the insurance discount lives here."
- Mail → "DDS letters and appointment notices land here today."

**Arrival:** "Growing in Wave 2 — first, because the need is now." + `btn-angel` "Tell me when this grove opens."

### 5.2 W12 · Babysitters & Childcare (V3 — directory + request flow, marketplace aspirational)

**ModuleHeader:** sigil `heart-handshake` · Title "Babysitters" · Subtitle "Trusted hands for the hours you can't be there." · `[🌱 Planting]`

**Hero:**
> "Early-release Wednesday. A work dinner Thursday. The sitter cancels at 4 PM. This grove keeps your bench — vetted sitters who know your kids, your rules, your emergency plan — and re-matches in minutes when plans change. Picture this: the school calendar shows a half day, and before you've finished your coffee, Maya is already confirmed for 12 to 3. That is what this grove is for."

**Three capabilities:**
1. **Your bench, not a directory.** "Sitters matched to your children's ages, needs, and your exact windows — ranked with reasons, not just distance. The sitter you rebook three times becomes the default suggestion." *How it will know: your family's need profile (seeded below) + verified reviews from completed bookings only.*
2. **The emergency handoff packet.** "For the booking window only, your sitter receives medical flags, allergies, medications, and emergency contacts — expiring automatically when the booking ends. They never see grades, location history, or anything else." *How it will know: reads the Health vault; the packet is time-boxed by design.*
3. **Coverage the calendar proposes.** "Early-release Wednesday appears on the school calendar → 'need coverage 12 to 3?' One tap starts the request." *How it will know: the School Calendar watches; the grove proposes, you confirm.*

**Seed it now (writes to `childcare_seed`):**
- Per child: "Who might need coverage?" (ages pre-filled from profiles — confirm/edit)
- "Typical windows" → chips: After school · Evenings · School breaks · Date nights
- Honesty line: "No sitter profiles yet — we'd rather show you real, verified people than a directory of maybe. Your need profile is what the matching starts from."

**While you wait:**
- School Calendar → "Half days and breaks — where coverage gaps start — are flagged here today."
- Health → "Allergies and medications your future sitter will need are kept here."

**Arrival:** "Growing in Wave 3 — the directory and request flow first; the full marketplace is a second business, and we'll be honest about that." + interest CTA.

### 5.3 W19 · Emergency & Guardianship (V3 — the heaviest module in the catalog)

**ModuleHeader:** sigil `shield-check` · Title "Emergency Plan" · Subtitle "The worry nobody says out loud — answered, on paper, in one place." · `[🌱 Planting]`

**Hero:**
> "If something happened to you tomorrow, would the right people know what to do? This grove holds the answers — guardianship designations, medical consent, who may pick up your children, and the documents that prove it — reviewed once a year, ready in an emergency. Picture this: the school calls, and instead of panic, there is a page. Names. Numbers. The plan you already made. That is what this grove is for."

**Three capabilities:**
1. **The vault.** "Birth certificates, passports, insurance cards, custody orders — encrypted, yours alone, organized the way an emergency needs them: findable in seconds." *How it will know: you place documents here; nothing is scanned or shared without you.*
2. **The pickup list.** "Who may collect your children, with photo and ID notes — the list the school and the sitter both need, kept current." *How it will know: you name them; the grove nudges a yearly confirmation.*
3. **The yearly review.** "Once a year, a gentle pass: are the contacts still current, the documents still valid, the designations still right? Fifteen minutes, then peace for another year." *How it will know: dates do the work — expiry math is the platform's superpower.*

**Seed it now: deliberately omitted.** Asking a parent to pre-enter guardianship designations into an unbuilt module is emotionally wrong — this is the one module where "start now" would feel like pressure, not invitation. The placeholder says so, gently: *"Some groves shouldn't be rushed. When this one opens, we'll walk through it together — one page at a time."* The absence is the design.

**While you wait:**
- Mail → "Legal and insurance mail that belongs in the future vault lands here today."
- Money & Documents (when built; today: Mail) → cross-link to what exists now.

**Arrival:** "Growing in Wave 3 — after the daily ritual has earned your trust. This grove asks for the most sensitive things you own; it will wait until we've earned them." + interest CTA.

**Special rule for W19:** no seasonal nudge, no "remind me" option, no playful copy anywhere on this screen. The tone is reverent, plain, and unhurried. The copy-lint gets a W19-specific pass: ban "peace of mind" (hollow), ban exclamation marks, ban urgency of any kind.

---

## 6. The placeholder build checklist (gate review)

Every placeholder must answer YES to all of these before it ships:

1. [ ] Does every CTA do something real? (interest registers, seed writes, cross-links navigate — zero dead buttons)
2. [ ] Is the future concrete? (named artifacts, honest data sources, no "exciting features")
3. [ ] Is the wave placement honest? (PRODUCT-SCOPE wave, no dates, no progress bars)
4. [ ] Does it pass the child-safety read? (no worry leakage, privacy contract stated where relevant)
5. [ ] Does it pass the shame-free read? (no "you haven't set up…", no guilt, no urgency)
6. [ ] Is there an onward path? (≥2 cross-links to built modules — no dead ends)
7. [ ] Is the `Planting` pill the only "unbuilt" signal? (no dimming, no locks, no "coming soon")
8. [ ] Does all motion fit the budget? (transform/opacity only, ≤2 ambient, stagger ≤8, reduced-motion path)
9. [ ] Would Mehedi open this at 11 PM and think "I can't wait" — not "not done yet"?
10. [ ] If a seed form exists, does the data persist to a real table the future module will read?

**Kill criteria (any one = KILL, no notes):** a dead CTA · fake data or fake UI screenshots · "coming soon" copy · a progress bar for build progress · launch notifications to parents who didn't opt in · a placeholder used to excuse skipping a seed form where an honest one exists.

---

## 7. What placeholders are NOT

- **Not a marketing page.** No feature hype, no "imagine the possibilities," no investor-deck language. The parent is not a prospect; they're family.
- **Not a waitlist.** "Tell me when it opens" is a courtesy, not a growth loop. No referral mechanics, no "skip the line," no countdown timers.
- **Not an excuse.** A placeholder never justifies a thin V1. The V1 gate (PRODUCT-SCOPE §2) stands on its own seven modules; placeholders are the horizon, not the product.
- **Not permanent.** Every placeholder carries its wave. If a module's wave passes without the module, the placeholder gets a dated, honest update — never silent lingering. A two-year-old "planting" bed is a broken promise.

---

*End of standard. Open question for the Design Lead gate: should seasonal placeholders (W18) get the February one-time invitation even without registered interest — a single gentle tap on the shoulder — or is that marketing? Recommendation: yes, once, because the season itself is the trigger (not the product), and the copy is "planning season is here," never "we built a thing."*
