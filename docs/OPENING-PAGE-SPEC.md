# Opening Page — Visual Composition Spec
**Pookie spacecraft cockpit · Home / "pilot walks in"**
Author: Visual Designer (subagent) · 2026-10-12 · Branch `staging-build` · **Uncommitted — for Track 1 implementation lead to integrate**

## 0. What this page is

The pilot signs in (or opens the app) and walks onto the bridge. The opening
page is **simple, calm, command-center**: a live planetary vista behind
everything, a small set of glass HUD panels in front. It is the pilot's
morning ritual surface — glanceable in 5 seconds, beautiful for 5 minutes.

**Locked product facts this spec accounts for:**
- **Adaptive layout (Mehedi 2026-10-12 ~22:22):** the AI arranges panels and
  prioritizes content from the pilot's integrated data. The opening page is
  **not** a fixed composition. This spec therefore defines **fixed anchors**
  (things that never move) vs. an **adaptive zone** (things the AI composes),
  plus the rules that keep the adaptive zone calm.
- **User-first, never assume parenthood:** child-related panels (e.g.
  child-homework) appear **only** when the pilot has linked children.
  "Just me" pilots never see parenting upsells or empty child slots.
- **Proactive AI co-pilot:** nudges ("meeting at 11", "bill due", "out of
  milk") are ambient and anticipatory. This spec defines the **nudge surface**.
- Design language: dark cockpit — black instrument panels
  (`#05080a`–`#141a1f`, never navy/gray), subtle neon accents
  (cyan/teal/green/amber, **zero purple/lavender**), nature-and-love warmth,
  divine-light soft glows. No light-on-white, no harsh neon.

## 1. Delivered video assets

Seamless-loop planetary vistas, generated for this page, post-processed with
ffmpeg (2 s crossfade of tail into head, libx264, yuv420p, 24 fps,
`+faststart`). Seamlessness was **verified, not assumed**: SSIM at the loop
point (0.94–0.97) exceeds the videos' own frame-to-frame motion step
(0.78–0.93) on all four — the loop is smoother than the footage itself.

| File | Vista | Suggested context | Duration | Size |
|---|---|---|---|---|
| `public/videos/vista-planets-1.mp4` | Ringed gas giant looming past a spacecraft viewport frame, teal nebula | Dawn / morning (05:00–10:59) | 10.0 s | 1.52 MB |
| `public/videos/vista-planets-2.mp4` | Earth-like blue world centered in dark space, atmosphere rim glow | Day (11:00–16:59) | 10.0 s | 1.66 MB |
| `public/videos/vista-planets-3.mp4` | Earthrise over a cratered moon surface, teal nebula wisps | Dusk (17:00–20:59) | 10.0 s | 1.69 MB |
| `public/videos/vista-planets-4.mp4` | Banded teal ice giant with aurora bands + small moon | Night (21:00–04:59) | 10.0 s | 1.39 MB |

Posters (first frame, reduced-motion / preload fallback):
`vista-planets-1-poster.jpg` … `vista-planets-4-poster.jpg` (~64–115 KB each).

Raw generations (pre-crossfade) are kept in
`public/videos/originals/media-generation-vista-planets-N-raw-*.mp4` for
reference; the Track 1 lead may delete them before merge to keep the tree
clean. All files are **uncommitted** per instructions.

**Honest quality notes (frames were inspected, not just encoded):**
- Planets are the hero in all four; backgrounds are genuinely dark — white
  UI text stays readable even before the overlay.
- No purple/lavender anywhere; palette is teal/cyan/deep-blue/black,
  matching the cockpit neon system.
- v1 includes a dark spacecraft window frame on the left edge — it reads as
  "inside the cockpit looking out" and is a feature, not a flaw. Panels
  should avoid hard-overlapping it (see §4: weather anchor sits right of it).
- v2/v3 show a recognizable Earth. This is intentional warmth ("home"),
  but if legal/brand prefers fictional worlds, v1/v4 are the alien options.
- Motion is a slow drift; nothing pans fast enough to fight text legibility.

## 2. Layer stack (bottom → top)

```
z-0   Vista video layer      fixed inset-0, object-cover, muted/autoplay/loop/playsinline
z-1   Readability overlay    the OVERLAY gradient (see §3) — non-negotiable, always on
z-2   Nudge banner lane      full-width, docked under HUD bar (see §7)
z-10  Fixed anchors          weather glass pane (see §4)
z-10  Adaptive zone          AI-composed panel slots (see §5)
z-40  HUD chrome             top bar: mission clock, pilot name, tab nav (see §8)
z-50  Applet layer           modules open as applets above (existing pattern; untouched)
```

The video + overlay pair **is** the existing `SpaceBackground` pattern —
reuse it, don't rebuild it (integration notes in §9).

## 3. Readability overlay (fixed anchor)

Reuse the exact `OVERLAY` from `src/components/space-background.tsx`:
radial vignette (transparent 52% → rgba(0,0,0,0.42)) + vertical linear
gradient (rgba(2,4,10,0.74) → 0.62 → 0.76). It guarantees contrast for the
brightest vista regions (planet limbs, nebula cores). Panels add their own
glass on top; the overlay must never be weakened to "show more video" —
readability wins over spectacle, always.

## 4. Fixed anchors — what never moves

Spatial memory is calm. Two things are pinned on every visit, in every
daypart, regardless of what the AI does:

1. **Video vista layer** — full-bleed background (§2, z-0/z-1).
2. **Glass weather pane** — pinned **top-left**, below the HUD bar, in the
   first grid column. Same size, same position, every time.
   - Content: current conditions (icon, temp, feels-like), location label
     (city/ZIP — coarse only, per MD decision D7), today's high/low, one
     line of "what it means for your day" (e.g. "Clear evening — good
     launch window for that run").
   - Styling: glass pane tokens (§6). Weather icon in amber or cyan neon.
   - Rationale: weather is ambient truth, not AI-curated content. Pilots
     learn "weather lives there" within a day; moving it would cost that.

Everything else on the page is adaptive.

## 5. Adaptive zone — panel slot system

The AI composes the rest of the page from a **slot registry**. The renderer
never invents layout; it maps the AI's ordered panel list onto fixed slots.

### 5.1 Slots (desktop 12-col grid, below HUD bar, right of weather anchor)

| Slot | Grid footprint | Max | Notes |
|---|---|---|---|
| `adaptive.featured` | 2 cols × 2 rows (large card) | 1 | The AI's single highest-priority panel. Larger type, richer content. |
| `adaptive.standard` | 1 col × 1 row each | 3 | Uniform glass cards. |
| `adaptive.drawer` | — | ∞ | Overflow: a "All stations" disclosure; panels beyond the 4 visible live here, never paginated on the page. |

Default AI composition (cold start / no strong signals): featured = **To-Do**,
standard = **Calendar** + one rotating contextual panel. To-do and calendar
are defaults, not anchors — the AI may demote them when something matters
more (e.g. a bill due today outranks the to-do list).

### 5.2 Panel catalog (AI may insert/reorder; never hardcode)

- `todo` — today's to-dos, top 3 + count, checkboxes inline.
- `calendar` — today's agenda, next 3 events + "view week".
- `bills` — due-soon bills with amounts and pay action (only when a bill is actually due soon).
- `child` — per-child school snapshot, e.g. "Dawson: Geometry homework due today" (**only if the pilot has linked children; never rendered otherwise**).
- `health` — sleep/recovery nudge (only when Health data is integrated).
- `shopping` — "we're out of milk" list (only when list is non-empty).
- `travel` — upcoming trip / cheapest-fuel-nearby card (only when relevant).
- `money` — credit-score tip (only when a concrete action exists).

Catalog rule: a panel renders **only when it has something to say**.
Empty states never occupy slots — that is the core calmness mechanism.

### 5.3 Calmness invariants (hard rules for the AI layout planner)

1. **Max 4 visible panels** (1 featured + 3 standard). Overflow → drawer.
2. **Weather anchor never moves** and no panel may overlap it.
3. **One featured panel max.** Featured is earned (urgency × importance),
   not rotated for novelty.
4. **No auto-reorder while the pilot is interacting.** Layout settles on
   page enter; mid-session changes arrive as nudges (§7), not reshuffles.
5. **Entrance motion ≤ 300 ms**, fade + 8 px rise, staggered 40 ms. No
   layout jump: slots reserve space before content paints (skeleton shimmer
   in glass).
6. **Uniform panel chrome:** every panel is the same glass card (§6) with
   the same header pattern (neon dot + small-caps label + chevron to its
   applet). The AI changes *content and order*, never *chrome*.
7. **Plain-English rule:** panel copy passes the grandmother test — no
   jargon, no internal metaphors.

### 5.4 Responsive behavior

- **≥1024 px:** 12-col grid; weather anchor col 1–3; adaptive zone cols 4–12.
- **640–1023 px:** 6-col; weather anchor spans full width as a compact
  horizontal strip (icon + temp + one-liner); adaptive zone stacks 2-col.
- **<640 px:** single column; weather strip on top; featured then standard
  panels stack; drawer becomes bottom sheet. Video stays `object-cover`.
- Touch targets ≥ 44 px; panel text never below 13 px.

## 6. Glass pane + HUD styling tokens

```css
/* Glass pane (weather + all adaptive panels) */
--glass-bg: linear-gradient(160deg, rgba(10,18,20,.72), rgba(5,8,10,.58));
--glass-blur: blur(18px) saturate(1.25);
--glass-border: 1px solid rgba(45,212,191,.22);   /* teal, subtle */
--glass-radius: 18px;
--glass-shadow: 0 8px 32px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06);
/* Featured panel: same, plus a 2px gradient hairline top (cyan→teal→green) */

/* Type */
--text-primary: #f2f7f5;   /* near-white, warm */
--text-muted: #9fb3ad;
--text-faint: #6b7f79;

/* Neon accents (subtle: glows, dots, hairlines — never large fills) */
--neon-cyan: #22d3ee; --neon-teal: #2dd4bf; --neon-green: #4ade80; --neon-amber: #fbbf24;
/* BANNED: purple/lavender in any form. */

/* Instrument panel black */
--panel-0: #05080a; --panel-1: #0a0f12; --panel-2: #141a1f;
```

## 7. Nudge surface — how proactive AI messages appear

Two surfaces, chosen by urgency. **Never both for the same nudge.**

**A. Banner lane (time-critical only).** A slim full-width strip docked
directly under the HUD bar (z-2, above video, below panels).
- Max **1 visible**; additional nudges queue. Auto-dismisses after 12 s or
  on tap; a quiet bell dot in the HUD bar shows the queue count.
- Content: one plain-English line + one action ("Meeting with Alina at 11 —
  [Open agenda]"). Amber left hairline for time, teal for money/health.
- Motion: slides down 200 ms; never shifts panel layout (it overlays the
  top of the adaptive zone with a scrim, or pushes content — Track 1 to
  choose, but it must not cause reflow jank).
- No sound by default; respects quiet hours (follows the 6 AM–10 PM spirit
  of comms windows — nudges are silent 10 PM–6 AM unless the pilot opts in).

**B. Panel highlight (informational).** The relevant adaptive panel gets a
soft pulsing neon ring (2 px, teal, 2 s ease, max 3 pulses) + a small "New"
dot on its header. Used for "your credit score can increase if you do XYZ"
style guidance — it draws the eye without interrupting.

**Nudge rules:** max 3 banner nudges per hour; duplicates collapse; every
nudge has a visible dismiss and a "why am I seeing this" affordance; nudges
never appear over applets.

## 8. HUD chrome (top bar)

Slim (56–64 px), transparent-to-glass gradient, full width:
- Left: Pookie orb mark (angelic light, per logo direction) + "POOKIE" wordmark, small.
- Center: tab nav — Home · Today · Pookie · Progress · More (per IA-FINAL; 5 tabs).
- Right: mission clock (local time, tabular numerals), date, pilot first
  name, nudge bell dot, avatar.
The bar is chrome, not content — it never participates in adaptive layout.

## 9. SpaceBackground integration notes (for the Track 1 lead)

- The existing `SpaceBackground` component
  (`src/components/space-background.tsx`) already implements the required
  pattern: fixed video + dark overlay, `muted`/`autoPlay`/`loop`/
  `playsInline`, poster fallback, `prefers-reduced-motion` → poster image,
  pause-on-hidden-tab, 1.1 s crossfade between videos on route change.
  **Reuse it.**
- Suggested wiring: add a `VISTA_VIDEOS` registry next to `COCKPIT_VIDEOS`
  (`vista-dawn/day/dusk/night` → the four files + posters), and a
  `vistaForNow(date)` selector with the daypart mapping in §1. The AI may
  override the selection (special occasions, pilot preference) — keep the
  override a prop, not a fork.
- `preload="metadata"` + poster: first paint shows the poster instantly,
  video fades in — no black flash.
- Keep the z-index contract in §2 (`z-[2]` for background). Panels sit at
  z-10+, HUD at z-40, applets above.
- One video element at a time; when the daypart changes while the page is
  open, crossfade (the component already does this on `src` change).

## 10. Reduced motion

`prefers-reduced-motion: reduce` → render the vista **poster JPG** as a
static full-bleed image (the component already does this); disable panel
entrance animations (opacity only, 0 ms); disable nudge banner slide
(appear instantly); disable panel highlight pulse (static ring).

## 11. What the Track 1 lead must verify in a real browser

(This spec was built without browser access — visual sign-off is required.)
1. Text contrast of every panel over **each** of the 4 vistas (brightest
   planet-limb regions), at desktop + mobile widths.
2. Glass legibility: `backdrop-filter` over moving video on iOS Safari and
   Chrome; fallback if blur is unsupported.
3. The adaptive zone with 1, 2, 4, and 7+ panels (drawer behavior).
4. Nudge banner over panels — no reflow jank, dismiss works, queue dot counts.
5. Reduced-motion path shows the poster, no video decode.
6. Daypart vista switching crossfade (leave page open across a boundary).
7. Performance: video decode + blur compositing stays smooth on a mid-range
   Android device.

## 12. Open design questions (for Mehedi, not blockers)

- Should the pilot be able to pin a favorite vista (override daypart)?
- Nudge quiet hours: mirror the 6 AM–10 PM comms window, or pilot-configurable?
- Featured-panel eligibility: should `child` panels ever be featured for a
  parent pilot, or is featured reserved for the pilot's own life?
