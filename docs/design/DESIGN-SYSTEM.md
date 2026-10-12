# Pookie Design System — DESIGN-SYSTEM.md

**Status:** Component library spec for the engineering pods (Wave 1 → Wave 4).
**Author:** Design Systems Specialist · **Date:** 2026-10-11
**Inputs:** founder's design language (standing rule), `src/app/globals.css` tokens, `src/components/school/styles.ts` grade bands, Guidance Framework copy rules, AI-MOTHER-VISION module taxonomy (W1–W23).

**Scope:** every UI surface in the Pookie app — all 23 modules must feel like one app. This spec extends the existing token set in `src/app/globals.css`; it does not replace anything. New tokens are marked **NEW**.

**Founder rule (non-negotiable):** shades of green everywhere; subtle neon shine/sparkle, never harsh; nature + love (sunlight through leaves); divine light (soft glows, angel touches — Pookie is a ball of light). "If the app does not look good and intuitive, it is not useful."

---

## 0. How to use this spec

- **Tokens (§1)** go into `@theme` in `globals.css` — CSS custom properties + Tailwind utilities. Token names below are the exact Tailwind class stems (e.g. `--color-ember-400` → `text-ember-400`).
- **Components (§2)** are specified by anatomy + states + usage rules. Build them as shared components under `src/components/ui/` so no module reinvents them.
- **Patterns (§3)** are composition rules — how components combine to produce the signature Pookie feelings (attention, growth, completion).
- **Do/Don't (§4)** includes the shame-free copy law. If a Do/Don't conflicts with an AI-generated string, the Do/Don't wins — wire the Guidance Framework copy-lint blocklist into the rules layer (vision §2.5 layer 3).

---

## 1. Design tokens

### 1.1 Color palette

All values are the canonical source. Existing tokens keep their values; NEW tokens extend the set.

**Canopy — backgrounds (night forest).**
| Token | Hex | Role |
|---|---|---|
| `canopy-950` | `#060f0a` | App page background (root) |
| `canopy-900` | `#0a1a10` | Raised surfaces: banners, sheet chrome, nav bar |
| `canopy-800` | `#10241a` | Card base (bottom of card-living gradient), inputs, track backgrounds |
| `canopy-700` | `#173322` | Hover-raised surfaces, skeleton shimmer base |

**Leaf — primary brand green (living green).**
| Token | Hex | Role |
|---|---|---|
| `leaf-300` | `#86efac` | Primary text accent, on-mission highlights, icon strokes |
| `leaf-400` | `#4ade80` | Primary interactive color (buttons, links, active states), glow source |
| `leaf-500` | `#22c55e` | Primary button fill base, ring fills |
| `leaf-600` | `#16a34a` | Button gradient edge, pressed states |
| `leaf-700` | `#15803d` | Darkest leaf — badge tints, visited/visited links |

**Moss — secondary soft greens.**
| Token | Hex | Role |
|---|---|---|
| `moss-200` | `#bbf7d0` | Soft chip backgrounds at 12–16% alpha |
| `moss-300` | `#86efac` | Secondary accents (same as leaf-300; keep for semantic naming) |

**Dew — pale mint (gentle highlights).**
| Token | Hex | Role |
|---|---|---|
| `dew-100` | `#ecfdf5` | Headings, primary text on dark |
| `dew-200` | `#d1fae5` | Sunlit text, child-private tint backgrounds at low alpha |

**Sunlight — warm gold (light through leaves).**
| Token | Hex | Role |
|---|---|---|
| `sunlight-200` | `#fef3c7` | Warm banner text |
| `sunlight-300` | `#fde68a` | Attention eyebrows, warmth accents |
| `sunlight-400` | `#fbbf24` | Attention glow source, star/sparkle fills |

**Gold — deeper amber. NEW.**
| Token | Hex | Role |
|---|---|---|
| `gold-300` | `#fcd34d` | "Needs tending" band text |
| `gold-400` | `#f59e0b` | "Needs tending" band fills, glow source |
| `gold-500` | `#d97706` | Deep gold — pressed/dark tints |

**Ember — warm orange-red. NEW.**
| Token | Hex | Role |
|---|---|---|
| `ember-300` | `#fdba74` | "Rally" band text (soft, warm — never harsh red) |
| `ember-400` | `#fb923c` | "Rally" band fills, glow source |
| `ember-500` | `#f97316` | Deep ember — critical attention accents |

