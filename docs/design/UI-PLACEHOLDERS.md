# UI-PLACEHOLDERS.md — The Six Placeholder Screens (Wave 3, Gate Screens)
**Author:** UI Designer 3 (Placeholder Screens) · **Date:** 2026-10-11 · **Status:** GATE SCREENS — for Design Lead gate review
**Reporting to:** Design Coordinator
**Inputs:** PLACEHOLDER-STANDARD.md · IA-FINAL-V2-LIFEAPP.md · GATE-REVIEW-1.md (17 IA + 8 placeholder notes) · VISUAL-DIRECTIVE-NEON.md · DESIGN-SYSTEM.md · PRODUCT-SCOPE.md

---

## 0. What these screens are

The full 24-module shell ships on day one. Six of its groves are still being planted. These screens are the six planting beds — drawn so a parent opening any of them at 11 PM thinks **"I cannot wait for this,"** never **"this isn't done yet."** Per the standard: if it looks interactive, it IS interactive. Every CTA below does something real: registers consent-gated interest, navigates to a live module, or writes a real Supabase row the future module reads on day one.

**Founder directives honored:** beauty-or-bust · the placeholder that earns longing, not pity · shame-free always.

---

## Global rules applied to all six screens

- **Routes (flat, per P-N2):** `/driving` · `/childcare` · `/emergency` · `/college` · `/safety` · `/summer`. Each is a real route on day one — deep links and the Groves index all work.
- **ModuleHeader:** sigil (44px rounded-2xl, Lucide, grove-tinted glow) + title + one-line subtitle + `🌱 Planting` StatusPill (`bg-sunlight-400/15 text-sunlight-300 border-sunlight-400/30`). No SyncNow button. Freshness shows "Planting" — never stale.
- **Layout:** single column, `max-w-2xl`, page padding `px-4`. Reading surface, not a dashboard. No more than two viewports to understand the module.
- **Motion budget:** `animate-bloom` entrance, 70ms stagger, capped at 8 items. Ambient: ONE element only — either a slow `dapple` drift (transform-only, ≤40% opacity) on the hero art OR a `breathe` on the sprout sigil, never both. Completion (seed submit / interest tap): firefly burst ≤900ms + toast `animate-rise`, then stillness. `prefers-reduced-motion`: art static, entrances become fades, glows remain.
- **Neon (VISUAL-DIRECTIVE-NEON):** firefly, never floodlight. Hero LivingCards carry the halo tint; capability cards are quiet LivingCards with no accent glow (the neon points at the one real action — the seed submit or interest CTA — not at descriptions). No rose anywhere on these screens (rose is safety-only; W3's SOS copy is factual, not styled urgent).
- **Copy law:** no em dashes; short sentences; specific nouns; the blocklist enforced ("coming soon", "under construction", "you haven't set up X", "early access", fake dates, progress bars — all banned). Wave lines name waves, never dates (P-N8).
- **Seed registry (all tables live under the child's tenant; real rows the future module reads):**
  - W6 → `driving_seed` (state + permit stage) + `driving_drive_log` (the hour log)
  - W12 → `childcare_seed` (family need profile)
  - W19 → deliberately none (documented omission, §4)
  - W5 → `college_seed` (aspiration shortlist + entered scores)
  - W3 → `safety_seed` (emergency contacts)
  - W18 → `summer_seed` (budget + summer-type interests)
- **Graduation payoff (P-N7):** every screen's Arrival section carries the line the launch notification will use when the module graduates — the seed visibly becomes the module. Listed per screen.
- **Groves rows (per §4.4 of the standard):** sigil + plain name + one-line subtitle + `🌱 Planting` pill, full opacity, no locks. Listed per screen.
- **Child-safety read (per screen):** the teen reads "cool, that's coming." No worry-list leakage, no surveillance framing.
- **Light theme:** the morning-mist light theme is designed, not derived — per UI-SHELL-HOME §0.5. Seedlings render on morning-mist white (`#f3f7f2` page, `#ffffff` cards), halo tints softened to low-opacity gold, sprout-sigil breathe kept, ink `#0d1f14` (never pure black). The 11 PM night is always dark, even in light theme.
- **Absence, not adaptation:** these seedlings mark UNBUILT modules. They are never shown for not-yours modules (childless households see none of the parenting groves at all).

---

## 1. W6 · Driving & Life Skills — `/driving` (the founder demo)

**Grove:** 🌱 Growing Up · **Sigil:** `car` · **Wave:** V2 ("The mother starts advising") — first in the wave, because the need is now
**Seed rule (P-N6): SEED FIRST.** The drive log is the module's core ritual; it sits directly under the header, above the capabilities. Aliveness before explanation.

### ModuleHeader
- Sigil `car` (gold-tinted glow) · **Title:** Driving & Life Skills · **Subtitle:** "The road to the license — and everything after it — watched over step by step." · `🌱 Planting`

### SEED IT NOW (section 1, immediately after the header)
**Copy lead (one line):** "Start the drive log today. The hours you log now count later. Nothing is wasted."
**Form — "Log a drive"** (writes to `driving_drive_log`; the log the parent keeps now *becomes* the DDS affidavit export later):
- Date (defaults today) · Minutes driven · Day / Night segmented toggle · Supervisor initial (text, 3 chars) · Conditions (chips, optional: Clear · Rain · Highway · Parking lot)
- Submit: `btn-dapple` "Log this drive" → firefly burst + toast "Logged. Those minutes count 🌱"
**Form — "Where is Dawson on the road?"** (writes to `driving_seed`):
- Which state? → Georgia (preselected from profile; changeable, 50-state select)
- Stage segmented: Not started · Studying · Has permit · Logging hours
**Visual:** the drive-log form is the one neon moment on the screen — a soft leaf rim on the card, the `btn-dapple` leaf→sunlight sweep. It must feel like the most alive thing on the page, because it is.
**Graduation payoff:** when the grove opens, the launch line reads: "Your logged drives are here — the affidavit export is ready."

### HERO — The Promise (halo-tinted LivingCard, section 2)
**Art:** soft mist over a turned bed at dawn, one small wooden marker at the head of the row; the sprout sigil breathes gently. Dapple drift ≤40% opacity, nothing else moves.
**Copy (60 words):** "Dawson is eligible for his learner's permit today. This grove walks him from the first practice test to the full license: the state rules, the study plan, the hour log, the insurance discount his grades earned. Picture the night before the DDS visit: every document checked, every test passed, the affidavit filled in. That is what this grove is for."

### WHAT IT WILL WATCH OVER — 3 capability cards
1. **Practice tests from the real manual.** "Unlimited practice built from the official Georgia DDS manual. The same 40 questions, the same 75% bar. You will know he is ready before the examiner does." *How it will know: the state manual, linked as the source of truth. Never paraphrased.*
2. **The hour log that becomes the affidavit.** "Every supervised drive logged with one tap, day and night hours split automatically. At the end, the log becomes the pre-filled sworn affidavit Georgia requires." *How it will know: you and Dawson log the drives. The math is ours.*
3. **The good-student discount packet.** "His GPA trend, packaged as the proof packet insurers ask for. Good grades literally pay for the insurance." *How it will know: reads the grade trend from School. The cross-module pride moment.*

### WHILE YOU WAIT — cross-links (2 compact LivingCard rows, all live)
- **School** → "The GPA trend that earns the insurance discount lives here." → `/school`
- **Mail** → "DDS letters and appointment notices land here today." → `/mail`

### ARRIVAL
"Growing in Wave 2 — first, because the need is now."
`btn-angel` "Tell me when this grove opens." → registers `placeholder_interest(child_id, "driving")` → toast "Noted — you'll be the first to know 🌱" → the CTA becomes a quiet StatusPill "We'll tell you 🌱" with an "undo" ghost link. No nag to re-register, ever.

### Groves row
Sigil `car` · **Driving & Life Skills** · "The road to the license, watched over step by step." · `🌱 Planting`

### Child-safety read
Dawson reads: a study plan, an hour log, and an insurance discount he earned. No surveillance, no worry leakage. Passes.

---

## 2. W12 · Babysitters — `/childcare` (need profile seed; NO fake sitter profiles)

**Grove:** 🏡 Home & Family · **Sigil:** `heart-handshake` (moss-tinted glow) · **Wave:** V3 ("Life admin, expanded")
**Seed rule (P-N4):** required, and honest — the seed is the family's *need profile*, which the real matching engine will use. No directory of invented people. That is a lie we will not tell.

### ModuleHeader
- Sigil `heart-handshake` · **Title:** Babysitters · **Subtitle:** "Trusted hands for the hours you can't be there." · `🌱 Planting`

### HERO — The Promise (halo-tinted LivingCard)
**Art:** a turned bed with a low trellis, morning light; one bud closed beside a small "planting" marker. Static or single dapple drift.
**Copy (60 words):** "Early-release Wednesday. A dinner Thursday. The sitter cancels at 4 PM. This grove keeps your bench: vetted sitters who know your kids, your rules, your emergency plan. They re-match in minutes when plans change. Picture it: the school calendar shows a half day, and before coffee cools, Priya is confirmed noon to 3. That is what this grove is for."

### WHAT IT WILL WATCH OVER — 3 capability cards
1. **Your bench, not a directory.** "Sitters matched to your children's ages and your exact windows, ranked with reasons. The sitter you rebook three times becomes the default suggestion." *How it will know: your family's need profile, seeded below, plus verified reviews from completed bookings only.*
2. **The emergency handoff packet.** "For the booking window only, the sitter receives medical flags, allergies, medications, and emergency contacts. It expires automatically when the booking ends." *How it will know: reads the Health vault. Time-boxed by design. They never see grades, location history, or anything else.*
3. **Coverage the calendar proposes.** "Early-release Wednesday appears on the school calendar, and the grove asks: coverage noon to 3? One tap starts the request." *How it will know: the School Calendar watches. The grove proposes, you confirm.*

### SEED IT NOW — "Plant the need profile" (writes to `childcare_seed`)
- Per child (from ChildSwitcher; Dawson pre-filled): "Who might need coverage?" — age pre-filled from profile, confirm/edit inline.
- Typical windows — chips (multi-select): After school · Evenings · School breaks · Date nights
- **Honesty line, required copy:** "No sitter profiles yet. We would rather show you real, verified people than a directory of maybes. Your need profile is what the matching starts from."
- Submit: `btn-dapple` "Plant the need profile" → toast "Noted — the matching starts here 🌱"
**Graduation payoff:** "Your need profile is here. The matching starts from it."

### WHILE YOU WAIT — cross-links
- **School Calendar** → "Half days and breaks, where coverage gaps start, are flagged here today." → `/school/calendar`
- **Health** → "Allergies and medications your future sitter will need are kept here." → `/health`

### ARRIVAL
"Growing in Wave 3. The directory and the request flow first. The full marketplace is a second business, and we will be honest about that."
`btn-angel` "Tell me when this grove opens." → same consent-gated interest pattern as W6.

### Groves row
Sigil `heart-handshake` · **Babysitters** · "Trusted hands for the hours you can't be there." · `🌱 Planting`

### Child-safety read
Teen reads "cool, that's coming" — the handoff packet copy states the boundary plainly (medical only, time-boxed). Passes.

---

## 3. W19 · Emergency Plan — `/emergency` (the trust-earning screen; NO seed form)

**Grove:** 🛡️ Safe & Sound · **Sigil:** `shield-check` (sunlight-tinted glow, kept dim — no pulse on this screen) · **Wave:** V3 ("Life admin, expanded")
**Seed rule (P-N4): DELIBERATELY OMITTED, documented here.** Asking a parent to pre-enter guardianship designations into an unbuilt module is emotionally wrong — "start now" would read as pressure, not invitation. The absence of a seed section is the design decision.
**Tone law (the heaviest module in the catalog):** reverent, plain, unhurried. No exclamation marks anywhere on this screen. No playful copy. No urgency. Copy-lint pass: "peace of mind" banned (hollow), and so is any sentence that hurries the reader. The page should feel like a hand resting on a shoulder.
**No seasonal nudge, no "remind me" variant.** The interest CTA is the quiet "tell me when this grove opens" only (P-N5).

### ModuleHeader
- Sigil `shield-check` · **Title:** Emergency Plan · **Subtitle:** "The worry nobody says out loud — answered, on paper, in one place." · `🌱 Planting`

### HERO — The Promise (halo-tinted LivingCard)
**Art:** a turned bed under soft dusk light, a lantern beside the planting marker. Fully static — no drift, no breathe. Stillness is the point. (The one allowed motion on this screen is the entrance bloom.)
**Copy (58 words):** "If something happened to you tomorrow, would the right people know what to do? This grove holds the answers: guardianship designations, medical consent, who may pick up your children, and the documents that prove it. Picture it: the school calls, and there is a page. Names. Numbers. The plan you made. That is what this grove is for."

### WHAT IT WILL WATCH OVER — 3 capability cards
1. **The vault.** "Birth certificates, passports, insurance cards, custody orders. Encrypted, yours alone, organized the way an emergency needs them: findable in seconds." *How it will know: you place documents here. Nothing is scanned or shared without you.*
2. **The pickup list.** "Who may collect your children, with photo and ID notes. The list the school and the sitter both need, kept current." *How it will know: you name them. The grove nudges a yearly confirmation.*
3. **The yearly review.** "Once a year, a gentle pass. Are the contacts still current, the documents still valid, the designations still right. Fifteen minutes, then rest for another year." *How it will know: dates do the work. Expiry math is the platform's strength.*

### THE ABSENCE — where the seed would be (a single quiet line, dew tint, no card, no form)
"Some groves should not be rushed. When this one opens, we will walk through it together, one page at a time."

### WHILE YOU WAIT — cross-links
- **Mail** → "Legal and insurance mail that belongs in the future vault lands here today." → `/mail`
- **Health** → "The medical details the future handoff packet will draw on live here." → `/health`

### ARRIVAL
"Growing in Wave 3 — after the daily ritual has earned your trust. This grove asks for the most sensitive things you own. It will wait until we have earned them."
`btn-angel`, quiet: "Tell me when this grove opens." → registers interest (consent-gated; launch contact fires ONLY for registered families) → toast "Noted. We will tell you when it is time 🌱" → StatusPill "We'll tell you 🌱" + undo.
**Graduation payoff:** "Everything you trusted us with is here — and it was worth the wait."

### Groves row
Sigil `shield-check` · **Emergency Plan** · "The worry nobody says out loud, answered on paper." · `🌱 Planting`

### Child-safety read
No worry leakage. The teen reads a calm vault, not a catalog of fears. Passes. (Teen-parent contract: the parent's designations stay parent-side; the pickup list is shared with the school, never shown as surveillance.)

---

## 4. W5 · College & Future — `/college` (taking-root; honest data-source lines)

**Grove:** 🌿 School Days · **Sigil:** `graduation-cap` (leaf-tinted glow) · **Wave:** V2 ("The mother starts advising") — after the driving grove
**Honesty note (PRODUCT-SCOPE §5 hard NOs apply to placeholders too):** there is no Common App push and no College Board/ACT auto-pull. Manual entry + verification + orchestration is the honest architecture, and the placeholder says so plainly — including on the seed form itself.

### ModuleHeader
- Sigil `graduation-cap` · **Title:** College & Future · **Subtitle:** "The 9th-grade window is open — the trajectory, read as a story." · `🌱 Planting`

### HERO — The Promise (halo-tinted LivingCard)
**Art:** a long row freshly turned, stretching toward a treeline — a path, not a wall. Dapple drift ≤40% opacity, nothing else.
**Copy (60 words):** "Dawson is 15, and the trajectory window is open now. This grove reads the transcript as a story: how grades and courses open the doors after graduation. It holds the deadline ladder, the essay workspace, and the math of what each path needs. Picture it: the plan for the next two years, written early. That is what this grove is for."

### WHAT IT WILL WATCH OVER — 3 capability cards
1. **The college door simulator.** "Fifty colleges, from Georgia in-state to national pre-med programs. What the current trajectory opens, what it closes, and the GPA that changes the answer." *How it will know: scores you enter once from the official report, verified against it. There is no College Board auto-pull, and we will never imply one.*
2. **The deadline ladder.** "Every deadline counted down at 30, 14, 7, and 2 days. The ladder escalates, so the parent never chases a date." *How it will know: deadlines curated by our team and confirmed against each school's official calendar.*
3. **The essay workspace.** "One home for drafts, prompts, and counselor feedback, with the deadline ladder watching so nothing is written at midnight." *How it will know: you and Dawson write here. Pookie reads alongside, never instead.*

### SEED IT NOW — "Plant the first map" (writes to `college_seed`)
- "Which colleges are on the family's mind?" — three free-text slots (aspirations, not commitments)
- "PSAT or SAT score on file?" — optional numeric, with the honest note beside it: "Entered from the official report and verified. There is no College Board auto-pull."
- Submit: `btn-dapple` "Plant the first map" → toast "Noted — the simulator will start here 🌱"
**Graduation payoff:** "Your shortlist is here, and the simulator already knows them."

### WHILE YOU WAIT — cross-links
- **School** → "The transcript trend the simulator will read lives here." → `/school`
- **Pookie** → "Ask Pookie tonight what the 9th-grade window means for Dawson." → `/pookie`

### ARRIVAL
"Growing in Wave 2, after the driving grove. College prep is weekly cadence, not daily — it will arrive ready for that rhythm."
`btn-angel` "Tell me when this grove opens." → consent-gated interest pattern.

### Groves row
Sigil `graduation-cap` · **College & Future** · "The trajectory, read as a story." · `🌱 Planting`

### Child-safety read
Strengths-first by construction: the simulator shows what the trajectory *opens*, not what is closed. No peer comparison, no verdict language. The 9-year-old's version stays fully dormant (per §3.1 of the IA: W5 sleeps for the 9-year-old). Passes.

---

## 5. W3 · Safety — `/safety` (phone tier; hardware-gated honesty)

**Grove:** 🛡️ Safe & Sound · **Sigil:** `radar` (sunlight-tinted glow) · **Wave:** V2 ("The mother starts advising") — the phone tier
**Honesty note (PRODUCT-SCOPE §5 hard NOs):** the trust contract is the feature — teens see the same map, pauses come with notice, safety context never punishment. No retroactive trail playback, no interrogation features, no AI behavior reports. The white-label tracker hardware is Wave 3 and procurement-gated (ODM firmware dealbreaker) — the placeholder says so plainly.
**Seed rule (P-N4):** required and honest — the SOS emergency contacts. This is data the parent can trust to a placeholder: it is theirs, not the system's.

### ModuleHeader
- Sigil `radar` · **Title:** Safety · **Subtitle:** "The background safety net — felt as calm, never seen as features." · `🌱 Planting`

### HERO — The Promise (halo-tinted LivingCard)
**Art:** a turned bed inside a low stone wall, lantern at the gate — protected, not fenced. Dapple drift ≤40% opacity, nothing else.
**Copy (60 words):** "The background safety net, not a daily ritual. This grove holds the geofences you set, arrival notes for the school run, and the SOS path that stays two taps away. Your teen sees the same map you do, and any pause comes with notice. Picture it: a note that Dawson reached practice, and the evening stays calm. That is what this grove is for."

### WHAT IT WILL WATCH OVER — 3 capability cards
1. **Geofences, the calm kind.** "Home, school, practice: arrival and departure notes, nothing more. No trail playback, no interrogation features. Safety context, never punishment." *How it will know: the companion app on Dawson's phone. He sees the same map, and pauses come with notice.*
2. **SOS that respects a shaking hand.** "Two taps, no fine-motor dependence. Reachable from this grove and from the long-press path the whole app shares." *How it will know: the emergency contacts you seed below, and the 911 routing your household sets.*
3. **The emergency handoff pair.** "Medical flags travel with the SOS: allergies, medications, contacts. The people who arrive know what they need to know." *How it will know: reads the Health vault. Minimum necessary, logged, and disclosed at onboarding.*

### SEED IT NOW — "Who should the SOS reach?" (writes to `safety_seed`)
- Emergency contact 1: name + phone · Emergency contact 2: name + phone
- **Honest line:** "These are the people the SOS path will reach. Dawson will see them too. Nothing hidden, on either side."
- Submit: `btn-dapple` "Save the contacts" → toast "Saved — the safety net knows who to reach 🌱"
**Graduation payoff:** "Your emergency contacts are already here. The SOS path knows them."

### WHILE YOU WAIT — cross-links
- **Health** → "The medical flags the safety net will read live here." → `/health`
- **Wellbeing** → "Daily check-ins give every arrival note its context." → `/wellbeing`

### ARRIVAL
"Growing in Wave 2. The phone tier first: geofencing and SOS through the companion app. The tracker hardware is Wave 3 and procurement-gated."
`btn-angel` "Tell me when this grove opens." → consent-gated interest pattern.

### Groves row
Sigil `radar` · **Safety** · "The background safety net — felt as calm." · `🌱 Planting`

### Child-safety read
The strongest read of the six: the copy states the trust contract in plain language ("He sees the same map"). The teen's takeaway is protection, not surveillance. Passes.

---

## 6. W18 · Summer — `/summer` (consent-gated; NO cold invitations)

**Grove:** 🌿 School Days · **Sigil:** `sun` (sunlight-tinted glow) · **Wave:** V3 ("Life admin, expanded") — ships when the calendar says so
**Consent rule (P-N3):** no cold seasonal invitations, ever. This screen carries TWO quiet, consent-gated options at Arrival: the standard "tell me when this grove opens" AND the seasonal "Remind me in February" opt-in. Both write real rows. Neither ever fires to a parent who did not opt in.
**Seed rule (P-N4):** required — budget + summer-type interests, collected as part of the February opt-in. The real module reads both.

### ModuleHeader
- Sigil `sun` · **Title:** Summer · **Subtitle:** "A season, not a scramble." · `🌱 Planting`

### HERO — The Promise (halo-tinted LivingCard)
**Art:** a turned bed with a small sundial, long evening light — the unhurried season. Dapple drift ≤40% opacity, nothing else.
**Copy (59 words):** "Summer is a season, not a scramble. This grove holds the camp and program directory, the deadline tracker, and the cost comparison, so February planning starts from a plan instead of a panic. Picture it: March, and every week of June is already placed, with the cost known and the deadlines met. That is what this grove is for."

### WHAT IT WILL WATCH OVER — 3 capability cards
1. **The camp and program directory.** "Camps, programs, and summer intensives near you, with real costs and real deadlines. Curated, not scraped." *How it will know: our team curates the listings and confirms them against each program's own site.*
2. **The deadline tracker.** "Applications, scholarships, early-bird pricing. Each with its countdown, none with a surprise." *How it will know: deadlines from the directory, verified against the source. Dates do the work.*
3. **The cost comparison.** "Three options side by side: cost per week, what is included, what the summer teaches. The family budget, respected." *How it will know: you enter the budget once. The math is ours.*

### SEED IT NOW — "Plant the summer sketch" (writes to `summer_seed`)
- "A rough summer budget?" — single numeric field, optional
- "What kind of summer?" — chips (multi-select): Camp · Academic · Sport · Work · Travel · Unstructured
- Submit: `btn-dapple` "Plant the summer sketch" → toast "Noted — February starts from here 🌱"
**Graduation payoff:** "Your summer sketch is here. The directory is already filtered for it."

### WHILE YOU WAIT — cross-links
- **School Calendar** → "The school calendar holds the breaks this grove will plan around." → `/school/calendar`
- **School** → "Grades shape which summer programs fit. The transcript lives here." → `/school`

### ARRIVAL — the consent-gated pair
"Growing in Wave 3. It ships when the calendar says so — and only to families who asked to hear about it."
- `btn-angel` "Remind me in February." → registers the seasonal opt-in (the February invitation fires ONLY to these families)
- `btn-ghost` "Tell me when this grove opens." → the standard wave-interest row
Both consent-gated, both undo-able, neither ever cold.

### Groves row
Sigil `sun` · **Summer** · "A season, not a scramble." · `🌱 Planting`

### Child-safety read
Teen reads camp planning, no worry leakage. Passes.

---

## Appendix A — Designer's notes for the gate review

**A. Why these six read as "real":** every screen has at least one living surface (the seed form or the consent row) above the description cards; the seed writes rows the future module reads; the cross-links answer the adjacent need today. There is no dead end and no fake UI anywhere in the six.

**B. Neon placement (per the visual directive — firefly, not floodlight):** the halo tint is reserved for hero cards. The only glowing interactive element per screen is the seed submit (`btn-dapple`) or the interest CTA (`btn-angel`) — the neon points at the one real action, never at descriptions. W19 keeps even this restrained (no pulsing sigil).

**C. Ambient motion count per screen:** exactly one (hero dapple drift, or static for W19). Entrance bloom staggered ≤8 items (hero + 3 cards + seed + 2 cross-links + arrival = ≤7). All transform/opacity only.

**D. Copy-length discipline:** every hero ≤60 words (verified in drafting); capability cards ≤35 words each; cross-links one line each; arrival two lines + CTA. Read aloud: each screen lands under 45 seconds.

**E. The bright line (per screen):**
- W6: the drive log form and stage selector write real rows. Nothing else looks interactive.
- W12: the need-profile form writes a real row. No sitter profiles anywhere (a directory of invented people is a lie).
- W19: no seed section, by documented design. The interest CTA is the only interactive element, and it is real.
- W5: the aspiration shortlist + score entry write real rows, with the no-auto-pull honesty note beside the score field.
- W3: the emergency-contacts form writes a real row. No map, no geofence UI — nothing that pretends the companion app exists.
- W18: the budget + interest chips + February opt-in write real rows. No camp listings — a fake directory is a lie.

**F. Graduation payoff lines (P-N7) — the launch notification copy, one per screen:**
- W6: "Your logged drives are here — the affidavit export is ready."
- W12: "Your need profile is here. The matching starts from it."
- W19: "Everything you trusted us with is here — and it was worth the wait."
- W5: "Your shortlist is here, and the simulator already knows them."
- W3: "Your emergency contacts are already here. The SOS path knows them."
- W18: "Your summer sketch is here. The directory is already filtered for it."

**G. Gate checklist (PLACEHOLDER-STANDARD §6) — self-verified per screen:**
1. Every CTA does something real — YES (interest registers, seeds write, cross-links navigate).
2. The future is concrete — YES (DDS affidavit, handoff packet, pickup list, deadline ladder, SOS contacts, camp directory).
3. Wave placement honest — YES (waves named from PRODUCT-SCOPE; no dates; no progress bars).
4. Child-safety read — YES (per-screen read recorded above; no worry leakage; W3 states the trust contract plainly).
5. Shame-free read — YES (no "you haven't set up X"; the garden is planting for the parent).
6. Onward path — YES (≥2 live cross-links each; W19 → Mail + Health).
7. `Planting` pill the only unbuilt signal — YES (no dimming, no locks, no "coming soon").
8. Motion budget — YES (≤2 ambient: exactly 1; stagger ≤8; reduced-motion path).
9. The 11 PM test — the bar these screens were written against.
10. Seeds persist to real tables — YES (registry in §0; W19's omission documented per P-N4).

**H. Kill criteria — self-verified:** no dead CTAs · no fake data or fake UI · no "coming soon" · no progress bars · no launch notifications without opt-in · no placeholder used to excuse skipping an honest seed (all six either seed honestly or document the W19 omission).

---

# PART 2 — W25–W31 PLACEHOLDER SPECS (merged 2026-10-11)

**Shared rules (all seven):** every CTA does something real (interest registers `placeholder_interest(tenant_id, module, created_at)`; seeds write real tables); `🌱 Planting` StatusPill (sunlight tint), never dimming, never locks, never "coming soon"; hero ≤60 words with one concrete vignette; `animate-bloom` stagger ≤8; reduced-motion path; child-safety read on every screen (no worry leakage); banned phrases per the standard's blocklist.

---

## W25 · Fuel & Charging — `/fuel` — sigil `fuel`

**ModuleHeader:** *Fuel & Charging* · Subtitle: *"The cheapest way to keep moving."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "Somebody in this family always knew where the cheap gas was. This grove knows it for you — closest and cheapest, gas or chargers, with the math on whether the detour is worth it. Picture this: you're driving to the game Thursday, and before you leave, the answer is already there — the Costco on your route is $0.23 cheaper than near home. That is what this grove is for."

**Three capabilities:**
1. **Closest + cheapest, ranked honestly.** "One ranked answer — the Shell 0.8 miles away is $3.12, the Costco 2.3 miles away is $2.89 — with the detour math shown: saves $4.20, costs 6 minutes, worth it." *How it will know: live price feeds, always timestamped ("updated 12 min ago") — a price without a timestamp is a lie, so we show the timestamp or we show nothing.*
2. **Chargers, vehicle-aware.** "Tesla drivers get Supercharger-first results — availability, cost per kWh, and a preconditioning reminder before arrival. Gas cars get price-first. Mixed household? Both, clearly labeled." *How it will know: the vehicle profile you set below + network APIs where they exist (Tesla, Electrify America, ChargePoint); where they don't, we mark what's estimated.*
3. **The fuel budget, quietly kept.** "Every fill-up logged, every month totaled — 'down $23 from last month, the Costco habit is working.' Low fuel fires with the nearest options attached, not just a warning." *How it will know: your receipts and the Tesla integration; the budget line shares its ledger with Spending.*

**Seed it now (writes to `fuel_seed`):** *"What do you drive?"* — per vehicle: nickname ("the Tesla"), fuel type (gas / EV / both), make + model (optional). Copy: "This is what the ranking runs on — set it once and the map already knows you." The seed persists; the real module reads it on day one.

**While you wait:**
- Flights → "When the trip card exists, fuel stops get pre-computed on the route."
- Spending → "Every fill-up receipt already lands in the ledger."

**Arrival:** "Growing in Wave 3 — the life-admin wave." + `btn-angel` "Tell me when this grove opens."

---

## W26 · Weather — `/weather` — sigil `cloud-sun`

**ModuleHeader:** *Weather* · Subtitle: *"The sky, translated — for the places your day happens."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "The mother who looked out the window and knew. This grove reads the sky for the places your day actually happens — home, the school, the away-game field — and tells you what it means, not just what it is. Picture this: 'temperature drops 20° by the 6 PM pickup — bring jackets.' You never opened a forecast. The day just knew."

**Three capabilities:**
1. **The day's verdict, not the numbers.** "Every forecast ends in a decision: jackets, umbrellas, or go. '68° and sunny' is trivia; 'leave the jackets, but practice ends at 6 and it'll be 54° by then — bring one' is the module." *How it will know: hyperlocal forecast feeds for your places — honest about confidence ("mid-70s, very likely dry" beats "73° and 0%").*
2. **Severe alerts that interrupt like they should.** "A tornado warning at 2 AM is a safety event, not a notification. Alerts come from the National Weather Service, delivered verbatim — never paraphrased by AI." *How it will know: the NWS feed directly, free and authoritative.*
3. **The sky the whole app reads.** "When the forecast changes, the day reshuffles — outdoor practice moves inside and the evening plan adjusts; the trail suggestion changes; the trip card's destination weather updates. One sky, every module looking up." *How it will know: the proactive engine treats weather as a first-class input (per IA §1.5).*

**Seed it now (writes to `weather_seed`):** *"Where does your day happen?"* — add places with labels: Home, School, Work, The Fields, Grandma's. Copy: "This seed feeds the morning line immediately — the dawn verdict knows which sky to read." The dawn line is this module's MVP (see §1.5's ritual-surface pattern); the full destination follows in Wave 3.

**While you wait:**
- Trails & Parks → "When it opens, the trail answers will already know the weather."
- Today → "The day's cards already reshuffle around the sky — that's the weather wire, working before the destination ships."

**Arrival:** "Growing in Wave 3 — but the Garden-dawn line rides ahead of it, because the ritual is the module's first surface." + `btn-angel` "Tell me when this grove opens."

**Pattern note (first ritual-surface module — IA §1.5):** this placeholder demonstrates the ritual-surface pattern: the ritual moment (the dawn line) is the primary surface and can go live before the destination; the tile is the "tell me more." Future ritual-surfaces copy this anatomy.

---

## W27 · Events Near Me — `/events` — sigil `ticket`

**ModuleHeader:** *Events* · Subtitle: *"What's worth doing near you this weekend."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "The mother who always knew what was going on. This grove scans the whole city — Ticketmaster, Eventbrite, venue calendars, city boards — and hands you a short list of 'you'd probably love this,' filtered by your family, not a 200-item firehose. Picture this: Friday afternoon, 'the lantern festival Saturday — 20 min away, free, weather's clear.' That is what this grove is for."

**Three capabilities:**
1. **Family-fit is the filter.** "Kids' ages, interests, budget comfort, how far you'll drive — the list is 'the lantern festival, the free concert, the robotics showcase,' never a concert at 11 PM downtown. Date-night mode is the same engine with a different filter." *How it will know: your family's fit profile (seeded below) + the household the app already knows.*
2. **The weekend, assembled.** "Saturday looks open and the weather's perfect — three things happening near you, with doors, parking, cost, and kid-friendliness spelled out. Tapping one gives you the logistics brief, ticket links, and a calendar add." *How it will know: event aggregators + your places (from the weather seed) + the school calendar, which cross-checks automatically — no festival during the SAT.*
3. **It learns your Saturdays.** "You went to three outdoor concerts — more of those, fewer craft fairs. Ticket drops you care about get a nudge: 'lantern festival tickets go on sale tomorrow — you went last year.'" *How it will know: what you tap and what you attend; taste learning, not star ratings.*

**Seed it now (writes to `events_seed`):** *"What does your family love, and how far will you drive?"* — interest chips (outdoor concerts, festivals, sports, theater, markets, museums), max drive minutes slider, budget comfort band, date-night opt-in. Copy: "This is the filter — set it once and the list is yours." No fake event listings; a directory of invented events is a lie.

**While you wait:**
- Weather → "The sky your weekend depends on already has its seed planted."
- Today (Coming Up) → "The band where the weekend possibilities will land when this grove opens."

**Arrival:** "Growing in Wave 3 — the life-admin wave." + `btn-angel` "Tell me when this grove opens."

---

## W28 · Restaurants Near Me — `/restaurants` — sigil `utensils-crossed`

**ModuleHeader:** *Restaurants* · Subtitle: *"Where should we eat tonight — decided in 30 seconds."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "The mother who knew every good spot. This grove ends the 20-minute 'I don't know, where do YOU want to go' loop — one answer built from your craving, your budget, your family's actual taste. Picture this: 'Italian, the margherita the kids will eat, 12 min away, outdoor seating — and you're short on protein, so the grilled options are flagged.' That is what this grove is for."

**Three capabilities:**
1. **Taste, not just stars.** "4.8 stars means nothing if the family hates sushi. The module learns what you actually order — the 'we always end up here' patterns — and ranks by your mouth, not the crowd's. The anti-rut nudge included: 'you've been to the same 4 places — this new Thai spot matches your profile.'" *How it will know: your taste profile (seeded below) + where you actually go.*
2. **Every constraint, filtered first.** "Allergies, halal, vegetarian, the kid who only eats margherita — filtered before results, never as an afterthought. Group decisions get ranked so everyone's constraints are satisfied." *How it will know: the dietary profile you set; reservations via Resy/OpenTable deep links (we never build booking infrastructure).*
3. **Wired into the day's food.** "No meal planned tonight — 'want to eat out? Here's what's good nearby.' Short on protein — 'these 3 spots have great grilled options.' The receipt flows back into Spending, so dinner out is never a mystery in the ledger." *How it will know: the meal plan, the nutrition closeout, the spend ledger — the wires are the module.*

**Seed it now (writes to `restaurants_seed`):** *"Your taste profile."* — cuisines loved (chips), dietary needs + allergies (first-class fields, not a notes box), budget band, kid-friendliness requirement, "we always end up here" (up to 3 saved spots). Copy: "Set it once — every future answer starts here."

**While you wait:**
- Meals → "The meal plan this grove will hand off from is already being built."
- Nutrition → "The closeout that will flag 'short on protein' already runs nightly."

**Arrival:** "Growing in Wave 3 — the life-admin wave." + `btn-angel` "Tell me when this grove opens."

---

## W29 · Trails & Parks — `/trails` — sigil `mountain`

**ModuleHeader:** *Trails & Parks* · Subtitle: *"Where can we go outside today."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "The mother who knew every trail. This grove holds the whole outdoors — trails, parks, playgrounds — with the honesty that matters: how hard, how far, who's it good for, and what it's like *right now*. Picture this: 'rained yesterday — the riverside trail will be muddy, try the ridge instead. Sunscreen, 2L water, the trail's exposed after mile 1.' That is what this grove is for."

**Three capabilities:**
1. **Conditions, honestly.** "A trail is only as good as its current state — mud after rain, closures, parking full by 10 AM. The module combines trail data with the weather feed, the season, and real-time signals: 'go now' vs 'wait until Sunday' is the difference between a great morning and a miserable one." *How it will know: trail data sources + the weather wire (the flagship cross-module synthesis).*
2. **Fit for YOUR family.** "Difficulty matched to real people — 'your knees + a 15-year-old who won't complain about a 2-hour loop = these 5 trails.' Playgrounds rated for teens too. Packing lists generated per trail." *How it will know: the household profile + your places seed; parks and playgrounds first, backcountry as the data layer matures.*
3. **The weekend plan, assembled.** "No practice Saturday — the trail window's open. Trail + weather + drive time + what to pack, in one card. Post-hike, the photos and the memory land in the family story." *How it will know: the activity calendar cross-checks (W4), the exercise data feeds it (W22: '2,100 steps — the 3-mile loop would close it out').*

**Seed it now (writes to `trails_seed`):** *"Home location."* — address or dropped pin + difficulty preference (easy strolls / real hikes / both) + who goes (per-person fitness notes, optional). Copy: "The map needs a center before it can rank — this is it."

**While you wait:**
- Weather → "The sky this grove reads already has its seed planted."
- Activity → "The step counts that will feed the trail suggestions are already tracked."

**Arrival:** "Growing in Wave 3 — parks and playgrounds first, backcountry as the data matures." + `btn-angel` "Tell me when this grove opens."

---

## W30 · Flights — `/flights` — sigil `plane`

**ModuleHeader:** *Flights* · Subtitle: *"The best deal, with the reasoning visible."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "The mother who always found the cheap flights — now watching prices around the clock. This grove doesn't just search; it strategizes: fare trends on your route, the book-now-vs-wait call with the odds shown, the hidden-airport math. Picture this: 'Chicago fares dropped $60 — the March trip. 78% chance it drops $40 more this week — set the alert or book the $212 now.' That is what this grove is for."

**Three capabilities:**
1. **Price intelligence, not just price display.** "The fare prediction shows its work — 'this route drops Tuesdays, wait 4 days' — with confidence, never fake certainty. 'From $X' pricing is banned: you see the actual bookable total for your travelers." *How it will know: live-checked fares at display time, timestamped, never cached-and-hoped (Duffel/Amadeus class APIs).*
2. **Family-trip coordination.** "Flying with kids isn't solo travel: seat-together guarantees flagged (basic-economy traps that split the family get called out), baggage math done honestly ('2 checked bags × $35 × 4 legs = $280 — the fare with bags included is actually cheaper'), the 6 AM departure that saves $50 but ruins the day flagged as such." *How it will know: your household + the trip you name; restrictions spelled out before booking, not discovered at the gate.*
3. **The trip, assembled.** "Flights + the rental car + the weather at the destination + what's on that weekend — one trip card, one plan. 'Landing at O'Hare 2:15 PM — 4 counters in Terminal 2, best total-cost rate for a midsize SUV.'" *How it will know: the rental-car handoff (W31), the weather wire (W26), the events scan (W27).*

**Seed it now (writes to `flights_seed`):** *"Your home airport + a trip you're dreaming of."* — home airport (powers fare-drop alerts), one watched trip: destination + rough dates. Copy: "Name the trip and we'll start watching the fares — the prediction engine's first job is already running."

**While you wait:**
- Rental Cars → "The car that will meet you at the gate is taking root beside this grove."
- Weather → "The destination forecast your trip card will carry already has its seed planted."

**Arrival:** "Growing in Wave 3 — the life-admin wave." + `btn-angel` "Tell me when this grove opens."

**Money-movement constraint (IA §1.6 — founder's attention):** this module books real travel. The placeholder and the future booking flow obey: card data never touches Pookie servers (tokenized provider flows); totals are the actual bookable total, taxes and fees included; cancellation/change policies summarized in plain language at the decision point; no countdown timers, no fake scarcity, no pre-checked upsells. Receipts flow to Spending.

---

## W31 · Rental Cars — `/cars` — sigil `car-front`

**ModuleHeader:** *Rental Cars* · Subtitle: *"The right car at the honest price — no counter gauntlet."* · `[🌱 Planting]`

**Hero (halo LivingCard):**
> "The mother who never overpaid for a rental. This grove compares every counter and shows you the total — base + taxes + fees — not the '$29/day*' that becomes $89 at checkout. Picture this: you land, and the answer is waiting — the best total-cost rate for the midsize SUV your family actually fits in, the insurance you already have declined for you, the return planned around your 8 AM flight. That is what this grove is for."

**Three capabilities:**
1. **Total-cost ranking.** "Ranked by what you actually pay — base rate + taxes + fees — never base-rate theater. One-way drop fees, toll transponders, child seats: surfaced before booking, not at the counter." *How it will know: rental inventory APIs (Amadeus/CarTrawler class) + the trip's airport and dates.*
2. **The loyalty and coverage intelligence.** "The module knows your memberships — Hertz Gold, National Emerald, or none (and whether signing up is worth it). It flags the insurance double-pay trap: 'your Amex already covers CDW — decline the $28/day.' Fuel-policy math included: 'prepay is only worth it if you return empty — you won't.'" *How it will know: your loyalty seed below + the card benefits the app already knows.*
3. **Vehicle-fit for the family.** "2 adults + 2 teens + luggage for a week = full-size minimum — here's why the compact won't work. The return planned too: 'flight's at 8 AM, the rental return is 15 min from the terminal, leave the hotel by 5:45.'" *How it will know: your household + the flight handoff (W30) that starts every rental search.*

**Seed it now (writes to `cars_seed`):** *"Loyalty programs."* — memberships held (chips: Hertz, National, Avis, Enterprise, none), member numbers (optional, stored encrypted), what coverage you already carry (credit-card CDW? personal auto?). Copy: "This is the fine print, handled once — the module declines what you already have."

**While you wait:**
- Flights → "The trip that hands this grove its dates and airport is taking root beside it."
- Spending → "Every rental receipt will land in the ledger — the trip's true cost, visible."

**Arrival:** "Growing in Wave 3 — the life-admin wave." + `btn-angel` "Tell me when this grove opens."

**Money-movement constraint (IA §1.6 — founder's attention):** same as Flights — tokenized booking flows, no card data on Pookie servers; actual bookable totals; plain-language cancellation terms at the decision point; no dark patterns (no fake scarcity, no pre-checked upsells, no base-rate theater). Receipts flow to Spending.

---

## Build checklist (per placeholder — PLACEHOLDER-STANDARD §6)

Each of the seven answers YES to all ten gate questions before shipping: every CTA real · future concrete with named artifacts · wave honest (V3, no dates) · child-safety read passed · shame-free read passed · ≥2 cross-links · Planting pill the only unbuilt signal · motion within budget · the 11 PM "I can't wait" test · seeds persist to real tables the future module will read.

**W26 special:** the Garden-dawn line is the ritual MVP and may ship ahead of the destination — the placeholder's Arrival section says so honestly.
