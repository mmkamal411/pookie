# Squad 5 — UX Specs: Travel, Marketplace & Support UI

**Owner:** UX Designer, Squad 5 · **Status:** SPEC ONLY — no code, no deploys · **Date:** 2026-10-12
**Branch target:** `staging-build` (specs for the Wave-2 Frontend Engineer to build from)
**Source of truth hierarchy:** this doc for UI/copy/component contract; `docs/solutions/sol-support.md` for the support domain model; `docs/solutions/sol-ux.md` for cross-cutting patterns; `docs/BUILD-SPECIFICATION.md` (FR-SUPPORT-001..006, FR-MENU, FR-MOD-W27/W28/W29/W30/W31/W6/W12) for requirements. Where this doc and BUILD-SPEC differ, BUILD-SPEC's exact acceptance criteria win (flagged below).

**Design system:** Nebula theme — dark cosmos `#050510`, animated starfield, subtle neon glows (soft, never harsh), pink `#f472b6` accent, PookieOrb. Mobile-first. Plain English, shame-free, ≤8th-grade copy. Information collapsed by default, expandable on tap. Visuals blend with the background (no sticker look).

**Shared components reused** (from sol-support §A + sol-ux): `Starfield`, `GlowCard`, `CollapseRow`, `Toggle`, `PrimaryButton`, `QuietButton`, `InfoLine`, `Sheet` (bottom sheet), `FullPageFlow`, `StatusPill`, `AuditLine`, `ModuleTile` (from `src/components/more-directory.tsx`), `CrisisResourceBlock` (988/741741 per sol-ux §7), `AgeGate`.

**Age-band model used in this doc:**
| Band | Ages | Notes |
|---|---|---|
| `kid` | <13 | Parent-managed profile only; no login, no AI chat, no tickets (sol-support §C.2). Support runs in the parent's session. |
| `teen` | 13–17 | Own login; child is access authority; cooling-off 13–15; gated modules apply. |
| `adult` | 18+ | Full surface. |

Every screen below has an **Age-band variations** section unless noted. Default specs assume the adult/parent band; teen deltas called out explicitly.

**Visual-language note:** Support crisis/safety moments use **Nebula-Neutral** (static dim starfield, flat slate, no confetti). Gaining-help moments use standard Nebula. Nothing punitive, ever.

---

## 1. TRAVEL HUB — `/c/[childSlug]/travel`

### 1.0 Screen: Travel hub home

**Layout (mobile-first):**
1. `Starfield` background, dim (hub, not celebration).
2. **Header block:** sigil 🌍, title "Travel", subtitle "getting around, and the world beyond the door" (from `modules.ts`).
3. **`InfoLine` (gated-transparency note, all bands):** "Some travel tools unlock as you grow up — Pookie grows with you." (Shame-free growth framing per sol-ux §9 empty-state rule.)
4. **Module grid:** 7 tiles rendered in `modules.ts` order: W25 Fuel & Charging, W30 Flights, W31 Rental Cars, W27 Events, W28 Restaurants, W29 Trails & Parks, W26 Weather. All are **seedlings** (see §1.1 for the seedling contract).
5. **Age-gating (server + UI — panel-blocked rules, redesigned only):**

