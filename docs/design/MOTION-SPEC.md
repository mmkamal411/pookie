# MOTION-SPEC — The Pookie Motion Language

**Author:** Motion/Interaction Designer · **Date:** 2026-10-11 · **Status:** SHIPPED — engineering handoff
**Reporting to:** Design Coordinator
**Inputs:** DESIGN-DIRECTION.md §3 (motion philosophy: "living things move; interfaces transition") · FRONTEND-CONSTRAINTS.md §2 (the divine-light performance contract) · DESIGN-SYSTEM.md §1.5 (motion tokens) · UI-SHELL-HOME.md (Garden day-states, habit moments) · UI-V1-MODULES.md (completion pattern, W9 briefing) · UI-PLACEHOLDERS.md (ambient ≤1, entrance rules)

**The one rule above all rules:** *motion is the reward for caring, never the price of looking.* If a parent can't name what moved and why it felt good, the motion is decoration — and decoration is KILL.

---

## 0. The physics — token table

Every motion in this spec is built from the DESIGN-SYSTEM motion tokens. Engineering implements these tokens once in `tokens.css` (`@theme`), then everything below is composition.

| Token | Value | Used for |
|---|---|---|
| `--ease-bloom` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances, completions — the house easing. Overshootless; arrives like a petal unfurling, not a spring |
| `--ease-gentle` | `cubic-bezier(0.4, 0, 0.2, 1)` | Hovers, color transitions |
| `--duration-instant` | `120ms` | Micro-interactions (chip toggles, checkbox state) |
| `--duration-swift` | `220ms` | Press states, sheet micro-settles |
| `--duration-bloom` | `600ms` | Card entrances, completion bursts, bloom reveals |
| `--duration-slow` | `900ms` | Hero transitions, grove reveals, firefly bursts, Water-the-Garden |
| `--motion-breathe` | `5s` loop | The canonical ambient rhythm — Pookie orb, garden centerpieces |
| `--motion-dapple` | `9s` loop | Drifting light gradients across hero surfaces (≤40% opacity, transform-only) |
| `--motion-ascend` | `8s` loop | Sparkles rising — reserved for consequence, not decoration |
| `--stagger-step` | `70ms` | Per-card entrance delay: `animation-delay: index * 70ms`, first item `0ms` |
| `--stagger-cap` | `8 items` | Past 8 items, animate the container once instead of staggering items |

**Hard physics laws (non-negotiable):**
1. **Only `transform` and `opacity` ever animate.** Nothing else. A comp that needs a moving blur, a growing box-shadow, or a sliding layout gets a redesign.
2. **Glows animate by opacity layer, never by shadow.** The pattern: a static `box-shadow` glow div + an absolutely-positioned glow-sibling whose `opacity` animates. Same visual, ~10× cheaper.
3. **Ambient loops are transform/opacity keyframes, paused off-screen** (`IntersectionObserver` or `content-visibility: auto` — one ambient loop per viewport, max).
4. **`prefers-reduced-motion: reduce` is a global kill-switch** (see §6) — ambient goes still, transitions become fades, glows remain.

### The budget each motion spends (mobile; desktop ×2 where noted)

| Resource | Mobile ceiling | Desktop ceiling |
|---|---|---|
| Simultaneously *animating* glows (opacity/transform only) | ≤ 3 | ≤ 6 |
| `backdrop-blur` instances | ≤ 2, fixed overlays only | ≤ 3 |
| Concurrent transform/opacity animations | ≤ 10 | ≤ 20 |
| Staggered entrance items | ≤ 8 | ≤ 12 |

Every choreography below carries a **budget tag** (`[BUDGET: n glows / k concurrent]`) counted at its peak frame. Screens that already spend budget name what's left — see §4.

---

## 1. The habit-loop motions

These four are the product's dopamine circuit. They must feel good on the 500th repetition — which means **fast, quiet, and never louder than the action deserved.**

### 1.1 The Garden Dawn bloom reveal (the morning dopamine hit)

**What it is:** the first open of the day (after 4 AM local, first session) plays a 2.4-second reveal: the garden wakes, and overnight growth blooms visibly. This is the ritual's opening chord — relief, oriented, a little addicted.

**Trigger:** first Garden render of the day AND at least one overnight state change exists (a grade moved, a bill filed, a sync landed). If nothing changed overnight, skip the reveal entirely — no theater on an empty stage; the quiet-morning micro-delight covers that case (UI-SHELL-HOME §1.3).

**Choreography (total 2.4s, then still):**

