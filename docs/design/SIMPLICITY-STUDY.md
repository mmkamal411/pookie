# SIMPLICITY-STUDY.md — What the masters do, and what Pookie steals
**Author:** Simplicity Researcher · **Date:** 2026-10-11 · **Status:** Wave-3 input — practical, not academic
**Founder's directive:** "Take into consideration popular social media sites and the simplicity in their design but the richness in their features is not compromised. We need a way to drive simplicity but not compromise at all on our feature deliverables."
**Research basis:** current web UX analyses of Instagram, TikTok, and X (sources cited at end).

---

## 0. The simplicity law, in one line

**The test:** a new parent opens Pookie and thinks *"this is simple."* A power parent uses it for a month and thinks *"this does everything."* Same app.

Instagram has ~2 billion users — your mother-in-law and a meme-page power user both feel at home. TikTok's grandma can swipe; its creators live inside one app for hours. That's the bar. The mechanism is always the same: **the surface is a feed of outcomes; the machinery is one tap away, and most users never need it — but it's always there.** This document names the mechanisms, then translates each into a Pookie concrete.

What makes these apps *feel* simple was never "fewer features." Instagram in 2026 is enormous — Reels, Shop, DMs, broadcast channels, Edits, Threads. What makes it *feel* simple is that **every surface has exactly one job, depth is one consistent gesture away, and features surface contextually instead of competing in menus.**

---

## 1. Pattern extraction — how the masters do it

### 1.1 Instagram — the everything-app that still feels simple

1. **The feed as universal surface.** Reels, photos, carousels, suggested posts, ads, shop cards — one scrolling surface carries heterogeneous content types behind a single interaction grammar (scroll → see, tap → open, heart → react). The *content* varies; the *contract* never does.
2. **Stories as ephemeral depth.** A parallel world that sits *above* the feed as a ring row, expires in 24 hours, and never pollutes the permanent grid. Low-stakes depth: worth a glance, gone tomorrow, full-screen when you want it. Key move: ephemerality *removes the posting anxiety* ("a ton of the pressure people have to post their absolute best stuff") — depth without commitment.
3. **Simple surface, deep gestures.** Double-tap to like. Long-press a profile picture to peek. Swipe right for camera. Pinch, hold, drag — a hidden vocabulary power users master without ever being taught in a menu. The toolbar shows 5 icons; the app has 50 behaviors.
4. **Contextual surfacing, not menus.** The "Your Story" ring appears *at the moment* you have something to say; the share sheet's quick-reply to stories appears *inside* the story, not in a "Share" module. Features arrive where you're already looking.
5. **Bottom tab bar: 5 destinations, never more.** Home, Search, Create (center, emphasized), Reels, Profile. Years of feature explosion (Notes, broadcast channels, Marketplace-adjacent shop surfaces) were absorbed *inside* existing destinations — Explore absorbed shopping, DMs absorbed channels. The tab contract has not grown since 2016.
6. **Profile grid as progressive disclosure ladder.** Profile: follower counts → grid thumbnails → tap → full post → comments → insights (creator). Four levels, each one tap, each voluntary. Nobody mistakes the profile for "simple" — everyone experiences it as simple.

### 1.2 TikTok — complexity deleted by the algorithm

