# PRODUCT-SCOPE.md — Pookie Module Waves (PM decision doc)

**Author:** Product Manager, design team · **Date:** 2026-10-11 · **Status:** FOR MEHEDI'S REVIEW
**Sources:** `AI-MOTHER-VISION.md` (23 modules W1–W23), founder directives, engineering state as of 2026-10-11.

---

## 0. How this doc was decided

Four non-negotiable founder directives govern every call below:

1. **"If the app does not look good and intuitive, it is not useful."** — UI is the milestone gate, not engineering volume.
2. **The true goal: make the parent FEEL their life is under control.** Mission control that feels like a garden.
3. **Healthy addiction = the daily ritual.** Open Pookie every morning like checking the weather. Progress dopamine, garden-metaphor hook, notifications that matter, completion loops. **Shame-free always** — pride and progress, never guilt or fear.
4. **Design is Milestone 1; engineering builds TO the spec.** The V1 set below is deliberately small enough to be designed and judged as one experience.

**The ruthless test applied to every module:** *"Would a tired parent open this at 11pm, or check it first thing in the morning — and does it make them feel their life is under control?"* If no, it's V2 or later. If never, it's cut.

**Current engineering state (as of 2026-10-11):** W1 (school core), W20 (shopping), W21 (mail) are BUILT but not yet live. W5 (college prep), W16 (school calendar), W22 (exercise), W23 (nutrition) are in progress. Everything else is unbuilt.

---

## 1. The V1 product: "Morning Mission Control"

V1 is not a module list — it is **one daily ritual** that a parent can feel:

> **Morning briefing (7:00 AM):** "Here's your family today." One screen. School fires first (W1+W9): what moved overnight, what's due, the path forward. Then the small things that make a mother a mother (W16): picture day, permission slip, the thing that needs signing tonight. Then the household (W21/W20): the bill due Friday, the grocery list with who's grabbing what. Then the body (W2/W8): meds taken?, sleep, mood pulse.
>
> **Evening closeout (9:00 PM):** the completion loop. Check off what got done. Watch the garden grow — grades climbing, streaks, tasks cleared. The dopamine hit that makes tomorrow morning's open automatic.

**V1 definition of done:** A parent opens Pookie on a random Tuesday morning and says, without prompting, *"Pookie runs my family's life."* Nothing in V1 may be a dead end (a module that ingests data but never feeds the ritual). Nothing may ship as "a dashboard with numbers." Every module in V1 must feed the morning briefing or the evening closeout, or it doesn't ship in V1.

The garden metaphor is the hook: the family's week is rendered as a living garden. Things grow (grades up, streaks alive, habits kept), things need water (tasks open, nudges pending). Never weeds, never rot — shame-free is a rendering rule, not just a copy rule.

---

## 2. V1 — The milestone gate (7 modules, ruthless)

### V1.1 — W1 · School core *(built, not live)*

- **Job-to-be-done:** Tell me if my kid is keeping up in school, and exactly what to do about it.
- **Why V1:** This is the founding worry and the densest daily data. Dawson's Geometry at 69.5 is the story every parent recognizes. Grades + missing work + Path-to-90 + teacher comms + daily check-in is the engine the whole ritual idles on.
- **If cut:** There is no product. Every other module is decoration.

### V1.2 — W9 · Proactive engine / morning briefing *(unbuilt — this is the actual product)*

- **Job-to-be-done:** Notice before I do, and hand me the day already prioritized.
- **Why V1:** The engine *is* the "notices before you do" thesis, and the morning briefing is its face. Without it, W1 is a spreadsheet and W16/W20/W21 are three apps. With it, five modules feel like one mother.
- **If cut:** No daily ritual. No "runs my family's life" feeling. The product becomes five tabs nobody opens.

### V1.3 — W16 · School minutiae calendar *(in progress)*

- **Job-to-be-done:** Never let me miss picture day, the permission slip, or spirit week again.
- **Why V1:** The purest "mother's eyes" differentiation — zero new data sources (runs off the W1 school-email pipeline), the feature a dad shows his friends, and the single most reliable morning-briefing content after grades.
- **If cut:** The morning briefing reads like a report card. W16 is what makes it feel like home.