| t (ms) | Beat | Properties animated |
|---|---|---|
| 0–300 | The scene fades in from the night's moonlit treatment to dawn light | `opacity` on two stacked scene layers (moonlit → dawn cross-fade, `300ms`, `--ease-gentle`) |
| 150–750 | The overnight blossom unfurls on the spotlight plant | `transform: scale(0.6→1) + opacity(0→1)`, `600ms`, `--ease-bloom` — one growth layer only, the new leaf/blossom SVG group |
| 500–800 | The dawn bloom banner rises above the queue | `animate-rise` (`translateY(12px→0) + opacity`, `300ms`, `--ease-bloom`) — the halo-tinted "While you slept, Geometry grew +2.5" banner |
| 600–1500 | One firefly burst, 8 motes, from the blossom | `.firefly` particles, `transform: translate + opacity`, `900ms`, `--ease-gentle`, then they rest (particles become ambient fireflies, no removal flash) |
| 750–900 | Cards bloom in, staggered | `animate-bloom`, `index * 70ms`, first card at 750ms |
| 2400 | Everything stills | Ambient `breathe` (5s) and `dapple` (9s) continue; no loop competes |

**Physical grammar:** the reveal grows *upward and outward from the plant*, never slides in from the edges. Dawn arrives like morning, not like a notification.

**Budget:** dawn cross-fade layer (1 glow-layer, opacity) + blossom unfurl (1) + 8 fireflies (1 budget item — fireflies count as ONE ambient item, UI-SHELL-HOME §0.2) + cards (transform/opacity, ≤3 cards + banner) = **2 animating glows, ~7 concurrent animations** ✓ within budget.

**Plays once.** The reveal never replays on re-entry the same day — the scene renders at the dawn still-frame.

**Reduced-motion fallback:** no cross-fade loop — the garden renders directly at the dawn still-frame; the banner appears without `rise` (simple `opacity` fade 200ms); no firefly burst; cards render static. The growth is still *shown* (the blossom is present), just not *played*.

### 1.2 Completion bloom + firefly burst (clearing a task)

**What it is:** the single most-repeated motion in the app — tapping a checkbox, claiming a shopping item, marking a bill paid, approving a reply. This is the reward circuit. It must feel good every single time, including the 500th.

**Trigger:** any winnable CTA completion — class-page checkbox, AttentionCard CTA confirm, shopping claim, mail "Mark paid ✓", seed-form submit, water tap.

**Choreography (total 1.1s):**

| t (ms) | Beat | Properties animated |
|---|---|---|
| 0 | Press confirms | Tap target: `transform: scale(0.97)`, `220ms`, `--ease-gentle` — the press is felt |
| 0–600 | The item blooms | `animate-bloom`: `scale(0.98→1) + opacity`, `600ms`, `--ease-bloom` — the completed row's check state draws (checkbox check draws as an SVG stroke-draw at `--duration-swift` — a stroke animation is a `stroke-dashoffset` paint, allowed once per interaction, never in lists) |
| 200–1100 | 6-dot firefly burst | `.firefly` particles radiate from the completion point, `transform: translate + opacity`, `900ms`, `--ease-gentle`, `ascend` flavor (they drift upward, like sparks from a touched plant) |
| 600–1100 | The row fades with strikethrough | `opacity(1→0.55) + translateY(4px)`, the strikethrough line draws via `transform: scaleX(0→1)` on a 1px line (`--duration-swift`), then the row leaves the queue |
| 900–1200 | Toast rises | `animate-rise`, bottom-center above nav, `300ms`: "Done — one less thing on your mind ✓" / "Paid — logged and filed ✓" / "Logged. Those minutes count 🌱" — auto-dismiss 4s, `opacity` fade-out only |
| 900–1100 | The ring advances (when the item feeds a ring) | GrowthRing `stroke-dashoffset`, `--duration-bloom`, `--ease-bloom` — the cause→effect loop closes **in the same frame** as the fade. A checkbox that doesn't move its number is a broken promise |

**Physical grammar:** completion grows from the *tap point* — particles radiate outward from where the finger was, the way brushing a plant releases its scent. Never confetti from the top of the screen. **No confetti anywhere in the product. No point scores.** Tending a garden, not clearing tickets.

**Budget:** 1 glow (the glow-layer opacity on the completing card, sunlight band) + particles (1 budget item) = **2 animating glows, ~4 concurrent** ✓.

**Queue reorder after completion:** remaining cards re-flow with `animate-rise` (`translateY`, `--duration-bloom`), **no stagger** — one coordinated settle, never a cascade. The 14-day trigger suppression applies (completed attention items stay suppressed 14 days).

**Reduced-motion fallback:** press → row fades to the struck-through state (`opacity`, `200ms`); no burst; the toast appears statically (no rise); the ring still advances (opacity-level state change, no stroke animation — it just *is* the new value). The *information* (done + effect) survives; the *theater* doesn't.

### 1.3 Water the Garden — the signature exit

**What it is:** the ritual close. The pinned end-cap (UI-SHELL-HOME §1.1/1.5, UI-V1-MODULES §3.2) is the one tap that ends the session calmly. The motion is the app saying "I'll keep watch" in light.

**Trigger:** tap on the "💧 Water the garden" end-cap (morning, quiet-day, and 11 PM variants).

**Choreography (total 2.0s):**