**Halo — divine radiance (sacred light).**
| Token | Hex | Role |
|---|---|---|
| `halo-100` | `#fffbeb` | Pookie orb core, blessing copy backgrounds |
| `halo-200` | `#fef9c3` | Divine highlights |
| `halo-300` | `#fde68a` | Halo glow source |

**Bark — warm earth neutrals (text).**
| Token | Hex | Role |
|---|---|---|
| `bark-100` | `#e8f5ee` | Body text on dark |
| `bark-300` | `#b8d4c2` | Secondary text, metadata, subtitles |
| `bark-500` | `#7d9b88` | Placeholder text, disabled text, captions |

**Rose — safety ONLY. NEW.** Never a grade, never a nudge, never a bill.
| Token | Hex | Role |
|---|---|---|
| `rose-300` | `#fda4af` | SOS text, crisis copy, destructive action text |
| `rose-400` | `#fb7185` | SOS button fill, destructive confirm |
| `rose-500` | `#f43f5e` | Deepest rose — critical safety accents |

**Rule: the grade palette is leaf / sunlight / gold / ember. Rose is reserved for genuine safety (SOS, crisis tripwire, destructive confirms, overdue critical documents). A grade is NEVER red. This is the shame-free law in color form.**

### 1.2 Grade badge tokens (canonical — supersedes the old green/yellow/orange/red bandStyles)

Bands are numeric-only inputs, mission-framed outputs (see `src/lib/grades.ts` `gradeBand()`):

| Band | Range | Token stem | Label (internal) | Parent-facing lead copy |
|---|---|---|---|---|
| On mission | ≥ 90 | `leaf` | On mission | "Holding strong at the 90 goal — keep growing." |
| Near the mission | 80–89 | `sunlight` | Growing | "`{gap}` points from the 90 goal — almost there." |
| Needs tending | 70–79 | `gold` | Tending | "`{gap}` points from the 90 goal — tending now pays off." |
| Rally | < 70 | `ember` | Rally | "`{gap}` points from the 90 goal. The plan below is the way back — one winnable step at a time." |

Per-band utility triples (extend `bandStyles` in `styles.ts`):
- `leaf`: text `text-leaf-300`, ring `border-leaf-400/30`, bar `bg-leaf-400`, chip `border-leaf-400/40 text-leaf-300`, glow `shadow-glow-sm`
- `sunlight`: text `text-sunlight-300`, ring `border-sunlight-400/30`, bar `bg-sunlight-400`, chip `border-sunlight-400/40 text-sunlight-300`, glow `shadow-sun-warm`
- `gold`: text `text-gold-300`, ring `border-gold-400/30`, bar `bg-gold-400`, chip `border-gold-400/40 text-gold-300`, glow `shadow-glow-gold`
- `ember`: text `text-ember-300`, ring `border-ember-400/30`, bar `bg-ember-400`, chip `border-ember-400/40 text-ember-300`, glow `shadow-glow-ember`

**NEW glow shadows** (add to `@theme`):
```css
--shadow-glow-gold: 0 0 14px rgb(245 158 11 / 0.25);
--shadow-glow-ember: 0 0 14px rgb(251 146 60 / 0.25);
--shadow-glow-gold-md: 0 0 28px rgb(245 158 11 / 0.32), 0 0 72px rgb(245 158 11 / 0.10);
--shadow-glow-ember-md: 0 0 28px rgb(251 146 60 / 0.32), 0 0 72px rgb(251 146 60 / 0.10);
--shadow-rose-alert: 0 0 24px rgb(251 113 133 / 0.35);
```

### 1.3 Typography

Base font: Geist Sans (`--font-sans`). Numbers always `tabular-nums`. No serif anywhere — warmth comes from copy and glow, not type.