### V1.4 — W21 · Mail intelligence *(built, not live)*

- **Job-to-be-done:** Did that bill get paid? Was there something important in today's mail?
- **Why V1:** This is "the household runs itself" in one interaction: snap → classified → action + reminder. Bills and deadlines are the adult half of the daily ritual. Already built — excluding it from the gate would waste the highest-feeling-of-control module we own.
- **If cut:** The parent still dreads the envelope pile. The app feels school-only.

### V1.5 — W20 · Shared family shopping list *(built, not live)*

- **Job-to-be-done:** Are we out of milk? Who's getting it? Did we overpay?
- **Why V1:** Daily household frequency, everyone-in-the-family participates (tagged by who), and it converts the parent's mental load into a visible, completable loop. Built — and the "who added it" social surface gives the garden something alive every single day.
- **If cut:** The household half of the ritual is thin. Morning briefing has no "family" in it.

### V1.6 — W2 · Health module, lite *(in progress)*

- **Job-to-be-done:** Keep my kid's health from falling through the cracks — meds, shots, checkups, the doctor's agenda.
- **Why V1:** Highest-stakes worry; Dawson's baseline already exists (BMI, braces, glasses, pending workup) so it seeds itself. V1 scope is tight: health profile + medication schedules/reminders + immunization tracking + doctor-visit cadence + the visit-agenda builder. The wearables pipeline and condition-tracking depth wait for V2.
- **If cut:** "Everything a mother would be worried about" fails at the second worry. The briefing has a school headline with no body underneath.

### V1.7 — W8 · Daily mood pulse *(folded into the W1 check-in, not a standalone module)*

- **Job-to-be-done:** Is my kid okay today — in 10 seconds, without a lecture.
- **Why V1:** One extra field on the existing daily check-in (mood/energy/stress). Costs almost nothing, feeds the briefing's emotional texture daily, and establishes the privacy contract early (child-private, parent sees patterns only).
- **If cut:** The ritual is all logistics, no person. Trend detection, supportive conversations, and crisis design ship in V2 as the full W8.

**V1 deliberately does NOT include:** location safety (W3), driving (W6), banking (W7), college prep (W5), meal planning (W13), nutrition tracking (W23), exercise tracking (W22), social life (W17), summer planning (W18), guardianship (W19), screen time (W15), co-parenting (W14), babysitters (W12), spend intelligence (W11). Reasons in §5.

---

## 3. V2 — "The mother starts advising" (sequenced by value)

V2 begins only after the milestone gate passes. Order within V2 is by daily-ritual leverage first, founder-demo leverage second:

1. **W6 · Driving + life skills** — Dawson is permit-eligible NOW with zero prep logged. The state-rules table, AI practice tests, and drive logging turn an urgent founder demo into a module. Permit-prep content already in progress.
2. **W5 · College prep pipeline** — Dawson is 15; the 9th→12th trajectory window is open now. Guidance engine + essay workspace + deadline tracker. In progress.
3. **W22 · Exercise & health tracker** — HealthKit/Health Connect are real and proven; manual entry first, Dexcom second. This is the data layer W2 interprets. In progress.
4. **W13 · AI meal planning** — From the child's actual health data; feeds W20's grocery list; teen-safe by design (no dieting, deterministic allergy gate). Makes the shopping list intelligent — closes a V1 loop.
5. **W23 · Nutrition tracker** — The what-if simulator is the differentiator; depends on W13 meal data + W22 exercise data + W20 list wiring (see §6). In progress — ships after its dependencies.
6. **W8 · Emotional wellbeing, full** — Trend detection over the V1 pulse, Pookie supportive conversations, disclosed crisis tripwire. The privacy contract from V1 carries over.
7. **W3 · Location safety, phone tier** — Geofencing + arrival/departure + SOS via the companion app, under the trust contract (teens see the same map, pause-with-notice, safety context never punishment). White-label hardware is V3 (procurement-gated).
8. **W7 · Banking virtual ledger + documents** — In-app allowance accounting (zero compliance) + passport/ID expiry tracking (pure date math — the platform's superpower). Plaid read-only and anything movement-capable wait for a compliance decision in V3.
9. **W11 · Spend intelligence** — Spend-vs-outcome per child, allowance ledger. Needs W7's ledger; feeds the parent digest.
10. **W4 · Extracurriculars** — Tryout radar, prep timelines, curated tutor directory (seeded from real relationships like Prof Ved), lessons. The proactive engine's T8 trigger ("time for a human tutor") comes alive here.
11. **W17 · Social life** — Friend birthdays, social calendar, pattern-level social health. Child-private by default — the privacy contract is the feature. Last in V2 because it adds ritual texture but not ritual structure.

---

## 4. V3 — "Life admin, expanded" (partnership- or procurement-gated)

- **W14 · Co-parenting** — Custody calendar, expense ledger, handoff notes. Designed for the one-parent-onboarded case (read-only share links).
- **W18 · Summer planning** — Camp/program directory + deadline tracking + cost comparison. Seasonal by nature; ships when the calendar says so.
- **W19 · Guardianship + documents vault** — The worry nobody says out loud. Vault reuses the credential-vault encryption pattern; "ask a lawyer" is a feature, not a footnote.
- **W15 · Screen time & digital wellbeing** — Android real (UsageStats), iOS via MDM-profile or manual fallback. Ships with per-OS honesty, nudges over blocks by default.
- **W3 · White-label tracker hardware** — Procurement-gated (ODM sample phase, firmware-to-us-only dealbreaker, lab traffic-verification). The brand already names the hardware.
- **W12 · Babysitter & childcare finder** — Curated directory + parent-confirmed request flow + emergency handoff packet. True two-sided marketplace is aspirational (a second business).
- **W10 · Sibling fairness view** — UI surface on native multi-tenancy: per-child cards, parent-only fairness nudges, never cross-child comparisons.
- **W7 · Banking partnerships** — Plaid read-only, movement-capable gated on compliance. Virtual ledger (V2) stands alone fine.

---

## 5. Explicit NOs — what we cut or defer, and why

### Never build (hard NOs — principles, not sequencing)

- **Scraped retailer prices presented as live (W20).** Stale or wrong prices destroy trust faster than no prices. User-reported prices + receipt learning only, until a licensed data feed exists.
- **Calorie targets / weight-loss dieting for teens (W13/W23).** Eating-disorder risk is a design constraint. No weight-loss mode for under-18 tenants, ever. Nourishment and energy framing only.
- **Location as punishment tooling (W3).** No retroactive trail playback, no interrogation features, no AI behavior reports. Safety context, never punishment — by design principle.
- **Message scanning / substance-use surveillance (W2/W15/W17).** Resources only. Coaching, never spyware. No cross-referencing hangouts with location history.
- **Diagnosis of any kind (all modules).** No diagnostic verbs in any copy — enforced in prompts and UI lint. Trends and nudges only, "talk to your doctor" rails.
- **Auto-anything financial or legal (W21/W7).** Nothing is paid, disputed, filed, or moved without the parent's explicit approval of the exact action. The AI drafts; the parent acts.
- **Being a money transmitter (W7).** No custody, no pooled funds, ever. Virtual ledger + partner-moves-money only.
- **Secret tripwires (W8/W22).** The crisis/safety override exists, is disclosed at onboarding in plain language, is logged, and is minimum-necessary. No covert monitoring.
- **Cross-child pattern store above scale (W9 §3.2).** Ships dark; expert-authored patterns only, clearly labeled, until k≥20 distinct children. The tenant-isolation iron rule is not negotiable.
- **Pretending nonexistent APIs exist.** No Common App push, no College Board/ACT auto-pull, no Find My integration, no Quest/Labcorp feeds, no real-time doctor availability, no live grocery price feeds — until partnerships make them real. Manual entry + verification + orchestration is the honest architecture.

### Deferred, not cut (right module, wrong wave)

- **W3 location in V1:** A 15-year-old's location isn't a daily ritual; it's a background safety net. Phone-tier geofencing lands in V2; hardware in V3. The SOS/911 honesty note (pendants can't place calls) is a V2 design input, not a V1 blocker.
- **W6 driving in V1:** Urgent for Dawson specifically, but it's one child's one milestone — the gate must serve every family's every day. V2-first.
- **W5 college in V1:** The trajectory window is open now, but college prep is weekly/monthly cadence, not daily. A daily-ritual gate that opens with "Ivy guidance" would feel wrong at 11pm. V2-second.
- **W22/W23 in V1:** In progress already, but the wires (W22→W2, W13→W20→W23) are what make them modules instead of apps. Ship the wires in V2, not the counters in V1.
- **W14 co-parenting in V1/V2:** Mehedi is a single dad; the founder is the first user. Designed for one-parent-onboarded from the start, built when the tenant base needs it. V3.
- **W12 babysitters in V1/V2:** Directory + request flow is buildable, but it's a second business disguised as a feature. V3.
- **W15 screen time in V1:** iOS has no honest API without MDM; shipping an Android-only module in the gate would embarrass the iOS majority. V3 with per-OS honesty.
- **W18 summer in V1:** Seasonal. Ships when February comes, not before.
- **W19 guardianship in V1:** The heaviest emotional module in the catalog. Earn the parent's trust with the daily ritual first, then ask for their will. V3.