| Tile | Teen (13–17) | Adult (18+) | Under 13 |
|---|---|---|---|
| W25 Fuel & Charging | Visible seedling | Visible seedling | Visible seedling (parent's session) |
| W30 Flights | **Visible seedling + 18+ purchaser notice** (see §1.2) | Visible seedling | Parent's session view |
| W31 Rental Cars | **Hidden entirely** — not rendered, no placeholder, no "locked" tile (FR-MOD-W31 + sol-ux §9: don't teach the boundary by displaying it) | Visible seedling | Parent's session view |
| W27 Events | Visible seedling + **curation-policy note + age-tag explainer** (see §1.3) | Visible seedling | Parent's session view |
| W28 Restaurants | Visible seedling (21+/bar-primary excluded silently per sol-ux §14 — no visible change on the hub tile) | Visible seedling | Parent's session view |
| W29 Trails & Parks | Visible seedling + **supervision guidance line** (see §1.4) | Visible seedling | Parent's session view |
| W26 Weather | Visible seedling + "not an emergency-alert system" disclaimer line | Visible seedling | Parent's session view |

6. **Empty-state rule:** if gating leaves a teen's grid thin, the remaining tiles still render normally. If a band ever sees zero tiles, render `EmptyCategoryCard`: "Nothing here for you right now. Some parts of Pookie unlock as you get older. Pookie grows with you." (per sol-ux §9; not expected at launch).

**Copy deck (hub-level):**
- Header subtitle: as in `modules.ts`.
- Gated note (teen): "Some travel tools unlock as you grow up — Pookie grows with you."

### 1.1 Seedling tile contract (all 7 tiles)

All travel tiles reuse the `ModuleTile` seedling pattern from `src/components/more-directory.tsx`: `GlowCard` with 🌱 marker, module name, `watchOver` line, expandable (tap tile) → `CollapseRow`-style expansion revealing "Taking root — the first step is small and real:" + `seedAction` text + per-tile gate notes below.

| Tile | `seedAction` | Tap expansion shows (one seed-it-now action + gate note) |
|---|---|---|
| W25 Fuel & Charging | "What do you drive?" | Vehicle form (one question: gas / EV / both) |
| W30 Flights | "Name a dream trip" | Trip-dream input + **18+ purchaser notice** (§1.2) |
| W31 Rental Cars | "Add your loyalty programs" | Loyalty-program list (adult only) |
| W27 Events | "What does your family love?" | Interest picker + **curation-policy note + age-tag explainer** (§1.3) |
| W28 Restaurants | "Build your taste profile" | Taste quiz start + teen: "Prefer well-lit, busy areas after dark" toggle preview (default ON <18, sol-ux §14) |
| W29 Trails & Parks | "Set your home location" | Coarse-location picker + **supervision guidance** (§1.4) |
| W26 Weather | "Where does your day happen?" | Location input + disclaimer: "Pookie isn't an emergency-alert system — follow official alerts." |

**Seedling empty/error states:** if a seed-it-now action fails to save (offline), keep the entered value locally, show `InfoLine`: "Couldn't save that just now — it's kept here and we'll try again." No error toasts that blame the user.

### 1.2 W30 Flights — teen seedling with 18+ purchaser invariant

**Rule (FR-MOD-W30):** purchaser-of-record must be 18+ (server-side invariant). The UI never lets a teen reach a working checkout. Per this squad's brief: teen sees **"ask a parent to book"**, not a broken checkout.

**Teen tile expansion (`teen` band):**
- `InfoLine` (amber-tinted, persistent, not dismissible): "✈️ **Flights need a grown-up to book.** Airlines require the person paying to be 18 or older — that's their rule, and Pookie enforces it. You can plan and dream all you want; a parent books it."
- Seed action becomes **plan-only**: "Name a dream trip" → trip idea saved to a shared family list; CTA button copy: `[Share this trip idea with a parent]` (not "Book").
- The word "checkout", "pay", "buy" never appears in the teen tile. Any fare estimate carries: "Prices are estimates — a parent completes the booking."
- **Copy deck (W30 teen):**
  - Notice: "Flights need a grown-up to book. Airlines require the person paying to be 18+."
  - CTA: "Share this trip idea with a parent"
  - Fare line: "About $___ (estimate — a parent completes the booking)"

**Adult tile (18+):** seedling only at launch — no booking surface yet. Seed action "Name a dream trip" → saved list. No purchaser notice (adult is eligible).

**Error state:** if a teen session somehow reaches a booking route (deep link), server rejects; UI shows Nebula-Neutral sheet: "Booking needs a parent — this link needs a grown-up's account. [Open the trip idea instead]" — never a generic 403.

### 1.3 W27 Events — curation policy + age tags + audience modes

**Rule (FR-MOD-W27):** published curation policy; ticketed public venues / municipal / school / nonprofit / verified hosts only; never private-residence or "DM for address"; per-event age tags (all-ages / 13+ / 18+ / 21+); 18+/21+ filtered by default for <18; audience modes (Family / Teen / Grown-up); municipal seed sources.

**Teen tile expansion (`teen` band):**
1. `InfoLine` (**curation-policy note**, always visible): "🛡️ **Every event here is vetted.** Pookie only lists public venues, schools, city events, and verified hosts — never private homes or 'DM for address' meetups."
2. **Age-tag explainer row** (chips, non-interactive at seedling stage): `[All ages] [13+] [18+] [21+]` with caption: "Events show who they're for. Grown-up events stay off your list automatically."
3. **Audience mode picker** (3 segmented chips; default for <18 = **Family**): Family · Teen · Grown-up. Teen accounts cannot select Grown-up — the chip renders disabled with `InfoLine`: "Grown-up events are for 18+ — your list shows Family and Teen." (Shame-free; growth framing, not "you're too young".)
4. Seed action: "What does your family love?" → interest chips (music, sports, fairs, volunteering…).

**Adult tile:** audience modes all selectable; curation-policy note still shown (trust surface, all bands).

**Age-band filtering rule (for build):** 18+/21+ events filtered by default for <18 server-side; teen cannot toggle the filter off. No "hidden for your age" placeholders on the hub tile.

**Copy deck (W27):**
- Curation note: "Every event here is vetted — public venues, schools, city events, and verified hosts only. Never private homes. Never 'DM for address'."
- Age tags caption: "Events show who they're for."
- Grown-up chip (teen): "Grown-up events are for 18+."

### 1.4 W29 Trails & Parks — supervision guidance, share-my-plan, sunset

**Rule (FR-MOD-W29):** no solo-hike recommendations for <16; difficulty carries group-size/supervision guidance; official sources only (NWS + park authority; dusk-closure awareness); 90-minute sunset warning; "share my plan" as a first-class step.

**Teen tile expansion (`teen` band):**
1. `InfoLine` (**supervision guidance**, always visible): "🥾 **Hiking is better with company.** Pookie won't suggest solo hikes if you're under 16 — every trail here shows who should come along."
2. **"Share my plan" first-class step:** the seed action flow includes, before location is saved, a `Sheet`: "Who gets your hiking plan?" → trusted-adult picker (defaults to the teen's trusted adult) + `InfoLine`: "Before you head out, Pookie shares where you're going and when you'll be back. One tap, every time."
3. **Sunset-warning preview line:** "You'll get a heads-up 90 minutes before sunset on hiking days — enough time to head back."
4. Seed action: "Set your home location" → coarse location (zip / neighborhood, per <18 coarse-location default).

**<16 rule:** no solo-hike recommendations at all — the recommendation engine excludes them server-side. Ages 16–17 get difficulty + group-size labels ("Bring 2+ people", "Go with an adult").

**Adult tile:** supervision line not shown; "share my plan" still offered as an option (good practice, not gated).

**Copy deck (W29):**
- Supervision: "Hiking is better with company. Under 16, Pookie only suggests hikes with others along."
- Share-my-plan: "Who gets your hiking plan? One tap before you head out."
- Sunset: "90 minutes before sunset, Pookie nudges you to head back."

### 1.5 W25 / W26 / W28 / W31 notes

- **W25 Fuel & Charging:** no age gating. Teen tile works fully (informational). Seed: "What do you drive?" → vehicle type picker.
- **W26 Weather:** all bands. Disclaimer line under expansion: "Pookie isn't an emergency-alert system — follow official alerts." NWS-sourced only when live (never LLM-generated weather).
- **W28 Restaurants:** teen tile has no visible gating on the hub. Silent server-side exclusions (21+/bar-primary) per sol-ux §14. Expansion shows taste-profile seed + night-safety toggle preview: "Prefer well-lit, busy areas after dark" (default ON <18; teen can toggle with one honest line).
- **W31 Rental Cars:** adult-only seedling. Teen accounts: tile not rendered. Under-21 adults (18–20): planning-mode label in expansion — "Planning mode: most companies rent at 21+. Pookie shows the real total so there are no surprises." Under-25 surcharge callout when live.

**Component inventory (§1):** `Starfield`, `ModuleTile` (reuse), `GlowCard`, `CollapseRow` (tile expansion), `InfoLine` ×4 (gated note, W30 18+ notice, W27 curation, W29 supervision), `Sheet` (W29 share-my-plan), `Toggle` (W28 night-safety, W27 audience segmented control), `EmptyCategoryCard`, `AgeGate` (W31 suppression).

---

## 2. MARKETPLACE HUB — `/c/[childSlug]/marketplace`

### 2.0 Screen: Marketplace hub home

**Layout:**
1. `Starfield` dim.
2. Header: sigil 🤝, title "Marketplace", subtitle "trusted services, found".
3. `InfoLine`: "These are directories and guides — Pookie helps you find and vet, but every booking happens with the real provider."
4. **Two large tiles** (not the small seedling grid — Marketplace has only 2 modules, give them room):
   - **W12 Babysitters** — seedling card.
   - **W6 Driving School** — seedling card.
5. Both bands see both tiles (W12/W6 are 13+-appropriate; W6 is visible 13+ per sol-ux §9).

**Copy deck (hub):** header + InfoLine above. Empty state: n/a (tiles always render).

### 2.1 W12 Babysitters — directory tile

**Rule (FR-MOD-W12):** directory only; labeled "parent-vetted, not background-checked by Pookie" — or integrate real checks (FCRA counsel first).

**Tile expansion (all bands):**
1. `InfoLine` (**required label**, always visible, amber-tinted): "👶 **Parent-vetted, not background-checked by Pookie.** Sitters here are added and vouched for by parents — Pookie doesn't run background checks. Always meet first and trust your gut."
2. Seed action: "Add your first sitter" → sitter profile form (name, contact, notes, "how we know them", availability).
3. Directory list (when seeded): sitter cards — name, contact, availability chips, parent's notes. Each card carries the micro-label: "Added by you · not background-checked".
4. **Teen band (13–17):** teens see the directory read-only (who's booked when, sitter contact for the evening). "Add sitter" CTA hidden for teens — `InfoLine`: "Only a parent can add or change sitters."

**Empty state:** "No sitters yet. Add someone your family trusts — a neighbor, a cousin, a regular." + `[Add your first sitter]`.

**Error state:** contact-save failure → inline `InfoLine` under the form: "Couldn't save — check your connection and try again." Values preserved.

**Copy deck (W12):**
- Vetting label: "Parent-vetted, not background-checked by Pookie."
- Card micro-label: "Added by you · not background-checked"
- Teen note: "Only a parent can add or change sitters."
- Safety nudge (first add): "Quick tip: meet a new sitter with your kids home the first time."

### 2.2 W6 Driving School — GA DDS rules tile

**Rule (FR-MOD-W6):** must encode Georgia DDS rules; digital driving log for Joshua's Law hours; per-state rules from day one. Visible 13+ (sol-ux §9).

**Tile expansion:**
1. **"Your Georgia timeline" card** (`GlowCard`, computed from DOB — `GeorgiaTimelineCard` per sol-ux §9):
   - **Under 15:** "Getting ready" content only — study guides, what the permit test feels like, what to expect at the DDS. No permit actions. Copy: "Your permit journey starts at 15. Here's how to get ready."
   - **15+:** learner's permit checklist (DDS documents, eye exam, written test).
   - **16+:** provisional Class D checklist with restrictions spelled out: "No driving midnight–5 AM · Passenger limits · No phone use".
   - **18+:** full Class C at 18.
2. **Joshua's Law 30-hour log:** `InfoLine`: "Georgia's Joshua's Law needs 30 hours of supervised driving logged. Pookie's log counts every drive." → `[Log a drive]` → simple form (date, minutes, supervisor, conditions). Progress ring: "12 of 30 hours".
3. **GA DDS rules list** (plain language, always visible):
   - "Learner's permit at 15"
   - "30 hours of supervised driving (Joshua's Law)"
   - "Provisional Class D at 16 — no driving midnight to 5 AM, passenger limits"
   - "Full license (Class C) at 18"
4. Driving-school directory seed: "Find a driving school" → zip search (seedling at launch).

**Under-15:** no log actions — the log CTA renders disabled with: "The driving log opens at 15 — for now, the study guides are yours."

**Copy deck (W6):**
- Timeline header: "Your Georgia license timeline"
- Joshua's Law: "Georgia's Joshua's Law needs 30 hours of supervised driving. Log every drive here."
- Class D restrictions: "Provisional license: no driving midnight–5 AM, and passenger limits."
- Under-15: "Your permit journey starts at 15. Here's how to get ready."

**Component inventory (§2):** `Starfield`, `GlowCard` (marketplace tiles + `GeorgiaTimelineCard`), `InfoLine` (vetting label ×2, teen note, Joshua's Law), `Sheet` (sitter form, log-a-drive form), `PrimaryButton` / `QuietButton`, `CollapseRow` (rules list), `AgeGate` (W12 add-sitter, W6 log gating).

---

## 3. SUPPORT HUB — `/c/[childSlug]/support`

### 3.0 Screen: Support hub home

Entry point to S1/S2/S3. This is the 7th menu category surface — it must feel like help, not a maze.

**Layout (mobile-first):**
1. `Starfield` dim; header sigil 💬, title "Support", subtitle "help, when you need it".
2. **`InfoLine` (privacy promise, always visible):** "Support works with almost nothing — your ticket and your words. Not your grades, not your health. (Why we do it this way ↗)" → deep-links to the S1 article *"Why does a support agent need my permission to look at my grades?"*.
3. **Three big entry cards** (`GlowCard`, full-width, icon + title + one-line description + chevron):

   | Card | Title | Sub | Route |
   |---|---|---|---|
   | 📖 S1 | "Help Center & FAQ" | "Answers to common questions — searchable, plain-language." | `/c/[childSlug]/support/faq` |
   | 💬 S2 | "AI Support Chat" | "Instant answers, 24/7. A human is one tap away." | `/c/[childSlug]/support/chat` |
   | 🎫 S3 | "Support Tickets" | "Open a ticket, track it, talk to a human." | `/c/[childSlug]/support/tickets` |

4. **"Not an emergency" line** (persistent, under the cards, per W19/sol-support §C.4): "Pookie Support isn't an emergency service. In an emergency, call 911. In crisis: call or text 988."
5. **Under-13 band:** S2 and S3 cards show a parent-context note: "For under-13s, support runs in a parent's session — the person Pookie talks to is always the parent." (sol-support §C.2). The cards remain tappable by the parent.

**Quick actions row** (under cards): `[?] Open the "?" helper` is contextual per screen (see §4.5); hub shows: `QuietButton` "What can support see?" → bottom `Sheet` with the visibility matrix in plain language (sol-support §A.3) + link to Settings → Privacy → "Support access".

**Copy deck (hub):**
- Privacy promise: "Support works with almost nothing — your ticket and your words. Not your grades, not your health."
- Emergency line: "Pookie Support isn't an emergency service. In an emergency, call 911. In crisis: call or text 988."
- Under-13 note: "For under-13s, support runs in a parent's session."

**Component inventory (§3):** `Starfield`, `GlowCard` ×3 (entry cards), `InfoLine`, `Sheet` (visibility matrix), `QuietButton`, `PrimaryButton`.

---

## 4. S1 — HELP CENTER & FAQ — `/c/[childSlug]/support/faq`

### 4.1 Screen: FAQ home

**Layout:**
1. **Search first** (sticky top): large search field, placeholder: "What do you need help with?" — search is the primary affordance, tree is secondary (mobile users search; the tree is for browsing).
2. **9-section tree** below search: each section a `CollapseRow` (collapsed by default), section title + article count:
   1. Health · 2. Home · 3. School · 4. Safety · 5. Travel · 6. Marketplace · 7. Support · 8. Account & Privacy · 9. Legal & Your Rights
   (Coverage per sol-support §A.5.1: every module gets ≥1 how-to + ≥1 troubleshooting article; launch corpus floor ~90 articles — Milestone-1 gate.)
3. Each article row: title + optional ⚖️ marker if it carries a legal accordion. Tapping opens the article screen (§4.3).
4. **Age-band filtering:** server-side by viewer band (`all` | `teen` | `parent`); the count of hidden results is never disclosed (sol-support §A.1).
5. Footer: "Can't find it? [Ask Pookie (AI chat)] · [Open a ticket]" (both one tap).

### 4.2 Search behavior

- **Keyword first:** Postgres full-text over title + keywords + body; typo-tolerant (`pg_trgm`), ranked by `ts_rank`.
- **Semantic fallback:** only when keyword returns <3 results or top score < threshold — `pgvector` cosine over embeddings. Fallback results render under a quiet section header: "Related answers" (no AI hype copy).
- **Ranking:** exact title match > keyword > semantic; teen-band filter applied before display.
- **Empty state:** "We didn't find that — ask Pookie (AI chat) or open a ticket." + two buttons: `[Ask Pookie]` `[Open a ticket]`.
- **Error state:** search service down → `InfoLine`: "Search is having a moment — try browsing the sections below, or ask Pookie." Sections remain usable.
- **Loading:** skeleton rows (3 shimmer lines), never a blank screen >300ms.
- **Result row:** title + section breadcrumb ("Travel › Events") + first-line excerpt. Legal-badge ⚖️ shown where applicable.

### 4.3 Screen: Article — `/c/[childSlug]/support/faq/[slug]`

**Article template (every article, no exceptions — sol-support §A.1):**

1. **Problem line** — H1, user-voiced, one sentence: *"My grades stopped updating."*
2. **InfoLine (audience):** if article is band-specific: teen band sees "Written for teens." / parent band sees "Written for parents."
3. **Steps** — numbered, ≤6, each one action, ≤8th-grade (FK ≤ 8.0 enforced in CMS; build fails to draft).
4. **`LegalAccordion`** — only where the article has a legal dimension (§4.4). Renders after steps, before related answers.
5. **"Still stuck?" escalation block** (`GlowCard`, soft pink border):
   > "Still stuck? Talk to us — we'll pick up where this article left off. You won't have to repeat yourself."
   > `[Ask Pookie about this]` (primary — opens S2 with article slug pre-attached as context) · `[Open a ticket]` (quiet — opens S3 with category pre-filled)
6. **Related answers** — 2–4 editorially curated links (`related_slugs`).
7. **Feedback row:** "Was this helpful?" 👍 / 👎 (quiet). 👎 → `Sheet`: "What went wrong?" chips: *Wrong answer · Out of date · Too confusing · Didn't answer my question* + optional one-line note. Copy on submit: "Thanks — that helps us fix it. Want a human to take it from here?" (→ S2/S3 offer). Writes to `faq_feedback`; helpful-rate <60% over 30 days → auto-flagged for editorial review (sol-support §A.2).

**Component inventory (article):** `InfoLine`, `LegalAccordion` (new — §4.4), `GlowCard` (still-stuck block), `Sheet` (feedback), `QuietButton`/`PrimaryButton`.

### 4.4 `LegalAccordion` component contract

Collapsed by default. Renders at end of article body, before "Related answers". (Full contract: sol-support §A.5.2; this is the UI build contract.)

**Collapsed row:**
```
┌──────────────────────────────────────────────────────────────┐
│ ⚖️ Why does Pookie do it this way?              [BADGE ▾]    │
└──────────────────────────────────────────────────────────────┘
```
Badge ∈ `Required by law` | `Our choice` | `Law + our choice` — fixed copy, no fourth option.

**Expanded:**
- Plain-language explanation (≤8th-grade, separately readability-gated).
- "The law:" line — name + citation (e.g. "COPPA — Children's Online Privacy Protection Act; FTC Rule, 2025 update").
- "What it means for you:" 2–3 bullets.
- **Honesty line (mandatory for `our_choice`):** "The law doesn't require this — we do it because …" Writers may never write "for legal reasons" without naming the law.
- Footer meta: "Reviewed {date} · Next review {date} · v{version}". If `review_due_at` passed → amber banner: "This explanation is being re-reviewed — the policy hasn't changed." (Never silently hidden.)
- **Attorney sign-off gate:** no `LegalAccordion` goes live without licensed-attorney approval (launch-blocking, sol-support §E).

**The 11 mandated legal topics** (each gets an article + `LegalAccordion`): COPPA under-13 logins; FCRA credit 18+; FERPA school-records-after-revoke; child-as-authority + court-order exception; go-independent trusted-adult (duty of care); 18+ health re-consent; GA Parents' Bill of Rights O.C.G.A. § 20-2-786 (permission slips/emergency notices); sitter background-check limits; support-agent data access (our choice); data retention/COPPA minimization; account deletion schedule + legal holds.

### 4.5 Contextual "?" deep-links

A small "?" button on complex screens opens a bottom `Sheet` with the relevant article **inline** — never navigates away from the task:
- Sharing screen → *"Who can see my child's stuff — and who decides?"* (access model; legal accordion on child-as-authority)
- Grade sync / "SYNC NOW" → *"Why did my grades stop updating?"*
- Settings → Safety → *"How safety works — private spaces and when we step in"*
- Ticket form → *"What can support see? (Almost nothing — by design)"*

**Sheet anatomy:** article title + problem line + steps (scrollable) + "Read the full article" link + "Still stuck?" mini-block (S2/S3 buttons). Close returns to the exact prior screen state.

### 4.6 Age-band variations (S1)

| Band | Sees |
|---|---|
| Teen 13–17 | `all` + `teen` articles. Parent-only legal-process articles (e.g., guardian attestation disputes) filtered out silently. Teen band gets the "private spaces" cross-link in the S2 article. |
| Adult/parent | `all` + `parent` articles. |
| Under-13 (parent session) | Parent band; child never sees FAQ directly. |

**Copy deck (S1):**
- Search placeholder: "What do you need help with?"
- Empty: "We didn't find that — ask Pookie (AI chat) or open a ticket."
- Still stuck: "Still stuck? Talk to us — we'll pick up where this article left off. You won't have to repeat yourself."
- Feedback: "Was this helpful?" → "Thanks — that helps us fix it. Want a human to take it from here?"
- Legal header: "⚖️ Why does Pookie do it this way?"
- Honesty line: "The law doesn't require this — we do it because …"

---

## 5. S2 — AI SUPPORT CHAT — `/c/[childSlug]/support/chat`

Scoped to support intents only: how-to, troubleshooting, account, billing. Served by the `pookie-tutor` Worker (support-scoped system prompt, FAQ retrieval, safety middleware).

### 5.0 Screen: chat home / active conversation

**Layout:**
1. **Persistent AI disclosure — header chip (always visible, never dismissible):** `🤖 AI assistant — not a person` (fixed under the nav bar, all scroll states).
2. **First-run `InfoLine`** (once per user, dismissible only after reading — scroll-to-bottom to dismiss):
   > "I'm Pookie's support assistant — an AI. I can walk you through features and fix common problems. I **can't** see your private data (grades, health, check-ins), delete or export your account, or make promises about the law. **A human is one tap away anytime** — just say 'human.'"
3. **Message list:** user bubbles right (soft pink glow), AI bubbles left (teal glass). Each AI answer carries quiet 👍 / 👎 affordances.
4. **Composer:** text input + `[Human]` quick button (always visible next to send — the one-tap human path). Placeholder: "Describe what's going wrong…"
5. **After S2→S3 handoff:** conversation becomes read-only: banner "This chat is now attached to ticket #PK-2026-0042 — continue there" + deep link to the ticket (sol-support §A.2).

### 5.1 Escalation tripwires (any one fires)

| # | Trigger | UX |
|---|---|---|
| 1 | Confidence < 0.60 after FAQ lookup | "I'm not sure I have this right — want me to bring in a human?" `[Yes, get a human]` `[Let me rephrase]` |
| 2 | User asks for a human ("human", "real person", "talk to someone", "agent") | Immediate handoff. No persuasion, no "are you sure?" |
| 3 | 3 failed attempts (same intent, 3 AI turns) | "I've tried three ways and we're still stuck — let me get you a person. I'll send them our whole chat so you don't repeat anything." |
| 4 | Crisis language | **Pattern interrupt — §5.3. Never the ticket queue alone.** |
| 5 | Account deletion / data export request | AI gives plain-language info (what deletion does, retention summary, 30-day SLA) **AND** opens a human ticket immediately: "Deleting your account is a big step — a person on our team will handle this with you to make sure it's done right." |

**Never bluff:** below-threshold confidence never produces a guessed answer.

### 5.2 The handoff contract (triggers 1, 2, 3, 5)

Two-step, inside the chat (no navigation away):

**Step 1 — Summary card ("what I'll hand them"):**
```
┌──────────────────────────────────────────────────┐
│ ✨ Handing you to a human                        │
│ Here's what I'll send them — check it over:      │
│ • Grades stopped syncing Tuesday                 │
│ • You tried SYNC NOW twice; still stuck          │
│ • On iPhone, parent account                      │
│ [Looks right ✓]  [Add something]                │
└──────────────────────────────────────────────────┘
```
- `[Add something]` → composer stays open for one more user message, then the card re-renders with the addition.
- 3–5 bullets, plain language, generated from the conversation.

**Step 2 — Ticket issued (on `[Looks right]`):**
```
┌──────────────────────────────────────────────────┐
│ 🎫 Ticket #PK-2026-0042 is open.                 │
│ I've attached our whole chat — you don't have    │
│ to retype anything.                              │
│ ⏱️ Current wait: about 2 hours.                  │
│ We'll notify you here and by push when someone   │
│ replies. [View ticket]                           │
└──────────────────────────────────────────────────┘
```
- **Ticket number issued immediately** (synchronously at handoff — the user never waits for a number).
- **Wait-time estimate:** computed from live queue depth per priority (p50 of last-7-days handle time × position). Queue empty → "usually replies within minutes right now" — never a fake precise number. After hours → honest banner variant (§6.4).
- Transcript attached as the ticket's first `ticket_messages` row (`author_type='ai'`), rendered in the thread as a collapsed "📎 Chat transcript" row.

### 5.3 Crisis pattern-interrupt (THE UNMISSABLE RULE)

**Crisis language NEVER goes into a ticket queue alone.** On server-side detection:

1. **Freeze the support flow.** Troubleshooting pauses. No ticket, no SLA timer, no "we'll get back to you in 24 hours."
2. **Inline resource block** (inside the chat, NOT a modal), persistent for the session:
```
┌──────────────────────────────────────────────────┐
│ We're really glad you told Pookie.               │
│ You don't have to handle this alone:             │
│ [📞 Call or text 988]  (tel:988, one tap)        │
│ [💬 Text HOME to 741741]  (sms:741741)            │
│ [📍 GA Crisis & Access Line: 1-800-715-4225]     │
│ [🧡 Help me tell a trusted adult]                │
│ Pookie stays here with you.                      │
└──────────────────────────────────────────────────┘
```
   - "Help me tell a trusted adult" → `TrustedAdultTellSheet` (editable pre-written message, per sol-ux §11 Rung 3).
   - 988 is one-tap call/text — never a plain link.
3. **No auto-ticket.** A support ticket is created **only** at explicit user request. After the crisis moment, the AI may offer once, gently: "When you're ready, I can connect you with a human on our support team for anything else." Opt-in only.
4. **After:** `crisis_events` audit row; conversation flagged crisis — **no human support agent reads it at launch** (re-run mandatory-reporter analysis before any human read begins).

**Copy contract (crisis):** warm, present, no clinical language, no "just between us" promises. The trusted-adult promise is the single safety guarantee stated (sol-ux §11).

### 5.4 "AI was wrong" correction path

- Every AI answer: quiet 👍 / 👎.
- 👎 → `Sheet`: "What went wrong?" → chips: *Wrong answer · Out of date · Too confusing · Didn't answer my question* → optional one-line note.
- *Wrong answer / Out of date* → offered corrected path: re-answer from a different article OR escalate to human.
- Copy: "Thanks — that helps us fix it. Want a human to take it from here?"
- Writes to `faq_feedback` + training queue; helpful-rate <60%/30d → auto-flagged for editorial review.

### 5.5 Empty / error / edge states

- **Empty (first open):** suggestion chips: "Grades not syncing" · "How do I share with a parent?" · "Delete my account" · "Talk to a human".
- **Offline:** composer disabled with `InfoLine`: "You're offline — Pookie's AI needs a connection. Your message is saved and will send when you're back." (Unsent draft preserved.)
- **Under-13:** S2 session creation rejected server-side. In a parent's session on a child's profile, the AI system prompt pins the counterparty as the parent: header chip gains a sub-line: "You're chatting as [Parent name] — Pookie talks to parents here, never kids under 13." (sol-support §C.2)
- **Rate/error:** AI service down → `InfoLine`: "Pookie's AI is resting right now — open a ticket and a human will pick it up." + `[Open a ticket]`.

**Component inventory (§5):** `InfoLine` (disclosure, first-run), `GlowCard` (handoff/summary/ticket cards), `Sheet` (feedback, trusted-adult), `CrisisResourceBlock` (988/741741/GCAL one-tap), `PrimaryButton`/`QuietButton`, `StatusPill` (n/a here), message bubbles.

**Copy deck (S2):**
- Header chip: "🤖 AI assistant — not a person"
- First-run: as quoted in §5.0.
- Low confidence: "I'm not sure I have this right — want me to bring in a human?"
- 3 attempts: "I've tried three ways and we're still stuck — let me get you a person. I'll send them our whole chat so you don't repeat anything."
- Deletion: "Deleting your account is a big step — a person on our team will handle this with you to make sure it's done right."
- Handoff: "I've attached our whole chat — you don't have to retype anything."
- Crisis: "We're really glad you told Pookie. You don't have to handle this alone."
- Post-crisis offer: "When you're ready, I can connect you with a human on our support team for anything else."

---

## 6. S3 — SUPPORT TICKETS — `/c/[childSlug]/support/tickets`

### 6.0 Screen: ticket list

**Layout:** `GlowCard` rows: ticket number, subject, `StatusPill`, last-activity timestamp, unread dot. Sorted by most-recent activity.
- **Empty state:** "No tickets yet — that's a good sign. If something breaks, open one here and a human will pick it up." + `[Open a ticket]` + `[Ask Pookie first]`.
- **New ticket CTA:** persistent `PrimaryButton` "Open a ticket" (bottom, thumb-reachable).

### 6.1 Screen: new ticket form — `/c/[childSlug]/support/tickets/new`

**Fields:**
1. **Subject** (text, required, ≤120 chars).
2. **Category** (picker: module/topic codes, e.g. `school.sync`, `login.sso`, `billing`; pre-filled when arriving from S1/S2).
3. **"What's going on?"** (textarea, required). Placeholder: "Tell us what happened — what you tried, what you expected."
4. **"?" helper** → `Sheet` with *"What can support see? (Almost nothing — by design)"* (sol-support §A.1).
5. **Teen-privacy banner** (teen band, always visible on the form — FR-SUPPORT-004):
   > 🔒 "This ticket is private to you. Your parents won't be told you opened it and can't see it — unless someone's safety is at risk right now. Every time a support agent looks at anything of yours, it's logged and you can see the log in Settings → Privacy → 'Who's looked at my stuff.'"
6. **Attachment** (images/PDFs ≤10 MB; server-side pattern redaction on ingest — PANs/SSNs/passwords replaced with `[redacted]`, never stored).
7. **On behalf of** (under-13 in parent session only): chip "On behalf of [child first name]" — counterparty is the parent (sol-support §C.2).
8. Submit → `PrimaryButton` "Open ticket" → ticket number issued immediately → lands on the thread (§6.2).

**Error states:** submit offline → draft saved locally, `InfoLine`: "Saved — we'll open this ticket when you're back online." Validation errors inline under fields, plain language ("Give it a subject so we know what it's about.").

### 6.2 Screen: ticket thread — `/c/[childSlug]/support/tickets/[id]`

**Header:**
- Subject (H1), ticket number (mono, small).
- **`StatusPill`** — user-facing pill copy mapped to server states (sol-support §D.2):
  | Server status | Pill copy |
  |---|---|
  | `open` | **Open** (slate) |
  | `in_progress` | **With [agent first name]** (teal glow) — e.g. "With Maya". Unassigned in_progress → "With our team". |
  | `resolved` (awaiting user confirm) | **Answered — your call** (amber) |
  | `closed` | **Closed** (dim) |
- **SLA indicator** (next to pill): "Replies within ~24h · 6h left" (green → amber <6h → red on breach). Red adds: "We're late — sorry. A lead has been notified." (sol-support §A.3)
- **"What can support see?"** link → visibility `Sheet` + link to Settings → Privacy → "Support access" audit view.
- **SLA clock is window-aware** (FR-SUPPORT-003): 9 AM–5 PM ET, 7 days/year-round. Display copy uses concrete times: "First response by ~1 PM tomorrow" — never a fake precise minute.

**Message thread (mobile-first):**
- User bubbles right (soft pink glow); agent bubbles left (teal glass); **system rows** center, small caps: "Ticket opened · 11:04 PM", "Maya joined · 9:12 AM", "Waiting on your confirmation".
- **AI transcript attachment** renders as a collapsed row: "📎 Chat transcript attached" (expandable, from S2 handoff).
- **Internal notes are never rendered** (RLS-enforced; not client-filtered).
- **Timestamps:** every bubble + every status transition timestamped. Shift changes announced in-thread.

**"Resolved? Confirm" card** (when agent marks resolved — the ticket **cannot close** without it):
```
┌──────────────────────────────────────────────────┐
│ Maya thinks this is resolved. Is it fixed for you?│
│ [Yes, all good ✅]   [No, still broken]           │
│ No reply in 5 business days? We'll close it      │
│ automatically — you can reopen anytime within    │
│ 30 days.                                         │
└──────────────────────────────────────────────────┘
```
- "No, still broken" → back to `in_progress`, agent notified, `reopened_count` increments; >2 → auto-flagged for lead review.

**Composer:** text + attachment (≤10 MB; redaction filter on send). Placeholder: "Reply to Maya…". After close: composer replaced with `[Reopen ticket]` (≤30 days, one tap).

**Shift-change re-intro:** when a new agent picks up, a system row + agent intro message: "Hi, I'm Jordan — picking up from Maya. I've read the whole thread, so you don't need to repeat anything."

**After-hours honest banner** (ticket opened outside 9–5 ET; FR-SUPPORT-003):
> 🌙 "It's after hours — our team is back at 9 AM ET. Your ticket is saved and first in line. Pookie's AI can keep helping meanwhile — [Ask Pookie] — or leave **notes for the agent** below and they'll read them first thing."
- **"Notes for the agent" scratchpad:** a separate textarea on the thread (visible only pre-first-response): "Anything the agent should know first? It'll be the first thing they read." Saved to the ticket as a user message flagged `is_scratchpad`.

### 6.3 Teen-privacy banner (persistent, teen band)

Shown at the top of every teen-owned ticket thread (collapsible but never dismissible — re-collapses on revisit, never hidden):
> 🔒 **Private to you.** Your parents aren't told about this ticket and can't see it. The only exception: if someone's safety is at risk right now. Agents must ask your permission *in this thread* before looking at your grades or health — and every look is logged where you can see it (Settings → Privacy → "Who's looked at my stuff").

**Enforcement note for build:** `teen_privacy` flag at the API layer — invisible to parent accounts, not just UI-hidden (FR-SUPPORT-004). Parents are **not** CC'd on teen-owned tickets, including notifications (sol-support §D.3).

**Lock-screen-safe copy rules** (all bands): push/email bodies contain **no PII** — "New reply on ticket #PK-0042: *Grades not syncing*" (ticket subject only; no message excerpt, no names). Agent push bodies never contain user PII (queue counts/SLA-risk only).

### 6.4 Grant consent card (in-thread, when an agent needs to see data)

When an agent taps "Request data access" (allowlisted scopes only: `school.grades.read`, `billing.read`, `sync.status.read` — never `health.*`/`wellbeing.*`/`mood.*`/`checkin.*`), the **data owner** gets an in-app card + push (for teen-owned data, the card goes to the **teen**, never the parent — sol-support §C2):

```
┌──────────────────────────────────────────────────┐
│ 🔑 Maya (support) is asking to look at:          │
│ • Your grades (school.grades.read)               │
│ Why: "To see why your sync is stuck"             │
│ Expires automatically in 24 hours. You can take  │
│ it back anytime in Settings → Privacy.           │
│ [Approve once]  [Deny]                           │
└──────────────────────────────────────────────────┘
```
- Approve → grant active (24h default, ≤72h lead-extendable); every scoped read audit-logged and teen-visible: "Maya viewed your grades (ticket #PK-0042, you approved) · 3:42 PM · access expired next day 3:42 PM."
- Deny → logged; agent sees only "Access declined."

### 6.5 Statuses, timestamps, audit

- Every status transition writes a timestamped system row in the thread.
- **AuditLine** component used in Settings → Privacy → "Support access" / "Who's looked at my stuff": "Maya (support) viewed ticket #PK-0042 · Oct 12, 3:40 PM" — teen-visible, never parent-visible for teen-owned tickets.
- Auto-close: 5 business days of silence after "Answered" → system row: "Closed automatically — reopen within 30 days if it's not fixed."

**Component inventory (§6):** `StatusPill` (4 states + SLA indicator), `GlowCard` (ticket rows, confirm card, consent card), `Sheet` ("?" helper, visibility matrix), `InfoLine` (after-hours, offline draft), `AuditLine` (privacy audit view), `PrimaryButton`/`QuietButton`, message bubbles, `CrisisResourceBlock` (n/a — crisis never enters tickets per §5.3).

**Copy deck (S3):**
- Teen banner: "🔒 Private to you. Your parents aren't told about this ticket and can't see it…"
- SLA ok: "First response by ~1 PM tomorrow" · "Replies within ~24h · 6h left"
- SLA breached: "We're late — sorry. A lead has been notified."
- After-hours: "It's after hours — our team is back at 9 AM ET. Your ticket is saved and first in line."
- Scratchpad: "Anything the agent should know first? It'll be the first thing they read."
- Confirm: "Maya thinks this is resolved. Is it fixed for you?" / "No reply in 5 business days? We'll close it automatically — you can reopen anytime within 30 days."
- Auto-close: "Closed automatically — reopen within 30 days if it's not fixed."
- Push (lock-screen-safe): "New reply on ticket #PK-0042: *Grades not syncing*"
- Grant card: "Maya (support) is asking to look at: … Expires automatically in 24 hours."
- Shift change: "Hi, I'm Jordan — picking up from Maya. I've read the whole thread, so you don't need to repeat anything."

---

## 7. CROSS-CUTTING NOTES FOR THE FRONTEND ENGINEER

1. **Age-gating is server-enforced; UI mirrors it.** W31 never renders for <18 (no placeholder). W30's 18+ purchaser rule is a server invariant — the teen UI must never present a working checkout path.
2. **"Hidden, not locked."** Per sol-ux §9: gated features are *not rendered* for the gated band — no locked tiles, no "unlocks at 18" teasers (they teach workarounds).
3. **Shame-free copy linter:** no "are you sure?", no "you're too young", no "your parents won't like this". Growth framing: "Pookie grows with you."
4. **≤8th-grade reading level** on all user-facing strings in this doc; no em dashes in teen-facing copy (use commas/periods).
5. **Support data minimization:** the S2/S3 UI must never display health, grades, or check-in content unless a grant is active — the "I can't see your private data" line must be *true* in what the UI renders.
6. **Crisis > support, always:** any crisis language freezes S2/S3 flows and routes to §5.3. No ticket is auto-created from crisis language.
7. **Legal accordions need attorney sign-off** before going live (launch-blocking gate, sol-support §E). Ship the component; gate the content.
8. **Seedling pattern:** reuse `ModuleTile` from `src/components/more-directory.tsx` — expandable, one seed-it-now action, never "coming soon".
9. **Routes** (all under `/c/[childSlug]`): `/travel`, `/marketplace`, `/support`, `/support/faq`, `/support/faq/[slug]`, `/support/chat`, `/support/tickets`, `/support/tickets/new`, `/support/tickets/[id]`.

## 8. OPEN QUESTIONS (for PM / Managing Director)

1. **FR-SUPPORT-006 — PARTIALLY DECIDED by Managing Director (D4, 2026-10-12):** billing/refund authority = **$50 in-ticket financial authority** for agents; holiday coverage = **rotating on-call** (7-day promise adjusted — on-call staffing, not full coverage). → *UX: SLA display component takes copy from config; add an in-ticket "$50 or less — I can fix this now" affordance in the agent console spec (agent-side, Squad 5 sibling scope). Holiday on-call: after-hours banner copy stays honest ("our team is back at 9 AM ET" vs on-call triage — confirm which copy applies on holidays).*
   - **Still open:** crisis keyword sensitivity bar.
2. **W27 seed sources:** municipal calendars (Cobb Parks & Rec, Marietta) confirmed per FR-MOD-W27 — is there a preferred events API vendor for launch, or manual curation?
3. **W30 fare estimates for teens:** show estimate ranges in the teen plan-only view, or hide prices entirely until a parent is involved? (Spec currently shows estimates with the "a parent completes the booking" line.)
4. **W12 real background checks:** FR-MOD-W12 allows integrating real checks (FCRA counsel first). Launch = directory + label. Confirm no launch-blocker.
5. **S2 wait-time estimate** uses p50 of last-7-days handle time × queue position — confirm the analytics pipeline exposes this to the client, or spec a server-computed string.

---

*End of Squad 5 UX specs. Wave-2 Frontend Engineer: build from §1–§6; treat §7 as build constraints and §8 as questions to route through the PM — do not guess on open questions, flag them.*
