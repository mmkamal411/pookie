# 11 — Design Language

**Owner:** Senior Frontend Developer (Frontend component patterns) · **Status:** draft for pod review · **Date:** 2026-10-11
**Authority:** founder hard requirement / standing design standard (AGENTS.md, 2026-10-11).
**Applies to:** every surface of the Pookie app, no exceptions.
**Theme:** *nature and love* — organic, warm, nurturing. Sunlight through leaves,
not a tech dashboard.
**Divine light** (founder addition, 2026-10-11): soft glows with neon colors are
woven through every surface — God- and angel-like touches. Pookie is a ball of
light, an angel; the app should feel heavenly, protective, watched-over-with-love.
"Everywhere" means *presence*, not intensity: the glow is ambient and diffused
(§2 budgets still bind), like light you feel rather than stare at.

**Stack grounding:** Tailwind CSS v4 (`@theme` tokens in `src/app/theme.css`),
Next.js 16 App Router. Dark mode via `class="dark"` strategy; light mode is the
default. All values below are normative tokens, not suggestions.

---

## 1. Green token palette

### 1.1 The ramp (Tailwind v4 `@theme`)

```css
@theme {
  /* Deep forest → emerald → mint */
  --color-pine-950: #0b1f14;   /* near-black green: page bg (dark) */
  --color-pine-900: #12291a;   /* app chrome (dark), primary CTA bg */
  --color-pine-800: #1a3a24;   /* raised surfaces (dark) */
  --color-pine-700: #245231;   /* borders on dark, hover states */
  --color-moss-600: #2f6b3f;   /* primary actions on light, AA-safe */
  --color-leaf-500: #3f9153;   /* brand emerald: accents, charts */
  --color-leaf-400: #5cb877;   /* interactive highlights on dark */
  --color-mint-300: #93dcb0;   /* glow color, sparkle */
  --color-mint-200: #c4efd8;   /* secondary text on dark */
  --color-mint-100: #e3f8ec;   /* primary text on dark */
  --color-mint-50:  #f2fbf5;   /* page bg (light) */

  /* Sunlight — the "love" in nature-and-love. Sparing, deliberate. */
  --color-sun-300: #f5d98b;    /* mascot sparkle, celebration only */
  --color-sun-500: #e8b84b;    /* warning/attention (never error) */
}
```

Error/destructive keeps a muted botanical red (`--color-ember-500: #c0564d`)
so it reads as "fallen leaf," not alarm. Info uses deep water
(`--color-pond-500: #3d7a8c`). Both are supporting cast; green leads everywhere.

### 1.2 Semantic aliases

```css
@theme {
  --color-ink:      var(--color-pine-950);  /* body text on light */
  --color-ink-soft: var(--color-pine-800);  /* secondary text on light */
  --color-paper:    var(--color-mint-50);    /* page bg (light) */
  --color-surface:  #ffffff;                 /* cards on light */
  --color-primary:  var(--color-moss-600);   /* main actions on light */
  --color-accent:   var(--color-leaf-500);   /* highlights, active states */
  --color-success:  var(--color-leaf-500);
  --color-glow:     var(--color-mint-300);    /* the neon source color */
}
```

Dark mode remaps (same alias names, `dark:` variant or `.dark` overrides):
`--color-ink` → `mint-100`, `--color-paper` → `pine-950`,
`--color-surface` → `pine-900`, `--color-primary` → `leaf-400`.
**Components reference aliases only** (`bg-surface`, `text-ink`), never ramp
names directly — that is what makes the mode flip free.

### 1.3 Dark / light mappings

| Alias | Light | Dark |
|---|---|---|
| page bg (`paper`) | `mint-50` | `pine-950` |
| card (`surface`) | `#ffffff` | `pine-900` |
| primary text (`ink`) | `pine-950` | `mint-100` |
| secondary text | `pine-800` | `mint-200` |
| primary CTA bg | `moss-600` | `leaf-400` on `pine-900` |
| borders | `pine-700` at 15% | `mint-300` at 12% |

### 1.4 Contrast rules — WCAG AA minimum on every pairing

**Approved pairings (verified AA, do not re-check):**

| Foreground | Background | Use |
|---|---|---|
| `mint-100` | `pine-950` / `pine-900` | body text (dark) |
| `mint-200` | `pine-950` / `pine-900` | secondary text (dark) |
| `pine-950` | `mint-50` / `mint-100` | body text (light) |
| `pine-800` | `mint-50` | secondary text (light) |
| `#ffffff` | `moss-600` | primary button text (light) |
| `pine-950` | `leaf-400` | primary button text (dark) |
| `leaf-400` | `pine-950` | large text (≥18pt) / icons only (dark) |
| `moss-600` | `mint-50` | large text / icons only (light) |

**Rules:**
- Body text (< 18pt): 4.5:1 minimum. Only the first six rows qualify.
- `leaf-500` and `leaf-400` are **never body text** on any background — icons,
  large headings, and glow only.
- `sun-*` is never text. Ever.
- Any pairing not in this table must be checked with a contrast tool and added
  to the table in the same PR. "Looks fine" is not a contrast check.

---