---

## 6. Dependency map

| Dependent | Needs | Note |
|---|---|---|
| W9 morning briefing (V1) | W1, W16, W21, W20, W2, W8-pulse | The briefing is a composition layer; every V1 module feeds it |
| W16 extractor (V1) | W1 school-email pipeline | No new data sources — this is why it's V1-cheap |
| W8 full trends (V2) | W8 V1 pulse + W22 sleep data | Correlation needs the data layer first |
| W13 meal plans (V2) | W2 health rollups | One-way, tenant-scoped; deterministic allergy gate is code, not LLM |
| W23 nutrition (V2) | W13 meal data + W22 exercise + W20 list | Build the wires, not just the counter; ships last of the three |
| W22 stream (V2) | W2 interpretation layer | W22 is data, W2 is meaning — don't ship the stream without the interpreter |
| W11 spend intelligence (V2) | W7 ledger + W4/W21 spend events | Spend without a ledger is a guess |
| W4 tutor trigger (V2) | W9 T8 trigger taxonomy | The AI decides *when* a human is needed |
| W5 guidance (V2) | W1 grades + W4 extracurricular depth | Trajectory needs the transcript and the story |
| W3 SOS (V2) | W2 medical flags | Emergency handoff packet is the killer feature of the pairing |
| W3 hardware (V3) | Procurement: ODM firmware-to-us-only | A procurement problem, not a software one |
| W20 basket optimization (V2+) | W13 grocery lists | Meal plans drop lists in tagged "meal plan" — the loop closes |
| W14 expense ledger (V3) | W11 ledger patterns | Same math, second household |
| Pattern store (dark) | k≥20 children | Expert-authored patterns only until the bar clears |

---

## 7. Design-team notes (the 11pm test)

- **The user is a tired parent on their phone at 11pm.** One thumb, low light, low patience. Morning briefing fits one screen; evening closeout is a checklist with a garden that visibly grew. No tables of numbers after 9pm.
- **Shame-free is a rendering rule.** Geometry at 69.5 renders as "12 points to the goal — here's the path" with the top-3 ranked next steps, never as a red 69.5. The Path-to-90 framing from the Dawson work carries into every module.
- **Completion loops are the addiction.** Every V1 module must have something to *finish*: sign the slip, mark the bill paid, clear the list item, log the check-in. Finished things feed the garden. Unfinished things are gentle nudges, never alarms.
- **Notifications that matter:** max 1 parent alert/day/child, max 3 child nudges/day, quiet hours 10pm–6am (held, auto-sent 6am). A mother who pings about everything gets tuned out — and then the product is dead.
- **The child has their own experience.** The teen sees the same map (W3), their own garden, their own nudges — never the parent's worry list, never raw surveillance. Trust is the retention mechanism for the second user.
- **Copy rules (standing):** mission framing ("12 points to go"), no em dashes, no diagnostic verbs, "under your protein target" never "you failed protein", allergy blocks are deterministic, dates come from the document not the model.

---

*End of PRODUCT-SCOPE.md. Next: design team renders the V1 morning briefing and evening closeout as the Milestone 1 gate.*