| Token | Class | Size / Line-height / Weight | Use |
|---|---|---|---|
| `display` | `text-display` | 34px / 40px / 600 | Garden Hub greeting, module hero numbers |
| `h1` | `text-h1` | 28px / 34px / 600 | Page titles |
| `h2` | `text-h2` | 22px / 30px / 600 | Section titles, sheet titles |
| `h3` | `text-h3` | 18px / 26px / 600 | Card titles |
| `body` | `text-body` | 15px / 24px / 400 | Body copy (mobile-first base — 15px, not 16px) |
| `small` | `text-small` | 13px / 20px / 400–500 | Metadata, secondary lines |
| `caption` | `text-caption` | 11.5px / 16px / 500, tracking +0.04em, uppercase optional | Eyebrows ("NEEDS A LOOK"), timestamps |
| `numeric` | `text-numeric` | inherits, `tabular-nums`, 600 | All grades, money, counts |

**NEW `@theme` additions:**
```css
--text-display: 2.125rem;   --text-display--line-height: 2.5rem;
--text-h1: 1.75rem;         --text-h1--line-height: 2.125rem;
--text-h2: 1.375rem;        --text-h2--line-height: 1.875rem;
--text-h3: 1.125rem;        --text-h3--line-height: 1.625rem;
--text-body: 0.9375rem;     --text-body--line-height: 1.5rem;
--text-small: 0.8125rem;    --text-small--line-height: 1.25rem;
--text-caption: 0.71875rem; --text-caption--line-height: 1rem;
```

### 1.4 Spacing, radii, layout

- Base unit 4px. Card padding: `p-5` (20px). Section gap: `gap-4` (16px). Page padding: `px-4` mobile, `px-6` ≥sm.
- Content width: mobile-first single column; `max-w-2xl` for reading surfaces; `max-w-5xl` for dashboards ≥lg.
- Radii: `rounded-2xl` (16px) default surfaces · `rounded-3xl` (24px) cards/heroes · `rounded-full` pills, orbs, avatars · `rounded-xl` (12px) inputs, chips. Nothing sharper than 12px — the app has no hard corners.
- Z-index scale: content 0–10 · sticky banners 40 · app nav 45 · top banner (staleness) 50 · sheets/modals 60 · command bar 70 · toasts 80 · Pookie orb (FAB) 55.

### 1.5 Motion

Existing animations stay (`bloom`, `breathe`, `sway`, `dapple`, `rise`, `halo-spin`, `ascend`). **NEW tokens:**

| Token | Value | Use |
|---|---|---|
| `--ease-bloom` | `cubic-bezier(0.22, 1, 0.36, 1)` | Entrances, completions — the house easing |
| `--ease-gentle` | `cubic-bezier(0.4, 0, 0.2, 1)` | Hovers, color transitions |
| `--duration-instant` | `120ms` | Micro-interactions (chip toggles) |
| `--duration-swift` | `220ms` | Hovers, presses |
| `--duration-bloom` | `600ms` | Card entrances, completion bursts |
| `--duration-slow` | `900ms` | Hero transitions, grove reveals |

- `prefers-reduced-motion`: keep the existing rule (movement stops, glows remain).
- Stagger rule: lists of cards enter with `animation-delay: 0.1s + index * 0.07s` (see `ClassCard`).
- Nothing loops faster than 4s except `dapple` (1.8s, hover-only). No spinners — loading = `breathe` pulse or skeleton shimmer.

---

## 2. Core components

All live in `src/components/ui/`. Props named exactly as below.

### 2.1 AppShell

**Anatomy:** `TopBannerSlot` (staleness/quiet-hours stack) → `AppHeader` → `main` → `BottomNav` (mobile) / `IconRail` (desktop ≥lg) → `PookieOrb` (FAB) → `ToastSlot`.

- `main` has `pt` for sticky banners, `pb-24` on mobile for bottom nav clearance.
- Background: `bg-canopy-950` with a fixed, non-interactive garden backdrop: 3–5 `.firefly` dots + one large soft `halo` radial top-center at 6% opacity. Backdrop NEVER carries text or interaction.
- **Do:** one shell, every module. **Don't:** module-specific headers above the AppHeader; the ModuleHeader (§3.4) lives inside `main`.

### 2.2 AppHeader

**Anatomy:** `[ChildSwitcher] [RoleBadge] … [SyncDot] [CommandBarTrigger]`