## 2. Neon glow / shine / sparkle — subtle, never harsh

**Principle: diffused neon, never laser.** Glow reads as *light through leaves*:
soft, broad, low-opacity. If it has a hard edge, a thin radius, or pure
saturated color, it is wrong.

### 2.1 Where glow is allowed

- **Primary CTAs** — one soft halo at rest, slightly stronger on hover/active.
- **Active states** — the selected tab, the active child card in the switcher.
- **Pookie mascot moments** — greeting, celebration, streak milestones: Pookie
  renders as a soft ball of light (radial `mint-300`→transparent halo, gentle
  float). Sparkle particles in `mint-300` / `sun-300` suggest the angelic
  presence — protective, never startling.
- **Ambient divine light** — one soft, large, low-opacity radial wash per key
  screen (dashboard hero, login) in `mint-300` at ≤ 8% opacity, evoking
  watched-over-with-love. It is atmosphere, not a glowing object: no edges,
  no animation loop (static; gentle breathe only with user consent of motion,
  disabled under reduced motion).
- **Focus rings** — the accessible glow: 2px `leaf-400` outline at 60% + soft
  outer blur. This is the *only* glow allowed on form controls.

### 2.2 Intensity caps (budgets, not vibes)

```css
/* utilities in theme.css — the ONLY glow values permitted */
.glow-cta    { box-shadow: 0 0 24px 0 rgb(147 220 176 / 0.35); }
.glow-cta-hover { box-shadow: 0 0 32px 4px rgb(147 220 176 / 0.45); }
.glow-active { box-shadow: 0 0 20px 0 rgb(92 184 119 / 0.30); }
.glow-mascot { box-shadow: 0 0 40px 8px rgb(147 220 176 / 0.25); }
```

- Max blur radius: **40px** (mascot only). Max opacity: **0.45**.
- Glow color is always `mint-300`/`leaf-400` from the palette — never `#00ff00`,
  never white, never ad-hoc.
- One glowing element per viewport is the norm; two is the max. A screen full
  of halos is a screen with no hierarchy.

### 2.3 No-glow zones

- **Body text** — `text-shadow` is forbidden on all text. No exceptions.
- **Data tables, grade lists, dense UI** — glow creates visual noise where the
  user is trying to read numbers.
- **Form inputs** — focus ring only (§2.1). No glow on fill, no glow on error
  (error uses `ember-500` border + message).
- **Backgrounds** — no full-screen glow washes; atmosphere comes from the
  palette and gradients, not halos. The one exception is the single ambient
  divine-light wash per key screen (§2.1), which is static atmosphere, not glow.

### 2.4 Shine / sparkle

- **Shine:** a slow diagonal sheen sweep on primary CTAs only
  (`--anim-shine: 2.4s`, opacity ≤ 0.25, `linear-gradient` overlay). Max one
  shine sweep per 5 seconds per element; disabled under `prefers-reduced-motion`.
- **Sparkle:** tiny `mint-300`/`sun-300` particles reserved for mascot moments
  and celebrations. Cap: 12 particles, ≤ 1.2s lifetime, never on data screens,
  never looping indefinitely (max 3 iterations, then rest).

---

## 3. Animation standards

### 3.1 Performance budgets

- **60fps target.** Animated properties are restricted to `transform` and
  `opacity` — the compositor-only set. Animating `width`, `height`, `top`,
  `margin`, `box-shadow`, or `filter` in a transition is a defect.
  (The one exception: `box-shadow` may *transition* between the fixed utility
  values in §2.2 on CTA hover — 150ms, never keyframed.)
- No layout thrash: measure once, animate with transforms. Lists render with
  `content-visibility: auto` where long.
- `will-change` is opt-in per element and removed after the animation ends;
  never applied globally.

### 3.2 Duration / easing tokens

```css
@theme {
  --anim-instant: 0ms;
  --anim-fast: 120ms;   /* micro-interactions: press, toggle, checkbox */
  --anim-base: 200ms;   /* hovers, focus, small reveals */
  --anim-slow: 320ms;   /* page transitions, sheet slides */
  --anim-mascot: 600ms; /* mascot celebrate — the only slow animation */

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);      /* entrances */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);   /* state changes */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);/* playful pops (mascot, badges) */
}
```

No ad-hoc durations/easings. If a motion needs a value not here, add the token
with a name and a reason.

### 3.3 `prefers-reduced-motion` — mandatory

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

What this means in practice:
- **Disables entirely:** sparkle particles, shine sweeps, mascot idle bounce,
  parallax, skeleton shimmer (show a static placeholder), glow pulsing.
- **Degrades to instant:** page transitions, sheet/modal entrances, accordion
  expands — content appears, no travel.
- **Keeps:** opacity fades ≤ 120ms are acceptable but not required; when in
  doubt, instant wins.
- JS-driven animation must check `matchMedia('(prefers-reduced-motion: reduce)')`
  before starting. The CSS blanket rule above is the backstop, not the plan.

### 3.4 Restraint rules — what animates, what never does