| t (ms) | Beat | Properties animated |
|---|---|---|
| 0–220 | The water tap presses | `btn-dapple` press: `transform: scale(0.97)`, `--duration-swift` |
| 200–1100 | A shimmer pass across the garden scene | A `dapple`-speed light gradient sweeps left→right across the scene (`transform: translateX(-20%→120%) + opacity 0→0.5→0` on one overlay layer, `--duration-slow`, `--ease-gentle`) — morning rain, not a flood |
| 500–1400 | The plants shimmer | Each plant's leaf-glow layer: `opacity(0.6→1→0.6)` once, `--duration-slow` — a single breath of light, then rest |
| 600–1500 | 6-dot firefly burst | From the scene's center, `900ms`, upward drift |
| 1200–1500 | The card settles into the signature sentence | `animate-rise` (`translateY(8px→0) + opacity`, `300ms`): "All quiet. 2 things handled, 1 for later. The family's okay. I'll keep watch." / night: "Sleep easy. The family's okay. I'll keep watch." |
| 1500+ | The garden stamps on the calendar | A small ring-glints on the TodayStrip dot — `opacity` pulse once (`600ms`) — then stillness |

**Physical grammar:** water falls *downward*, light responds *upward* — the shimmer sweep reads as rain, the fireflies as the garden exhaling. The settle is slow (`--duration-slow`) because this is the end of the day, not a notification.

**Budget:** shimmer overlay (1 glow-layer) + plant glow (1) + fireflies (1) = **3 animating glows at peak (500–1100ms)** — the ceiling, spent only here, on purpose. ~5 concurrent. Night variant: identical choreography at reduced opacity (moonlit palette), and the fireflies are fewer (4) and slower.

**Reduced-motion fallback:** shimmer skipped — the scene renders the signature sentence directly (`opacity` fade `200ms`); one still frame of the watered state (a dewdrop dot on the TodayStrip marker, static). The calm close is the *sentence*, not the sweep.

### 1.4 The first-bloom-within-48h moment

**What it is:** Day-0's promise kept — the FIRST real input (first bill snapped + classified, first CTA completed, first streak watered) blooms visibly. This teaches, in one gesture, that Pookie does something real. The contract is ≤48h; the motion is the receipt.

**Trigger:** the first seed-it-now completion per life — e.g. the first mail snap classified as a bill, the first card connected in the W24 seedling, the first health connect. Fires once per intake area, then the area joins the normal habit loop (§1.2).

**Choreography (total 1.6s):**

| t (ms) | Beat | Properties animated |
|---|---|---|
| 0–300 | The seedling breathes | `.breathe` one cycle emphasis — `transform: scale(1→1.04→1)`, `600ms`, `--ease-bloom` — the seedling *notices* it was touched |
| 300–900 | The leaf unfurls | A new leaf SVG group: `transform: scale(0.3→1) rotate(-12deg→0) + opacity`, `600ms`, `--ease-bloom` — the unfurl is the literal "first bloom" |
| 600–1500 | 6-dot firefly burst | `900ms`, upward |
| 800–1100 | The day-state line rewrites | GreetingHero line cross-fades (`opacity`, `300ms`): "First bloom — the electric bill is watched now 🌱" |
| 1000–1600 | The new Today card blooms in | `animate-bloom` on the one new card (e.g. "Electric bill — $142.18, due Friday") — the cause→effect loop made visible |

**Physical grammar:** the seedling's growth is *upward from the soil bed* — a leaf unfurls, nothing slides in. The new card blooming in afterward teaches the user that *input here → queue there*.

**Budget:** seedling glow (1) + leaf unfurl (1) + fireflies (1) = **3 animating glows at peak** ✓.

**If 48h pass with no input:** no motion at all — the garden rests under the moonlit still-frame ("Resting. It'll be here when you are."). The absence of bloom is not animated, not nudged, not guilted. Stillness is the honest state.

**Reduced-motion fallback:** the seedling renders at its grown state (leaf present); the day-state line changes without cross-fade; no burst. The growth is *stated*, not played.

---

## 2. Ambient life — what's alive vs. what's still

The rule from DESIGN-DIRECTION §3: *one ambient motion per viewport.* Calm is curated; competing motion is noise.

### 2.1 The always-alive registry (exactly one per viewport)