- **ChildSwitcher:** child avatar (initial in a `leaf`-ringed circle; active child gets `halo` glow) + name + chevron. Tap → bottom sheet listing children (each row: avatar, name, one-line status "All quiet 🌿" / "2 things need a look ✦"), then "＋ Add child" (invite flow), then "Household" (family-level modules W10/W11/W14/W19/W20).
- **RoleBadge:** pill showing `Parent` or child's name view. Parent sees child data; child sees their own view. Child view NEVER shows parent worry-list copy.
- **SyncDot:** `leaf-400` pulsing dot = fresh (<15 min) · `sunlight-400` = aging (15–60 min) · `gold-400` = stale (>60 min). Tap → freshness popover with per-source timestamps + SYNC NOW.
- **Do:** header is calm — no red dots, no badge counts screaming. Attention lives in the Garden Hub queue. **Don't:** numeric notification badges on the header (anxiety engine). The only header indicator is the SyncDot.

### 2.3 Navigation

**Garden Hub (home, `/`):** the "mission control that feels like a garden."
Anatomy top→bottom: `GreetingHero` ("Good morning, Mehedi ☀️" + date + one-line garden state: "The garden is thriving — 2 things could use a look") → `AttentionQueue` (max 5, §3.1) → `GroveSections` (module groups as horizontal living-card rails) → `TodayStrip` (calendar items due today across modules).

**BottomNav (mobile) / IconRail (desktop):** exactly 5 destinations — no more:
1. **Garden** (home icon) — the hub
2. **Today** (sun icon) — unified attention queue + today's plan across all modules
3. **Pookie** (orb icon, center, larger, `halo` glow) — AI chat; child sees Pookie, parent can toggle Pookie/Muse per standing directive
4. **Grow** (sprout icon) — progress/growth view: rings, streaks, weekly deltas per child
5. **Menu** (grid icon) — all 23 modules grouped by grove (§2.3 GroveDrawer)

- Active tab: `leaf-400` icon + `text-sunlit` label + soft glow; inactive: `bark-500`.
- **CommandBar (⌘K / tap search icon):** fuzzy search across modules, children, actions ("Sync now", "Log check-in", "Approve teacher draft", "Add expense"). Results grouped: Actions → Modules → Children. Keyboard-first, 44px rows.

**Do:** 5 tabs, always. New modules go in the Menu groves, never as tabs. **Don't:** per-module bottom tabs, hamburger-only navigation, or badge counts on tabs.

### 2.4 Cards

**LivingCard (base — generalizes `card-living`):** `rounded-3xl border p-5` + gradient `165deg canopy-800→canopy-900` + `border-leaf-400/16` + `shadow-glow-sm`; hover: lift `-3px`, `shadow-glow-md`, `border-leaf-400/35`. Entrance: `animate-bloom` with stagger. This is the default card for EVERY module.