**Animates:**
- Page/route transitions: fade + 8px rise, `--anim-slow` + `--ease-out`.
- Micro-interactions on key actions: CTA press (`scale(0.97)`, `--anim-fast`),
  toggles, checkboxes, tab selection.
- Mascot moments: the ball-of-light float (slow `translateY` ±6px, 4s loop —
  the *only* indefinite animation permitted) and celebrate
  (`--anim-mascot` + `--ease-spring`), capped.
- Skeletons: shimmer (opacity only), static under reduced motion.

**Never animates:**
- Data-dense lists: no stagger, no per-row entrances. Content appears.
- Anything during data entry: inputs, forms, steppers — no layout shift, no
  travel, no glow pulses while the user types.
- Numbers that update (grades, counts): crossfade at most; never count-up
  tickers on grades — a ticking grade reads as unstable.
- Navigation chrome: the tab bar and header do not bounce, slide, or shimmer.

---

## 4. Responsive / interaction requirements

### 4.1 Breakpoints (Tailwind defaults, mobile-first)

`sm:640` · `md:768` · `lg:1024` · `xl:1280` · `2xl:1536`.
Author base styles for the smallest viewport first; `md:`+ only *adds*.
The primary design target is the phone — Dawson's daily surface — with tablet
and desktop as progressive enhancement, never the other way around.

### 4.2 Touch targets

- Minimum **44×44px** for every tappable element (buttons, links, checkboxes,
  tab items, switcher cards' hit areas). This closes audit finding LOW-1.
- 8px minimum gap between adjacent targets.
- No hover-dependent interactions, anywhere: every `hover:` is paired with
  `active:` (tap feedback) and `focus-visible:` (keyboard). Hover is enhancement;
  `active` is the contract (audit finding MEDIUM-3).

### 4.3 Capacitor WebView implications

(Cross-reference: `docs/audit-findings/ui-fullstack-mobile.md`, findings
MEDIUM-2, MEDIUM-3, LOW-1.)

- **Safe-area insets:** `viewport-fit=cover` in the meta viewport; fixed chrome
  (tab bar, headers, FABs) pads with tokens:
  `--spacing-safe-top: env(safe-area-inset-top)` etc. Never hardcode notch padding.
- **Viewport units:** app shell and full-height screens use `dvh` (`h-dvh`,
  `min-h-dvh`), not `vh` — the URL bar show/hide jump is real on mobile browsers
  even though the Capacitor WebView itself has no URL bar.
- **No hover, no cursor:** assume touch-first in the WebView. Long-press is not
  a discoverable gesture — put destructive/advanced actions behind explicit
  buttons, not gestures.
- **Tap highlight:** `-webkit-tap-highlight-color: transparent` globally; our
  `active:` states replace it.
- **Performance:** the WebView is a thin client — keep JS bundles lean, prefer
  CSS animations over JS ones, and treat every animation token above as a
  battery budget too.

### 4.4 Offline / degraded-state visual language

- **Offline banner:** a slim `pine-800` bar under the header — "You're offline.
  Changes will sync when you reconnect." Never red; offline is a state, not an error.
- **Stale data:** desaturate to 60% + show "Updated {relative time}" under the
  section title. The user must always be able to tell live from cached.
- **Queued actions:** pending mutations show a sprout-seedling pending dot
  (`sun-500`) on the affected row with "waiting to sync" copy; they resolve
  into the normal success state on reconnect — no separate "synced!" fanfare.
- **Full degradation:** if a section can't load and has no cache, the themed
  `ErrorState` with retry (§5 of handbook 02) — never a blank screen, never a
  stack trace.

---

## 5. Enforcement — how this is enforced in code review

1. **Token-only colors.** No raw hex, `rgb()`, or arbitrary color values outside
   `theme.css`. In review: any `bg-[#…]`, `text-[#…]`, or `#[0-9a-f]{6}` in a
   component file is a blocking comment. (Tailwind v4 arbitrary values make this
   easy to sneak in — grep for it.)
2. **Glow utilities, not ad-hoc shadows.** `box-shadow` appears only via the
   `.glow-*` utilities in §2.2 or Tailwind's scale for neutral elevation
   (`shadow-sm`…`shadow-xl`). A custom `box-shadow` with a green tint that isn't
   a utility = blocking comment.
3. **Contrast table is the law.** New text/background pairings must be added to
   §1.4 with their ratio in the same PR. Screenshots are not contrast evidence.
4. **Reduced-motion check.** Every PR that adds or changes animation must state
   the reduced-motion behavior in the PR description. No statement = not approved.
5. **Touch-target audit.** New interactive elements must meet 44px; reviewers
   spot-check on a 360px viewport.
6. **Animation restraint.** Stagger on lists, animation during form entry, or
   count-up on grades = blocking comment, with a pointer to §3.4.
7. **Founder override path.** This standard is a founder hard requirement. Any
   exception (e.g., a one-off celebration moment that wants a bigger glow) needs
   the founder's explicit sign-off *in the PR*, and the exception is documented
   in the PR — never silently merged.

*End of section 11. Companion: handbook 02 (frontend patterns) for component
structure and tenant-context rules; `docs/audit-findings/ui-fullstack-mobile.md`
for the mobile findings this section closes.*