1. **Algorithmic curation as navigation replacement.** The For You page makes *browsing* the primary navigation — there is no meaningful category tree, no menu of channels. Discovery replaces hierarchy. The interface is one video: the algorithm is the index.
2. **One atomic unit, one gesture.** The entire content model is "one video, swipe up." Hick's Law in practice: zero decision about *where* to go, one decision about *whether to keep watching*. The screen is one big swipeable target — near-zero cognitive load per decision.
3. **Content IS the onboarding.** No tutorial, no wizard, no feature tour: video playing within one click of signup. The app demonstrates itself by *being used*. (DesignLab's analysis: "Tiktok places their content full screen and in your face in potentially one click.")
4. **Full-screen immersion.** Chrome retreats to overlays — a like button floats on the video, captions sit under it. The interface apologizes for existing; content owns the pixels. Minimal UI distractions = focus stays on content.
5. **Implicit signals beat explicit menus.** TikTok reads dwell time, re-watches, churn speed — it never asks "what are you interested in?" Preference capture is *behavioral*, not declarative. This is why it feels like it reads minds: it never interrupts you to ask.
6. **Depth sits beside the video, one tap away.** Comments slide up as a sheet *over* the video; creator profile is one tap on the avatar; effects pages are one tap on the effect name. Everything is adjacent — the video never unloads, depth is a layer, not a destination.

### 1.3 X — radical surface minimalism over deep machinery

1. **The atomic unit is scannable.** The text post is optimized for *scan speed, reaction, redistribution* — fast to write, fast to scan, fast to spread. X's entire design philosophy is that the timeline can be read at a glance. Simplicity through *density of meaning*, not sparsity of chrome.
2. **Timeline is the product; everything else is a tab.** Home timeline, search, notifications, DMs — 4 thin surfaces. Lists, bookmarks, Spaces, Communities, analytics: all exist, all buried exactly one consistent gesture away (profile pane, tab switches). Power machinery, plain door.
3. **Text-first = speed-first.** X resisted becoming a video platform despite industry pressure because its "primitive" structure is structural: the interface's job is *conversation*, and text is the fastest medium for it. Lesson: **simplicity is choosing what the surface is FOR, and letting that choice delete entire categories of chrome.**

### 1.4 The shared skeleton (all three)

Strip away the brands and every one of these apps does the same five things:

| # | Mechanism | Instagram | TikTok | X |
|---|---|---|---|---|
| 1 | **One universal surface** | Feed | For You | Timeline |
| 2 | **≤5 permanent destinations** | 5-tab bar (unchanged since 2016) | Home/Discover/Inbox/Profile | Home/Search/Notifs/DMs |
| 3 | **Ephemeral layer above the permanent** | Stories rail | LIVE rail / trending tray | Fleets (killed — cautionary tale: don't force it) |
| 4 | **Single-tap drill-down** | Profile → grid → post → comments | Avatar → profile → video → comments | Tweet → thread → replies |
| 5 | **Features surface contextually** | Quick-reply inside stories | Duet inside the video | Quote-tweet inside the tweet |
| 6 | **Deep gesture vocabulary** | Double-tap like, long-press peek | Swipe, long-press speed/save | Swipe tabs, long-press tweet |
| 7 | **Ranking replaces menus** | Suggested posts | The FYP itself | "For You" timeline |

---

## 2. The transfer table — what Pookie borrows, and what it refuses

Each row: the pattern, why it works (the psychology), the concrete Pookie application (never "like a social app" — a parenting app), and the explicit refusal (what we will NOT borrow — shame-free law applies everywhere).

### 2.1 The feed as universal surface

**What it is:** One scrolling surface that carries heterogeneous items behind one interaction grammar — scan, tap to open, one action inline.
**Why it works:** The brain learns *one* contract and spends zero energy on navigation. Heterogeneity is handled by the *card*, not by the *screen* — so new content types never require re-learning the app.
**Pookie borrows it:** The **Today tab works like a feed** — Now / This Week / Coming Up / If Needed are four *bands*, but inside each band every item is the same AttentionCard grammar: situation + cause + ONE winnable CTA + "Not now." A Geometry grade slip, a permission slip due tomorrow, a bill from scanned mail, a summer-deadline countdown — different modules, one contract. When W18 wakes in February, it emits feed items; it does not need a navigation redesign. (IA-FINAL §2 already specs this — this is the why behind it.)
**NOT borrowed:** Infinite scroll. The feed is *bounded* — bands with honest ends ("Nothing here. The engine is watching — go enjoy your coffee."). Infinite scroll is engagement-bait machinery; Pookie's business is the *signature exit*: calmer than they started.

### 2.2 ≤5 permanent destinations, forever

**What it is:** Instagram absorbed a decade of features without adding a tab. The tab bar is a contract with the user's thumb-memory.
**Why it works:** Spatial permanence — the thumb knows where Home is without looking. Every new feature is a routing decision *inside* an existing destination, so the app grows in depth, never in width. Cognitive research cited in the pattern literature: users abandon when faced with >10–15 choices on a single screen; the 5-tab bar never approaches that.
**Pookie borrows it:** **Garden · Today · Pookie · Grow · Menu — five, forever, by standing rule.** The 23rd module joins a grove; it never becomes a tab. (IA-FINAL §1, §11.) The Menu tab is the *index*, not a 6th destination — exactly how Instagram's profile tab absorbs settings, archive, insights, and QR codes behind one door.
**NOT borrowed:** Tab bloat via "the everything app" drift. X's "everything app" ambition is the cautionary counter-example — the shipped IA explicitly rejected a 6th Safety tab because a permanent Safety tab is an anxiety dashboard 360 days a year.

### 2.3 Ephemeral depth — the layer above the surface

**What it is:** Stories sit *above* the feed as rings; they're gone in 24 hours; they never touch the permanent grid. Low-stakes depth.
**Why it works:** Ephemerality removes commitment anxiety — the reason Stories got people posting again ("you don't have to worry about overposting"). A layer that *decays* can't accumulate into clutter.
**Pookie borrows it:** **The Garden's AttentionQueue is the ephemeral layer.** Today's 5 cards are *today's* — they resolve, they expire, the queue refreshes at dawn. Nothing about yesterday's resolved items lingers on the hub; resolved depth lives in Grow (the retrospective artifact) and in the module's own history. Design rule for Wave 3: the hub must *visually feel* transient (cards that complete bloom-and-leave) while module pages feel permanent. Also: **seasonal modules decay honestly** — W18 Summer in November is a countdown in Coming Up, not a dead tile. It wakes; it doesn't rot.
**NOT borrowed:** Forced ephemerality that destroys trust. Fleets died because *nobody asked for disappearing tweets*. Pookie never auto-deletes anything the parent might need (health records, teacher emails, the fairness log). Decay applies to *attention*, never to *records*.

### 2.4 Single-tap drill-down (the disclosure ladder's gesture)

**What it is:** Profile → grid → post → comments. One tap per level, each level voluntary, breadcrumbs unnecessary because back always returns.
**Why it works:** Each tap is a *micro-commitment with guaranteed return* — the user never fears getting lost, so they explore fearlessly. Depth feels free because the exit cost is zero.
**Pookie borrows it:** Every module page follows the same ladder: **Module hero (the gap-to-90, the one number that matters) → ranked action list → detail sheet → full module depth.** Concretely: `/school` shows "Geometry — 21 to the mission" → tap → class page hero + top-3 actions → tap an action → the path-to-90 step with its checkbox → tap → the assignment, the teacher thread, the study plan. Four taps to the bottom, one back-gesture per level, the hub always one tab away. (FRONTEND-CONSTRAINTS: every screen a real route — the ladder is routes, so the back button is the escape hatch.)
**NOT borrowed:** Engagement-farming drill-downs — "see who viewed your story," view counts on parenting. Pookie shows *no vanity metrics anywhere*: no "you checked grades 14 times," no streak-count shaming, no follower-equivalent numbers. Copy law stands: "3-day streak — Sapling 🌱", never streak-loss language.

### 2.5 Contextual surfacing — features appear where you are

**What it is:** Instagram's share-sheet reply lives *inside* the story you're watching. TikTok's duet lives *on* the video. Nothing requires a trip to a module.
**Why it works:** Context is the cheapest form of explanation — the user already understands *what* they're looking at, so the feature needs no teaching. Menus force the user to supply the context themselves.
**Pookie borrows it:** **Adjacency is wired, not hoped for.** The meal plan (W13) surfaces its "send to shopping list" action *inside the meal card* — the parent never visits a "W13→W20 integration screen." A scanned bill (W21) offers "mark paid" inline and the spend ledger (W11) updates *visibly in the same flow*. An AttentionCard about the Geometry test offers the teacher-draft approval *in the card* (ApprovalSheet as intercepting route — the garden stays underneath). The rule for Wave 3: **if two modules touch in real life, the seam is a one-tap action inside the surface where the thought occurs.**
**NOT borrowed:** Algorithmic *ambush* surfacing — features that interrupt. TikTok's "Suggested for you" mid-scroll is fine for entertainment; in Pookie, every surfaced feature must be *caused* (an attention item always carries its cause: "the two missing assignments look like the cause"). No causeless suggestions, ever.

### 2.6 Simple surface, deep gestures

**What it is:** Double-tap to like. Long-press to peek. Swipe right for camera. The visible toolbar is 5 icons; the behavior set is 50.
**Why it works:** Gestures are *discoverable through use*, not through menus — they reward continued use without punishing new users, because every gesture has a visible fallback (the heart button still exists). Mastery feels earned; simplicity feels permanent.
**Pookie borrows it:** **Long-press the Pookie orb (FAB) anywhere → SOS confirm.** That's the flagship: a global power gesture that never appears as chrome. Second: **swipe an AttentionCard to snooze** ("Not now" — 24h, logged), with the visible "Not now" link as the fallback for users who never discover the swipe. Third: **long-press a GroveSection rail card → quick actions** (e.g., long-press Shopping → "add item" without opening the module). Every gesture ships with a visible fallback — the gesture is a shortcut, never the only door.
**NOT borrowed:** Gesture-only critical paths. If a power feature is reachable *only* by an undiscoverable gesture, it doesn't exist for 90% of users. The Menu index + global search are the always-visible doors; gestures are accelerators.

### 2.7 Algorithmic curation as navigation replacement

**What it is:** TikTok deleted the category tree — the FYP *is* the navigation. Ranking replaces menus.
**Why it works:** Choosing *where to look* is the most expensive decision in any interface. When the system ranks well, the user makes only cheap decisions (keep watching / skip). Implicit signals (dwell, skip) beat explicit preference screens.
**Pookie borrows it:** **The attention engine (W9) ranks; the parent doesn't browse.** Today → Now is ordered: safety → time-critical (<48h) → high-leverage (missing/zeros first) → gentle. The parent never opens `/school` wondering "what should I look at" — the queue already decided, with cause-first copy so the ranking is *legible* ("Geometry slipped 4 points — the two missing assignments look like the cause"). This is why W9 is a *surface*, not a tab: ranking is the navigation. And like TikTok's implicit signals: **Pookie learns from behavior, not questionnaires** — snoozed items, completed actions, and time-of-day patterns tune the queue; the parent never fills out "notification preferences."
**NOT borrowed:** The black-box feed. TikTok's creepiness ("the algorithm knows me") is a *trust liability* in a parenting app. Every Pookie ranking must be explainable in one line — cause-first copy on every card — and the parent can always see "2 updates resting until tomorrow" (suppressed-state honesty). The algorithm serves; it never mystifies.

### 2.8 The atomic unit is scannable (X's lesson)

**What it is:** X's text post is optimized for scan speed. The whole product is readable at a glance because the *unit* is small and uniform.
**Why it works:** Glanceability is a property of the *unit*, not the *page*. If every item can be parsed in 2 seconds, the whole surface feels calm no matter how many items there are.
**Pookie borrows it:** **The AttentionCard is Pookie's tweet.** Fixed anatomy, fixed length: one situation line, one cause line, one CTA, one dismiss. No card ever carries two asks. The class-page hero is the same discipline: gap-to-90 + top-3 actions, never a data dump. Wave-3 rule: **if a card needs a "read more," it's two cards.**
**NOT borrowed:** Density for density's sake. X's timeline is *dense* because conversation is the product. Pookie's surfaces are *spacious* — divine-light, breathing room, one focal moment per screen (IA-FINAL kill-criteria #1: no control-room dashboards). Scannable ≠ cramped.

---

## 3. The disclosure ladder — Glance / Engage / Master

**The contract:** every module exists at three depths. The parent chooses their depth by tapping — never by configuring, never by learning a "mode."

- **GLANCE (3 seconds):** one number, one sentence, one feeling. Mission framing (gap-to-90, never raw judgment). No actions except the single most obvious one.
- **ENGAGE (one tap):** the useful depth — the ranked top-3 actions, the state that explains the glance, inline one-tap completions. This is where 80% of sessions end.
- **MASTER (the full module):** everything — history, settings, exports, the committee's full analysis, cross-module wires. Reachable, never advertised. The power parent lives here; the new parent never stumbles into it.

**Ladder law:** each level must be *complete* — Glance never shows a number it can't explain one tap down; Engage never offers an action whose consequence isn't visible; Master never hides the exit back up.

### 3.1 W1 School core (grades)

| Level | What the parent sees | Example (Geometry, GP2) |
|---|---|---|
| **Glance** | Garden rail card / AttentionCard: class name + gap-to-90 + one feeling | "Geometry — 21 to the mission" with the branch glowing soft ember (needs tending, not alarming). No percentage screaming. |
| **Engage** | Class page hero: numeric + letter side by side, separated by a line (visible on open); top-3 ranked actionable next steps with checkboxes; check-in + uploads *below* the hero ("what do I do next" stays first) | Hero: 69 D | "Unit 3 test retake window closes Friday" → checkbox; "2 missing classwork dragging the grade" → checkbox; "Study plan for Unit 4 test Thursday" → checkbox. Tapping a checkbox persists to Supabase (cross-device), and the hero number moves *in the same frame*. |
| **Master** | Full module: every assignment with per-assignment feedback, category weights, the grade forecaster ("what-if" simulator), teacher comms threads with drafts, the term-long DeltaLine, Learn-section unit hub with uploads tagged by unit, AI practice quizzes | The forecaster: "turn in the 2 missing CW + score 85 on Unit 4 test → 78 by Friday." The full teacher thread with Donna Dunham CC'd. The path-to-90 checkbox history across devices. |

*Design note:* the Glance→Engage step is the shame-free law in action — "21 to the mission" (gap framing), never "Geometry: 69, D, failing." The number appears at Engage (numeric + letter, side by side) because by then the parent has *chosen* depth.

### 3.2 W21 Mail intelligence

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | Today band item: "2 pieces of mail need a look" — or the quiet variant: nothing. | "Electric bill — $142, due Friday" as a single AttentionCard: situation + cause + ONE winnable CTA ("Remind me Thursday"). |
| **Engage** | `/mail` feed: snapped mail as cards — photo, OCR'd key facts (amount, due date, sender), the classified action (pay / file / dispute), one-tap reminder set. | The bill card: thumbnail of the envelope, "$142.18 · due Fri Oct 16 · Georgia Power", buttons: "Paid ✓" / "Remind me" / "Dispute". Tapping "Paid" closes the loop visibly — W11's ledger updates in the same frame. |
| **Master** | Full archive with search ("find the March water bill"), dispute tracker with document trail (the EVOffer pattern: charge, merchant messages, Amex ref, return-label status), tax-season export, reminder rules per sender, the OCR confidence view for misreads. | "Show every Georgia Power bill this year" → export for taxes. Dispute timeline: filed date, reference number, expected resolution, next nudge. |

*Design note:* Glance for mail is almost always *silence* — mail only surfaces when it has an action. Junk mail is classified and filed without ever appearing. This is contextual surfacing: the feature works hardest when the parent sees nothing.

### 3.3 W20 Shopping list

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | Garden rail card: live state, one line. | "Shopping — 4 items, 1 claimed" (who claimed it, tagged). |
| **Engage** | `/shopping`: the family list — items grouped by store aisle (or by store, AI-suggested), each tagged by who added it ("milk — Dawson"), tap to claim/check, quick-add bar at top. | Quick-add "eggs" → appears instantly, tagged "Mehedi". Claim "milk" → Dawson's tag flips to "claimed ✓". The W13 meal plan's "send to list" lands here as a grouped batch, one tap to accept. |
| **Master** | Price intelligence (per-store comparison, "did we overpay?" history), recurring staples with auto-suggest, household spend rollup feeding W11, store preference rules, shared-list permissions per family member. | "Milk: Kroger $3.49 vs Publix $4.19 — Kroger wins 8 of last 10 trips." The staples engine: "You're out of eggs every 9 days — add to auto-list?" |

*Design note:* W20 is the proof that family-scoped modules don't need the child switcher — tags ("— Dawson") do the job at a glance, exactly like Instagram tags the *content* rather than switching *accounts*.

### 3.4 W2 Health

| Level | What the parent sees | Example |
|---|---|---|
| **Glance** | Garden rail / Today: only when something needs tending. Health is *quiet by design* — a healthy child generates no cards. | Silence. Or: "Refill reminder — albuterol runs out Thursday" (time-critical band). Never a health *score*. |
| **Engage** | `/health`: profile snapshot (conditions, meds with refill states, immunization currency), visit-agenda builder ("pediatrician visit Tuesday — 3 things to ask"), vitals trend in plain language. | "Steps down 40% since grounding — expected, not alarming" (W22 data interpreted, not dumped). The agenda builder: tap-to-add questions, one-tap share to the visit. |
| **Master** | Full longitudinal record, per-metric privacy controls, the W22/W23 data layers with raw charts, document vault (W7 overlap), the "what changed since last visit" diff the pediatrician actually wants. | Export visit summary PDF. Per-metric sharing rules ("Maya's sleep detail stays with Maya — you see the trend"). |

*Design note:* Health is the anti-vanity-metric module — no scores, no grades, no rings-to-close. The ladder's Glance level is *honest silence*, which is itself a simplicity feature: the app proves it's watching by saying nothing.

---

## 4. Anti-overwhelm rules — the hard law

These are **build gates**, not suggestions. A screen that breaks one fails review.

1. **No screen shows more than 5 action choices.** The Garden hub shows ≤5 AttentionCards; a module hero shows top-3 actions; sheets show one primary + one secondary + dismiss. The 6th choice lives one tap down or in search. (Instagram's tab bar, the 5-band queue — the number 5 is load-bearing.)
2. **Every deep feature is reachable, but none is advertised on the surface.** Master-level power (forecaster, dispute tracker, price history) is one consistent gesture away (tap the module title / "see everything") — but the surface never upsells it. No "Pro tip!" coach marks, no feature-discovery banners. Depth is found, not pushed.
3. **One card, one ask.** An AttentionCard carries exactly one winnable CTA. A screen carries one focal moment. If a card needs "read more," it's two cards. (X's atomic-unit lesson.)
4. **New modules join groves; tabs never grow.** The 5-tab contract is permanent. A module graduates inside its grove tile — freshness chip, live state, Today-band emissions. No navigation surgery per launch. (Instagram absorbed a decade without a 6th tab.)
5. **Silence is a designed state.** Empty bands say so warmly ("Nothing here. The engine is watching — go enjoy your coffee."). Healthy modules generate no cards. Suppressed states are honest ("2 updates resting until tomorrow"). The app must be *openable with nothing to do* — that's the trust dividend that makes the ritual daily.
6. **Every ranking shows its cause.** Any ordered list (attention queue, top-3 actions, price suggestions) carries a one-line cause. No black-box feeds, no "Recommended for you" without a because. The algorithm serves; it never mystifies. (TikTok's power, minus TikTok's creepiness.)
7. **Gestures accelerate; they never gate.** Long-press orb → SOS, swipe card → snooze, long-press rail → quick actions — every gesture ships with a visible fallback (button, link, menu item). If a feature is reachable *only* by an undiscoverable gesture, it doesn't exist.

**The shame-free corollary (applies to all seven):** urgency is conveyed by presence and copy, never agitation — no flashing, no pulsing red, no shaking, no streak-loss language, no vanity metrics, no comparisons (never cross-child, never peer-ranked). Rose is reserved for safety. Everything else is sunlight.

---

## 5. The designer's cheat sheet — do this, not that

| Situation | Social-app instinct (don't) | Pookie move (do) |
|---|---|---|
| New module ships | Add a tab / badge the Menu icon | Grove tile gains live state; module starts emitting Today items; hub rail shows it with real data |
| Parent opens app, nothing's wrong | Show a dashboard so the app feels "full" | "All quiet. Nothing needs you today." — the quiet morning is the product |
| Grade drops | Red alert, push immediately | Cause-first card in the right band: "slipped 4 points — the two missing assignments look like the cause. Want to knock out the first one tonight?" |
| Feature nobody found | Onboarding tour / coach marks | Contextual surfacing: put the action where the thought occurs; add it to search; let gestures accelerate |
| Power user wants more | Settings page with 40 toggles | Master level: one "see everything" door per module; behavior-learned preferences, no questionnaires |
| Seasonal module dormant | Grey it out / "coming soon" | Countdown in Coming Up ("wakes in February 🌱"); never nags, never a dead tile |
| Child's private data | Show parent everything (it's "their" child) | Privacy contract stated at the surface: "Maya's mood detail stays with Maya — you see the trend." |
| Session ends | Leave the parent mid-list | The signature exit: "All quiet. 2 things handled, 1 for later. The family's okay." — calmer than they started |

---

## 6. Sources

- Medium — "UX Case Study: What Makes Apps Like Instagram & TikTok So Addictive?" (instant feedback & micro-interactions; gesture-based navigation; full-screen immersive UI; seamless onboarding) — https://medium.com/@dollyborade07/ux-case-study-what-makes-apps-like-instagram-tiktok-so-addictive-83ad94798b09
- DesignLab — "Why TikTok is Addictive: A Product Design and UX Analysis" (content in one click; familiar gestures; positioning against known products) — https://storage.designlab.com/submissions_pdf/008d7d53.pdf
- Glasp — "Seeing Like an Algorithm: The Magic of TikTok's Algorithm-Friendly Design" (one-video-at-a-time inference; explicit positive/negative signals via swipe) — https://glasp.co/hatch/malcolmjmr/p/At21KugFWZUsiLaFgu7W
- Gist.ly — "TikTok's Unprecedented Rise: The Magic Behind the Addictive UX" (Hick's Law; the whole screen as swipe target; autoplay/autosnap) — https://gist.ly/youtube-summarizer/tiktoks-unprecedented-rise-the-magic-behind-the-addictive-ux
- Medium (Mar 2026) — "Why Does X (Twitter) Still Maintain a 'Primitive' Text-First Structure?" (scan-speed philosophy; atomic unit = text post; simplicity as structural equilibrium) — https://medium.com/@deferare/why-does-x-twitter-still-maintain-a-primitive-text-first-structure-d7e55ec7f2f4
- GitHub — shawnyeager/nostr-ux-patterns, "05-progressive-complexity.md" (Pareto 80/20; 30–40% cognitive-load reduction via progressive disclosure; >10–15 settings per screen = abandonment) — https://github.com/shawnyeager/nostr-ux-patterns/blob/HEAD/content/docs/patterns/05-progressive-complexity.md
- FasterCapital — interaction design pattern surveys (progressive disclosure, hover controls, swipe gestures, card layouts, infinite scroll) — https://fastercapital.com/content/User-interaction--Interaction-Design-Patterns--Creating-Consistency--A-Look-at-Interaction-Design-Patterns.html
- Search Engine Journal (2016) — Instagram Stories launch (ephemeral 24h design; pressure-reduction rationale; ring-row placement above feed) — https://www.searchenginejournal.com/instagram-stories-launches/169914/

*End of SIMPLICITY-STUDY.md. Next: Wave-3 UI designers apply §3's ladder to Garden, Today, and Menu as the Milestone-1 gate screens, audited against §4's seven rules.*