**MissionCard (per-entity summary, e.g. ClassCard pattern):** LivingCard + header row (name + meta left; numeric + divider + letter chip right) + progress bar + footer row (gap copy left, delta copy right). The anatomy generalizes to any "entity with a goal": class grades, savings goals, reading streaks, practice hours.
- Numeric and letter ALWAYS side by side separated by a 1px `bg-leaf-400/20` divider (Mehedi's standing class-page rule).
- Progress bar: `h-1.5 rounded-full bg-canopy-800` track, fill in band color with matching soft glow.

**AttentionCard:** LivingCard with `border-sunlight-400/30` + `shadow-sun-warm` + eyebrow `✦ NEEDS A LOOK` (`text-caption text-sunlight-300`) + one-line situation + ONE primary action button (the winnable next step) + dismiss ("Not now" → snoozes 24h, logged). Never more than one CTA.

**StatCard:** LivingCard compact (`p-4`): caption label, `text-h2 text-numeric` value, `text-small` delta line. Used in Grow view and module dashboards.

**ChildSpaceCard (child-private modules W8/W17/W23-teen):** LivingCard with `dew` tint: `border-dew-200/20`, header shows lock sigil 🔒 + "`[Child]`'s space". Parent variant shows aggregates only + "Details stay with `[child]`" footnote.

**Do:** every card is a LivingCard descendant — same radius, same gradient, same hover physics. **Don't:** white cards, sharp corners, flat `#fff` surfaces anywhere; drop shadows that aren't green/gold glows.

### 2.5 Badges & pills

- **GradeBadge:** `rounded-full border px-2.5 py-1 text-small font-semibold` in band colors (§1.2). Always pairs numeric + letter where grades appear.
- **StatusPill:** neutral states — `Synced`, `Pending approval`, `Paused by [child]`. Base: `border-bark-500/30 text-bark-300`. Never uses band colors for non-grade states.
- **CountPill:** for quantities (e.g. "3 due") — `bg-sunlight-400/15 text-sunlight-300 border-sunlight-400/30`. Counts are warm, not alarming.
- **Do:** pills describe state, never judge ("Needs tending", not "Behind"). **Don't:** red pills for grades/missing work — red is safety-only.

### 2.6 Growth indicators (progress dopamine)

- **GrowthRing:** SVG ring, 56px default (88px hero). Track `stroke-canopy-700`; fill = band-color gradient (`leaf-500→leaf-300` etc.) with `filter: drop-shadow(0 0 6px band)`. Animates `stroke-dashoffset` over `--duration-bloom` with `--ease-bloom`. Center: numeric % or a sprout-stage glyph. Label below: the mission ("of the 90 goal").
- **SproutMeter:** 5-stage growth visual for streaks/habits: 🌱→🌿→🪴→🌳 rendered as Lucide `sprout` icons filling with leaf gradient left→right. Each stage has a name: Seed, Sprout, Sapling, Grove, Canopy. Copy: "3-day streak — Sapling 🌱".
- **DeltaLine:** 7-point sparkline (SVG polyline, no axes) in band color, `text-small` caption from `deltaCopy()`. Cause-first: tooltip/annotation names the cause ("2 missing assignments"), never just the number.
- **Do:** progress always framed as *growth toward* something. **Don't:** leaderboards across children (never-blended rule), "below average" population comparisons (banned copy), or progress bars that start red and "forgive" upward.

### 2.7 Buttons

| Variant | Class | Anatomy |
|---|---|---|
| Primary | `btn-dapple` (existing) | Leaf→sunlight sweep, `shadow-glow-sm`; hover runs `dapple` + lifts `-1px`; label `text-canopy-950 font-semibold` |
| Angel | `btn-angel` **NEW** | Halo gradient (`halo-200→sunlight-300`), `shadow-halo-sm`; reserved for Pookie AI actions ("Ask Pookie", "Generate plan") |
| Secondary | `btn-rooted` **NEW** | `input-rooted` base + `hover:border-leaf-400/50`; quiet actions |
| Ghost | `btn-ghost` | transparent, `text-bark-300 hover:text-dew-100` |
| Danger | `btn-danger` **NEW** | `rose-400/15 border-rose-400/40 text-rose-300`; destructive confirms ONLY (delete vault doc, revoke share) |

- Sizes: `sm` (h-9 px-4), `md` (h-11 px-5, default), `lg` (h-13 px-7). Min touch target 44px.
- Disabled: `opacity-40 saturate-50`, no glow.
- **Do:** one primary per screen region. **Don't:** primary buttons in rose for non-safety actions; "Submit" labels — use verbs ("Send to teacher", "Mark done", "Start sync").

### 2.8 Sheets & modals

- **BottomSheet (mobile) / CenterModal (≥sm):** one component, responsive presentation. `rounded-t-3xl` (sheet) / `rounded-3xl` (modal), `bg-canopy-900`, `border-leaf-400/20`, `shadow-glow-md`. Entrance `animate-rise`. Drag handle on sheets. Scrim: `bg-canopy-950/70 backdrop-blur-sm`.
- **ApprovalSheet (teacher emails, expense approvals, consent grants):** shows the EXACT text to be approved in a `dew`-tinted quote block, then Approve / Edit / Decline buttons. Nothing sends without explicit approval of the exact words (standing rule). Approval outside 6:00 AM–10:00 PM local → "Scheduled for 6:00 AM" chip (send-window rule).
- **ConfirmSheet (destructive):** rose accents, requires typing or explicit two-tap for vault/tenant deletion.
- **Do:** sheets for actions, modals for reading. **Don't:** more than one sheet deep; alerts-as-modals for non-critical info (use toasts).

### 2.9 Banners

Stack order in `TopBannerSlot`: Staleness → Quiet-hours.

- **StalenessBanner NEW:** `border-gold-400/30 bg-canopy-900/95`, copy "Last updated {x} ago — the garden may have grown since." + `Sync now` button. Appears when any primary source is stale (>60 min grades, >24h health rollups).
- **QuietHoursBanner NEW:** 10 PM–6 AM local: `border-halo-300/20`, copy "🌙 Quiet hours — approvals and nudges rest until 6:00 AM." Non-blocking, dismissible per night.
- **Do:** banners inform, never scold. **Don't:** red/urgent styling for staleness — stale data is a fact, not a failure.

### 2.10 Empty states

**SeedlingEmpty:** centered `sprout` icon in `halo` glow + `text-h3` title + `text-small text-bark-300` body + one primary CTA.
Copy formula: name what's missing → name the first seed → invite. Examples:
- "No check-ins yet — plant the first seed with a 60-second check-in."
- "No tutors saved — when you find a good one, they'll grow here."
- **Don't:** "No data found", empty tables, or illustrations of failure.

### 2.11 Skeletons

`.skeleton`: `rounded-3xl bg-canopy-800` with shimmer — `linear-gradient(110deg, transparent 30%, rgb(74 222 128 / 0.08) 50%, transparent 70%)`, `background-size: 220%`, `animate-dapple 2.2s`. Match the card shape being loaded (same radius/padding). **Don't:** spinners for content loads; layout shift — skeletons reserve final height.

### 2.12 Toasts

Bottom-center (above nav), `rounded-2xl bg-canopy-800 border-leaf-400/25 shadow-glow-md`, `animate-rise`, auto-dismiss 4s. Copy is completion-flavored: "Marked done — one less thing on your mind ✓", "Plan saved — growing 🌱". **Don't:** error toasts in rose for user-fixable issues — explain + offer the fix inline instead.

---

## 3. Patterns (how the app *feels*)

### 3.1 The Attention pattern — "needs you now"

This is the signature Pookie pattern: the mother noticing before you do, without ever raising her voice.

**Rules:**
1. The AttentionQueue is the single ordered list across ALL modules (school, health, money, calendar...). Ordered by: safety (rose, rare) → time-critical (<48h deadline) → high-leverage (missing/zero items first — "a zero drags its whole category") → gentle (suggestions).
2. Max 5 visible on the Garden Hub + "See all ({n})". Anti-nag: max 3 child nudges/day, max 1 parent alert/day/child (vision §3.1).
3. Visual: `sunlight` glow + `✦ NEEDS A LOOK` eyebrow. Grades/money/tasks NEVER render in rose. Only safety items (SOS, crisis tripwire, credential failure, legal deadline <72h) may use rose.
4. Every attention item carries exactly ONE winnable next step as its CTA ("Do the 2 missing assignments" not "Fix Geometry"). Completing it fires the Completion pattern (§3.3) and suppresses the trigger for 14 days.
5. Copy frame — situation, cause, invitation:
   - ✅ "Geometry slipped 4 points this week — the two missing assignments look like the cause. Want to knock out the first one tonight?"
   - ❌ "Geometry dropped to 69! You're falling behind!"
6. Dismiss = "Not now" → snoozes 24h, logged as parent/child choice (never silent-deleted).

### 3.2 The Growth pattern — progress dopamine

Progress renders as *a living thing growing*, everywhere:

1. **GrowthRing** for any goal-with-target (grade→90, savings goal, reading minutes, practice hours). The ring fills toward the goal; the label names the mission.
2. **SproutMeter** for streaks (check-ins, loggings, practice days): Seed → Sprout → Sapling → Grove → Canopy. Breaking a streak: "The sapling is still here — water it today 🌱" (never "streak lost").
3. **DeltaLine** for trends: 7-day sparkline + `deltaCopy()` caption. A downward delta ALWAYS ships with its cause and the plan link ("Down 3.2 this week — the plan below answers it.").
4. **Weekly wins digest:** the Grow tab opens with "This week's growth" — completed items, rings advanced, streaks watered. Strengths first, always.
5. **Do:** celebrate process (showing up, completing the plan), not just outcomes. **Don't:** streak-shaming, rank lists, or "you're behind" framing on any growth surface.

### 3.3 The Completion pattern — cleared-item satisfaction

The dopamine hit that makes the ritual stick:

1. Tap complete → row plays `animate-bloom` (scale 0.98→1, 600ms, `--ease-bloom`) + a 6-dot firefly burst (`.firefly` particles, 900ms) + item fades with strikethrough.
2. Toast: "Done — one less thing on your mind ✓" (never "Task completed").
3. If the item fed a GrowthRing/SproutMeter, the ring visibly advances in the same frame (the cause→effect loop the habit loop needs).
4. Attention items completed suppress their trigger for 14 days and the queue re-orders with `animate-rise`.
5. **Don't:** confetti (too tech-bro), point scores, or "productivity" language. The metaphor is tending a garden, not clearing a ticket queue.

### 3.4 The Module Header pattern — 23 modules, one voice

Every module page opens with the same anatomy:

```
[Sigil 44px, grove-tinted glow]  Module title (text-h1)      [FreshnessChip] [SyncNow?] [⋮]
                                 One-line subtitle (text-small text-bark-300)
                                 — what this grove watches over, in plain words
[AttentionStrip — only if this module has queue items]
```

- **Sigil:** Lucide icon in a 44px rounded-2xl tile with the grove's glow color (see grove map below). The sigil is the module's face in Menu, search, and headers — one icon per module, never changed casually.
- **FreshnessChip:** `text-caption` pill — "Updated 12m ago" (leaf) / "Updated 3h ago" (sunlight) / "2d ago — pull for fresh" (gold + tap → sync). Data honesty is a design feature.
- **Subtitle formula:** "What I watch over for you" in one line. E.g. School: "Grades, assignments, and the path to 90 — watched daily." Health: "The body, gently tracked — trends, never judgments."

**Grove map (Menu + Garden Hub grouping of the 23 modules):**

| Grove | Glow | Modules |
|---|---|---|
| 🌿 School Grove | leaf | W1 School core · W16 Minutiae calendar · W5 College prep · W18 Summer planning · W4 Extracurriculars |
| 🌸 Body & Heart | halo/dew | W2 Health · W8 Emotional wellbeing 🔒 · W13 Meals · W22 Exercise tracker · W23 Nutrition |
| 🛡️ Safety | sunlight | W3 Location & SOS |
| 🌱 Growing Up | gold | W6 Driving & life skills · W7 Banking & documents · W15 Digital wellbeing |
| 🏡 Home & Family | moss | W20 Shopping list · W21 Mail intelligence · W11 Spend · W19 Guardianship vault · W14 Co-parenting · W12 Childcare · W17 Social life 🔒 · W10 Fairness |

🔒 = child-private by default (ChildSpaceCard, aggregates-only for parent).

### 3.5 The Freshness pattern

Every data surface shows its age. `useFreshness(source)` returns `{ageMin, tone}` → FreshnessChip. Tones: leaf (<15m), sunlight (15–60m), gold (>60m / source SLA breached → StalenessBanner). Sync actions always show optimistic "Pulling fresh leaves…" state then bloom in the new data. **Never show a number without its timestamp within one tap.**

### 3.6 The Child-Private pattern (W8/W17/W23-teen, health-sensitive)

- Visual: `dew` tint + lock sigil + "`[Child]`'s space — details stay with them."
- Parent sees: aggregates, trends, and the safety tripwire state. Never raw text, never plate-by-plate logs, never friend names.
- The tripwire's existence and consequence are disclosed at onboarding (no secret tripwires, ever).
- **Do:** make the boundary visible and beautiful — privacy is a feature to show off. **Don't:** "Ask your child to share" nag screens.

---

## 4. Do / Don't — component quick reference

| Component | Do | Don't |
|---|---|---|
| Any card | LivingCard base: 24px radius, canopy gradient, green glow hover | White/flat cards, hard corners, non-glow shadows |
| Grades | Numeric + letter side by side, divider line, gap-to-90 leads | Lead with the raw number as verdict; red anything |
| Bands | leaf/sunlight/gold/ember; ember = warm rally, not alarm | Use rose/red for grades, missing work, or nudges |
| Attention | ✦ NEEDS A LOOK, one winnable CTA, cause named | More than 5 on hub; exclamation marks; "urgent" |
| Buttons | One primary per region; verb labels | Rose primary for non-safety; "Submit" |
| Empty | Seedling: icon + invitation + one CTA | "No data", empty tables |
| Loading | Skeleton matching final shape | Spinners for content; layout shift |
| Copy (all) | Short sentences, specific numbers, questions over verdicts | Identity verdicts, peer comparison, fatalism, false reassurance (Guidance Framework never-say list) |
| Child surfaces | Strengths first; mission framing; invitation | "Failing", "lazy", "behind", "your dad is worried" |
| Safety | Rose reserved; maximally urgent AND factual | Panic language — panicked parents decide worse |
| Motion | bloom/breathe/fireflies; stagger 70ms | Confetti, fast loops, movement without reduced-motion fallback |

### 4.1 Shame-free copy law (applies to every component)

From the Guidance Framework (signed off 2026-10-11):
- **Banned:** identity verdicts ("you're failing/lazy"), diagnostic verbs, body/weight language to the child, parent-anxiety transfers ("your dad is worried"), peer comparison ("most kids your age…"), fatalism ("you'll never catch up"), false reassurance ("it'll be fine, don't worry").
- **Required rewrites:** "You're failing Geometry" → "Geometry is at 69 — 21 points to the mission. The two missing assignments are worth 8 of them." · "You bombed the test" → "The Unit 3 test came in at 55 — one event, not a trend. Here's the recovery order." · "Why didn't you do your homework?" → "Two assignments didn't get turned in this week — want to knock out the first one tonight?"
- Microcopy: short sentences; specific numbers over vague judgments; questions over verdicts. Strengths first, always; deficit language banned from child-facing copy.

---

## 5. Accessibility (non-negotiable)

- Contrast: body text `bark-100` on `canopy-800` ≈ 13:1. `bark-300` on `canopy-800` ≈ 7:1. `bark-500` is decorative/caption only — never body copy. No light-on-white anywhere (founder rule).
- Touch targets ≥ 44px. Focus: `focus-visible` ring = `0 0 0 3px rgb(74 222 128 / 0.5)` (halo ring, never default blue outline).
- `prefers-reduced-motion`: existing global rule stands — glows remain, movement stops.
- Grade info is never color-only: numeric + letter + words always accompany the band color.
- Screen-reader: GrowthRings get `aria-label` ("Geometry: 78 of the 90 goal"); firefly/particle decor is `aria-hidden`.

---

## 6. Implementation notes for engineering

1. **Tailwind v4** (`@import "tailwindcss"`): add all NEW tokens to `@theme` in `src/app/globals.css` — colors as `--color-{stem}-{step}`, shadows as `--shadow-{name}`, animations as `--animate-{name}`, type as `--text-{name}`. Existing tokens are already there; don't rename them.
2. **Shared primitives** → `src/components/ui/`: `living-card.tsx`, `mission-card.tsx`, `attention-card.tsx`, `growth-ring.tsx`, `sprout-meter.tsx`, `delta-line.tsx`, `buttons.tsx`, `sheet.tsx`, `banner.tsx`, `empty-state.tsx`, `skeleton.tsx`, `module-header.tsx`, `freshness-chip.tsx`, `child-switcher.tsx`, `command-bar.tsx`, `toast.tsx`.
3. **Grade bands:** extend `bandStyles` in `src/components/school/styles.ts` (or move to `src/components/ui/bands.ts`) with the gold/ember entries from §1.2; migrate the old `orange`/`red` usages — `red` band must not survive for grades.
4. **Copy helpers:** `gapCopy()` / `deltaCopy()` already exist — add `bandLeadCopy(band, gap)` from §1.2 and keep all user-facing grade strings flowing through them (single source for the copy law).
5. **Icons:** Lucide only. One sigil per module — record assignments in a `MODULE_SIGILS` map so Menu, headers, and search agree.
6. **The `.halo`, `.firefly`, `.light-rays`, `.ascend-particle` utilities already exist** — reuse for divine moments (Pookie orb, completion bursts, grove heroes). Don't rebuild them per module.

---

*End of spec. Open questions for the Design Lead gate review: (1) confirm the 5-tab nav + grove map against UX Researcher A's card-sort results; (2) confirm GrowthRing hero size (88px) vs. MissionCard inline ring (56px); (3) whether the child view gets its own Garden Hub variant or a filtered parent hub.*