| Viewport | The one ambient life | Why it lives there |
|---|---|---|
| Garden (day) | The Pookie orb **breathes** (`5s`: `scale(1→1.03) + halo opacity(0.5→0.7)`, loop) | The guardian is present. Breathing = alive |
| Garden (11 PM) | The same orb breathes **slower and dimmer** (effective `8s`, halo opacity `0.3→0.45`) | Rest, not sleep — she's still watching |
| Firefly backdrop | 3–5 fireflies drift (`transform` wander `12s` loop, `opacity 0.3–0.6`) | The garden has air. Counts as ONE budget item total |
| Hero art (placeholders, module headers) | EITHER a `dapple` drift (transform-only, ≤40% opacity) OR a `breathe` on the sprout sigil — never both (UI-PLACEHOLDERS §0) | Light through leaves |
| SyncDot fresh | Static glow — no animation, no budget | Calm when healthy |
| SyncDot aging/stale | **Pulse** (`opacity 0.6→1`, `4s` — the only pulse allowed faster than 5s is a safety signal; aging is *not* a safety signal, so it stays at 4s) | Counts as the second animation (UI-SHELL-HOME §0.2) |
| OCR processing ("Reading your mail…") | The snap card **breathes** (`.breathe`, no spinner, no dead photo) | The app is working, gently |
| Skeleton loading | `animate-dapple 2.2s` shimmer (`background-position` — this is the sanctioned exception: it's paint-once per skeleton shape, low-frequency, and dies when content arrives) | Growing, not spinning |

### 2.2 The always-still registry (what never moves)

- **The tab bar and IconRail.** Chrome stays still. The active indicator may *slide* once on tab change (§3.1 — a transition, not ambient), then rest.
- **The second Pookie orb.** Where two orbs coexist (Garden hero orb + center-tab orb), one breathes and the other is static (UI-SHELL-HOME §0.4 — one breathing orb per screen).
- **Card borders and static glows.** Neon borders on priority cards are painted once (`box-shadow`, cached texture). They never pulse, throb, or shimmer. Urgency lives in copy, never in agitation.
- **W19 Emergency Plan hero art.** Fully static — stillness is the point (UI-PLACEHOLDERS §3). The only motion on that screen is the entrance bloom.
- **Body copy, numbers, labels.** Never bounce, wobble, typewriter-in, or count-up habitually. (The one sanctioned exception: a grade counting up *once* on first sight of a milestone — e.g. the path-to-90 ring crossing 90 — implemented as a `600ms` ease over `opacity`-friendly DOM, once per milestone, never per render.)
- **Safety surfaces.** SOS rows, the Emergency sheet, IF NEEDED band — no ambient motion within 2 viewports of a safety control. Calm is not decoration there; it's clinical.

### 2.3 The 11 PM moonlit state (nearly silent)

**The night contract (UI-SHELL-HOME §1.4):** after 10 PM the app must be restful. Motion follows light — the palette goes silver-blue, and so does the physics.

- **Palette swap:** scene cross-fades once on first night render (300ms, `--ease-gentle`) to the moonlit treatment — silver-blue scene layers, warm dapple replaced by cool still-water shimmer. This is a one-time transition, not a loop.
- **Ambient at night:** fireflies become fewer (3) and slower (drift loop stretches to `20s`); the orb's breath slows to `8s` at reduced halo opacity. **Nothing on screen pulses faster than 4s.** The water-drop card is the warmest thing on screen — and it's still.
- **Sheets at night:** same choreography as day (§3.2) but scrim opacity deepens (`bg-canopy-950/80`) and entrance duration stays identical — speed doesn't change at night; *warmth* does.
- **What's absent:** no entrance staggers on the night Garden (four elements render together, still); no bloom reveals; the queue is gone so nothing completes. The only motion the user can trigger at 11 PM is the water tap (§1.3 night variant) — and its fireflies are dimmed.
- **The SyncDot dims** at night (leaf→moon silver). Its aging pulse, if active, slows to `6s`.

**Reduced-motion at night:** identical to day (§6) — ambient is already near-still; the night still-frame is the resting state.

### 2.4 Ambient scheduling rules (engineering)

- Ambient loops **pause when off-screen**: use `IntersectionObserver` to toggle `animation-play-state`, or `content-visibility: auto` on scene containers. A garden that drains the battery is a dead garden.
- Ambient loops **pause when the tab is hidden** (`document.visibilitychange` — CSS handles this natively for keyframe animations; JS-driven particles must listen).
- Ambient never starts before first contentful paint — no blank-screen animation.
- The ambient registry is **per-viewport, not per-component**: when a sheet opens over the Garden, the Garden's ambient keeps running (it's behind the scrim, cheap) but the sheet introduces no new ambient loop.

---

## 3. Transitions — the physical grammar

**The doctrine:** *living things move; interfaces transition.* Navigation is interface — it should feel like walking a garden path, not like a deck of slides. Motion lives **inside** routes, never **between** them (FRONTEND-CONSTRAINTS §A5 — no custom page-transition choreography; the App Router owns route changes).

### 3.1 Tab switches (the 5-tab contract)

**What happens:** the persistent `(tabs)` layout never remounts; only the route segment swaps. The transition is **content-only**:

- **Outgoing tab content:** `opacity(1→0) + translateY(0→-6px)`, `200ms`, `--ease-gentle` — the old tab settles *down and away*, like a leaf settling.
- **Incoming tab content:** `animate-rise` (`translateY(10px→0) + opacity(0→1)`), `300ms`, `--ease-bloom` — the new tab *blooms up*, like a shoot. Content entrances stagger at `70ms` only if ≤8 items; beyond that, the container rises once.
- **The tab-bar indicator:** a soft pill slides under the active icon (`transform: translateX`, `220ms`, `--ease-gentle`) — the single permitted chrome motion, measured with refs, no library. The icons themselves never bounce or pop.
- **The center Pookie orb:** persists across tabs (it's in the layout) — it does not re-animate on tab switch. On non-Garden tabs it resumes its gentle breath; it is never startled by navigation.

**Physical grammar:** tabs are *paths in the garden*, not *cards in a deck*. The content rises into place; nothing slides horizontally off-screen.

**Budget:** tab switches spend **0 glows** (no glow layers animate) and ~2 concurrent animations ✓.

**Reduced-motion:** cross-fade only (`opacity`, `150ms`) — no translate. The indicator still moves (it's essential wayfinding), but without easing overshoot.

### 3.2 Sheet presentations (intercepting routes)

**What happens:** tap a card → the intercepting route renders the sheet over Garden; back closes it. This is the App Router's sanctioned pattern (FRONTEND-CONSTRAINTS §1.7), and the motion honors it.

**Presentation choreography:**

| t (ms) | Beat | Properties animated |
|---|---|---|
| 0–200 | Scrim fades in | `bg-canopy-950/70`, `opacity(0→1)`, `200ms`, `--ease-gentle`. Scrim is one of the ≤2 permitted `backdrop-blur` instances (`backdrop-blur-sm`, static, never animated) |
| 0–350 | The sheet rises | `animate-rise` — `translateY(100%→0)` on the sheet container is **banned** (full-screen translate on a content-heavy sheet is jank); instead: `translateY(48px→0) + opacity(0→1)`, `350ms`, `--ease-bloom` — the sheet *blooms up into place* from a small rise, the way a plant unfurls. It reads as rising because the scrim darkens the world behind it |
| 100–350 | The sheet's content blooms | First card `animate-bloom`, `100ms` delay after sheet start — content follows chrome, one beat behind |
| 350+ | Drag handle rests | The handle is static. The sheet's drag gesture is user-driven (transform follows the finger, no easing) — release past threshold: dismisses with the reverse choreography; release short: springs back (`220ms`, `--ease-bloom`, no bounce overshoot) |

**Dismissal:** reverse — content `opacity→0` (`150ms`), sheet `translateY(0→48px) + opacity→0` (`250ms`, `--ease-gentle`), scrim fades. Back-button, swipe-down, tap-scrim, and the close control all play the same dismissal.

**Confirm-inside-sheet (the approval pattern):** confirming an action inside a sheet (e.g. "Send the reply" in the ApprovalSheet) plays the **completion burst inside the sheet** (§1.2: 6-dot firefly burst + toast), then the sheet dismisses and the underlying Garden card plays bloom-and-leave. The cause and the effect are visible in both layers — the user sees the action land *through* the sheet.

**Physical grammar:** sheets are *clearings you step into* — the world behind dims, the clearing blooms up. They never slide in from the side (side-slides are decks; we are a garden).

**Budget:** 0 animating glows (scrim blur is static; sheet glow is a static `shadow-glow-md`). ~3 concurrent ✓.

**Reduced-motion:** scrim fades (`opacity`, `150ms`); sheet appears without rise (`opacity` fade `200ms`); no content stagger.

### 3.3 Drill-downs (Glance → Engage → Master)

**The ladder is depth, not decoration.** Each rung deeper *grows* from where the user tapped.

**Engage (Glance → Engage):** tap a Garden rail tile or AttentionCard → the module page (a real route, not a sheet).

- The tapped card plays the press (`scale(0.97)`, `220ms`) as the route changes.
- The destination renders with `animate-rise` on its hero + `70ms` stagger on its first ≤8 cards (`--ease-bloom`).
- **The spotlight pattern (A-N13):** the destination's hero *grows from the tap* — the class detail hero ring draws (`stroke-dashoffset`, `--duration-bloom`) on entry. The ring drawing is the destination's welcome: it says "this is what you came for."

**Master (Engage → Master):** tap "see everything" / the hero ring / a "read thread" link → the deep view.

- Same route-change grammar as Engage, but the hero *persists conceptually*: where the Master view shares the hero (e.g. class page → forecaster), the hero stays pinned and only the content below rises. **No shared-element morph library** (FRONTEND-CONSTRAINTS §A2) — the pinning is achieved by route layout composition, not animation magic.
- Expanding sections (assignment tables, thread views, seedling expanders "▸ 2 more taking root 🌱") grow **downward from the tap point**: the `grid-template-rows: 0fr → 1fr` trick (`350ms`, `--ease-bloom`) + content `opacity`. The expansion reads as a plant responding to touch.

**Back navigation (up the ladder):** reverse of the forward grammar — content settles (`opacity→0`, `translateY(0→-6px)`, `200ms`), the previous route's content rises back in (`300ms`). The garden is always there when you step back; it never has to re-bloom.

**Physical grammar:** depth is *downward growth*, never sideways paging. The deeper you go, the more the garden unfolds beneath you.

**Budget:** 0 animating glows on route changes (ring draws are stroke paint, once per entry, budgeted as 1 non-glow animation). ✓

**Reduced-motion:** destinations fade in (`opacity`, `200ms`); expanders open without the grid animation (content appears, `opacity` only).

### 3.4 The AttentionCard sheet (the intercepting-route special case)

AttentionCards open the **intercepting sheet over Garden** (`/today/approve/abc` style) rather than a full route — because the user must land back in the queue. The sheet carries the **one winnable CTA + "Not now"** and the exact-action preview (bill: "What happens next" wiring list; email: the exact draft text in the dew-tinted quote block).

On confirm: §1.2's completion burst plays inside the sheet, the sheet dismisses, and the Garden card blooms-and-leaves. On "Not now": the sheet dismisses with the standard dismissal (§3.2) and the card re-ranks in place (`animate-rise`, no burst — a snooze is a choice, not a failure, and gets no reward animation).

### 3.5 Loading, skeletons, and the "gathering sunlight" states

- **Route loads:** `loading.tsx` per segment renders the garden's "growing…" skeleton — `.skeleton` cards (`animate-dapple 2.2s` shimmer, same radius/padding as the final card, final height reserved). **No spinners for content loads. No layout shift.**
- **Mist for pending data:** data still syncing renders as soft mist over that bed — the skeleton carries the copy "gathering sunlight" where a label fits. Mist = `opacity` on a static gradient layer; it doesn't move.
- **OCR processing:** §2.1 — the card breathes, "Reading your mail…" — never a spinner, never a dead photo.
- **Sync states:** the SyncDot is the sync indicator everywhere (§2.1). Full-screen sync overlays are banned — the garden degrades like weather passing, not like a system failing.

---

## 4. The budget, enforced

### 4.1 Per-screen budget ledger (the count, at peak frame)

| Screen | Animating glows | Concurrent animations | Notes |
|---|---|---|---|
| Garden morning | 2 | ~9 (reveal) → 4 (rest) | Fireflies (1) + orb breath (1); card borders static |
| Garden quiet-day | 2 | ~4 | Same as morning minus the reveal |
| Garden 11 PM | 2 (dimmed) | ~3 | Fireflies (1) + orb slow-breath (1); no staggers |
| Water-the-Garden exit | **3** (ceiling) | ~5 | The one moment allowed the full budget |
| Completion burst | 2 | ~4 | Card glow (1) + fireflies (1) |
| First-bloom (Day-0) | 3 (ceiling) | ~5 | Seedling (1) + leaf (1) + fireflies (1) |
| Dawn reveal | 2 | ~7 | Cross-fade (1) + blossom (1); fireflies counted once |
| `/school` | 1 | ~9 (entry) → 2 (rest) | Hero ring draw (stroke, 1) + entrance stagger ≤8 |
| `/school/:classId` | 1 | ~5 | Hero ring + checkbox bursts (one at a time) |
| `/mail` | 1 | ~3 | Snap card breathes during OCR; action cards bloom on arrival |
| `/shopping` | 1 | ~3 | Add/claim bursts, one at a time |
| `/health` | 1 | ~2 | Snapshot is calm; pulse trend is static |
| Placeholders (W6/W12/W19/W5/W3/W18) | 1 | ~2 | Hero dapple OR sigil breathe, never both; W19: 0 ambient |
| Sheets (any) | 0 | ~3 | Scrim blur static; sheet + content rise |
| Tab switch | 0 | ~2 | Content cross-fade + rise; indicator slide |

**The rule the ledger enforces:** no screen exceeds 3 animating glows; no screen exceeds 10 concurrent animations. The two ceiling-spending moments (Water exit, first-bloom) are **celebrations, one tap each, user-triggered** — the budget is spent where the dopamine is.

### 4.2 The never-animate list

These never carry motion — not ambient, not entrance, not press — with the single noted exception:

1. **Body copy** — paragraphs, card copy, cause lines. No bounce, wobble, typewriter, or count-up. *(Exception: the milestone grade count-up, §2.2 — once per milestone, 600ms, never habitual.)*
2. **Numbers and labels** — grades, amounts, dates, eyebrows. They change state; they don't perform.
3. **Navigation** — tabs, IconRail, headers, back controls. The indicator slide (§3.1) is the only chrome motion; icons never pop.
4. **Alerts** — safety items, time-critical cards, the SOS row. Urgency is copy + presence. Nothing flashes, pulses red, or shakes. **A flashing app is an anxious app.**
5. **Destructive or irreversible actions** — "Mark paid," dispute filing, send-window scheduling. The *confirm* plays the completion motion; the *button itself* never pulses to demand attention.
6. **Empty states and quiet states** — "All quiet" is still. The micro-delight card blooms in once on entry (it's content), then rests.
7. **W19 Emergency Plan** — the whole screen is still except entrance bloom. Reverence is not animated.
8. **`backdrop-blur`** — never animated, never on cards in scrollable lists, never on list items. Two fixed overlays max (nav bar, sheet scrim).
9. **`box-shadow` / `filter`** — never animated directly. Animate the opacity of a glow layer instead.

### 4.3 The motion review checklist (for every screen, before it ships)

1. [ ] Name the one feeling this screen's motion serves (breathing = alive, blooming = arrival, ascending = your doing). If you can't name it, cut it.
2. [ ] Count the animating glows at peak frame: ≤ 3 mobile / ≤ 6 desktop.
3. [ ] Count concurrent animations at peak frame: ≤ 10 mobile / ≤ 20 desktop.
4. [ ] Every animation reduces to `transform` and/or `opacity` — point to the property.
5. [ ] Entrance stagger ≤ 8 items (mobile) / ≤ 12 (desktop); beyond that, the container animates once.
6. [ ] `prefers-reduced-motion` path designed per §6 — not tolerated, designed.
7. [ ] No item on the never-animate list (§4.2) moves.
8. [ ] Ambient loops pause off-screen and when the tab hides.
9. [ ] The 11 PM test: open this screen at night — does it exhale?
10. [ ] The 500th-time test: repeat the most common motion 500 times mentally — does it still feel good, or has it become noise?

---

## 5. The SOS exception — the panic path is instant

**The doctrine:** on the way to help, there is no delight. The SOS path is the one place in the product where the motion language **does not apply** — because motion is feeling, and the feeling on this path is urgency made calm.

### 5.1 What "instant" means, concretely

- **Row → Emergency sheet:** the sheet appears with **no rise, no bloom, no stagger** — `opacity(0→1)` on the sheet at `--duration-instant` (`120ms`), scrim at `120ms`. The sheet is simply *there*. The three targets (Call 911 / Text trusted contact / I'm okay) render immediately, fully laid out, no entrance animation.
- **Inside the sheet:** no breathing, no dapple, no firefly backdrop, no ambient anything within the sheet's viewport. The calm line ("Breathe. Help is one tap away. Pookie stays with you.") is static text. The 911 button does not pulse, glow-breathe, or demand — it's a large, still, rose-400 target. **Urgency is the size of the target, not the motion around it.**
- **"I'm okay — stand down":** dismisses with the standard sheet dismissal (§3.2) — the panic is over, so the garden's manners may return. The dismissal logs the entry.
- **Long-press → SOS confirm sheet:** the haptic fires immediately; the sheet appears at `120ms`. The long-press itself has no progress animation on the orb — the orb does not "charge up." A charging animation would teach hesitation into a panic path.

### 5.2 What is NOT suspended

- The `prefers-reduced-motion` contract still holds trivially (there's nothing to reduce — the path is already still).
- The rest of the app behind the sheet keeps its ambient life; the sheet simply doesn't participate.
- After stand-down, the Garden's ambient resumes — the garden was never alarmed, only the sheet was urgent.

### 5.3 The wave-3 panic test (acceptance criterion)

The shaking-hand test (UI-SHELL-HOME §3.3): with the sheet open, every target must be tappable with a shaking hand — 64px+ targets, one-thumb reachable, **and** reachable without waiting for any animation to complete. The acceptance test includes a "tap during the first 120ms" case: the sheet must accept input from frame one. **If any entrance animation delays input by even one frame, the path fails the gate.**

---

## 6. The reduced-motion contract (global)

`prefers-reduced-motion: reduce` is not a degradation — it's a first-class rendering mode. **Calm must be accessible calm.**

| Motion class | Full-motion behavior | Reduced-motion behavior |
|---|---|---|
| Ambient loops (breathe, dapple, drift) | Loop | **Stopped** — render the rest frame (orb at full glow, scene at current light) |
| Entrance blooms/staggers | `animate-bloom`, 70ms stagger | **Fades** — `opacity(0→1)`, `200ms`, no stagger, no translate |
| Firefly bursts | 6–8 particles, 900ms | **Skipped** — the completion state renders directly |
| Dawn reveal | 2.4s choreography | **Skipped** — the dawn still-frame renders directly |
| Completion | Bloom + burst + fade | Row fades to struck-through (`200ms`); the ring still advances (state change, no stroke animation); toast appears statically |
| Water the Garden | 2.0s choreography | Shimmer skipped; signature sentence fades in (`200ms`); dewdrop marker static |
| Sheets | Rise 350ms | Fade `200ms`, no rise |
| Tab switches | Settle + rise | Cross-fade `150ms` |
| Expanders | Grid-rows grow 350ms | Content appears, `opacity` only |
| Ring draws | Stroke animation 600ms | Ring renders at final value |
| Toasts | `animate-rise` 300ms | Appear statically, fade out on dismiss |
| Glows | Static glows remain | **Glows remain** — the divine-light identity survives; only *movement* stops |

**Implementation:** a single `@media (prefers-reduced-motion: reduce)` block in `tokens.css` that forces `animation: none` on all ambient keyframes and swaps the entrance/completion keyframes to their fade equivalents; plus the `usePrefersReducedMotion()` hook and `<MotionSafe>` wrapper convention (FRONTEND-CONSTRAINTS §5) so JS-driven particles never fire. Every animated component degrades **by construction, not by review**.

**The one thing reduced-motion never removes:** state changes. A completed checkbox still completes, a ring still advances, a toast still informs. The *information* always survives; only the *theater* is optional.

---

## 7. Engineering notes — how to build this

1. **Tokens first.** All `--ease-*`, `--duration-*`, `--motion-*`, `--stagger-*` tokens go in `@theme` in `src/app/globals.css` (Tailwind v4: animations as `--animate-{name}`). Existing tokens (`bloom`, `breathe`, `sway`, `dapple`, `rise`, `halo-spin`, `ascend`) stay; this spec only composes them. **Don't rename existing tokens.**
2. **The firefly particle pattern** (used in §1.1–1.4): a `.firefly` span — 4px dot, `radial-gradient(halo-white, transparent)`, `position: absolute` at the burst origin; JS sets `--tx/--ty` per particle (precomputed radial fan, 6 or 8 dots); one `900ms` keyframe animates `transform: translate(var(--tx), var(--ty))` + `opacity(1→0)`; remove the node on `animationend`. Upward bias on `--ty` for the "ascend" flavor. Killed after the burst — particles never linger as ambient.
3. **The glow-layer pattern** (the only way to animate glow): `<div class="glow-layer">` absolutely positioned behind the content, `box-shadow` static, and only the layer's `opacity` animates. Never animate `box-shadow` or `filter` directly — ever.
4. **Entrance stagger:** `style={{ animationDelay: `${Math.min(index, 7) * 70}ms` }}` — the cap is in the code, not in review. Past 8, animate the container.
5. **Off-screen ambient:** wrap garden scenes in an `useInView`-gated container that toggles `animation-play-state: paused` — or `content-visibility: auto` on scene containers. Both cheap; pick one and be consistent.
6. **No motion library for v1.** This entire spec is CSS + Tailwind v4 keyframes. The single sanctioned addition (`motion`, for FLIP list reorder only) stays out unless Wave-4 proves the need — the queue reorder in §1.2 is a coordinated `animate-rise`, not a FLIP.
7. **The SOS sheet** is a separate component (`EmergencySheet`) with its own `120ms` presentation — it must not inherit the standard sheet's rise. Code-review flag: any `animate-rise` inside the SOS path is a bug.
8. **Test on Mehedi's phone.** The budget was written for a mid-range phone WebView (Capacitor remote-URL mode). If the dawn reveal drops frames on device, cut the firefly count before touching the choreography — the beats matter more than the particle count.

---

## Appendix A — Choreography index (quick reference)

| # | Moment | Trigger | Duration | Easing | Budget (glows) | Reduced-motion |
|---|---|---|---|---|---|---|
| 1.1 | Dawn bloom reveal | First Garden open of day + overnight change | 2.4s | `--ease-bloom` | 2 | Dawn still-frame, no reveal |
| 1.2 | Completion bloom + burst | Any winnable CTA | 1.1s | `--ease-bloom` | 2 | Fade to struck-through, no burst |
| 1.3 | Water the Garden exit | End-cap tap | 2.0s | `--ease-gentle`/`--ease-bloom` | 3 (ceiling) | Sentence fades in, no shimmer |
| 1.4 | First bloom (Day-0) | First seed completion | 1.6s | `--ease-bloom` | 3 (ceiling) | Growth stated, not played |
| 2.1 | Orb breathe | Always (Garden) | 5s loop (8s night) | linear-ish loop | 1 | Stopped at rest frame |
| 2.1 | Firefly drift | Always (backdrop) | 12s loop (20s night) | loop | 1 (shared) | Stopped |
| 2.1 | Dapple / sigil breathe | Placeholders, heroes | 9s / 5s loop | loop | 1 | Stopped |
| 3.1 | Tab switch | Tab tap | 300ms in / 200ms out | `--ease-bloom`/`--ease-gentle` | 0 | Cross-fade 150ms |
| 3.2 | Sheet present | Card tap | 350ms | `--ease-bloom` | 0 | Fade 200ms |
| 3.2 | Sheet dismiss | Back / swipe / scrim | 250ms | `--ease-gentle` | 0 | Fade |
| 3.3 | Drill-down | Module/ring/thread tap | 300ms + ring 600ms | `--ease-bloom` | 0–1 | Fade 200ms |
| 3.3 | Expander | "▸ N more taking root" | 350ms | `--ease-bloom` | 0 | Opacity only |
| 5 | SOS sheet | Row / long-press | 120ms | none (instant) | 0 | Already still |

**The sentence this spec is built on:** *living things move; interfaces transition.* The garden breathes, blooms arrive, and your doing ascends as sparks — everything else is just getting out of the way.
